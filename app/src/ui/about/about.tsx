import * as React from 'react'

import { Row } from '../lib/row'
import { Button } from '../lib/button'
import {
  Dialog,
  DialogError,
  DialogContent,
  DefaultDialogFooter,
} from '../dialog'
import { LinkButton } from '../lib/link-button'
import { IUpdateState, UpdateStatus } from '../lib/update-store'
import { Loading } from '../lib/loading'
import { RelativeTime } from '../relative-time'
import { assertNever } from '../../lib/fatal-error'
import { ReleaseNotesUri } from '../lib/releases'
import { encodePathAsUrl } from '../../lib/path'
import {
  getSystemInfo,
  isOSNoLongerSupportedByElectron,
} from '../../lib/get-os'
import { AriaLiveContainer } from '../accessibility/aria-live-container'
import { formatDate } from '../../lib/format-date'
import { t, Trans, localization } from '../../lib/l10n'
import { buildFeedbackIssueUrl } from '../localization/translation-issue'
import { getUpstreamStatus, IUpstreamStatus } from '../../lib/upstream-status'
import {
  getForkReleaseStatus,
  IForkReleaseStatus,
} from '../../lib/fork-release'

const logoPath = __DARWIN__
  ? 'static/logo-64x64@2x.png'
  : 'static/windows-logo-64x64@2x.png'
const DesktopLogo = encodePathAsUrl(__dirname, logoPath)

// This fork's translations are maintained outside the upstream repository, so
// the credit line names the translator and offers them a way to report on the
// very build they are looking at.
const LocalizationAuthorUri = 'https://github.com/bahooo22/'

interface IAboutProps {
  /**
   * Event triggered when the dialog is dismissed by the user in the
   * ways described in the Dialog component's dismissible prop.
   */
  readonly onDismissed: () => void

  /**
   * The name of the currently installed (and running) application
   */
  readonly applicationName: string

  /**
   * The currently installed (and running) version of the app.
   */
  readonly applicationVersion: string

  /**
   * The currently installed (and running) architecture of the app.
   */
  readonly applicationArchitecture: string

  /** A function to call to kick off a non-staggered update check. */
  readonly onCheckForNonStaggeredUpdates: () => void

  readonly onShowAcknowledgements: () => void

  /** A function to call when the user wants to see Terms and Conditions. */
  readonly onShowTermsAndConditions: () => void
  readonly onQuitAndInstall: () => void

  readonly updateState: IUpdateState

  /**
   * A flag to indicate whether the About dialog should ignore that
   * it's running in development mode. Used exclusively by the AboutTestDialog
   */
  readonly allowDevelopment?: boolean
}

interface IAboutState {
  readonly upstreamStatus: IUpstreamStatus | null
  readonly forkReleaseStatus: IForkReleaseStatus | null
}

interface IUpdateInfoProps {
  readonly message: string
  readonly richMessage?: JSX.Element
  readonly loading?: boolean
}

class UpdateInfo extends React.Component<IUpdateInfoProps> {
  public render() {
    return (
      <div className="update-status">
        <AriaLiveContainer message={this.props.message} />

        {this.props.loading && <Loading />}
        {this.props.richMessage ?? this.props.message}
      </div>
    )
  }
}

/**
 * A dialog that presents information about the
 * running application such as name and version.
 */
export class About extends React.Component<IAboutProps, IAboutState> {
  private mounted = false

  public constructor(props: IAboutProps) {
    super(props)

    this.state = { upstreamStatus: null, forkReleaseStatus: null }
  }

  public componentDidMount() {
    this.mounted = true

    getUpstreamStatus()
      .then(upstreamStatus => {
        if (this.mounted) {
          this.setState({ upstreamStatus })
        }
      })
      .catch(e => log.warn(`[about] upstream status check failed`, e))

    getForkReleaseStatus()
      .then(forkReleaseStatus => {
        if (this.mounted) {
          this.setState({ forkReleaseStatus })
        }
      })
      .catch(e => log.warn(`[about] fork release check failed`, e))
  }

