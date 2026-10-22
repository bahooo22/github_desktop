import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/**
 * Where Electron keeps this application's data. The CLI runs as Node, before
 * any `app` object exists, so the path has to be reconstructed from the same
 * inputs Electron uses: the platform, the app name and the environment.
 */
export function getUserDataPath(
  platform: NodeJS.Platform,
  appName: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  home: string = homedir()
): string {
  if (platform === 'win32') {
    return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), appName)
  }

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', appName)
  }

  return join(env.XDG_CONFIG_HOME ?? join(home, '.config'), appName)
}

/**
 * The language chosen in Settings → Language, or `null` when the application
 * follows the operating system. The file is written by the main process and
 * lives next to the user's catalogs; a missing or broken file means there is
 * no choice to honour.
 */
export function readPreferredLanguage(userDataPath: string): string | null {
  try {
    const raw = readFileSync(
      join(userDataPath, 'localizations', 'settings.json'),
      'utf8'
    )
    const language = JSON.parse(raw)?.language
    return typeof language === 'string' ? language : null
  } catch {
    return null
  }
}

/**
 * The help text is built from the same catalog the interface uses. `translate`
 * is passed in rather than imported so the layout can be checked without
 * loading every shipped catalog.
 */
export function formatCliUsage(
  command: string,
  translate: (key: string) => string
): string {
  const indent = ' '.repeat(36)
  const row = (args: string, description: string) =>
    `  ${command}${args}`.padEnd(36) + description + '\n'
  const hint = translate('cli.help-clone-hint')
    .split('\n')
    .map(line => indent + line)
    .join('\n')

  return (
    translate('cli.help-usage') +
    '\n' +
    row('', translate('cli.help-open-current')) +
    row(' open [path]', translate('cli.help-open-path')) +
    row(' clone [-b branch] <url>', translate('cli.help-clone')) +
    hint +
    '\n'
  )
}
