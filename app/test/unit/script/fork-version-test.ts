import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as semver from 'semver'
import { convertVersion } from 'electron-winstaller'

import {
  compareVersions,
  getPublishedVersion,
  toNuGetVersion,
  withForkBuildNumber,
} from '../../../../script/fork-version'

// The shapes a fork release can start from: `3.6.7-beta3` is what upstream keeps
// in `app/package.json` between releases, `3.6.7` what it holds right after one.
const baseVersions = ['3.6.7-beta3', '3.6.7', '3.7.0-beta1', '1.0.0-beta.4']

describe('toNuGetVersion', () => {
  // The module copies this rule instead of importing it, because the release gate
  // job runs it on a checkout with no installed dependencies. If the library ever
  // changes the rule, this is where it shows up.
  it('agrees with electron-winstaller on every version this scheme produces', () => {
    for (const base of baseVersions) {
      for (const buildNumber of ['1', '40382', '99999']) {
        const intermediate = withForkBuildNumber(base, buildNumber)
        assert.equal(
          toNuGetVersion(intermediate),
          convertVersion(intermediate),
          intermediate
        )
        assert.equal(toNuGetVersion(base), convertVersion(base), `base ${base}`)
      }
    }
  })

  it('is stable when electron-winstaller applies it a second time', () => {
    // `script/package.ts` looks the written package up by name, so the value we
    // hand over has to be the one that survives the library's own conversion.
    for (const base of baseVersions) {
      for (const buildNumber of ['', '40382']) {
        const published = getPublishedVersion(base, {
          DESKTOP_FORK_BUILD_NUMBER: buildNumber,
        })
        assert.equal(toNuGetVersion(published), published, published)
      }
    }
  })
})

describe('withForkBuildNumber', () => {
  it('keeps an existing prerelease and appends the number to it', () => {
    assert.equal(
      withForkBuildNumber('3.6.7-beta3', '40382'),
      '3.6.7-beta3.40382'
    )
  })

  it('introduces the prerelease for a plain version', () => {
    assert.equal(withForkBuildNumber('3.7.0', '40500'), '3.7.0-fork.40500')
  })

  it('rejects a build number that is not a commit count', () => {
    assert.throws(
      () => withForkBuildNumber('3.6.7-beta3', 'a77daf2ce1'),
      /is not a commit number/
    )
    assert.throws(
      () => withForkBuildNumber('3.6.7-beta3', '40382.1'),
      /is not a commit number/
    )
  })

  it('rejects a base version the scheme cannot extend', () => {
    assert.throws(
      () => withForkBuildNumber('3.6.7.1', '40382'),
      /is not a version this scheme can extend/
    )
    assert.throws(
      () => withForkBuildNumber('3.6', '40382'),
      /is not a version this scheme can extend/
    )
    assert.throws(
      () => withForkBuildNumber('v3.6.7', '40382'),
      /is not a version this scheme can extend/
    )
  })
})

