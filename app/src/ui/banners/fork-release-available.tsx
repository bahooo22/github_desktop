import * as React from 'react'

import { Banner } from './banner'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Trans } from '../../lib/l10n'
import { dismissForkRelease } from '../../lib/fork-release'
interface IForkReleaseAvailableProps {
  readonly releaseSha: string
  readonly aheadBy: number
  readonly releasePageUrl: string
  readonly onDismissed: () => void
}

/**
 * This fork rebuilds more often than it bumps its version, and Squirrel is
 * silent about a release that carries the version it merged from — so the
 * commit is the only thing that says 'there's a newer build'. This banner is
 * that reminder for people who don't open the About dialog.
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
            link: <LinkButton uri={this.props.releasePageUrl} />,
          }}
        />
      </Banner>
    )
  }

  private onDismissed = () => {
    // Per release, not per day: the next rebuild of the fork should remind
    // again, and the release this one points at stays dismissed forever.
    dismissForkRelease(this.props.releaseSha)
    this.props.onDismissed()
  }
}
