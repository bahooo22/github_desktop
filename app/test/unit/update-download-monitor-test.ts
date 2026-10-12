import assert from 'node:assert'
import { describe, it, TestContext } from 'node:test'
import { mkdir, truncate, writeFile } from 'fs/promises'
import { join } from 'path'

import { UpdateDownloadMonitor } from '../../src/main-process/update-download-monitor'
import { IUpdateDownloadProgress } from '../../src/lib/update-download-progress'
import { createTempDirectory } from '../helpers/temp'

/**
 * Строка `RELEASES` и имена пакетов взяты из живого каталога установленного
 * форка (`%LocalAppData%\GitHubDesktopL10n\packages`), снятого 12.10: фид
 * отдаёт пакет с суффиксом `-full`, а в списке он лежит без него. Именно эту
 * разницу и проверяют тесты — на выдуманных именах она бы не всплыла.
 */
const releaseEntry =
  '36DCE9343323DAF18C9DE18F5228679ADB2A9486 GitHubDesktopL10n-3.6.7-beta340409.nupkg 266852527'
const packageSize = 266852527
const fullPackage = 'GitHubDesktopL10n-3.6.7-beta340409-full.nupkg'

/**
 * `RELEASES` фида целиком, снятый 12.10 запросом по
 * `…/releases/download/latest-win-x64/RELEASES` (HTTP 200, 483 байта). Здесь
 * есть и `-full`, и `-delta` одного релиза с разными размерами - как раз то,
 * чего в локальном списке во время докачки быть не может.
 */
const feedReleases =
  '74B77884B26B659D2111E5FEFEB56BD963D4D3A0 GitHubDesktopL10n-3.6.7-beta340399-full.nupkg 259642023\n' +
  'AC48AACC488F0A4AE5F26224F1D5A5D25F90C8F0 GitHubDesktopL10n-3.6.7-beta340409-delta.nupkg 545186\n' +
  'F67C86CE49D120ABBF65511421427F3C271FCD9C GitHubDesktopL10n-3.6.7-beta340409-full.nupkg 259642701\n' +
  '8D7123410C4D534DFC20DE8BE5079549714FA540 GitHubDesktopL10n-3.6.7-beta340411-delta.nupkg 723325\n' +
  '65FE2FA2B809D091F44CC3327EC1C40865051C99 GitHubDesktopL10n-3.6.7-beta340411-full.nupkg 259647455\n'
const feedFullPackage = 'GitHubDesktopL10n-3.6.7-beta340411-full.nupkg'
const feedFullSize = 259647455
const feedDeltaPackage = 'GitHubDesktopL10n-3.6.7-beta340411-delta.nupkg'
const feedDeltaSize = 723325

// Размер на диске — целое число байт, доли пакета считаем сразу округлённо.
const tenthOfPackage = Math.floor(packageSize / 10)
const halfOfPackage = Math.floor(packageSize / 2)

async function makePackagesDir(
  t: TestContext,
  releases: boolean,
  entry: string = releaseEntry
): Promise<string> {
  const root = await createTempDirectory(t)
  const dir = join(root, 'packages')
  await mkdir(dir)

  if (releases) {
    await writeFile(join(dir, 'RELEASES'), `${entry}\n`, 'utf8')
  }

  return dir
}

/** Файл нужного размера без записи самих байт (`truncate` чужого пути не создаёт). */
async function grow(path: string, bytes: number): Promise<void> {
  await writeFile(path, '')
  await truncate(path, bytes)
}

/**
 * Монитор отдаёт отсчёт раз в секунду, поэтому ждём именно их количество, а не
 * время: на медленном диске тик опаздывает, и проверка по часам ловила бы
 * ложное падение.
 */
async function waitForReports(
  reports: ReadonlyArray<IUpdateDownloadProgress>,
  count: number
): Promise<IUpdateDownloadProgress> {
  const deadline = Date.now() + 15000

  while (reports.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`expected ${count} reports, got ${reports.length}`)
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }

  return reports[reports.length - 1]
}

function startMonitor(packagesDir: string) {
  const reports = new Array<IUpdateDownloadProgress>()
  const monitor = new UpdateDownloadMonitor(packagesDir, p => reports.push(p))

  return { monitor, reports }
}

