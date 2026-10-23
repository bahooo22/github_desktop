/**
 * Rules shared by the renderer's dialog and the main process downloader, so
 * neither side can be tricked into writing a file the other would refuse.
 */

/** Hosts GitHub redirects a release asset download through. */
const releaseAssetHosts = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
])

/** The only files this fork offers for download. */
export const releaseAssetExtensions: ReadonlyArray<string> = [
  '.deb',
  '.AppImage',
  '.zip',
]

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

export function isAllowedReleaseAssetName(name: string): boolean {
  const lower = name.toLowerCase()

  return releaseAssetExtensions.some(extension =>
    lower.endsWith(extension.toLowerCase())
  )
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
