import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Banner } from './banner'
import { Trans } from '../../lib/l10n'

export function BranchAlreadyUpToDate({
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
        k="banners.branchAlreadyUpToDateWith"
        components={{
          ours: <strong>{ourBranch}</strong>,
          theirs: <strong>{theirBranch}</strong>,
        }}
      />
    ) : (
      <Trans
        as="span"
        k="banners.branchAlreadyUpToDate"
        components={{ ours: <strong>{ourBranch}</strong> }}
      />
    )

  return (
    <Banner id="successful-merge" timeout={5000} onDismissed={onDismissed}>
      <div className="green-circle">
        <Octicon className="check-icon" symbol={octicons.check} />
      </div>
      <div className="banner-message">{message}</div>
    </Banner>
  )
}