describe('getPublishedVersion', () => {
  it('stays on the package version when the gate gave no commit number', () => {
    // Local packaging and any workflow that predates the numbering must not
    // suddenly start publishing a different version.
    assert.equal(getPublishedVersion('3.6.7-beta3', {}), '3.6.7-beta3')
    assert.equal(
      getPublishedVersion('3.6.7-beta3', { DESKTOP_FORK_BUILD_NUMBER: '' }),
      '3.6.7-beta3'
    )
    assert.equal(getPublishedVersion('1.0.0-beta.4', {}), '1.0.0-beta4')
  })

  it('publishes the commit number inside the prerelease', () => {
    assert.equal(
      getPublishedVersion('3.6.7-beta3', {
        DESKTOP_FORK_BUILD_NUMBER: '40382',
      }),
      '3.6.7-beta340382'
    )
    assert.equal(
      getPublishedVersion('3.7.0', { DESKTOP_FORK_BUILD_NUMBER: '40500' }),
      '3.7.0-fork40500'
    )
  })

  it('produces a version the app can parse', () => {
    // `app/src/lib/release-notes.ts` reads the running app's version through
    // `new SemVer(...)`, so a published form that is not valid semver would break
    // that dialog for every install it reaches.
    for (const base of baseVersions) {
      for (const buildNumber of ['', '1', '40382', '99999']) {
        const published = getPublishedVersion(base, {
          DESKTOP_FORK_BUILD_NUMBER: buildNumber,
        })
        assert.notEqual(semver.valid(published), null, published)
      }
    }
  })

  it('sorts above the version it extends, which is what Squirrel installs on', () => {
    // Between upstream releases the package file carries a prerelease, and the
    // published form has to be greater than it — the whole point of the scheme is
    // that `UpdateInfo.cs:66` drops a feed whose version is not above the
    // installed one.
    for (const base of ['3.6.7-beta3', '3.7.0-beta1', '1.0.0-beta.4']) {
      const published = getPublishedVersion(base, {
        DESKTOP_FORK_BUILD_NUMBER: '40382',
      })
      assert.ok(semver.gt(published, base), `${published} > ${base}`)
    }
  })

  it('sorts neighbours of the same digit count in commit order', () => {
    // Squirrel orders NuGet versions by comparing the prerelease as a string, and
    // within one digit count that agrees with semver's identifier comparison — so
    // consecutive rebuilds keep rising. Crossing a digit count does not, which is
    // why the release gate compares the two versions before a run publishes.
    let previous = getPublishedVersion('3.6.7-beta3', {
      DESKTOP_FORK_BUILD_NUMBER: '40380',
    })

    for (const buildNumber of ['40381', '40382', '40383', '40999']) {
      const next = getPublishedVersion('3.6.7-beta3', {
        DESKTOP_FORK_BUILD_NUMBER: buildNumber,
      })
      assert.ok(semver.gt(next, previous), `${next} > ${previous}`)
      previous = next
    }
  })

  it('yields a version below a plain base, which the gate has to catch', () => {
    // A prerelease is always lower than the release it precedes, both in semver
    // and in NuGet. This only bites the first run after upstream drops the
    // prerelease from `app/package.json`, in the case where the feed still holds
    // that plain version — the gate's version check is what refuses it.
    const published = getPublishedVersion('3.7.0', {
      DESKTOP_FORK_BUILD_NUMBER: '40500',
    })
    assert.ok(semver.lt(published, '3.7.0'), published)
  })
})

describe('compareVersions', () => {
  // The release gate runs this on a checkout with no installed dependencies, so
  // it cannot use `semver.compare` — these cases are the ones it decides on.
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    ['3.6.7-beta3', '3.6.7-beta340382', -1],
    ['3.6.7-beta340382', '3.6.7-beta3', 1],
    ['3.6.7-beta340382', '3.6.7-beta340382', 0],
    ['3.6.7-beta340382', '3.6.7-beta340383', -1],
    ['3.6.7-beta340382', '3.6.7', -1],
    ['3.6.7', '3.6.7-beta340382', 1],
    ['3.7.0', '3.6.7-beta399999', 1],
    ['3.6.7-beta399999', '3.6.7-beta340382', 1],
    ['1.0.0-beta.4', '1.0.0-beta.5', -1],
    ['1.0.0-beta.4.40382', '1.0.0-beta.4.40383', -1],
    ['3.6.7+build.1', '3.6.7', 0],
    ['3.6.10', '3.6.9', 1],
  ]

  for (const [left, right, expected] of cases) {
    it(`orders ${left} against ${right}`, () => {
      assert.equal(compareVersions(left, right), expected)
      assert.equal(compareVersions(right, left), -expected)
    })
  }

  it('agrees with semver where both define the answer', () => {
    for (const [left, right, expected] of cases) {
      if (left.includes('+') || right.includes('+')) {
        continue
      }

      const compared = semver.compare(
        new semver.SemVer(left),
        new semver.SemVer(right)
      )
      assert.equal(compared, expected, `${left} vs ${right}`)
    }
  })
})
