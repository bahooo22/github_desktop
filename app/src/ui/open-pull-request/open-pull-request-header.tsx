import * as React from 'react'
import { Branch } from '../../models/branch'
import { BranchSelect } from '../branches/branch-select'
import { DialogHeader } from '../dialog/header'
import { Ref } from '../lib/ref'
import { Repository } from '../../models/repository'
import { IChangesetData } from '../../lib/git'
import { t, Trans } from '../../lib/l10n'

export const OpenPullRequestDialogId = 'Dialog_Open_Pull_Request'

interface IOpenPullRequestDialogHeaderProps {
  readonly repository: Repository

  /** The base branch of the pull request */
  readonly baseBranch: Branch | null

  /** The branch of the pull request */
  readonly currentBranch: Branch

  /**
   * See IBranchesState.defaultBranch
   */
  readonly defaultBranch: Branch | null

  /**
   * Branches in the repo with the repo's default remote
   *
   * We only want branches that are also on dotcom such that, when we ask a user
   * to create a pull request, the base branch also exists on dotcom.
   */
  readonly prBaseBranches: ReadonlyArray<Branch>

  /**
   * Recent branches with the repo's default remote
   *
   * We only want branches that are also on dotcom such that, when we ask a user
   * to create a pull request, the base branch also exists on dotcom.
   */
  readonly prRecentBaseBranches: ReadonlyArray<Branch>

  /** The count of commits of the pull request */
  readonly commitCount: number

  /** The changeset data associated with the selected commit */
  readonly changesetData: IChangesetData

  /** When the branch selection changes */
  readonly onBranchChange: (branch: Branch) => void

  /**
   * Event triggered when the dialog is dismissed by the user in the
   * ways described in the dismissable prop.
   */
  readonly onDismissed?: () => void
}

/**
 * A header component for the open pull request dialog. Made to house the
 * base branch dropdown and merge details common to all pull request views.
 */
export class OpenPullRequestDialogHeader extends React.Component<IOpenPullRequestDialogHeaderProps> {
  public constructor(props: IOpenPullRequestDialogHeaderProps) {
    super(props)
  }

  public render() {
    const title = t('openPullRequest.title')
    const {
      baseBranch,
      currentBranch,
      changesetData,
      defaultBranch,
      prBaseBranches,
      prRecentBaseBranches,
      commitCount,
      onBranchChange,
      onDismissed,
    } = this.props
    const { linesAdded, linesDeleted } = changesetData

    return (
      <DialogHeader
        title={title}
        titleId={OpenPullRequestDialogId}
        onCloseButtonClick={onDismissed}
      >
        <div className="break"></div>
        <div className="base-branch-details">
          <Trans
            k="openPullRequest.merge-commits-into"
            params={{ count: commitCount, branch: currentBranch.name }}
            components={{
              select: (
                <BranchSelect
                  repository={this.props.repository}
                  branch={baseBranch}
                  defaultBranch={defaultBranch}
                  currentBranch={currentBranch}
                  allBranches={prBaseBranches}
                  recentBranches={prRecentBaseBranches}
                  onChange={onBranchChange}
                  noBranchesMessage={
                    <>
                      <p>{t('openPullRequest.no-remote-branch')}</p>
                      <p>{t('openPullRequest.remote-only-pr')}</p>
                    </>
                  }
                />
              ),
              ref: <Ref />,
            }}
          />
        </div>
        <div className="lines-added-deleted">
          <span className="sr-only">{t('openPullRequest.lines-changed')}</span>
          <span className="lines-added">
            {t('openPullRequest.lines-added', { count: linesAdded })}
          </span>
          <span>, </span>
          <span className="lines-deleted">
            {t('openPullRequest.lines-deleted', { count: linesDeleted })}
          </span>
        </div>
      </DialogHeader>
    )
  }
}
