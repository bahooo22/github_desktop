import * as React from 'react'
import { ErrorType } from './shared'
import { TitleBar } from '../ui/window/title-bar'
import { encodePathAsUrl } from '../lib/path'
import { WindowState } from '../lib/window-state'
import { Octicon } from '../ui/octicons'
import * as octicons from '../ui/octicons/octicons.generated'
import { Button } from '../ui/lib/button'
import { LinkButton } from '../ui/lib/link-button'
import { getVersion } from '../ui/lib/app-proxy'
import { getOS } from '../lib/get-os'
import * as ipcRenderer from '../lib/ipc-renderer'
import { getCurrentWindowState } from '../ui/main-process-proxy'
import { Trans, localization, registerBuiltInLocales, t } from '../lib/l10n'

// The crash window is a standalone renderer entry that never runs the main
// renderer's localization bootstrap. Registering the shipped catalogs and
// detecting the operating system language here lets the translated strings
// below resolve (falling back to English) instead of rendering raw keys. We
// deliberately avoid the IPC-backed `initializeLocalization` because the crash
// process has neither a main-process round trip nor the renderer `log` global
// that its failure path relies on.
registerBuiltInLocales()
localization.setSystemLocales(
  (typeof navigator === 'undefined' ? [] : navigator.languages) ?? []
)

// This is a weird one, let's leave it as a placeholder
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ICrashAppProps {}

interface ICrashAppState {
  /**
   * Whether this error was thrown before we were able to launch
   * the main renderer process or not. See the documentation for
   * the ErrorType type for more details.
   */
  readonly type?: ErrorType

  /**
   * The error that caused us to spawn the crash process.
   */
  readonly error?: Error

  /**
   * The current state of the Window, ie maximized, minimized full-screen etc.
   */
  readonly windowState: WindowState | null
}

// Note that we're reusing the welcome illustration here, any changes to it
// will have to be reflected in the welcome flow as well.
const BottomImageUri = encodePathAsUrl(
  __dirname,
  'static/welcome-illustration-left-bottom.svg'
)

const issuesUri = 'https://github.com/desktop/desktop/issues'

/**
 * Formats an error by attempting to strip out user-identifiable information
 * from paths and appends system metadata such and the running version and
 * current operating system.
 */
function prepareErrorMessage(error: Error) {
  let message

  if (error.stack) {
    message = error.stack
      .split('\n')
      .map(line => {
        // The stack trace lines come in two forms:
        //
        // `at Function.module.exports.Emitter.simpleDispatch (SOME_USER_SPECIFIC_PATH/app/node_modules/event-kit/lib/emitter.js:25:14)`
        // `at file:///SOME_USER_SPECIFIC_PATH/app/renderer.js:6:4250`
        //
        // We want to try to strip the user-specific path part out.
        const match = line.match(/(\s*)(.*)(\(|file:\/\/\/).*(app.*)/)

        return !match || match.length < 5
          ? line
          : match[1] + match[2] + match[3] + match[4]
      })
      .join('\n')
  } else {
    message = `${error.name}: ${error.message}`
  }

  return `${message}\n\nVersion: ${getVersion()}\nOS: ${getOS()}\n`
}

/**
 * The root component for our crash process.
 *
 * The crash process is responsible for presenting the user with an
 * error after the main process or any renderer process has crashed due
 * to an uncaught exception or when the main renderer has failed to load.
 *
 * Exercise caution when working with the crash process. If the crash
 * process itself crashes we've failed.
 */
export class CrashApp extends React.Component<ICrashAppProps, ICrashAppState> {
  public constructor(props: ICrashAppProps) {
    super(props)

    this.state = {
      windowState: null,
    }

    this.initializeWindowState()
  }

  public componentDidMount() {
    ipcRenderer.on('window-state-changed', this.onWindowStateChanged)

    ipcRenderer.on('error', (_, crashDetails) => this.setState(crashDetails))

    ipcRenderer.send('crash-ready')
  }

  public componentWillUnmount() {
    ipcRenderer.removeListener(
      'window-state-changed',
      this.onWindowStateChanged
    )
  }

  private initializeWindowState = async () => {
    const windowState = await getCurrentWindowState()
    if (windowState === undefined) {
      return
    }

    this.setState({ windowState })
  }

  private onWindowStateChanged = (
    _: Electron.IpcRendererEvent,
    windowState: WindowState
  ) => {
    this.setState({ windowState })
  }

  private onQuitButtonClicked = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    ipcRenderer.send('crash-quit')
  }

  private renderTitle() {
    const message =
      this.state.type === 'launch'
        ? t('crash.launchTitle')
        : t('crash.errorTitle')

    return (
      <header>
        <Octicon symbol={octicons.stop} className="error-icon" />
        <h1>{message}</h1>
      </header>
    )
  }

  private renderDescription() {
    const components = { link: <LinkButton uri={issuesUri} /> }

    if (this.state.type === 'launch') {
      return (
        <Trans as="p" k="crash.launchDescription" components={components} />
      )
    }

    return (
      <Trans as="p" k="crash.runtimeErrorDescription" components={components} />
    )
  }

  private renderErrorDetails() {
    const error = this.state.error

    if (!error) {
      return
    }

    return <pre className="error">{prepareErrorMessage(error)}</pre>
  }

  private renderFooter() {
    return <div className="footer">{this.renderQuitButton()}</div>
  }

  private renderQuitButton() {
    // We don't support restarting in dev mode since we can't
    // control the life time of the dev server.
    const quitText = __DEV__ ? t('crash.quit') : t('crash.quitAndRestart')

    return (
      <Button type="submit" onClick={this.onQuitButtonClicked}>
        {quitText}
      </Button>
    )
  }

  private renderBackgroundGraphics() {
    return (
      <img className="background-graphic-bottom" alt="" src={BottomImageUri} />
    )
  }

  public render() {
    return (
      <div id="crash-app">
        <TitleBar
          showAppIcon={false}
          titleBarStyle="light"
          windowState={this.state.windowState}
        />
        <main>
          {this.renderTitle()}
          {this.renderDescription()}
          {this.renderErrorDetails()}
          {this.renderFooter()}
          {this.renderBackgroundGraphics()}
        </main>
      </div>
    )
  }
}
