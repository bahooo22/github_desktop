import * as React from 'react'
import { SuccessBanner } from './success-banner'
import { Trans } from '../../lib/l10n'

export function SuccessfulMerge({
  ourBranch,
  theirBranch,
  onDismissed,
}: {
  readonly ourBranch: string
  readonly theirBranch?: string
  readonly onDismissed: () => void
}) {
  const message =
    theirBranch !== undefined ? (
      <Trans
        as="span"
        k="banners.successfulMergeWith"
        components={{
          theirs: <strong>{theirBranch}</strong>,
          ours: <strong>{ourBranch}</strong>,
        }}
      />
    ) : (
      <Trans
        as="span"
        k="banners.successfulMerge"
        components={{ ours: <strong>{ourBranch}</strong> }}
      />
    )

  return (
    <SuccessBanner timeout={5000} onDismissed={onDismissed}>
      <div className="banner-message">{message}</div>
    </SuccessBanner>
  )
}
