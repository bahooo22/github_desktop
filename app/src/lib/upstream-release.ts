/**
 * The official channel's installer for the machine this fork runs on.
 *
 * Upstream serves production releases from `central.github.com`, which answers
 * with a redirect to the release CDN instead of an asset list, and the release
 * often reaches that endpoint days before it appears in GitHub Releases. So the
 * file name is stated here, and only the download is handed to the main
 * process, which follows the redirect.
 *
 * Nothing is launched afterwards: the official build is a separate application
 * that installs beside this fork, so the user runs the downloaded file
 * themselves.
 */
export interface IUpstreamInstaller {
  readonly url: string
  readonly fileName: string
}

const centralLatest =
  'https://central.github.com/deployments/desktop/desktop/latest'

export function getUpstreamInstaller(
  platform: string,
  arch: string
): IUpstreamInstaller | null {
  if (platform === 'win32') {
    // There is no arm64 installer on the channel — measured 26.10.2026,
    // `latest/win32arm64` answers without a location — so an arm64 machine is
    // offered the x64 build, which is what the channel itself serves there.
    return {
      url: `${centralLatest}/win32`,
      fileName: 'GitHubDesktopSetup-x64.exe',
    }
  }

  if (platform === 'darwin') {
    return arch === 'arm64'
      ? {
          url: `${centralLatest}/darwin-arm64`,
          fileName: 'GitHubDesktop-arm64.zip',
        }
      : {
          url: `${centralLatest}/darwin`,
          fileName: 'GitHubDesktop-x64.zip',
        }
  }

  // Upstream publishes no Linux build; this fork's own packages are the answer
  // on that platform, and the About dialog says so through the fork line.
  return null
}