  public componentWillUnmount() {
    this.mounted = false
  }

  private get canCheckForUpdates() {
    return (
      __RELEASE_CHANNEL__ !== 'development' ||
      this.props.allowDevelopment === true
    )
  }

  private renderUpdateButton() {
    if (!this.canCheckForUpdates) {
      return null
    }

    const updateStatus = this.props.updateState.status

    switch (updateStatus) {
      case UpdateStatus.UpdateReady:
        return (
          <Row>
            <Button onClick={this.props.onQuitAndInstall}>
              {t('about.quit-and-install-update')}
            </Button>
          </Row>
        )
      case UpdateStatus.UpdateNotAvailable:
      case UpdateStatus.CheckingForUpdates:
      case UpdateStatus.UpdateAvailable:
      case UpdateStatus.UpdateNotChecked:
        const disabled =
          ![
            UpdateStatus.UpdateNotChecked,
            UpdateStatus.UpdateNotAvailable,
          ].includes(updateStatus) || isOSNoLongerSupportedByElectron()

        const buttonTitle = t('about.check-for-updates')

        return (
          <Row>
            <Button
              disabled={disabled}
              onClick={this.props.onCheckForNonStaggeredUpdates}
            >
              {buttonTitle}
            </Button>
          </Row>
        )
      default:
        return assertNever(
          updateStatus,
          `Unknown update status ${updateStatus}`
        )
    }
  }

  private renderUpdateDetails() {
    if (__LINUX__) {
      return null
    }

    if (!this.canCheckForUpdates) {
      return <p>{t('about.dev-no-updates')}</p>
    }

    const { status, lastSuccessfulCheck } = this.props.updateState

    switch (status) {
      case UpdateStatus.CheckingForUpdates:
        return <UpdateInfo message={t('about.checking')} loading={true} />
      case UpdateStatus.UpdateAvailable:
        return <UpdateInfo message={t('about.downloading')} loading={true} />
      case UpdateStatus.UpdateNotAvailable:
        if (!lastSuccessfulCheck) {
          return null
        }

        const richMessage = (
          <p>
            <Trans
              k="about.up-to-date-rich"
              components={{ time: <RelativeTime date={lastSuccessfulCheck} /> }}
            />
          </p>
        )

        const absoluteDate = formatDate(lastSuccessfulCheck, {
          dateStyle: 'full',
          timeStyle: 'short',
        })

        const upToDateMessage = t('about.up-to-date', { date: absoluteDate })

        return (
          <UpdateInfo message={upToDateMessage} richMessage={richMessage} />
        )
      case UpdateStatus.UpdateReady:
        return <UpdateInfo message={t('about.update-ready')} />
      case UpdateStatus.UpdateNotChecked:
        return null
      default:
        return assertNever(status, `Unknown update status ${status}`)
    }
  }

  private renderUpdateErrors() {
    if (__LINUX__) {
      return null
    }

    if (!this.canCheckForUpdates) {
      return null
    }

    if (isOSNoLongerSupportedByElectron()) {
      return (
        <DialogError>
          <Trans
            k="about.os-unsupported"
            components={{
              link: (
                <LinkButton uri="https://docs.github.com/en/desktop/installing-and-configuring-github-desktop/overview/supported-operating-systems" />
              ),
            }}
          />
        </DialogError>
      )
    }

    if (!this.props.updateState.lastSuccessfulCheck) {
      return <DialogError>{t('about.check-time-error')}</DialogError>
    }

    return null
  }

  private renderBetaLink() {
    if (__RELEASE_CHANNEL__ === 'beta') {
      return
    }

    return (
      <div>
        <p className="no-padding">{t('about.looking-for-features')}</p>
        <p className="no-padding">
          <Trans
            k="about.beta-channel"
            components={{
              link: <LinkButton uri="https://desktop.github.com/beta" />,
            }}
          />
        </p>
      </div>
    )
  }

