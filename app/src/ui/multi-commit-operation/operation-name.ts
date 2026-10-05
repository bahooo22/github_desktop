import { MultiCommitOperationKind } from '../../models/multi-commit-operation'
import { t } from '../../lib/l10n'

/** The display name of a multi commit operation kind, translated. */
export function getOperationName(
  operation: string | MultiCommitOperationKind
): string {
  switch (operation) {
    case MultiCommitOperationKind.Rebase:
      return t('multiCommit.operation.rebase')
    case MultiCommitOperationKind.CherryPick:
      return t('multiCommit.operation.cherryPick')
    case MultiCommitOperationKind.Squash:
      return t('multiCommit.operation.squash')
    case MultiCommitOperationKind.Merge:
      return t('multiCommit.operation.merge')
    case MultiCommitOperationKind.Reorder:
      return t('multiCommit.operation.reorder')
    default:
      return operation
  }
}