describe('update download monitor', () => {
  it('knows the whole size of the package behind the -full suffix', async t => {
    const packagesDir = await makePackagesDir(t, true)
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      // Всё, чего нет в списке до первого тика, считается скачиванием, поэтому
      // пакет появляется в каталоге уже после запуска монитора.
      await monitor.start()
      await grow(join(packagesDir, fullPackage), tenthOfPackage)

      const progress = await waitForReports(reports, 2)

      assert.equal(progress.downloadedBytes, tenthOfPackage)
      assert.equal(progress.totalBytes, packageSize)
      assert.ok(
        Math.abs(progress.percent! - 10) < 0.01,
        `percent: ${progress.percent}`
      )
    } finally {
      monitor.stop()
    }
  })

  it('leaves the percent away for a package RELEASES does not describe', async t => {
    const packagesDir = await makePackagesDir(t, true)
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()

      // Пока `RELEASES` фида не прочитан, нового пакета в локальном списке нет:
      // процент был бы выдумкой, а скачанные байты и скорость - правда.
      await grow(
        join(packagesDir, 'GitHubDesktopL10n-3.6.7-beta340410-delta.nupkg'),
        545186
      )

      const progress = await waitForReports(reports, 2)

      assert.equal(progress.downloadedBytes, 545186)
      assert.equal(progress.totalBytes, 0)
      assert.equal(progress.percent, null)
    } finally {
      monitor.stop()
    }
  })

  it('reports the speed once the file has grown twice', async t => {
    const packagesDir = await makePackagesDir(t, true)
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()
      await grow(join(packagesDir, fullPackage), tenthOfPackage)
      await waitForReports(reports, 2)

      await grow(join(packagesDir, fullPackage), halfOfPackage)
      const progress = await waitForReports(reports, 3)

      assert.equal(progress.downloadedBytes, halfOfPackage)

      // За секунду между тиками файл вырос на десятую часть пакета, то есть на
      // 26 мегабайт; нижняя граница заведомо ниже, чтобы проверка не зависела от
      // скорости диска.
      assert.ok(
        progress.bytesPerSecond !== null &&
          progress.bytesPerSecond > 1024 * 1024,
        `speed: ${progress.bytesPerSecond}`
      )
    } finally {
      monitor.stop()
    }
  })

  it('counts nothing that was already in the directory', async t => {
    const packagesDir = await makePackagesDir(t, true)

    // Установленный пакет: он лежит в каталоге до запуска монитора.
    await grow(join(packagesDir, fullPackage), packageSize)

    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()

      assert.equal(reports.length, 1)
      assert.equal(reports[0].downloadedBytes, 0)
      assert.equal(reports[0].percent, null)
      assert.equal(reports[0].bytesPerSecond, null)
    } finally {
      monitor.stop()
    }
  })

  it('still counts bytes when there is no RELEASES to read', async t => {
    // Portable-сборка: каталога пакетов рядом с приложением нет вовсе.
    const packagesDir = await makePackagesDir(t, false)
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()
      await grow(join(packagesDir, fullPackage), 1024 * 1024)

      const progress = await waitForReports(reports, 2)

      assert.equal(progress.downloadedBytes, 1024 * 1024)
      assert.equal(progress.totalBytes, 0)
      assert.equal(progress.percent, null)
    } finally {
      monitor.stop()
    }
  })

  it('does not borrow the size of a previous build sharing the prefix', async t => {
    // Номер коммита дописан к той же базе, что и прежняя публикаемая версия:
    // `3.6.7-beta3` и `3.6.7-beta340411`. Сравнение по префиксу на этом попадало
    // в пакет прошлой сборки и считало процент от чужого размера.
    const packagesDir = await makePackagesDir(
      t,
      true,
      'A9B2C3D4E5F60718293A4B5C6D7E8F9012345678 GitHubDesktopL10n-3.6.7-beta3.nupkg 266852527'
    )
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()
      await grow(join(packagesDir, feedFullPackage), 1024 * 1024)

      const progress = await waitForReports(reports, 2)

      assert.equal(progress.totalBytes, 0)
      assert.equal(progress.percent, null)
    } finally {
      monitor.stop()
    }
  })

  it('takes the size of the downloading package from the feed', async t => {
    const packagesDir = await makePackagesDir(t, true)
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()
      // Фид отвечает после первого тика: таблица размеров заменяется живой.
      monitor.setFeedReleases(feedReleases)
      await grow(
        join(packagesDir, feedFullPackage),
        Math.floor(feedFullSize / 4)
      )

      const progress = await waitForReports(reports, 2)

      assert.equal(progress.totalBytes, feedFullSize)
      assert.ok(
        Math.abs(progress.percent! - 25) < 0.01,
        `percent: ${progress.percent}`
      )
    } finally {
      monitor.stop()
    }
  })

  it('keeps the delta package at its own size, not the full one', async t => {
    const packagesDir = await makePackagesDir(t, true)
    const { monitor, reports } = startMonitor(packagesDir)

    try {
      await monitor.start()
      monitor.setFeedReleases(feedReleases)
      await grow(
        join(packagesDir, feedDeltaPackage),
        Math.floor(feedDeltaSize / 2)
      )

      const progress = await waitForReports(reports, 2)

      // У того же релиза в списке лежит и полный пакет (259 647 455 байт):
      // процент от него показал бы 0,14 вместо половины дельты.
      assert.equal(progress.totalBytes, feedDeltaSize)
      assert.ok(
        Math.abs(progress.percent! - 50) < 0.01,
        `percent: ${progress.percent}`
      )
    } finally {
      monitor.stop()
    }
  })
})