  private renderUpstreamStatus() {
    const status = this.state.upstreamStatus

    if (status === null) {
      return null
    }

    return (
      <p className="no-padding">
        <Trans
          k="about.upstream-behind"
          params={{
            version: status.latestVersion,
            count: status.releasesBehind,
          }}
          components={{ link: <LinkButton uri={ReleaseNotesUri} /> }}
        />
      </p>
    )
  }

  /**
   * This fork's own release, when it was built from a commit ahead of the
   * installed one. Unlike the upstream line above, a fork release carries the
   * version it merged from, so the version says nothing — what identifies the
   * newer build is the commit it was made from.
   */
  private renderForkRelease() {
    const status = this.state.forkReleaseStatus

    if (status === null) {
      return null
    }

    return (
      <p className="no-padding">
        <Trans
          k="about.forkRelease"
          params={{
            sha: status.releaseSha.substring(0, 10),
            date: formatDate(new Date(status.builtAt), { dateStyle: 'long' }),
            count: status.aheadBy,
          }}
          components={{ link: <LinkButton uri={status.releasePageUrl} /> }}
        />
      </p>
    )
  }

  public render() {
    const name = this.props.applicationName
    const version = this.props.applicationVersion
    const releaseNotesLabel = t('about.release-notes')
    const releaseNotesLink = (
      <LinkButton uri={ReleaseNotesUri}>{releaseNotesLabel}</LinkButton>
    )

    const versionText = __DEV__
      ? t('about.build', { version })
      : t('about.version', { version })
    const titleId = 'Dialog_about'

    return (
      <Dialog
        id="about"
        titleId={titleId}
        onSubmit={this.props.onDismissed}
        onDismissed={this.props.onDismissed}
      >
        {this.renderUpdateErrors()}
        <DialogContent>
          <Row className="logo">
            <img
              src={DesktopLogo}
              alt="GitHub Desktop"
              width="64"
              height="64"
            />
          </Row>
          <h1 id={titleId}>{t('about.title', { name })}</h1>
          <p className="no-padding">
            <span className="selectable-text about-version">
              {versionText} ({this.props.applicationArchitecture})
            </span>{' '}
            ({releaseNotesLink})
          </p>
          <p className="no-padding selectable-text">
            {t('about.system', getSystemInfo())}
          </p>
          {(() => {
            const tag = localization.getActiveTag()
            const locale = localization.getLocale(tag)
            if (locale?.authors && locale.authors.length > 0) {
              return (
                <p className="no-padding selectable-text l10n-credit">
                  <Trans
                    k="about.l10nCredit"
                    params={{
                      authors: locale.authors.join(', '),
                      sha: __SHA__.substring(0, 10),
                      date: __BUILD_DATE__,
                    }}
                    components={{
                      authors: <LinkButton uri={LocalizationAuthorUri} />,
                      sha: (
                        <LinkButton
                          uri={buildFeedbackIssueUrl({
                            target: tag,
                            search: '',
                          })}
                        />
                      ),
                    }}
                  />
                </p>
              )
            }
            return null
          })()}
          {this.renderUpstreamStatus()}
          {this.renderForkRelease()}
          {this.renderUpdateDetails()}
          {this.renderUpdateButton()}
          {this.renderBetaLink()}
          <div className="terms-and-license-container">
            <p className="no-padding terms-and-license">
              <LinkButton onClick={this.props.onShowTermsAndConditions}>
                {t('about.terms-and-conditions')}
              </LinkButton>
            </p>
            <p className="no-padding terms-and-license">
              <LinkButton onClick={this.props.onShowAcknowledgements}>
                {t('about.license-notices')}
              </LinkButton>
            </p>
            <p className="terms-and-license">
              <LinkButton uri="https://gh.io/copilot-for-desktop-transparency">
                {t('about.responsible-use-copilot')}
              </LinkButton>
            </p>
          </div>
        </DialogContent>
        <DefaultDialogFooter />
      </Dialog>
    )
  }
}
