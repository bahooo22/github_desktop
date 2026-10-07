import * as OS from 'os'
import { compare } from 'compare-versions'
import memoizeOne from 'memoize-one'

function getSystemVersionSafe() {
  if (__DARWIN__) {
    // getSystemVersion only exists when running under Electron, and not when
    // running unit tests which frequently end up calling this. There are no
    // other known reasons why getSystemVersion() would return anything other
    // than a string
    return 'getSystemVersion' in process
      ? process.getSystemVersion()
      : undefined
  } else {
    return OS.release()
  }
}

function systemVersionGreaterThanOrEqualTo(version: string) {
  const sysver = getSystemVersionSafe()
  return sysver === undefined ? false : compare(sysver, version, '>=')
}

function systemVersionLessThan(version: string) {
  const sysver = getSystemVersionSafe()
  return sysver === undefined ? false : compare(sysver, version, '<')
}

/** Get the OS we're currently running on. */
export function getOS(): string {
  const version = getSystemVersionSafe()
  if (__DARWIN__) {
    return `Mac OS ${version}`
  } else if (__WIN32__) {
    return `Windows ${version}`
  } else {
    return `${OS.type()} ${version}`
  }
}

/** We're currently running macOS and it is macOS Ventura. */
export const isMacOSVentura = memoizeOne(
  () =>
    __DARWIN__ &&
    systemVersionGreaterThanOrEqualTo('13.0') &&
    systemVersionLessThan('14.0')
)

/** We're currently running macOS and it is macOS Sonoma. */
export const isMacOSSonoma = memoizeOne(
  () =>
    __DARWIN__ &&
    systemVersionGreaterThanOrEqualTo('14.0') &&
    systemVersionLessThan('15.0')
)

/** We're currently running macOS and it is macOS Sequoia. */
export const isMacOSSequoia = memoizeOne(
  () =>
    __DARWIN__ &&
    systemVersionGreaterThanOrEqualTo('15.0') &&
    systemVersionLessThan('16.0')
)

/** We're currently running macOS and it is macOS Sonoma or later. */
export const isMacOSSonomaOrLater = memoizeOne(
  () => __DARWIN__ && systemVersionGreaterThanOrEqualTo('14.0')
)

/** We're currently running macOS and it is macOS Catalina or earlier. */
export const isMacOSCatalinaOrEarlier = memoizeOne(
  () => __DARWIN__ && systemVersionLessThan('10.16')
)

/** We're currently running macOS and it is at least Mojave. */
export const isMacOSMojaveOrLater = memoizeOne(
  () => __DARWIN__ && systemVersionGreaterThanOrEqualTo('10.13.0')
)

/** We're currently running macOS and it is at least Big Sur. */
export const isMacOSBigSurOrLater = memoizeOne(
  // We're using 10.16 rather than 11.0 here due to
  // https://github.com/electron/electron/issues/26419
  () => __DARWIN__ && systemVersionGreaterThanOrEqualTo('10.16')
)

/** We're currently running macOS and it is at least Tahoe. */
export const isMacOSTahoeOrLater = memoizeOne(
  () => __DARWIN__ && systemVersionGreaterThanOrEqualTo('26')
)

/** We're currently running Windows 10 and it is at least 1809 Preview Build 17666. */
export const isWindows10And1809Preview17666OrLater = memoizeOne(
  () => __WIN32__ && systemVersionGreaterThanOrEqualTo('10.0.17666')
)

export const isWindowsAndNoLongerSupportedByElectron = memoizeOne(
  () => __WIN32__ && systemVersionLessThan('10')
)

export const isMacOSAndNoLongerSupportedByElectron = memoizeOne(
  () => __DARWIN__ && systemVersionLessThan('13.0')
)

export const isOSNoLongerSupportedByElectron = memoizeOne(
  () =>
    isMacOSAndNoLongerSupportedByElectron() ||
    isWindowsAndNoLongerSupportedByElectron()
)

/**
 * A type alias, not an interface: only the former gets an implicit index
 * signature, which is what lets it be passed straight to `t()` as translation
 * parameters.
 */
export type ISystemInfo = {
  /** OS family, spelled the way the user sees it in their own settings. */
  readonly name: string
  /** OS version, including the marketing name where the raw one lacks it. */
  readonly version: string
  /** Instruction set of the machine, not of this process. */
  readonly arch: string
}

function getSystemArchitecture(): string {
  const machine = (OS.machine() ?? '').toLowerCase()

  if (machine === 'amd64' || machine === 'x86_64' || machine === 'x64') {
    return 'x64'
  }
  if (machine === 'arm64' || machine === 'aarch64') {
    return 'arm64'
  }
  if (machine === 'i386' || machine === 'i686' || machine === 'x86') {
    return 'x86'
  }

  return machine
}

/**
 * The machine the app runs on, in three parts so a translation can order them
 * the way its language reads.
 *
 * Windows is the awkward one: `os.release()` answers `10.0.<build>` for both
 * Windows 10 and 11, so the marketing name is derived from the build number
 * (22000 is the first Windows 11 build) and the raw release is kept next to it
 * rather than replaced by a guess.
 */
export const getSystemInfo = memoizeOne((): ISystemInfo => {
  const arch = getSystemArchitecture()

  if (__DARWIN__) {
    return { name: 'macOS', version: getSystemVersionSafe() ?? '', arch }
  }

  if (__WIN32__) {
    const release = OS.release()
    const build = parseInt(release.split('.')[2] ?? '0', 10)
    const marketing = build >= 22000 ? '11' : '10'

    return { name: 'Windows', version: `${marketing} (${release})`, arch }
  }

  return { name: 'Linux', version: OS.release(), arch }
})
