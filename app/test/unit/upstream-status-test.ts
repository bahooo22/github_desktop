import { describe, it } from 'node:test'
import assert from 'node:assert'

import { compareUpstreamVersions } from '../../src/lib/upstream-status'

describe('Upstream status', () => {
  it('reports how far behind the fork build is', () => {
    const status = compareUpstreamVersions('3.5.0', ['3.5.1', '3.4.9', '3.5.2'])

    assert.ok(status !== null)
    assert.strictEqual(status.latestVersion, '3.5.2')
    assert.strictEqual(status.releasesBehind, 2)
  })

  it('stays silent when this build is the newest thing around', () => {
    assert.strictEqual(
      compareUpstreamVersions('3.6.0', ['3.5.9', '3.6.0']),
      null
    )
  })

  it('ignores entries that are not versions at all', () => {
    assert.strictEqual(compareUpstreamVersions('3.5.0', ['nonsense', '']), null)
  })

  it('ignores a build whose own version cannot be compared', () => {
    assert.strictEqual(compareUpstreamVersions('development', ['3.5.1']), null)
  })
})
