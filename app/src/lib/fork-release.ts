import { getObject, setObject } from './local-storage'

/**
 * Squirrel — the updater this fork keeps — compares version numbers, and a fork
 * release carries the upstream version it was merged from, so the version is
 * never enough to tell an installed build that the fork rebuilt. The commit a
 * build came from does, and each release states that commit (`script/build-info.ts`).
 * This module reads that statement back and says whether the fork has moved
 * ahead.
 *
 * It reads the release's notes, not its `build-info.json` asset, and both the
 * transport and the content have to be plain API JSON: an asset's own bytes are
 * only ever served by redirecting to a CDN that answers without
 * `Access-Control-Allow-Origin`, which a renderer `fetch` cannot follow, while
 * asking the API for raw content with a `+json` media type returns the asset's
 * metadata instead of its content (measured against `latest-win-x64` on
 * 08.10.2026). The release object carries CORS and the notes inside it, so one
 * request reads both. See `getForkFeedURL` in `script/dist-info.ts`.
 */
const cacheKey = 'fork-release-check'

const checkInterval = 1000 * 60 * 60 * 24

/** A Git commit as `git rev-parse` writes it. */
const fullShaRe = /^[0-9a-f]{40}$/

/** Commits reach this module from build constants and from cached JSON. */
function normalizeSha(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * The machine block `getForkReleaseNotes` in `script/build-info.ts` writes into
 * a release's notes: one line of compact JSON, so `.` without `s` is enough and
 * a hand-written multi-line block simply doesn't match.
 */
const buildInfoMarker = /<!--fork-build-info\s*(\{.*?\})-->/

/**
 * What one release says about the build it carries. Declared here rather than
 * imported from `script/build-info.ts`, which belongs to the build tooling and
 * is not part of the renderer's program; `schema` is what keeps the two in step.
 */
export interface IForkBuildInfo {
  readonly schema: number
  readonly platform: string
  readonly arch: string
  readonly sha: string
  readonly version: string
  readonly builtAt: string
}

export interface IForkReleaseStatus {
  /** The commit the released build was made from. */
  readonly releaseSha: string

  /** How many commits the release carries on top of the installed build. */
  readonly aheadBy: number

  /** The release page, which is where a portable build gets its update. */
  readonly releasePageUrl: string

  /** The version string of the release, for telling it apart in the UI. */
  readonly version: string

  /** When the release was built, as the release states it. */
  readonly builtAt: string
}

interface ICachedCheck {
  readonly checkedAt: number

  /** The commit this build was made from, as the check saw it. */
  readonly checkedSha: string

  /**
   * Null is a result, not a failure to record one: a build that is at the
   * release commit and an unreachable API both mean 'nothing to tell you', and
   * caching that keeps an offline app from re-asking on every dialog open.
   */
  readonly status: IForkReleaseStatus | null
}

/**
 * The release's own commit, or null when the release isn't something we can
 * trust: an unknown schema, a truncated SHA or a missing field. The block is
 * written by our own workflow, so anything else means the release was rebuilt by
 * hand or half-uploaded, and guessing from it is worse than saying nothing.
 */
export function parseBuildInfo(raw: unknown): IForkBuildInfo | null {
  if (raw === null || typeof raw !== 'object') {
    return null
  }

  const value = raw as Record<string, unknown>

  if (value.schema !== 1) {
    return null
  }

  if (
    typeof value.sha !== 'string' ||
    !fullShaRe.test(value.sha.toLowerCase()) ||
    typeof value.version !== 'string' ||
    value.version.length === 0 ||
    typeof value.builtAt !== 'string' ||
    value.builtAt.length === 0
  ) {
    return null
  }

  return {
    schema: 1,
    platform: typeof value.platform === 'string' ? value.platform : '',
    arch: typeof value.arch === 'string' ? value.arch : '',
    sha: value.sha.toLowerCase(),
    version: value.version,
    builtAt: value.builtAt,
  }
}

/**
 * What a release response says about the build it carries, or null when the
 * release names no commit — one published before the workflow wrote this block,
 * or edited by hand afterwards.
 *
 * The release's own commit is trusted only through `parseBuildInfo`, so an
 * unknown `schema` or a malformed SHA counts as no answer either.
 */
export function parseBuildInfoFromRelease(
  release: unknown
): IForkBuildInfo | null {
  if (release === null || typeof release !== 'object') {
    return null
  }

  const body = (release as Record<string, unknown>).body

  if (typeof body !== 'string') {
    return null
  }

  const block = buildInfoMarker.exec(body)

  if (block === null) {
    return null
  }

  let raw: unknown

  try {
    raw = JSON.parse(block[1])
  } catch {
    return null
  }

  return parseBuildInfo(raw)
}

/**
 * Whether the fork has a build ahead of the installed one.
 *
 * The SHA alone answers "is this the same build", but not "is the release
 * newer": someone running their own branch off the fork is ahead of, not
 * behind, the release, and only the commit graph between the two says which way
 * it goes. A release that adds nothing on top of this build is no update to
 * offer, however different the two SHAs look.
 */
export function evaluateForkRelease(
  currentSha: string,
  buildInfo: IForkBuildInfo,
  aheadBy: number,
  releasePageUrl: string
): IForkReleaseStatus | null {
  const current = normalizeSha(currentSha)

  if (current === '' || !fullShaRe.test(current)) {
    return null
  }

  if (buildInfo.sha === current) {
    return null
  }

  if (!Number.isFinite(aheadBy) || aheadBy <= 0) {
    return null
  }

  return {
    releaseSha: buildInfo.sha,
    aheadBy,
    releasePageUrl,
    version: buildInfo.version,
    builtAt: buildInfo.builtAt,
  }
}

/** The `…/repos/<owner>/<repo>` half of the feed URL, for the compare call. */
export function repositoryApiUrl(feedUrl: string): string | null {
  try {
    const url = new URL(feedUrl)
    const releasesIndex = url.pathname.indexOf('/releases/')

    if (releasesIndex === -1) {
      return null
    }

    return `${url.origin}${url.pathname.substring(0, releasesIndex)}`
  } catch {
    return null
  }
}

async function fetchJson(url: string, accept: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: accept } })

  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * How many commits `releaseSha` carries on top of `currentSha`, as the GitHub
 * compare endpoint counts them. A 404 here means one of the two commits isn't
 * in the fork's repository at all, which is as good as no answer.
 */
