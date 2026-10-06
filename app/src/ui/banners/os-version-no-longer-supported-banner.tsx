import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Banner } from './banner'
import { LinkButton } from '../lib/link-button'
import { setNumber } from '../../lib/local-storage'
import { Trans } from '../../lib/l10n'

export const UnsupportedOSBannerDismissedAtKey =
  'unsupported-os-banner-dismissed-at'

export class OSVersionNoLongerSupportedBanner extends React.Component<{
  onDismissed: () => void
}> {
  private onDismissed = () => {
    setNumber(UnsupportedOSBannerDismissedAtKey, Date.now())
    this.props.onDismissed()
  }

  public render() {
    return (
      <Banner
        id="os-not-supported-banner"
        dismissable={true}
        onDismissed={this.onDismissed}
      >
        <Octicon className="alert-icon" symbol={octicons.alert} />
        <Trans
          k="banners.osNotSupported"
          components={{
            link: (
              <LinkButton uri="https://docs.github.com/en/desktop/installing-and-configuring-github-desktop/overview/supported-operating-systems" />
            ),
          }}
        />
      </Banner>
    )
  }
}
