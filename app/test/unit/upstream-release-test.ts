import assert from 'node:assert'
import { describe, it } from 'node:test'

import { getUpstreamInstaller } from '../../src/lib/upstream-release'
import {
  isAllowedReleaseAssetName,
  isAllowedReleaseAssetUrl,
  releaseAssetExtensionsFor,
} from '../../src/lib/release-asset-download'

describe('upstream release installer', () => {
  it('names the Windows installer the official channel serves', () => {
    const installer = getUpstreamInstaller('win32', 'x64')

    assert.notEqual(installer, null)
    assert.equal(
      installer!.url,
      'https://central.github.com/deployments/desktop/desktop/latest/win32'
    )
    assert.equal(installer!.fileName, 'GitHubDesktopSetup-x64.exe')
  })

  it('separates the two macOS architectures', () => {
    const arm = getUpstreamInstaller('darwin', 'arm64')
    const intel = getUpstreamInstaller('darwin', 'x64')

    assert.equal(
      arm!.url,
      'https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64'
    )
    assert.equal(arm!.fileName, 'GitHubDesktop-arm64.zip')

    assert.equal(
      intel!.url,
      'https://central.github.com/deployments/desktop/desktop/latest/darwin'
    )
    assert.equal(intel!.fileName, 'GitHubDesktop-x64.zip')
  })

  it('offers nothing on the platform upstream does not build', () => {
    assert.equal(getUpstreamInstaller('linux', 'x64'), null)
  })

  /**
   * The pair is what the main process checks before it writes anything, so a
   * rule that passes the url but refuses the name would leave a button that
   * always answers «host is not allowed» or «name is not allowed».
   */
  it('keeps every offered pair inside the download allowlist', () => {
    for (const [platform, arch] of [
      ['win32', 'x64'],
      ['win32', 'arm64'],
      ['darwin', 'arm64'],
      ['darwin', 'x64'],
    ] as const) {
      const installer = getUpstreamInstaller(platform, arch)

      assert.notEqual(installer, null, `${platform}/${arch} has a build`)
      assert.ok(
        isAllowedReleaseAssetUrl(installer!.url),
        `${installer!.url} must stay downloadable`
      )
      assert.ok(
        isAllowedReleaseAssetName(
          installer!.fileName,
          releaseAssetExtensionsFor(installer!.url)
        ),
        `${installer!.fileName} must stay downloadable`
      )
    }
  })

  it('refuses hosts and file types the channel never uses', () => {
    const channelUrl = getUpstreamInstaller('win32', 'x64')!.url

    assert.ok(
      !isAllowedReleaseAssetUrl('https://example.invalid/desktop/win32'),
      'an arbitrary host is not downloadable'
    )
    assert.ok(
      !isAllowedReleaseAssetUrl('http://central.github.com/deployments/x'),
      'http is not downloadable'
    )
    assert.ok(
      !isAllowedReleaseAssetName(
        'GitHubDesktopSetup-x64.dll',
        releaseAssetExtensionsFor(channelUrl)
      ),
      'the channel serves installers and archives, nothing else'
    )
  })
})
