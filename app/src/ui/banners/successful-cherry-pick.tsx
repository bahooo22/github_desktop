import * as React from 'react'
import { SuccessBanner } from './success-banner'
import { Trans } from '../../lib/l10n'

interface ISuccessfulCherryPickBannerProps {
  readonly targetBranchName: string
  readonly countCherryPicked: number
  readonly onDismissed: () => void
  readonly onUndo: () => void
}

export class SuccessfulCherryPick extends React.Component<
  ISuccessfulCherryPickBannerProps,
  {}
> {
  public render() {
    const { countCherryPicked, onDismissed, onUndo, targetBranchName } =
      this.props

    return (
      <SuccessBanner timeout={15000} onDismissed={onDismissed} onUndo={onUndo}>
        <Trans
          as="span"
          k="successfulCherryPick.copied"
          params={{ count: countCherryPicked, branch: targetBranchName }}
          components={{ strong: <strong /> }}
        />
      </SuccessBanner>
    )
  }
}
