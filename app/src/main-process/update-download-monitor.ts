import * as Path from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import {
  IDownloadSample,
  IUpdateDownloadProgress,
  measureDownload,
} from '../lib/update-download-progress'

/**
 * Electron-овский `download-progress` Squirrel Windows не отдаёт: качает не
 * сам Electron, а `Update.exe`, который лежит снаружи процесса приложения.
 * Поэтому прогресс меряют по диску — единственный канал, где видно рост
 * пакета.
 */
const pollIntervalMs = 1000

/** Пять тиков усредняют скорость: одна пауза диска не обнуляет её. */
const rateWindowMs = 5000

/**
 * Каталог пакетов Squirrel Windows: приложение лежит в `app-<версия>`, а
 * `Update.exe` вместе с `packages` — на два уровня выше.
 *
 * Расчёт повторяет формулу из `squirrel-updater.ts` намеренно: общий импорт
 * оттуда потянул бы в это модуль win32-модули, которых на macOS и Linux нет.
 */
export function getPackagesDirectory(): string {
  const appFolder = Path.resolve(process.execPath, '..')
  return Path.resolve(appFolder, '..', 'packages')
}

interface IReleaseEntry {
  readonly fileName: string
  readonly length: number
}

/**
 * Ядро имени пакета: имя из `RELEASES` и имя файла на диске различаются только
 * хвостом - фид отдаёт `…-full.nupkg`, скачанный и применённый пакет лежит под
 * `…beta340409.nupkg`, а дельта сохраняет суффикс `-delta`.
 *
 * Сравниваем ядра на равенство, а не через `startsWith`: на живом списке фида
 * (12.10) префиксное сравнение давало две подмены - полный пакет `…-beta340411`
 * находился по записи дельты того же релиза (723 325 байт вместо 259 647 455), а
 * новая сборка `…-beta340410` - по записи прежней `…-beta3`, потому что номер
 * коммита дописан к той же базе.
 */
function packageCore(fileName: string): string {
  const lowered = fileName.toLowerCase()
  return lowered.replace(/\.[^.]+$/, '').replace(/-full$/, '')
}

/** Разбор `RELEASES`: строки вида «sha1 имя-пакета длина». */
function parseReleases(contents: string): ReadonlyArray<IReleaseEntry> {
  const entries = new Array<IReleaseEntry>()

  for (const line of contents.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 3) {
      continue
    }

    const length = Number.parseInt(parts[2], 10)
    if (Number.isFinite(length)) {
      entries.push({ fileName: parts[1], length })
    }
  }

  return entries
}

/**
 * Опрос каталога пакетов во время скачивания обновления.
 *
 * Монитор живёт между `update-available` и `update-downloaded`, то есть ровно
 * тогда, когда renderer показывает состояние `UpdateAvailable`.
 */
export class UpdateDownloadMonitor {
  private timer: NodeJS.Timeout | null = null
  private samples = new Array<IDownloadSample>()
  private baseline = new Set<string>()
  private releases: ReadonlyArray<IReleaseEntry> = []
  private ticking = false

  public constructor(
    private readonly packagesDir: string,
    private readonly onProgress: (progress: IUpdateDownloadProgress) => void
  ) {}

