import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  parseBuildInfo,
  parseBuildInfoFromRelease,
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

describe('parseBuildInfoFromRelease', () => {
  const notes = (info: unknown) =>
    `Release text\n\n<!--fork-build-info ${JSON.stringify(info)}-->\n`

  const buildInfo = {
    schema: 1,
    platform: 'win32',
    arch: 'x64',
    sha: validSha,
    version: '3.6.7-beta2',
    builtAt: '2026-10-08T00:00:00Z',
  }

  it('reads the block the release states about its own build', () => {
    const parsed = parseBuildInfoFromRelease({
      body: notes(buildInfo),
      html_url: 'https://github.com/o/r/releases/tag/latest-win-x64',
    })

    assert.ok(parsed !== null)
    assert.strictEqual(parsed.sha, validSha)
    assert.strictEqual(parsed.version, '3.6.7-beta2')
  })

  it('finds the block regardless of the text around it', () => {
    const parsed = parseBuildInfoFromRelease({
      body: `## Changelog\n\n- one thing\n\n${notes(buildInfo)}\n- more text`,
    })

    assert.ok(parsed !== null)
    assert.strictEqual(parsed.sha, validSha)
  })

  it('returns null when the notes name no commit', () => {
    assert.strictEqual(parseBuildInfoFromRelease({ body: 'plain notes' }), null)
    assert.strictEqual(parseBuildInfoFromRelease({ body: '' }), null)
    assert.strictEqual(parseBuildInfoFromRelease({}), null)
    assert.strictEqual(parseBuildInfoFromRelease({ body: null }), null)
    assert.strictEqual(parseBuildInfoFromRelease(null), null)
  })

  it('returns null when the block is not readable', () => {
    assert.strictEqual(
      parseBuildInfoFromRelease({
        body: 'Release text\n\n<!--fork-build-info {"schema":1,} -->\n',
      }),
      null
    )

    assert.strictEqual(
      parseBuildInfoFromRelease({
        body: notes({ ...buildInfo, schema: 2 }),
      }),
      null
    )

    assert.strictEqual(
      parseBuildInfoFromRelease({
        body: notes({ ...buildInfo, sha: 'abc' }),
      }),
      null
    )
  })

  it('only accepts the commit the notes themselves state', () => {
    // An asset record describes a file rather than the build, and a release that
    // carries one without naming its commit in the notes has no commit to offer.
    const release = {
      body: 'Release text',
      assets: [
        {
          name: 'build-info.json',
          size: 180,
          digest: 'sha256:3372e043',
          updated_at: '2026-10-08T02:03:22Z',
        },
      ],
    }

    assert.strictEqual(parseBuildInfoFromRelease(release), null)
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
