export function getSha() {
  const gitHubSha = process.env.GITHUB_SHA
  if (isGitHubActions() && gitHubSha !== undefined && gitHubSha.length > 0) {
    return gitHubSha
  }

  throw new Error(
    `Unable to get the SHA for the current platform. Check the documentation for the expected environment variables.`
  )
}

export function isGitHubActions() {
  return process.env.GITHUB_ACTIONS === 'true'
}

/**
 * Azure code signing is only reachable when the workflow has been given the
 * secrets that feed the signing action (ci.yml passes both). A fork running the
 * same workflow without a signing account has neither, and the signing setup
 * below would abort the build on a missing Azure.CodeSigning.Dlib.dll instead
 * of producing an unsigned installer.
 */
export function isCodeSigningConfigured() {
  return (
    process.env.AZURE_TENANT_ID !== undefined &&
    process.env.AZURE_CLIENT_ID !== undefined
  )
}
