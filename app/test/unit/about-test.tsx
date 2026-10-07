import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import { About } from '../../src/ui/about/about'
import { UpdateStatus } from '../../src/ui/lib/update-store'
import { getVersion } from '../../src/ui/lib/app-proxy'
import { render, waitFor } from '../helpers/ui/render'

const cacheKey = 'upstream-changelog-check'
const indicatorSelector = '[data-l10n-key="about.upstream-behind"]'

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
