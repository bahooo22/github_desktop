import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  isAllowedReleaseAssetName,
  isAllowedReleaseAssetUrl,
  uniqueFileName,
} from '../../src/lib/release-asset-download'
import { parseReleaseAssets } from '../../src/lib/fork-release'

describe('Release assets', () => {
  const release = {
    assets: [
      {
        name: 'github-desktop-l10n.deb',
        browser_download_url: 'https://github.com/desktop/x.deb',
        size: 100,
      },
      {
        name: 'GitHubDesktopL10n-x86_64.AppImage',
        browser_download_url: 'https://github.com/desktop/x.AppImage',
        size: 200,
      },
      {
        name: 'GitHub Desktop L10n-arm64.zip',
        browser_download_url: 'https://github.com/desktop/x.zip',
        size: 300,
      },
      {
        name: 'checksums.txt',
        browser_download_url: 'https://github.com/desktop/checksums.txt',
        size: 10,
      },
      { name: 'no-url' },
    ],
  }

  it('picks only the requested extensions', () => {
    const linux = parseReleaseAssets(release, ['.deb', '.AppImage'])

    assert.deepStrictEqual(
      linux.map(a => a.name),
      ['github-desktop-l10n.deb', 'GitHubDesktopL10n-x86_64.AppImage']
    )

    const mac = parseReleaseAssets(release, ['.zip'])

    assert.deepStrictEqual(
      mac.map(a => a.name),
      ['GitHub Desktop L10n-arm64.zip']
    )
  })

  it('drops malformed releases and entries', () => {
    assert.deepStrictEqual(parseReleaseAssets(null, ['.zip']), [])
    assert.deepStrictEqual(parseReleaseAssets({}, ['.zip']), [])
    assert.deepStrictEqual(parseReleaseAssets({ assets: 'nope' }, ['.zip']), [])
  })

  it('allows only https URLs from GitHub hosts', () => {
    assert.ok(isAllowedReleaseAssetUrl('https://github.com/desktop/x.zip'))
    assert.ok(
      isAllowedReleaseAssetUrl(
        'https://release-assets.githubusercontent.com/x.zip'
      )
    )
    assert.ok(
      isAllowedReleaseAssetUrl('https://objects.githubusercontent.com/x.zip')
    )
    assert.strictEqual(
      isAllowedReleaseAssetUrl('http://github.com/desktop/x.zip'),
      false
    )
    assert.strictEqual(
      isAllowedReleaseAssetUrl('https://example.com/x.zip'),
      false
    )
    assert.strictEqual(isAllowedReleaseAssetUrl('not a url'), false)
  })

  it('allows only package extensions', () => {
    assert.ok(isAllowedReleaseAssetName('app.deb'))
    assert.ok(isAllowedReleaseAssetName('App.AppImage'))
    assert.ok(isAllowedReleaseAssetName('app.zip'))
    assert.strictEqual(isAllowedReleaseAssetName('app.exe'), false)
    assert.strictEqual(isAllowedReleaseAssetName('app.zip.exe'), false)
  })

  it('keeps a free name and numbers a taken one', () => {
    assert.strictEqual(
      uniqueFileName('app.zip', () => false),
      'app.zip'
    )

    const taken = new Set(['app.zip', 'app (1).zip'])

    assert.strictEqual(
      uniqueFileName('app.zip', p => taken.has(p)),
      'app (2).zip'
    )
  })
})