async function commitsAhead(
  repositoryUrl: string,
  currentSha: string,
  releaseSha: string
): Promise<number> {
  const url = `${repositoryUrl}/compare/${currentSha}...${releaseSha}`
  const comparison = await fetchJson(url, 'application/vnd.github.v3+json')

  if (comparison === null || typeof comparison !== 'object') {
    return 0
  }

  const aheadBy = (comparison as Record<string, unknown>).ahead_by

  return typeof aheadBy === 'number' && Number.isFinite(aheadBy) ? aheadBy : 0
}

async function checkForkRelease(
  currentSha: string
): Promise<IForkReleaseStatus | null> {
  try {
    const release = await fetchJson(
      __FORK_FEED_URL__,
      'application/vnd.github.v3+json'
    )

    if (release === null || typeof release !== 'object') {
      return null
    }

    const releasePageUrl = (release as Record<string, unknown>).html_url

    if (typeof releasePageUrl !== 'string') {
      return null
    }

    const buildInfo = parseBuildInfoFromRelease(release)

    if (buildInfo === null) {
      return null
    }

    // Same commit: nothing to ask the compare endpoint about.
    if (buildInfo.sha === currentSha) {
      return null
    }

    const repositoryUrl = repositoryApiUrl(__FORK_FEED_URL__)

    if (repositoryUrl === null) {
      return null
    }

    return evaluateForkRelease(
      currentSha,
      buildInfo,
      await commitsAhead(repositoryUrl, currentSha, buildInfo.sha),
      releasePageUrl
    )
  } catch (e) {
    // No network, a rate-limited API, a release whose notes carry no build block
    // yet — none of them is something the user can act on, so stay quiet.
    log.debug(`[fork-release] release check failed`, e)
    return null
  }
}

/**
 * Whether a cached verdict still describes the build that is reading it.
 *
 * Age alone is not enough: an update swaps the installed commit while the
 * cached 'the release is N commits ahead' was computed against the old one, so
 * a build that just updated keeps showing a banner about the release it already
 * has until the entry expires. Measured 09.10.2026 — the banner of
 * `1c37b25e22`, '38 commits ahead', survived installing `1c37b25e22`.
 */
export function isCacheUsable(
  cached: unknown,
  currentSha: string,
  now: number
): cached is ICachedCheck {
  if (cached === null || typeof cached !== 'object') {
    return false
  }

  const entry = cached as Partial<ICachedCheck>

  return (
    typeof entry.checkedAt === 'number' &&
    typeof entry.checkedSha === 'string' &&
    normalizeSha(entry.checkedSha) === normalizeSha(currentSha) &&
    now - entry.checkedAt <= checkInterval &&
    (entry.status === null || isForkReleaseStatus(entry.status))
  )
}

function readCache(currentSha: string): ICachedCheck | undefined {
  const cached = getObject<ICachedCheck>(cacheKey)

  return isCacheUsable(cached, currentSha, Date.now()) ? cached : undefined
}

/**
 * A cached status is read back as untrusted JSON: an entry written by an older
 * build of the fork could be missing fields this code now dereferences.
 */
function isForkReleaseStatus(value: unknown): value is IForkReleaseStatus {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const status = value as Record<string, unknown>

  return (
    typeof status.releaseSha === 'string' &&
    typeof status.aheadBy === 'number' &&
    typeof status.releasePageUrl === 'string' &&
    typeof status.version === 'string' &&
    typeof status.builtAt === 'string'
  )
}

/**
 * The fork's newest build if it is ahead of this one, otherwise null — and null
 * is also the answer when the check could not be made, because there is nothing
 * to say then either. Results are cached for a day per install.
 */
export async function getForkReleaseStatus(): Promise<IForkReleaseStatus | null> {
  if (__FORK_FEED_URL__ === '') {
    return null
  }

  const currentSha = normalizeSha(__SHA__)

  const cached = readCache(currentSha)

  if (cached !== undefined) {
    return cached.status
  }

  const status = await checkForkRelease(currentSha)

  setObject(cacheKey, {
    checkedAt: Date.now(),
    checkedSha: currentSha,
    status,
  })

  return status
}

/**
 * Which release the user told the banner about once already. Keyed by commit
 * rather than by a timestamp so that the next rebuild of the fork asks again —
 * a reminder that never comes back would hide exactly the case this check
 * exists for.
 */
const dismissedReleaseKey = 'fork-release-dismissed'

export function isForkReleaseDismissed(releaseSha: string): boolean {
  return localStorage.getItem(dismissedReleaseKey) === releaseSha
}

export function dismissForkRelease(releaseSha: string) {
  localStorage.setItem(dismissedReleaseKey, releaseSha)
}
