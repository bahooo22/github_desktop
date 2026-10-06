import { getCommitsBetweenCommits } from '../../lib/git'
import { promiseWithMinimumTimeout } from '../../lib/promise'
import { Branch } from '../../models/branch'
import { ComputedAction } from '../../models/computed-action'
import { MultiCommitOperationKind } from '../../models/multi-commit-operation'
import { RebasePreview } from '../../models/rebase'
import { Repository } from '../../models/repository'
import { IDropdownSelectButtonOption } from '../dropdown-select-button'
import { t } from '../../lib/l10n'

export function getMergeOptions(): ReadonlyArray<IDropdownSelectButtonOption> {
  return [
    {
      label: t('updateBranch.mergeCommitLabel'),
      description: t('updateBranch.mergeCommitDescription'),
      id: MultiCommitOperationKind.Merge,
    },
    {
      label: t('updateBranch.squashLabel'),
      description: t('updateBranch.squashDescription'),
      id: MultiCommitOperationKind.Squash,
    },
    {
      label: t('multiCommit.operation.rebase'),
      description: t('updateBranch.rebaseDescription'),
      id: MultiCommitOperationKind.Rebase,
    },
  ]
}

export async function updateRebasePreview(
  baseBranch: Branch,
  targetBranch: Branch,
  repository: Repository,
  onUpdate: (rebasePreview: RebasePreview | null) => void
) {
  const computingRebaseForBranch = baseBranch.name

  onUpdate({
    kind: ComputedAction.Loading,
  })

  const commitsBehind = await promiseWithMinimumTimeout(
    () =>
      getCommitsBetweenCommits(
        repository,
        targetBranch.tip.sha,
        baseBranch.tip.sha
      ),
    500
  )

  const commitsAhead = await promiseWithMinimumTimeout(
    () =>
      getCommitsBetweenCommits(
        repository,
        baseBranch.tip.sha,
        targetBranch.tip.sha
      ),
    500
  )

  // if the branch being track has changed since we started this work, abandon
  // any further state updates (this function is re-entrant if the user is
  // using the keyboard to quickly switch branches)
  if (computingRebaseForBranch !== baseBranch.name) {
    onUpdate(null)
    return
  }

  // if we are unable to find any commits to rebase, indicate that we're
  // unable to proceed with the rebase
  if (commitsBehind === null) {
    onUpdate({
      kind: ComputedAction.Invalid,
    })
    return
  }

  onUpdate({
    kind: ComputedAction.Clean,
    commitsAhead: commitsAhead ?? [],
    commitsBehind: commitsBehind,
  })
}
