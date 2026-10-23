import * as React from 'react'

import { Banner } from './banner'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { t, Trans } from '../../lib/l10n'
import { Dispatcher } from '../dispatcher'
import { PopupType } from '../../models/popup'
import { dismissForkRelease } from '../../lib/fork-release'
import { updateStore } from '../lib/update-store'

export type ForkReleaseAction = 'download' | 'choose-package'

interface IForkReleaseAvailableProps {
  readonly version: string
  readonly releaseSha: string
  readonly aheadBy: number
  readonly action: ForkReleaseAction
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
}

/**
 * This fork rebuilds more often than it bumps its version, and Squirrel is
 * silent about a release that carries the version it merged from — so the
 * commit is the only thing that says 'there's a newer build'. This banner is
 * that reminder for people who don't open the About dialog.
 *
 * Nothing is downloaded until the user presses the button: on Windows the
 * button hands the feed to Squirrel, on Linux and macOS it opens the package
 * chooser. Squirrel's own check would start the download by itself, which is
 * exactly what this banner exists to avoid.
 */
export class ForkReleaseAvailable extends React.Component<IForkReleaseAvailableProps> {
  public render() {
    return (
      <Banner id="fork-release-available" onDismissed={this.onDismissed}>
        <Octicon className="download-icon" symbol={octicons.desktopDownload} />
        <Trans
          k="banners.forkReleaseAvailable"
          params={{ count: this.props.aheadBy }}
          components={{
            link: (
              <LinkButton onClick={this.onAction}>
                {t('banners.forkReleaseDownload')}
              </LinkButton>
            ),
          }}
        />
      </Banner>
    )
  }

  private onAction = () => {
    if (this.props.action === 'choose-package') {
      this.props.dispatcher.showPopup({
        type: PopupType.DownloadForkRelease,
        version: this.props.version,
      })
      return
    }

    updateStore.checkForUpdates(false, false)
  }

  private onDismissed = () => {
    // Per release, not per day: the next rebuild of the fork should remind
    // again, and the release this one points at stays dismissed forever.
    dismissForkRelease(this.props.releaseSha)
    this.props.onDismissed()
  }
}
