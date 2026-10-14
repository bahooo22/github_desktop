import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import { About } from '../../src/ui/about/about'
import { IUpdateState, UpdateStatus } from '../../src/ui/lib/update-store'
import { getVersion } from '../../src/ui/lib/app-proxy'
import { formatBytes } from '../../src/ui/lib/bytes'
import {
  buildFeedbackIssueUrl,
  TranslationIssueLabel,
} from '../../src/ui/localization/translation-issue'
import { localization, t } from '../../src/lib/l10n'
import { formatDate } from '../../src/lib/format-date'
import { render, waitFor } from '../helpers/ui/render'

const cacheKey = 'upstream-changelog-check'
const indicatorSelector = '[data-l10n-key="about.upstream-behind"]'
const creditSelector = '[data-l10n-key="about.l10nCredit"]'

function seedCache(upstreamVersions: ReadonlyArray<string>) {
  localStorage.setItem(
    cacheKey,
    JSON.stringify({ checkedAt: Date.now(), upstreamVersions })
  )
}

async function flushAsyncWork() {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

function renderAbout(
  updateState: Partial<IUpdateState> = {},
  allowDevelopment: boolean = false
) {
  return render(
    <About
      onDismissed={() => {}}
      applicationName="GitHub Desktop"
      applicationVersion="3.6.7-beta2"
      applicationArchitecture="x64"
      onCheckForNonStaggeredUpdates={() => {}}
      onShowAcknowledgements={() => {}}
      onShowTermsAndConditions={() => {}}
      onQuitAndInstall={() => {}}
      allowDevelopment={allowDevelopment}
      updateState={{
        status: UpdateStatus.UpdateNotChecked,
        lastSuccessfulCheck: null,
        isX64ToARM64ImmediateAutoUpdate: false,
        newReleases: null,
        prioritizeUpdate: false,
        prioritizeUpdateInfoUrl: undefined,
        downloadProgress: null,
        ...updateState,
      }}
    />
  )
}

describe('about - upstream indicator', () => {
  let restoreIpcSend: (() => void) | null = null

  beforeEach(() => {
    localStorage.removeItem(cacheKey)

    // The dialog pings the main process when it opens; the test mock has no
    // `send`.
    const previousSend = ipcRenderer.send as any
    ipcRenderer.send = () => {}
    restoreIpcSend = () => {
      ipcRenderer.send = previousSend
    }
  })

  afterEach(() => {
    restoreIpcSend?.()
    restoreIpcSend = null
    localStorage.removeItem(cacheKey)
  })

  it('shows how far behind the cached upstream release is', async () => {
    seedCache(['99999.0.0'])

    const view = renderAbout()

    await waitFor(() => assert.ok(document.querySelector(indicatorSelector)))

    const indicator = document.querySelector(indicatorSelector)!
    assert.ok(indicator.textContent!.includes('99999.0.0'))
    // One release behind must read as one, not as "1 releases".
    assert.ok(indicator.textContent!.includes('1 release behind'))
    assert.ok(!indicator.textContent!.includes('releases behind'))

    const link = indicator.querySelector('a')!
    assert.equal(
      link.getAttribute('href'),
      'https://desktop.github.com/release-notes/'
    )

    view.unmount()
  })

  it('counts every cached upstream release the build is behind', async () => {
    seedCache(['99999.0.0', '99998.0.0'])

    const view = renderAbout()

    await waitFor(() => assert.ok(document.querySelector(indicatorSelector)))

    const indicator = document.querySelector(indicatorSelector)!
    assert.ok(indicator.textContent!.includes('2 releases behind'))

    view.unmount()
  })

  it('stays silent when the cached check says nothing is behind', async () => {
    seedCache([getVersion()])

    const view = renderAbout()
    await flushAsyncWork()

    assert.equal(document.querySelector(indicatorSelector), null)

    view.unmount()
  })

  it('stays silent when the changelog cannot be reached', async () => {
    const originalFetch = globalThis.fetch as any
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as any

    try {
      const view = renderAbout()
      await flushAsyncWork()

      assert.equal(document.querySelector(indicatorSelector), null)

      view.unmount()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

/**
 * The dialog pings the main process when it opens and the test mock has no
 * `send`.
 */
function mockIpcSend(): () => void {
  const previousSend = ipcRenderer.send as any
  ipcRenderer.send = () => {}

  return () => {
    ipcRenderer.send = previousSend
  }
}

describe('about - the translation credit line', () => {
  let restoreIpcSend: (() => void) | null = null

  beforeEach(() => {
    restoreIpcSend = mockIpcSend()

    // A cached check that says nothing is behind: without it the dialog would
    // reach central.github.com from a unit test.
    seedCache([getVersion()])

    // The credit line only exists for a language that credits its translator,
    // which the built-in catalogs do for Russian and Ukrainian only.
    localization.setRequestedLocale('ru')
  })

  afterEach(() => {
    restoreIpcSend?.()
    restoreIpcSend = null
    localization.setRequestedLocale(null)
    localStorage.removeItem(cacheKey)
  })

  it('sends the build number straight into the translation report', () => {
    const view = renderAbout()

    const credit = document.querySelector(creditSelector)
    assert.ok(credit !== null, 'a credited language shows the credit line')

    const links = credit.querySelectorAll('a')
    assert.equal(links.length, 2)
    assert.equal(links[0].getAttribute('href'), 'https://github.com/bahooo22/')

    const sha = links[1]
    assert.equal(sha.textContent, __SHA__.substring(0, 10))

    const href = sha.getAttribute('href')!
    assert.equal(
      href,
      buildFeedbackIssueUrl({ target: 'ru', search: '' }),
      'the very report the translation editor offers for this language'
    )

    const params = new URL(href).searchParams
    assert.equal(params.get('labels'), TranslationIssueLabel)
    assert.equal(
      params.get('title'),
      t('localizationEditor.reportIssueTitle', { tag: 'ru' })
    )

    view.unmount()
  })

  it('does not repeat the report as a separate line at the bottom', () => {
    const view = renderAbout()

    const bottomLinks = [
      ...document.querySelectorAll('.terms-and-license-container a'),
    ].map(a => a.textContent)

    assert.deepEqual(bottomLinks, [
      t('about.terms-and-conditions'),
      t('about.license-notices'),
      t('about.responsible-use-copilot'),
    ])

    view.unmount()
  })
})

const forkCacheKey = 'fork-release-check'
const forkReleaseSelector = '[data-l10n-key="about.forkRelease"]'

const releaseSha = 'df4b3a9c1e7f52a8d6c0b4f9a3e1c7d5b9f2a8c6'
const releasePageUrl =
  'https://github.com/bahooo22/github_desktop/releases/tag/latest-win-x64'

/**
 * A cached check is the only way to reach this line from a unit test: the feed
 * URL is empty in `globals.mts`, which switches the whole check off, and the
 * tests must not reach api.github.com either.
 *
 * The entry has to carry the commit that wrote it: `isCacheUsable` in
 * `fork-release.ts` drops anything whose `checkedSha` is not the running build,
 * which is how the stale banner of an already-installed release was fixed.
 */
function seedForkCache(status: object | null) {
  localStorage.setItem(
    forkCacheKey,
    JSON.stringify({
      checkedAt: Date.now(),
      checkedSha: __SHA__,
      status,
    })
  )
}

function seedForkStatus(aheadBy: number) {
  seedForkCache({
    releaseSha,
    aheadBy,
    releasePageUrl,
    version: '3.7.0',
    builtAt: '2026-10-05T12:00:00.000Z',
  })
}

describe('about - the fork release line', () => {
  let restoreIpcSend: (() => void) | null = null
  let restoreFeedUrl: (() => void) | null = null

  beforeEach(() => {
    restoreIpcSend = mockIpcSend()

    // The upstream line would otherwise reach desktop.github.com, and this
    // suite is only about the fork's own release.
    seedCache([getVersion()])

    const previous = (globalThis as any).__FORK_FEED_URL__
    ;(globalThis as any).__FORK_FEED_URL__ =
      'https://api.github.com/repos/bahooo22/github_desktop/releases/tags/latest-win-x64'
    restoreFeedUrl = () => {
      ;(globalThis as any).__FORK_FEED_URL__ = previous
    }
  })

  afterEach(() => {
    restoreIpcSend?.()
    restoreIpcSend = null
    restoreFeedUrl?.()
    restoreFeedUrl = null
    localStorage.removeItem(forkCacheKey)
  })

  it('names the newer build, its commit and where to get it', async () => {
    seedForkStatus(1)

    const view = renderAbout()

    await waitFor(() => assert.ok(document.querySelector(forkReleaseSelector)))

    const line = document.querySelector(forkReleaseSelector)!
    const text = line.textContent!

    assert.ok(text.includes(releaseSha.substring(0, 10)), text)
    assert.ok(
      text.includes(
        formatDate(new Date('2026-10-05T12:00:00.000Z'), { dateStyle: 'long' })
      ),
      text
    )
    // One commit must read as one commit, not "1 commits".
    assert.ok(text.includes('1 commit ahead'), text)
    assert.ok(!text.includes('commits ahead'), text)

    assert.equal(line.querySelector('a')!.getAttribute('href'), releasePageUrl)

    view.unmount()
  })

  it('counts every commit the release carries on top of this build', async () => {
    seedForkStatus(4)

    const view = renderAbout()

    await waitFor(() => assert.ok(document.querySelector(forkReleaseSelector)))

    assert.ok(
      document
        .querySelector(forkReleaseSelector)!
        .textContent!.includes('4 commits ahead')
    )

    view.unmount()
  })

  it('stays silent when the cached check found nothing to offer', async () => {
    seedForkCache(null)

    const view = renderAbout()
    await flushAsyncWork()

    assert.equal(document.querySelector(forkReleaseSelector), null)

    view.unmount()
  })

  it('stays silent when the feed cannot be reached', async () => {
    localStorage.removeItem(forkCacheKey)

    const originalFetch = globalThis.fetch as any
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as any

    try {
      const view = renderAbout()
      await flushAsyncWork()

      assert.equal(document.querySelector(forkReleaseSelector), null)

      view.unmount()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('ignores a cached entry from a build that wrote different fields', async () => {
    seedForkCache({ releaseSha: 'df4b3a9' })

    const originalFetch = globalThis.fetch as any
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as any

    try {
      const view = renderAbout()
      await flushAsyncWork()

      assert.equal(document.querySelector(forkReleaseSelector), null)

      view.unmount()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

const statusSelector = '.update-status'
const progressSelector = '.update-status p'
const ariaSelector = '.update-status .sr-only'

const MiB = 1024 * 1024

/**
 * Скачивание обновления.
 *
 * Строка обновляется раз в секунду, поэтому её цифры идут только в визуальную
 * часть, а в `aria-live` остаётся постоянная фраза — иначе программа чтения
 * экрана повторяла бы её каждую секунду.
 */
describe('about - the download progress line', () => {
  let restoreIpcSend: (() => void) | null = null
  let restoreLinux: (() => void) | null = null
  let view: ReturnType<typeof render> | null = null

  beforeEach(() => {
    restoreIpcSend = mockIpcSend()

    // `renderUpdateDetails` на Linux возвращает null, и тогда строки вовсе нет в
    // DOM. Глобальную константу подменяют и другие тесты этого репозитория, так
    // что проверка снимается с платформы, а не пропускается на ней.
    const previous = (globalThis as any).__LINUX__
    ;(globalThis as any).__LINUX__ = false
    restoreLinux = () => {
      ;(globalThis as any).__LINUX__ = previous
    }

    // Без этого диалог пошёл бы на central.github.com за апстримным changelog.
    seedCache([getVersion()])
  })

  afterEach(() => {
    view?.unmount()
    view = null
    restoreIpcSend?.()
    restoreIpcSend = null
    restoreLinux?.()
    restoreLinux = null
    localStorage.removeItem(cacheKey)
  })

  function renderProgress(
    downloadProgress: IUpdateState['downloadProgress']
  ): Element {
    view = renderAbout(
      {
        status: UpdateStatus.UpdateAvailable,
        lastSuccessfulCheck: new Date(),
        downloadProgress,
      },
      // В тестовой сборке канал development, и без этого флага диалог показывает
      // строку «обновления недоступны в dev», а не статус загрузки.
      true
    )

    const status = document.querySelector(statusSelector)
    assert.ok(status !== null, 'the update line renders')
    return status
  }

  it('states the percent, both sizes and the speed', () => {
    const progress = renderProgress({
      downloadedBytes: 700 * MiB,
      totalBytes: 2078 * MiB,
      percent: 33.7,
      bytesPerSecond: 4 * MiB,
    })

    const text = progress.querySelector(progressSelector)!.textContent!

    // Дробный процент округлён, а не выведен всеми цифрами.
    assert.ok(text.includes('34%'), text)
    assert.ok(!text.includes('33.7'), text)

    // Размеры в тех же IEC-единицах, что и всё приложение, а не голые байты.
    assert.ok(text.includes(formatBytes(700 * MiB, 1)), text)
    assert.ok(text.includes(formatBytes(2078 * MiB, 0)), text)
    assert.ok(text.includes(formatBytes(4 * MiB, 1)), text)
    assert.ok(!text.includes(`${700 * MiB}`), text)
  })

  it('drops the percent when the package size is unknown', () => {
    const progress = renderProgress({
      downloadedBytes: 12 * MiB,
      totalBytes: 0,
      percent: null,
      bytesPerSecond: MiB,
    })

    const text = progress.querySelector(progressSelector)!.textContent!

    // Дельта-пакета нет в `RELEASES`, поэтому процент был бы выдумкой;
    // скачанные байты при этом остаются.
    assert.ok(
      text.includes(
        t('about.downloadingSize', { downloaded: formatBytes(12 * MiB, 1) })
      ),
      text
    )
    assert.ok(!text.includes('%'), text)
  })

  it('drops the speed until there are enough reports', () => {
    const progress = renderProgress({
      downloadedBytes: 300 * MiB,
      totalBytes: 600 * MiB,
      percent: 50,
      bytesPerSecond: null,
    })

    const text = progress.querySelector(progressSelector)!.textContent!

    assert.ok(text.includes(formatBytes(300 * MiB, 1)), text)
    assert.ok(text.includes(formatBytes(600 * MiB, 0)), text)
    assert.ok(text.includes('50%'), text)

    // Скорости нет целиком: ни числа, ни единицы измерения.
    assert.ok(!text.includes('/s'), text)
    assert.equal(text.split(' · ').length, 2, text)
  })

  it('keeps the plain line while the download has no reports yet', () => {
    const progress = renderProgress(null)

    // Без отсчётов остаётся обычная строка: ни разделителей, ни цифр.
    assert.equal(progress.querySelector(progressSelector), null)
    assert.ok(!progress.textContent!.includes('·'), progress.textContent!)
  })

  it('keeps the numbers out of the screen reader announcement', () => {
    const progress = renderProgress({
      downloadedBytes: 700 * MiB,
      totalBytes: 2078 * MiB,
      percent: 33.7,
      bytesPerSecond: 4 * MiB,
    })

    const announcement = progress.querySelector(ariaSelector)!.textContent!

    assert.equal(announcement, t('about.downloading'))
    assert.ok(!/\d/.test(announcement), announcement)
  })
})

const firstRunKey = 'first-run-of-build'
const SECOND = 1000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * Обе строки статуса диалога в порядке вывода: сначала возраст последней
 * проверки, потом возраст сборки. Первая обязана оставаться единственной, что
 * матчится под `statusSelector`, — на этом селекторе держится апстримный
 * e2e-локатор `#about .update-status` (`app/test/e2e/app-launch.e2e.ts:310`).
 */
const statusRowsSelector = '.update-status, .first-run-status'
const firstRunStatusSelector = '.first-run-status'

/**
 * Вторая строка статуса: возраст самой сборки.
 *
 * Единственная дата, которую держит апстримный апдейтер, — возраст последней
 * удачной проверки, и её обнуляет каждая автопроверка. Поэтому возраст сборки
 * считается по коммиту сборки (`__SHA__`), а не по статусу обновлений, и в
 * `aria-live` идёт абсолютная дата: относительную форму счётчик меняет тиком, и
 * скринридер повторял бы её снова и снова.
 */
describe('about - the build age line', () => {
  let restoreIpcSend: (() => void) | null = null
  let restoreLinux: (() => void) | null = null
  let view: ReturnType<typeof render> | null = null

  function seedFirstRun(ageMs: number) {
    localStorage.setItem(
      firstRunKey,
      JSON.stringify({ sha: __SHA__, firstRunAt: Date.now() - ageMs })
    )
  }

  beforeEach(() => {
    restoreIpcSend = mockIpcSend()

    const previous = (globalThis as any).__LINUX__
    ;(globalThis as any).__LINUX__ = false
    restoreLinux = () => {
      ;(globalThis as any).__LINUX__ = previous
    }

    seedCache([getVersion()])
    localization.setRequestedLocale('ru')

    // Десять суток — это ровно «1 неделю назад» на недельной шкале.
    seedFirstRun(10 * DAY)
  })

  afterEach(() => {
    view?.unmount()
    view = null
    restoreIpcSend?.()
    restoreIpcSend = null
    restoreLinux?.()
    restoreLinux = null
    localization.setRequestedLocale(null)
    localStorage.removeItem(cacheKey)
    localStorage.removeItem(firstRunKey)
  })

  function renderUpToDate(lastSuccessfulCheck: Date) {
    view = renderAbout(
      {
        status: UpdateStatus.UpdateNotAvailable,
        lastSuccessfulCheck,
      },
      true
    )

    return [...document.querySelectorAll(statusRowsSelector)]
  }

  it('shows the age of this build next to the age of the last check', () => {
    const statuses = renderUpToDate(new Date(Date.now() - 2 * HOUR))

    assert.equal(statuses.length, 2, 'две строки статуса')
    const buildLine = statuses[1].textContent!
    assert.ok(
      buildLine.includes(
        t('about.firstRunOfBuild-rich').replace('<time />', '').trim()
      ),
      `подпись сборки на языке интерфейса: ${buildLine}`
    )
    assert.ok(buildLine.includes('1 неделю назад'), buildLine)
  })

  it('announces an absolute date instead of a ticking number', () => {
    const statuses = renderUpToDate(new Date(Date.now() - 2 * HOUR))

    const firstRunAt = JSON.parse(localStorage.getItem(firstRunKey)!)
      .firstRunAt as number

    const announcement = statuses[1].querySelector('.sr-only')!.textContent!
    assert.ok(
      announcement.includes(
        formatDate(new Date(firstRunAt), {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      ),
      announcement
    )
    assert.ok(!announcement.includes('назад'), announcement)

    // Ни одна озвучиваемая строка не содержит недельной цифры.
    for (const status of statuses) {
      const text = status.querySelector('.sr-only')!.textContent!
      assert.ok(!/недел|месяц/.test(text), text)
    }
  })

  it('survives another successful update check', () => {
    renderUpToDate(new Date(Date.now() - 2 * HOUR))
    const storedBefore = localStorage.getItem(firstRunKey)

    view?.unmount()
    view = null
    renderUpToDate(new Date())

    assert.equal(
      localStorage.getItem(firstRunKey),
      storedBefore,
      'проверка обновлений не трогает возраст сборки'
    )

    // И строка остаётся недельной, а не обнуляется до «только что».
    const statuses = [...document.querySelectorAll(statusRowsSelector)]
    assert.ok(statuses[1].textContent!.includes('1 неделю назад'))
  })

  it('keeps a single line when this build has no recorded first run', () => {
    localStorage.removeItem(firstRunKey)

    const statuses = renderUpToDate(new Date(Date.now() - HOUR))

    assert.equal(statuses.length, 1)
    assert.ok(statuses[0].textContent!.includes('назад'))
  })

  it('ignores a first run recorded by a different build', () => {
    localStorage.setItem(
      firstRunKey,
      JSON.stringify({ sha: 'другая-сборка', firstRunAt: Date.now() - DAY })
    )

    const statuses = renderUpToDate(new Date(Date.now() - HOUR))
    assert.equal(statuses.length, 1, 'чужая запись не показывается')
  })

  it('counts both lines in seconds during the first minute', () => {
    // Секунды включены у обеих строк: иначе рядом висят «только что» и
    // «12 секунд назад», и это читается как поломка счётчика.
    seedFirstRun(12 * SECOND)

    const statuses = renderUpToDate(new Date(Date.now() - 30 * SECOND))

    assert.equal(statuses.length, 2, 'две строки статуса')

    for (const status of statuses) {
      const visible = status.textContent!
      assert.ok(visible.includes('секунд назад'), visible)
    }

    // Озвучка от посекундного тика не меняется: в `aria-live` абсолютные даты.
    for (const status of statuses) {
      const announcement = status.querySelector('.sr-only')!.textContent!
      assert.ok(!/секунд|назад/.test(announcement), announcement)
    }
  })

  it('leaves exactly one element for the upstream update-status selector', () => {
    renderUpToDate(new Date(Date.now() - 2 * HOUR))

    // `.update-status` — апстримный e2e-локатор `#about .update-status`, он
    // обязан матчить одну строку: два совпадения Playwright отвергает в
    // strict-режиме, и из-за этого падает весь набор E2E.
    assert.equal(document.querySelectorAll(statusSelector).length, 1)
    assert.equal(document.querySelectorAll(firstRunStatusSelector).length, 1)
  })
})
