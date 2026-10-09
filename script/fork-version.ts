/**
 * The version number a fork build is published under.
 *
 * Squirrel answers "is there an update" by comparing the version in the feed's
 * `RELEASES` against the version of the installed package, and it refuses to
 * install anything that isn't greater: `src/Squirrel/UpdateInfo.cs:66` returns an
 * empty `releasesToApply` as soon as `currentVersion.Version >= latestFull.Version`.
 * Measured against `latest-win-x64` on 09.10.2026 — a release rebuilt from a new
 * commit while `app/package.json` still said `3.6.7-beta3` left the installed app
 * saying "you have the latest version", because there was nothing for Squirrel to
 * apply.
 *
 * The commit is what distinguishes this fork's builds, so the commit's number is
 * folded into the published version rather than waiting for a human to bump the
 * version file: a new commit then becomes an update Squirrel can actually install,
 * and rebuilding the commit it already has stays impossible at the release gate,
 * which refuses a run whose commit is published.
 *
 * The number rides in the prerelease part, because that is the only place a fourth
 * component survives: `semver.valid` rejects both `3.6.7.40382` and `3.6.7-beta3.00382`
 * (leading zeroes), while `app/src/lib/release-notes.ts:123` parses the version of
 * the running app with `new SemVer(...)` — measured 09.10.2026.
 */

import { readFileSync } from 'fs'
import { basename, dirname, join } from 'path'

/**
 * The rule `electron-winstaller` applies to the nuspec version before Squirrel
 * writes it into a package name: NuGet versions have no dots inside the prerelease
 * part, so `3.6.7-beta3.40382` is published as `3.6.7-beta340382`.
 *
 * This is a copy of `convertVersion` in `node_modules/electron-winstaller/lib/index.js:84`
 * rather than an import, because the release gate job runs this file with
 * `node --experimental-strip-types` on a checkout that installs no dependencies
 * (`fetch-depth: 1`, no `yarn install`). `app/test/unit/script/fork-version-test.ts`
 * compares the two implementations on every version form this module can produce,
 * so the copy cannot drift.
 */
export function toNuGetVersion(version: string): string {
  const parts = version.split('+')[0].split('-')
  const mainVersion = parts.shift() as string

  if (parts.length > 0) {
    return `${mainVersion}-${parts.join('-').replace(/\./g, '')}`
  }

  return mainVersion
}

/**
 * The commit number as a prerelease suffix, before NuGet's dots are removed:
 * `3.6.7-beta3` + `40382` → `3.6.7-beta3.40382`, `3.7.0` + `40500` →
 * `3.7.0-fork.40500`.
 *
 * A base version that already carries a prerelease keeps it, so the upstream label
 * stays readable and the published build sorts above the release it was merged
 * from (`beta340382` > `beta3`, compared as strings the way Squirrel does). When
 * the base is a plain release number the suffix has to introduce the prerelease
 * itself, or the result would not be a version at all.
 */
export function withForkBuildNumber(
  baseVersion: string,
  buildNumber: string
): string {
  if (!/^\d+$/.test(buildNumber)) {
    throw new Error(
      `Build number '${buildNumber}' is not a commit number (expected digits only)`
    )
  }

  if (!/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(baseVersion)) {
    throw new Error(
      `Base version '${baseVersion}' is not a version this scheme can extend`
    )
  }

  if (baseVersion.includes('-')) {
    const [main, ...prerelease] = baseVersion.split('-')
    return `${main}-${prerelease.join('-')}.${buildNumber}`
  }

  return `${baseVersion}-fork.${buildNumber}`
}

/**
 * What `electron-winstaller` should put in the nuspec, or the version of the
 * package file with NuGet's dot rule already applied when no commit number was
 * given — a local build then packages the way it did before this fork numbered
 * its releases.
 *
 * The base version still goes through `toNuGetVersion` without a build number,
 * because electron-winstaller applies the same rule to whatever it publishes
 * (lib/index.js:84), and `script/package.ts` looks the written package up by name
 * when renaming it with the architecture.
 */
export function getPublishedVersion(
  baseVersion: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const buildNumber = env.DESKTOP_FORK_BUILD_NUMBER ?? ''

  if (buildNumber === '') {
    return toNuGetVersion(baseVersion)
  }

  return toNuGetVersion(withForkBuildNumber(baseVersion, buildNumber))
}