  /**
   * Снимает список файлов и `RELEASES` до первого тика: всё, чего в этом
   * списке не окажется, и есть скачивание.
   */
  public async start(): Promise<void> {
    this.stop()
    this.samples = []

    try {
      this.baseline = new Set(await readdir(this.packagesDir))
      this.releases = parseReleases(
        await readFile(Path.join(this.packagesDir, 'RELEASES'), 'utf8')
      )
    } catch {
      // Каталога ещё нет (portable-сборка) или `RELEASES` не прочитался:
      // прогресс остаётся без процентов, но скорость считать можно.
      this.baseline = new Set()
      this.releases = []
    }

    this.timer = setInterval(() => this.tick(), pollIntervalMs)
    await this.tick()
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Заменяет таблицу размеров содержимым `RELEASES` с фида.
   *
   * Нужен именно фид, а не локальный файл: `packages\RELEASES` в момент докачки
   * описывает ПРЕЖНЮЮ сборку. Squirrel перегенерирует локальный список только
   * после установки пакета в `app-<версия>` - `updateLocalReleasesFile()` стоит
   * на строке 52 `src/Squirrel/UpdateManager.ApplyReleases.cs`, сразу за
   * `installPackageToAppDir`, и зовёт `ReleaseEntry.BuildReleasesFile` (строка
   * 245 `src/Squirrel/ReleaseEntry.cs`), - а всё это наступает уже после того,
   * как файл докачан. Скачиваемый пакет в локальном списке поэтому быть не
   * может, и без фида процент либо не считается вовсе, либо считается от размера
   * прошлой сборки. Оба файла - внешнего `Squirrel/Squirrel.Windows` (коммит
   * `615753b4`), в этом дереве их нет.
   *
   * Пустой текст, как и тот, что не даёт ни одной записи, ничего не меняет: при
   * недоступном фиде строка остаётся с локальным списком, как и до этой правки.
   */
  public setFeedReleases(contents: string): void {
    const entries = parseReleases(contents)
    if (entries.length > 0) {
      this.releases = entries
    }
  }

  private async tick(): Promise<void> {
    // Медленный диск может не успеть между тиками; накладывающийся опрос
    // показал бы двойной прирост байт.
    if (this.ticking || this.timer === null) {
      return
    }

    this.ticking = true

    try {
      const names = await readdir(this.packagesDir)

      let downloadedBytes = 0
      let activeFile = ''
      let activeSize = -1

      for (const name of names) {
        if (this.baseline.has(name)) {
          continue
        }

        const info = await stat(Path.join(this.packagesDir, name))
        if (!info.isFile()) {
          continue
        }

        downloadedBytes += info.size
        if (info.size > activeSize) {
          activeSize = info.size
          activeFile = name
        }
      }

      const at = Date.now()
      this.samples.push({ at, bytes: downloadedBytes })

      // Окно держим с запасом в два раза: иначе первое измерение после паузы
      // не из чего было бы строить.
      const cutoff = at - rateWindowMs * 2
      while (this.samples.length > 2 && this.samples[0].at < cutoff) {
        this.samples.shift()
      }

      const totalBytes = this.totalFor(activeFile)
      const rate = measureDownload(this.samples, rateWindowMs)

      this.onProgress({
        downloadedBytes,
        totalBytes,
        percent:
          totalBytes > 0
            ? Math.min(100, (downloadedBytes / totalBytes) * 100)
            : null,
        bytesPerSecond: rate?.bytesPerSecond ?? null,
      })
    } catch {
      // Каталог исчез, пока Squirrel переставлял пакет: тик пропускаем,
      // следующий придёт по своему таймеру.
    } finally {
      this.ticking = false
    }
  }

  /**
   * Ожидаемый размер скачиваемого пакета, или ноль.
   *
   * Суффиксы различаются: фид отдаёт `…-full.nupkg`, применённый пакет лежит без
   * него, а дельта сохраняет `-delta` - у полного и дельта-пакета одного релиза
   * размеры разные, и смешивать их нельзя.
   */
  private totalFor(fileName: string): number {
    const core = packageCore(fileName)
    if (core === '') {
      return 0
    }

    for (const entry of this.releases) {
      if (packageCore(entry.fileName) === core) {
        return entry.length
      }
    }

    return 0
  }
}

/**
 * Текст `RELEASES` с фида обновлений, или `null`.
 *
 * Единственный источник, где размер скачиваемого пакета объявлен до того, как
 * пакет применён: локальный список появляется только на применении, см.
 * `setFeedReleases`. Живая мерка 12.10: `GET` по фиду
 * `…/releases/download/latest-win-x64/RELEASES` отдаёт 200 и 483 байта с пятью
 * строками, где у `…-beta340411-full.nupkg` размер 259647455, а у
 * `…-beta340411-delta.nupkg` - 723325.
 *
 * Запрос повторяет то, как имя файла к фиду добавляет сам Squirrel:
 * `Utility.AppendPathToUri` (`src/Squirrel/Utility.cs:473-482` внешнего
 * `Squirrel/Squirrel.Windows`, коммит `615753b4`) дописывает слэш, если его нет,
 * и правит только `Path`, оставляя query нетронутым. В URL проверки обновлений
 * query - `guid` ступенчатой выдачи, живой вид фида:
 * `…/releases/download/latest-win-x64/?guid=a1337ada-…`.
 */
export async function fetchFeedReleases(
  feedUrl: string
): Promise<string | null> {
  try {
    const url = new URL(feedUrl)
    if (!url.pathname.endsWith('/')) {
      url.pathname += '/'
    }
    url.pathname += 'RELEASES'

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    })

    return response.ok ? await response.text() : null
  } catch {
    // Фида нет - офлайн, прокси, portable-сборка: строка остаётся с локальным
    // списком, то есть без процентов, но со скоростью.
    return null
  }
}
