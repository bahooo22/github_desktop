import { getSHA } from './git-info'
import {
  getForkFeedURL,
  getUpdatesURL,
  getChannel,
  getWindowsIdentifierName,
} from '../script/dist-info'
import { version, productName } from './package.json'

/**
 * Desktop is installed on the machine of whoever runs it, which makes it a public
 * client (RFC 6749 §2.1, RFC 8252 §8.4), and RFC 8252 §8.5 says what a secret
 * carried inside a distributed app is worth: "Secrets that are statically
 * included as part of an app distributed to multiple users should not be treated
 * as confidential secrets, as one user may inspect their copy and learn the
 * shared secret." So this pair lives in source rather than in a build secret, and
 * the Code Scanning finding `js/build-artifact-leak` about the `DefinePlugin`
 * sinks of `webpack.common.ts` is an accepted risk: the values are read by code
 * that ships, and shipping them is what protects nothing. Which bundle actually
 * carries the literals, and why no code change improves that, is in
 * `docs/fork-oauth-client.md`.
 *
 * These belong to GitHub's bundled test OAuth app — the same two lines are in
 * upstream's copy, and `docs/technical/oauth.md` labels them "THIS IS ONLY FOR
 * TESTING PURPOSES". No workflow of this fork sets `DESKTOP_OAUTH_CLIENT_SECRET`,
 * so every build the fork publishes carries exactly these public values.
 */
const devClientId = '3a723b10ac5575cc5bb9'
const devClientSecret = '22c34d87789a365981ed921352a7b9a8c3f69d54'

const channel = getChannel()

const s = JSON.stringify

const optionalStringReplacement = (value: string | undefined) =>
  value === undefined || value.length === 0 ? 'undefined' : s(value)

export function getReplacements() {
  const isDevBuild = channel === 'development'

  return {
    __OAUTH_CLIENT_ID__: s(process.env.DESKTOP_OAUTH_CLIENT_ID || devClientId),
    __OAUTH_SECRET__: s(
      process.env.DESKTOP_OAUTH_CLIENT_SECRET || devClientSecret
    ),
    __DARWIN__: process.platform === 'darwin',
    __WIN32__: process.platform === 'win32',
    __LINUX__: process.platform === 'linux',
    __APP_NAME__: s(productName),
    __APP_VERSION__: s(version),
    __DEV__: isDevBuild,
    __DEV_SECRETS__: isDevBuild || !process.env.DESKTOP_OAUTH_CLIENT_SECRET,
    __RELEASE_CHANNEL__: s(channel),
    __WINDOWS_IDENTIFIER_NAME__: s(getWindowsIdentifierName()),
    __UPDATES_URL__: s(process.env.DESKTOP_E2E_UPDATES_URL ?? getUpdatesURL()),
    __FORK_FEED_URL__: s(getForkFeedURL()),
    __ERROR_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.DESKTOP_ERROR_REPORTING_ENDPOINT
    ),
    __NON_FATAL_ERROR_REPORTING_ENDPOINT__: optionalStringReplacement(
      process.env.DESKTOP_NON_FATAL_ERROR_REPORTING_ENDPOINT
    ),
    __SHA__: s(getSHA()),
    __BUILD_DATE__: s(new Date().toISOString().slice(0, 10)),
    'process.platform': s(process.platform),
    'process.env.NODE_ENV': s(process.env.NODE_ENV || 'development'),
    'process.env.TEST_ENV': s(process.env.TEST_ENV),
  }
}
