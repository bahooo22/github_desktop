import { join, resolve } from 'path'
import parse from 'minimist'
import { execFile, spawn } from 'child_process'
import { localization, t } from '../lib/l10n/core'
import { registerBuiltInLocales } from '../lib/l10n/builtins'
import { formatCliUsage, getUserDataPath, readPreferredLanguage } from './help'

const run = (...args: Array<string>) => {
  function cb(e: unknown | null, stderr?: string) {
    if (e) {
      console.error(`Error running command ${args}`)
      console.error(stderr ?? `${e}`)
      process.exit(
        typeof e === 'object' && 'code' in e && typeof e.code === 'number'
          ? e.code
          : 1
      )
    }
  }

  if (process.platform === 'darwin') {
    execFile('open', ['-n', join(__dirname, '../../..'), '--args', ...args], cb)
  } else if (process.platform === 'win32') {
    const exeName = `${__WINDOWS_IDENTIFIER_NAME__}${__DEV__ ? '-dev' : ''}.exe`
    spawn(join(__dirname, `../../${exeName}`), args, {
      detached: true,
      stdio: 'ignore',
    })
      .on('error', cb)
      .on('exit', code => (process.exitCode = code ?? process.exitCode))
      .unref()
  } else {
    throw new Error('Unsupported platform')
  }
}

const args = parse(process.argv.slice(2), {
  alias: { help: 'h', branch: 'b' },
  boolean: ['help'],
})

/**
 * The CLI is a separate Node process without an Electron `app`, so it reads
 * the language choice the main process wrote and loads the same catalogs the
 * interface uses.
 */
function initializeLocalization(): void {
  registerBuiltInLocales()
  localization.setSystemLocales([
    Intl.DateTimeFormat().resolvedOptions().locale,
  ])
  localization.setRequestedLocale(
    readPreferredLanguage(getUserDataPath(process.platform, __APP_NAME__))
  )
}

const usage = (exitCode = 1): never => {
  // On Windows the fork's entry point is installed under its own name, because
  // upstream writes `github` into its own `bin` and both directories are on
  // PATH (see `getWindowsCliCommandName`). Elsewhere the historical name stands.
  const command = __WIN32__ ? __WINDOWS_CLI_COMMAND_NAME__ : 'github'

  initializeLocalization()
  process.stderr.write(formatCliUsage(command, t))
  process.exit(exitCode)
}

delete process.env.ELECTRON_RUN_AS_NODE

if (args.help || args._.at(0) === 'help') {
  usage(0)
} else if (args._.at(0) === 'clone') {
  const urlArg = args._.at(1)
  // Assume name with owner slug if it looks like it
  const url =
    urlArg && /^[^\/]+\/[^\/]+$/.test(urlArg)
      ? `https://github.com/${urlArg}`
      : urlArg

  if (!url) {
    usage(1)
  } else if (typeof args.branch === 'string') {
    run(`--cli-clone=${url}`, `--cli-branch=${args.branch}`)
  } else {
    run(`--cli-clone=${url}`)
  }
} else {
  const [firstArg, secondArg] = args._
  const pathArg = firstArg === 'open' ? secondArg : firstArg
  const path = resolve(pathArg ?? '.')
  run(`--cli-open=${path}`)
}
