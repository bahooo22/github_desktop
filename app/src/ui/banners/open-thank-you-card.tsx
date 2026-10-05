import * as React from 'react'
import { LinkButton } from '../lib/link-button'
import { RichText } from '../lib/rich-text'
import { Banner } from './banner'
import { Emoji } from '../../lib/emoji'
import { t } from '../../lib/l10n'

interface IOpenThankYouCardProps {
  readonly emoji: Map<string, Emoji>
  readonly onDismissed: () => void
  readonly onOpenCard: () => void
  readonly onThrowCardAway: () => void
}

/**
 * A component which tells the user that there is a thank you card for them.
 */
export class OpenThankYouCard extends React.Component<
  IOpenThankYouCardProps,
  {}
> {
  public render() {
    return (
      <Banner id="open-thank-you-card" onDismissed={this.props.onDismissed}>
        <form onSubmit={this.props.onOpenCard}>
          {t('thankYouCard.message')}{' '}
          <LinkButton onClick={this.props.onOpenCard}>
            {t('thankYouCard.openCard')}
          </LinkButton>{' '}
          <RichText
            className="thank-you-banner-emoji"
            text={':tada:'}
            emoji={this.props.emoji}
            renderUrlsAsLinks={true}
          />
          {t('thankYouCard.or')}{' '}
          <LinkButton onClick={this.onThrowCardAway}>
            {t('thankYouCard.throwAway')}
          </LinkButton>{' '}
          <RichText
            className="thank-you-banner-emoji"
            text={':sob:'}
            emoji={this.props.emoji}
            renderUrlsAsLinks={true}
          />
        </form>
      </Banner>
    )
  }

  private onThrowCardAway = () => {
    this.props.onDismissed()
    this.props.onThrowCardAway()
  }
}
