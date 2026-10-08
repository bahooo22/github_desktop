import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  parseBuildInfo,
  selectBuildInfoAsset,
  evaluateForkRelease,
  repositoryApiUrl,
} from '../../src/lib/fork-release'

const validSha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)

describe('parseBuildInfo', () => {
  it('accepts a schema-1 asset with required fields', () => {
    const info = parseBuildInfo({
      schema: 1,
      platform: 'win32',
      arch: 'x64',
      sha: validSha,
      version: '3.6.7-beta2',
      builtAt: '2026-10-08T00:00:00Z',
    })

    assert.ok(info !== null)
    assert.strictEqual(info.schema, 1)
    assert.strictEqual(info.sha, validSha)
    assert.strictEqual(info.version, '3.6.7-beta2')
    assert.strictEqual(info.builtAt, '2026-10-08T00:00:00Z')
  })

  it('normalizes sha to lowercase', () => {
    const upper = 'A'.repeat(40)
    const info = parseBuildInfo({
      schema: 1,
      sha: upper,
      version: '3.6.7',
      builtAt: '2026-10-08T00:00:00Z',
    })

    assert.ok(info !== null)
    assert.strictEqual(info.sha, validSha)
  })

  it('rejects unknown schema versions', () => {
    assert.strictEqual(
      parseBuildInfo({
        schema: 2,
        sha: validSha,
        version: '3.6.7',
        builtAt: '2026-10-08T00:00:00Z',
      }),
      null
    )
  })

  it('rejects truncated or non-hex shas', () => {
    assert.strictEqual(
      parseBuildInfo({
        schema: 1,
        sha: 'abc',
        version: '3.6.7',
        builtAt: '2026-10-08T00:00:00Z',
      }),
      null
    )

    assert.strictEqual(
      parseBuildInfo({
        schema: 1,
        sha: 'z'.repeat(40),
        version: '3.6.7',
        builtAt: '2026-10-08T00:00:00Z',
      }),
      null
    )
  })

  it('requires non-empty version and builtAt', () => {
    assert.strictEqual(
      parseBuildInfo({
        schema: 1,
        sha: validSha,
        version: '',
        builtAt: '2026-10-08T00:00:00Z',
      }),
      null
    )

    assert.strictEqual(
      parseBuildInfo({
        schema: 1,
        sha: validSha,
        version: '3.6.7',
        builtAt: '',
      }),
      null
    )
  })

  it('returns null for non-object input', () => {
    assert.strictEqual(parseBuildInfo(null), null)
    assert.strictEqual(parseBuildInfo('not-an-object'), null)
    assert.strictEqual(parseBuildInfo(undefined), null)
  })
})

describe('selectBuildInfoAsset', () => {
  it('finds the build-info.json asset url', () => {
    const release = {
      assets: [
        { name: 'Setup-x64.exe', url: 'https://example.com/setup.exe' },
        {
          name: 'build-info.json',
          url: 'https://api.github.com/repos/o/r/releases/assets/1',
        },
      ],
    }

    assert.strictEqual(
      selectBuildInfoAsset(release),
      'https://api.github.com/repos/o/r/releases/assets/1'
    )
  })

  it('ignores releases without the asset', () => {
    const release = {
      assets: [{ name: 'Setup-x64.exe', url: 'https://example.com/setup.exe' }],
    }

    assert.strictEqual(selectBuildInfoAsset(release), null)
  })

  it('handles missing or malformed asset lists', () => {
    assert.strictEqual(selectBuildInfoAsset({}), null)
    assert.strictEqual(selectBuildInfoAsset({ assets: null }), null)
    assert.strictEqual(selectBuildInfoAsset({ assets: 'nope' }), null)
    assert.strictEqual(selectBuildInfoAsset(null), null)
  })

  it('skips malformed asset entries', () => {
    const release = {
      assets: [
        null,
        'not-an-object',
        { name: 'build-info.json' },
        { name: 'build-info.json', url: 'https://api.github.com/asset' },
      ],
    }

    assert.strictEqual(
      selectBuildInfoAsset(release),
      'https://api.github.com/asset'
    )
  })
})

describe('evaluateForkRelease', () => {
  const buildInfo = {
    schema: 1 as const,
    platform: 'win32',
    arch: 'x64',
    sha: otherSha,
    version: '3.6.7-beta3',
    builtAt: '2026-10-08T00:00:00Z',
  }

  it('returns status when release is ahead', () => {
    const status = evaluateForkRelease(validSha, buildInfo, 5, 'https://r')

    assert.ok(status !== null)
    assert.strictEqual(status.releaseSha, otherSha)
    assert.strictEqual(status.aheadBy, 5)
    assert.strictEqual(status.releasePageUrl, 'https://r')
    assert.strictEqual(status.version, '3.6.7-beta3')
    assert.strictEqual(status.builtAt, '2026-10-08T00:00:00Z')
  })

  it('returns null when shas match', () => {
    assert.strictEqual(
      evaluateForkRelease(otherSha, buildInfo, 5, 'https://r'),
      null
    )
  })

  it('returns null when aheadBy is zero or negative', () => {
    assert.strictEqual(
      evaluateForkRelease(validSha, buildInfo, 0, 'https://r'),
      null
    )
    assert.strictEqual(
      evaluateForkRelease(validSha, buildInfo, -1, 'https://r'),
      null
    )
  })

  it('returns null for invalid current sha', () => {
    assert.strictEqual(evaluateForkRelease('', buildInfo, 5, 'https://r'), null)
    assert.strictEqual(
      evaluateForkRelease('not-a-sha', buildInfo, 5, 'https://r'),
      null
    )
  })

  it('normalizes current sha comparison', () => {
    const status = evaluateForkRelease(
      'B'.repeat(40),
      buildInfo,
      1,
      'https://r'
    )
    assert.strictEqual(status, null)
  })
})

describe('repositoryApiUrl', () => {
  it('strips /releases/... from feed url', () => {
    assert.strictEqual(
      repositoryApiUrl(
        'https://api.github.com/repos/bahooo22/github_desktop/releases/tags/latest-win-x64'
      ),
      'https://api.github.com/repos/bahooo22/github_desktop'
    )
  })

  it('returns null when no releases segment exists', () => {
    assert.strictEqual(
      repositoryApiUrl('https://api.github.com/repos/bahooo22/github_desktop'),
      null
    )
  })

  it('returns null for invalid urls', () => {
    assert.strictEqual(repositoryApiUrl('not a url'), null)
    assert.strictEqual(repositoryApiUrl(''), null)
  })
})
