import * as semver from 'semver'

import { getChangeLog } from './release-notes'
import { getVersion } from '../ui/lib/app-proxy'
import { getObject, setObject } from './local-storage'

/**
 * Upstream Desktop publishes its own changelog feed, and that's the cheapest
 * way for a fork build to learn that upstream moved on without the fork having
 * to host another endpoint.
 */
const cacheKey = 'upstream-changelog-check'

const checkInterval = 1000 * 60 * 60 * 24

export interface IUpstreamStatus {
  /** The newest version upstream has released. */
  readonly latestVersion: string

  /** How many upstream releases this build is behind. Always at least one. */
  readonly releasesBehind: number
}

interface ICachedCheck {
  readonly checkedAt: number

  /**
   * Every version the feed listed at that check, newest first — not just the
   * top one. Caching only the latest would make the second and later opens of
   * the dialog within the interval report "1 release behind" no matter how far
   * upstream actually moved.
   */
  readonly upstreamVersions: ReadonlyArray<string>
}

/**
 * The newest upstream version and our distance to it, or null when there's
 * nothing to say: an offline app, a malformed feed and a build that is itself
 * at or ahead of upstream all look identical to the user, which is 'no news'.
 */
export function compareUpstreamVersions(
  currentVersion: string,
  upstreamVersions: ReadonlyArray<string>
): IUpstreamStatus | null {
  const valid = upstreamVersions
    .map(v => semver.valid(v))
    .filter((v): v is string => v !== null)
    .sort((a, b) => semver.rcompare(a, b))

  const latest = valid[0]

  if (latest === undefined || semver.valid(currentVersion) === null) {
    return null
  }

  if (semver.gte(currentVersion, latest)) {
    return null
  }

  return {
    latestVersion: latest,
    releasesBehind: valid.filter(v => semver.gt(v, currentVersion)).length,
  }
}

export async function getUpstreamStatus(): Promise<IUpstreamStatus | null> {
  const cached = readCache()

  if (cached !== undefined) {
    return compareUpstreamVersions(getVersion(), cached.upstreamVersions)
  }

  try {
    const releases = await getChangeLog(10)

    const upstreamVersions = releases
      .map(r => semver.valid(r.version))
      .filter((v): v is string => v !== null)
      .sort((a, b) => semver.rcompare(a, b))

    // Cache what the feed said, even when it said nothing usable: the day
    // without network or a broken endpoint shouldn't turn into a request every
    // time the About dialog opens.
    const entry: ICachedCheck = {
      checkedAt: Date.now(),
      upstreamVersions:
        upstreamVersions.length > 0 ? upstreamVersions : [getVersion()],
    }

    setObject(cacheKey, entry)

    return compareUpstreamVersions(getVersion(), entry.upstreamVersions)
  } catch (e) {
    // fetch rejects when there's no network, which the About dialog can't act
    // on, so stay quiet and let the cache decide when to try again.
    log.debug(`[upstream-status] changelog lookup failed`, e)
    return null
  }
}

function readCache(): ICachedCheck | undefined {
  const cached = getObject<ICachedCheck>(cacheKey)

  if (
    cached === undefined ||
    typeof cached.checkedAt !== 'number' ||
    !Array.isArray(cached.upstreamVersions) ||
    !cached.upstreamVersions.every(v => typeof v === 'string') ||
    Date.now() - cached.checkedAt > checkInterval
  ) {
    return undefined
  }

  return cached
}
