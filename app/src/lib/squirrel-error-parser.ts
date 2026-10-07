import { t } from './l10n/core'

// an error that Electron raises when it can't find the installation for the running app
const squirrelMissingRegex = /^Can not find Squirrel$/

// an error that occurs when Squirrel isn't able to reach the update server.
// The host is not part of the pattern: this fork feeds from github.com, while
// the upstream literal only ever names central.github.com.
const squirrelDNSRegex =
  /System\.Net\.WebException: The remote name could not be resolved/

// an error that occurs when the connection times out during updating
const squirrelTimeoutRegex =
  /A connection attempt failed because the connected party did not properly respond after a period of time, or established connection failed because connected host has failed to respond/

/**
 * This method parses known error messages from Squirrel.Windows and returns a
 * friendlier message to the user.
 *
 * @param error The underlying error from Squirrel.
 */
export function parseError(error: Error): Error | null {
  if (squirrelMissingRegex.test(error.message)) {
    // Electron raises this only when there is no Update.exe one level above the
    // running exe, so the app was launched from a loose bundle, not installed —
    // which is why the message names that instead of blaming a dependency.
    return new Error(t('updateErrors.missingSquirrel'))
  }
  if (squirrelDNSRegex.test(error.message)) {
    return new Error(t('updateErrors.serverUnreachable'))
  }
  if (squirrelTimeoutRegex.test(error.message)) {
    return new Error(t('updateErrors.timeout'))
  }

  return null
}
