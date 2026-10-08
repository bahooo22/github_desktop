import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  getUpdatesURL,
  getWindowsShortcutName,
  isCentralUpdatesFeed,
} from './dist-info'

const centralFeed =
  'https://central.github.com/deployments/desktop/desktop/latest/win32'
const forkFeed =
  'https://github.com/bahooo22/github_desktop/releases/download/latest-win-x64/'

/**
 * `getUpdatesURL` is where a build learns which feed its auto updater reads.
 * Squirrel installs exactly the package that feed's `RELEASES` names, so a fork
 * build pointed at upstream Central would be replaced by the stock `GitHubDesktop`
 * package on the next update check — on the user's machine, not in a build log.
 */
describe('the updates feed of a fork build', () => {
  const savedUpdatesUrl = process.env.DESKTOP_UPDATES_URL
  const savedChannel = process.env.RELEASE_CHANNEL

  afterEach(() => {
    if (savedUpdatesUrl === undefined) {
      delete process.env.DESKTOP_UPDATES_URL
    } else {
      process.env.DESKTOP_UPDATES_URL = savedUpdatesUrl
    }

    if (savedChannel === undefined) {
      delete process.env.RELEASE_CHANNEL
    } else {
      process.env.RELEASE_CHANNEL = savedChannel
    }
  })

  it('defaults to a release tag of this fork', () => {
    delete process.env.DESKTOP_UPDATES_URL
    process.env.RELEASE_CHANNEL = 'production'

    const url = new URL(getUpdatesURL())

    assert.equal(url.hostname, 'github.com')
    assert.match(
      url.pathname,
      /^\/bahooo22\/github_desktop\/releases\/download\/latest-win-(x64|arm64)\/$/,
      `default feed must be a fork release tag, got ${url.pathname}`
    )
    assert.ok(
      url.pathname.endsWith('/'),
      'Squirrel appends RELEASES to the base'
    )
  })

  it('refuses a publishable build pointed at upstream Central', () => {
    process.env.DESKTOP_UPDATES_URL = centralFeed

    for (const channel of ['production', 'beta', 'test']) {
      process.env.RELEASE_CHANNEL = channel

      assert.throws(
        () => getUpdatesURL(),
        /Central feed/,
        `channel ${channel} ships, so Central must not be accepted`
      )
    }
  })

  it('still allows a non-publishable build to point at Central', () => {
    process.env.DESKTOP_UPDATES_URL = centralFeed
    process.env.RELEASE_CHANNEL = 'development'

    assert.ok(isCentralUpdatesFeed(getUpdatesURL()))
  })

  it('accepts an explicit fork feed on any publishable channel', () => {
    process.env.DESKTOP_UPDATES_URL = forkFeed
    process.env.RELEASE_CHANNEL = 'production'

    assert.equal(getUpdatesURL(), forkFeed)
  })
})

/**
 * Squirrel names the Start Menu / Desktop `.lnk` after the packaged exe's
 * `FileDescription`, and `script/build.ts` sets that from
 * `getWindowsShortcutName`. With upstream's label both editions write the very
 * same `Programs\GitHub, Inc.\GitHub Desktop.lnk` and the edition that updated
 * last owns the other one's icon (measured 2026-10-08 in `Squirrel-Shortcut.log`
 * of two installs on one machine), so the fork's label has to differ from the
 * stock one while still being recognizable as the same app.
 */
describe('the Windows shortcut label of a fork build', () => {
  const stock = 'GitHub Desktop'

  it('is distinct from the label upstream installs under', () => {
    assert.notEqual(
      getWindowsShortcutName(),
      stock,
      'the same label means the same .lnk, which the two editions then overwrite'
    )
  })

  it('stays recognizable as GitHub Desktop', () => {
    assert.ok(
      getWindowsShortcutName().startsWith(stock),
      `a user must still find the app they know in the Start Menu`
    )
  })
})
