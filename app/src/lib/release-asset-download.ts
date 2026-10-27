/**
 * Rules shared by the renderer's dialog and the main process downloader, so
 * neither side can be tricked into writing a file the other would refuse.
 */

/**
 * Hosts GitHub redirects a release asset download through.
 *
 * `central.github.com` is the official channel's own endpoint: unlike this
 * fork's releases it has no API release to read an asset name from — a
 * production release of upstream is often published to the feed days before it
 * appears in GitHub Releases — so the download starts there and Electron's
 * `net` follows the redirect to the release CDN for us.
 */
const releaseAssetHosts = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
  'central.github.com',
])

/** The packages this fork publishes for its own releases. */
export const releaseAssetExtensions: ReadonlyArray<string> = [
  '.deb',
  '.AppImage',
  '.zip',
]

/**
 * What the official channel serves: a Windows installer on Windows, an archive
 * on macOS.
 *
 * Kept apart from the list above so a fork release can never hand out an
 * executable — the caller does not choose which list applies, the URL does.
 */
const upstreamInstallerExtensions: ReadonlyArray<string> = [
  '.exe',
  '.zip',
]

/**
 * The official channel's endpoint, the only URL that may carry an installer
 * rather than one of this fork's packages.
 */
function isUpstreamInstallerUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'central.github.com'
  } catch {
    return false
  }
}

/**
 * Which file types a download may save under, decided by the URL alone so a
 * caller cannot pick the looser list.
 */
export function releaseAssetExtensionsFor(url: string): ReadonlyArray<string> {
  return isUpstreamInstallerUrl(url)
    ? upstreamInstallerExtensions
    : releaseAssetExtensions
}

export function isAllowedReleaseAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    return (
      parsed.protocol === 'https:' && releaseAssetHosts.has(parsed.hostname)
    )
  } catch {
    return false
  }
}

export function isAllowedReleaseAssetName(
  name: string,
  extensions: ReadonlyArray<string> = releaseAssetExtensions
): boolean {
  const lower = name.toLowerCase()

  return extensions.some(extension => lower.endsWith(extension.toLowerCase()))
}

/**
 * `desired` if free, otherwise `name (1).ext`, `name (2).ext` and so on. `taken`
 * is a callback so the rule can be tested without touching the disk.
 */
export function uniqueFileName(
  desired: string,
  taken: (path: string) => boolean
): string {
  if (!taken(desired)) {
    return desired
  }

  const extension = desired.slice(desired.lastIndexOf('.'))

  const base =
    extension.length > 1 ? desired.slice(0, -extension.length) : desired

  for (let counter = 1; counter < 1000; counter++) {
    const candidate = `${base} (${counter})${
      extension.length > 1 ? extension : ''
    }`

    if (!taken(candidate)) {
      return candidate
    }
  }

  return `${base} (${Date.now()})${extension}`
}

export interface IReleaseAssetDownloadProgress {
  readonly received: number
  readonly total: number
}

export type ReleaseAssetDownloadResult =
  | { readonly status: 'saved'; readonly path: string }
  | { readonly status: 'error'; readonly message: string }
