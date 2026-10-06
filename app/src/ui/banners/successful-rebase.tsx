import * as React from 'react'
import { SuccessBanner } from './success-banner'
import { Trans } from '../../lib/l10n'

export function SuccessfulRebase({
  baseBranch,
  targetBranch,
  onDismissed,
}: {
  readonly baseBranch?: string
  readonly targetBranch: string
  readonly onDismissed: () => void
}) {
  const message =
    baseBranch !== undefined ? (
      <Trans
        as="span"
        k="banners.successfulRebaseOnto"
        components={{
          target: <strong>{targetBranch}</strong>,
          base: <strong>{baseBranch}</strong>,
        }}
      />
    ) : (
      <Trans
        as="span"
        k="banners.successfulRebase"
        components={{ target: <strong>{targetBranch}</strong> }}
      />
    )

  return (
    <SuccessBanner timeout={5000} onDismissed={onDismissed}>
      <div className="banner-message">{message}</div>
    </SuccessBanner>
  )
}
