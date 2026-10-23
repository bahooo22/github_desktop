import { bundleID, companyName, productName, version } from './package.json'

/**
 * The macOS build installs beside upstream, so it needs its own application
 * name: the same `.app` name and bundle ID would make LaunchServices treat the
 * two as one app and share Keychain and application-support data.
 */
const macOSProductName = `${productName} L10n`

export function getProductName() {
  const name = process.platform === 'darwin' ? macOSProductName : productName

  return process.env.NODE_ENV === 'development' ? `${name}-dev` : name
}

export function getCompanyName() {
  return companyName
}

export function getVersion() {
  return version
}

export function getBundleID() {
  const base = process.platform === 'darwin' ? `${bundleID}L10n` : bundleID

  return process.env.NODE_ENV === 'development' ? `${base}Dev` : base
}