/**
 * Whether NuGet version `a` sorts below (-1), equal to (0) or above (1) `b`.
 *
 * Squirrel compares the versions it reads in `RELEASES` this way, and the release
 * gate needs the same answer to refuse a run whose published version would not be
 * an update. Only the subset of NuGet's rules this fork's versions can reach is
 * implemented: the numeric main part compared by component, then a version with a
 * prerelease below one without, then two prereleases as identifiers — which for
 * `beta340382` and `fork40500` is a case-insensitive string order. Dot-separated
 * prerelease identifiers are walked one at a time, so a longer prerelease wins only
 * when the identifiers it shares with the other are equal.
 */
export function compareVersions(a: string, b: string): number {
  const [mainA, preA = ''] = splitVersion(a)
  const [mainB, preB = ''] = splitVersion(b)

  const partsA = mainA.split('.')
  const partsB = mainB.split('.')
  const shared = Math.max(partsA.length, partsB.length)

  for (let index = 0; index < shared; index++) {
    const left = Number(partsA[index] ?? '0')
    const right = Number(partsB[index] ?? '0')

    if (left !== right) {
      return left < right ? -1 : 1
    }
  }

  // A prerelease sorts below the release it precedes.
  if (preA === '' || preB === '') {
    if (preA === preB) {
      return 0
    }
    return preA === '' ? 1 : -1
  }

  const identifiersA = preA.split('.')
  const identifiersB = preB.split('.')
  const identifierCount = Math.max(identifiersA.length, identifiersB.length)

  for (let index = 0; index < identifierCount; index++) {
    const left = identifiersA[index]
    const right = identifiersB[index]

    if (left === undefined || right === undefined) {
      return left === undefined ? -1 : 1
    }

    const leftNumber = /^\d+$/.test(left) ? Number(left) : null
    const rightNumber = /^\d+$/.test(right) ? Number(right) : null

    if (leftNumber !== null && rightNumber !== null) {
      if (leftNumber !== rightNumber) {
        return leftNumber < rightNumber ? -1 : 1
      }
      continue
    }

    // Numeric identifiers always sort below alphanumeric ones.
    if (leftNumber !== null) {
      return -1
    }
    if (rightNumber !== null) {
      return 1
    }

    const lowerLeft = left.toLowerCase()
    const lowerRight = right.toLowerCase()

    if (lowerLeft !== lowerRight) {
      return lowerLeft < lowerRight ? -1 : 1
    }
  }

  return 0
}

function splitVersion(version: string): [string, string] {
  const withoutMetadata = version.split('+')[0]
  const separator = withoutMetadata.indexOf('-')

  if (separator === -1) {
    return [withoutMetadata, '']
  }

  return [
    withoutMetadata.substring(0, separator),
    withoutMetadata.substring(separator + 1),
  ]
}

// Run as a command for the release gate, which has this file but no installed
// dependencies: `node --experimental-strip-types script/fork-version.ts`. The base
// version comes from the `app/package.json` next to the checkout, the commit number
// from DESKTOP_FORK_BUILD_NUMBER the gate computes.
//
// `--compare A B` answers with -1, 0 or 1 and exists for the same reason: the gate
// has to know whether the version it is about to publish is above the one already
// in the feed, and that is NuGet's ordering, not a string comparison.
//
// The entry point is recognised through `process.argv[1]` instead of
// `import.meta.url`: `script/tsconfig.json` sets `module: nodenext` over a package
// with no `"type": "module"`, so tsc type-checks this file as CommonJS and rejects
// `import.meta` with TS1470 (measured with `yarn compile:dev` 09.10.2026), while
// Node runs the same file as an ES module. argv[1] holds the main script either
// way, and the test that imports these functions has a `-test.ts` entry point, so
// importing the module never runs the command.
const entryPoint = process.argv[1]

if (entryPoint !== undefined && basename(entryPoint) === 'fork-version.ts') {
  const [command, first, second] = process.argv.slice(2)

  try {
    if (command === '--compare') {
      if (first === undefined || second === undefined) {
        throw new Error('usage: --compare <version> <version>')
      }
      console.log(String(compareVersions(first, second)))
    } else if (command === undefined) {
      const baseVersion = JSON.parse(
        readFileSync(
          join(dirname(entryPoint), '..', 'app', 'package.json'),
          'utf8'
        )
      ).version

      console.log(getPublishedVersion(baseVersion))
    } else {
      throw new Error(`unknown command '${command}'`)
    }
  } catch (e) {
    console.error(`fork-version: ${e}`)
    process.exit(1)
  }
}
