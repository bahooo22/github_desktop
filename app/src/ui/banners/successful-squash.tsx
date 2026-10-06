import * as React from 'react'
import { SuccessBanner } from './success-banner'
import { Trans } from '../../lib/l10n'

interface ISuccessfulSquashedBannerProps {
  readonly count: number
  readonly onDismissed: () => void
  readonly onUndo: () => void
}

export class SuccessfulSquash extends React.Component<
  ISuccessfulSquashedBannerProps,
  {}
> {
  public render() {
    const { count, onDismissed, onUndo } = this.props

    return (
      <SuccessBanner timeout={15000} onDismissed={onDismissed} onUndo={onUndo}>
        <Trans as="span" k="banners.successfulSquash" params={{ count }} />
      </SuccessBanner>
    )
  }
}
