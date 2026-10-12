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
   * Ожидаемый размер скачиваемого пакета из `RELEASES`, или ноль.
   *
   * Имя в `RELEASES` и имя файла на диске различаются хвостом: фид отдаёт
   * `-full.nupkg`, локально пакет лежит без него, а недокачанный файл
   * Squirrel подписывает суффиксом. Поэтому сравниваем префикс до расширения,
   * а живая мерка на бою показывает, какой именно суффикс встречается.
   */
  private totalFor(fileName: string): number {
    if (fileName === '') {
      return 0
    }

    const core = fileName.replace(/\.[^.]+$/, '').replace(/-full$/, '')

    for (const entry of this.releases) {
      const entryCore = entry.fileName
        .replace(/\.[^.]+$/, '')
        .replace(/-full$/, '')

      if (core.startsWith(entryCore) || entryCore.startsWith(core)) {
        return entry.length
      }
    }

    return 0
  }
}
