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

// Размер на диске — целое число байт, доли пакета считаем сразу округлённо.
const tenthOfPackage = Math.floor(packageSize / 10)
const halfOfPackage = Math.floor(packageSize / 2)

async function makePackagesDir(
  t: TestContext,
  releases: boolean
): Promise<string> {
  const root = await createTempDirectory(t)
  const dir = join(root, 'packages')
  await mkdir(dir)

  if (releases) {
    await writeFile(join(dir, 'RELEASES'), `${releaseEntry}\n`, 'utf8')
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

      // Дельта следующего релиза: её в `RELEASES` нет, и процент был бы выдумкой.
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
})
