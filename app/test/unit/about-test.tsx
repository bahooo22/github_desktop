import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import { About } from '../../src/ui/about/about'
import { UpdateStatus } from '../../src/ui/lib/update-store'
import { getVersion } from '../../src/ui/lib/app-proxy'
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

function renderAbout() {
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
      updateState={{
        status: UpdateStatus.UpdateNotChecked,
        lastSuccessfulCheck: null,
        isX64ToARM64ImmediateAutoUpdate: false,
        newReleases: null,
        prioritizeUpdate: false,
        prioritizeUpdateInfoUrl: undefined,
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
 */
function seedForkCache(status: object | null) {
  localStorage.setItem(
    forkCacheKey,
    JSON.stringify({ checkedAt: Date.now(), status })
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
