import * as React from 'react'
import { SuccessBanner } from './success-banner'
import { Trans } from '../../lib/l10n'

interface ICherryPickUndoneBannerProps {
  readonly targetBranchName: string
  readonly countCherryPicked: number
  readonly onDismissed: () => void
}

export class CherryPickUndone extends React.Component<
  ICherryPickUndoneBannerProps,
  {}
> {
  public render() {
    const { countCherryPicked, targetBranchName, onDismissed } = this.props
    return (
      <SuccessBanner timeout={5000} onDismissed={onDismissed}>
        <Trans
          k="banners.cherryPickUndone"
          params={{ count: countCherryPicked }}
          components={{ branch: <strong>{targetBranchName}</strong> }}
        />
      </SuccessBanner>
    )
  }
}
