import * as React from 'react'

import { Banner } from './banner'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Trans } from '../../lib/l10n'
import { dismissUpstreamRelease } from '../../lib/upstream-status'

interface IUpstreamReleaseAvailableProps {
  readonly version: string
  readonly releasePageUrl: string
  readonly onDismissed: () => void
}

/**
 * The official GitHub Desktop channel has released a version this fork is
 * behind. The official build is a separate application: it installs beside the
 * fork and arrives without this fork's localization, so the banner links out
 * instead of installing anything.
 */
export class UpstreamReleaseAvailable extends React.Component<IUpstreamReleaseAvailableProps> {
  public render() {
    return (
      <Banner id="upstream-release-available" onDismissed={this.onDismissed}>
        <Octicon className="download-icon" symbol={octicons.desktopDownload} />
        <Trans
          k="banners.upstreamReleaseAvailable"
          params={{ version: this.props.version }}
          components={{
            download: <LinkButton uri={this.props.releasePageUrl} />,
          }}
        />
      </Banner>
    )
  }

  private onDismissed = () => {
    dismissUpstreamRelease(this.props.version)
    this.props.onDismissed()
  }
}
