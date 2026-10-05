import * as React from 'react'
import { Octicon } from '../../octicons'
import * as octicons from '../../octicons/octicons.generated'
import { LinkButton } from '../link-button'
import { t } from '../../../lib/l10n'

export function renderUnmergedFilesSummary(conflictedFilesCount: number) {
  const message =
    conflictedFilesCount === 1
      ? t('conflicts.oneConflictedFile')
      : t('conflicts.manyConflictedFiles', { count: conflictedFilesCount })
  return <h2 className="summary">{message}</h2>
}

export function renderAllResolved() {
  return (
    <div className="all-conflicts-resolved">
      <div className="green-circle">
        <Octicon symbol={octicons.check} />
      </div>
      <div className="message">{t('conflicts.allResolved')}</div>
    </div>
  )
}

export function renderShellLink(openThisRepositoryInShell: () => void) {
  return (
    <div>
      <LinkButton onClick={openThisRepositoryInShell}>
        Open in command line,
      </LinkButton>{' '}
      your tool of choice, or close to resolve manually.
    </div>
  )
}
