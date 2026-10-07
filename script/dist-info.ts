import * as Path from 'path'
import * as Fs from 'fs'

import { getProductName, getVersion } from '../app/package-info'
import { join } from 'path'

const productName = getProductName()
const version = getVersion()

const projectRoot = Path.join(__dirname, '..')

export function getDistRoot() {
  return Path.join(projectRoot, 'dist')
}

export function getDistPath() {
  return Path.join(
    getDistRoot(),
    `${getExecutableName()}-${process.platform}-${getDistArchitecture()}`
  )
}

export function getExecutableName() {
  const suffix = process.env.NODE_ENV === 'development' ? '-dev' : ''

  if (process.platform === 'win32') {
    return `${getWindowsIdentifierName()}${suffix}`
  } else if (process.platform === 'linux') {
    return 'desktop'
  } else {
    return productName
  }
}

export function getOSXZipName() {
  return `${productName}-${getDistArchitecture()}.zip`
}

export function getOSXZipPath() {
  return Path.join(getDistPath(), '..', getOSXZipName())
}

export function getWindowsInstallerName() {
  const productName = getExecutableName()
  return `${productName}Setup-${getDistArchitecture()}.msi`
}

export function getWindowsInstallerPath() {
  return Path.join(getDistPath(), '..', 'installer', getWindowsInstallerName())
}

export function getWindowsStandaloneName() {
  const productName = getExecutableName()
  return `${productName}Setup-${getDistArchitecture()}.exe`
}

export function getWindowsStandalonePath() {
  return Path.join(getDistPath(), '..', 'installer', getWindowsStandaloneName())
}

export function getWindowsFullNugetPackageName(
  includeArchitecture: boolean = false
) {
  const architectureInfix = includeArchitecture
    ? `-${getDistArchitecture()}`
    : ''
  return `${getWindowsIdentifierName()}-${version}${architectureInfix}-full.nupkg`
}

export function getWindowsFullNugetPackagePath() {
  return Path.join(
    getDistPath(),
    '..',
    'installer',
    getWindowsFullNugetPackageName()
  )
}

export function getWindowsDeltaNugetPackageName(
  includeArchitecture: boolean = false
) {
  const architectureInfix = includeArchitecture
    ? `-${getDistArchitecture()}`
    : ''
  return `${getWindowsIdentifierName()}-${version}${architectureInfix}-delta.nupkg`
}

export function getWindowsDeltaNugetPackagePath() {
  return Path.join(
    getDistPath(),
    '..',
    'installer',
    getWindowsDeltaNugetPackageName()
  )
}

/**
 * This fork ships under its own Squirrel identifier instead of the upstream
 * 'GitHubDesktop' one. Two builds with the same identifier share
 * %LOCALAPPDATA%\<identifier>, the Start/Desktop shortcuts and – most
 * importantly – the auto-update feed, so an upstream install would happily
 * replace itself with a fork build and vice versa. A distinct identifier keeps
 * the fork and upstream Desktop side by side and makes the fork's feed the only
 * thing the fork can update from.
 */
export function getWindowsIdentifierName() {
  return 'GitHubDesktopL10n'
}

/**
 * The Windows App User Model Id Squirrel generates for an install, derived from
 * the identifier above so that notifications and taskbar grouping of a dev
 * build line up with the installed one.
 */
export function getWindowsAppUserModelId() {
  const identifier = getWindowsIdentifierName()
  return `com.squirrel.${identifier}.${identifier}`
}

export function getBundleSizes() {
  const outPath = Path.join(projectRoot, 'out')
  return {
    // eslint-disable-next-line no-sync
    rendererBundleSize: Fs.statSync(Path.join(outPath, 'renderer.js')).size,
    // eslint-disable-next-line no-sync
    mainBundleSize: Fs.statSync(Path.join(outPath, 'main.js')).size,
  }
}
export const isPublishable = () =>
  ['production', 'beta', 'test'].includes(getChannel())

export const getChannel = () =>
  process.env.RELEASE_CHANNEL ?? process.env.NODE_ENV ?? 'development'

export function getDistArchitecture(): 'arm64' | 'x64' {
  // If a specific npm_config_arch is set, we use that one instead of the OS arch (to support cross compilation)
  if (
    process.env.npm_config_arch === 'arm64' ||
    process.env.npm_config_arch === 'x64'
  ) {
    return process.env.npm_config_arch
  }

  if (process.arch === 'arm64') {
    return 'arm64'
  }

  // TODO: Check if it's x64 running on an arm64 Windows with IsWow64Process2
  // More info: https://www.rudyhuyn.com/blog/2017-12-13/how-to-detect-that-your-x86-application-runs-on-windows-on-arm/
  // Right now (March 3, 2021) is not very important because support for x64
  // apps on an arm64 Windows is experimental. See:
  // https://blogs.windows.com/windows-insider/2020-12-10/introducing-x64-emulation-in-preview-for-windows-10-on-arm-pcs-to-the-windows-insider-program/

  return 'x64'
}

/** Host of upstream's own deployment feed, see `isCentralUpdatesFeed` below. */
const centralUpdatesHost = 'central.github.com'

/**
 * Feed for this fork's releases: the assets of a GitHub Release, one release
 * per architecture (a single tag can't serve both x64 and arm64 `RELEASES`
 * files). Squirrel.Windows appends `RELEASES` to whatever it's given, so the
 * value has to be the trailing-slash download base of the tag, not a link to a
 * concrete asset.
 */
export function getUpdatesURL() {
  if (process.env.DESKTOP_UPDATES_URL !== undefined) {
    return process.env.DESKTOP_UPDATES_URL
  }

  const tag =
    getDistArchitecture() === 'arm64' ? 'latest-win-arm64' : 'latest-win-x64'

  return `https://github.com/bahooo22/github_desktop/releases/download/${tag}/`
}

/**
 * Whether the feed is upstream's Central endpoint rather than this fork's
 * release assets. Central-specific behaviour (the staggered-release query
 * parameters and the `/desktop/desktop/arm64/latest` path rewrite) is
 * meaningless – and can actively break – a plain asset download, so callers
 * gate it on this.
 */
export function isCentralUpdatesFeed(url: string): boolean {
  try {
    return new URL(url).hostname === centralUpdatesHost
  } catch {
    return false
  }
}

export function shouldMakeDelta() {
  // Only production and beta channels include deltas. Test releases aren't
  // necessarily sequential so deltas wouldn't make sense.
  //
  // The flag is for the very first release into a fork's own feed: there is no
  // RELEASES there yet, and electron-winstaller spawns SyncReleases.exe whenever
  // `remoteReleases` is set (lib/index.js:272-274) and rejects on its non-zero
  // exit (lib/spawn-promise.js), so the whole `yarn package` run dies. Skipping
  // the delta keeps the production channel — and with it the app's update
  // behaviour — intact, which a `RELEASE_CHANNEL=test` bootstrap would not.
  if (process.env.DESKTOP_SKIP_DELTA === '1') {
    return false
  }

  return ['production', 'beta'].includes(getChannel())
}

/**
 * Path to the directory containing all icon assets for the current release channel.
 */
export function getIconDirectory() {
  const devOrProd = getChannel() === 'development' ? 'dev' : 'prod'
  return join(projectRoot, 'app', 'static', 'logos', devOrProd)
}

export function getChannelFromReleaseBranch(): string {
  const branchName = process.env.GITHUB_HEAD_REF ?? ''

  if (!branchName.includes('releases/')) {
    return 'development'
  }

  if (getVersion().includes('test')) {
    return 'test'
  }

  if (getVersion().includes('beta')) {
    return 'beta'
  }

  return 'production'
}
