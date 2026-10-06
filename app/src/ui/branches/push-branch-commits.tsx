import * as React from 'react'
import { Dispatcher } from '../dispatcher'
import { Branch } from '../../models/branch'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Repository } from '../../models/repository'
import { Ref } from '../lib/ref'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { t, Trans } from '../../lib/l10n'

interface IPushBranchCommitsProps {
  readonly dispatcher: Dispatcher
  readonly repository: Repository
  readonly branch: Branch
  readonly onConfirm: (repository: Repository, branch: Branch) => void
  readonly onDismissed: () => void

  /**
   * Used to show the number of commits a branch is ahead by.
   * If this value is undefined, component defaults to publish view.
   */
  readonly unPushedCommits?: number
}

interface IPushBranchCommitsState {
  /**
   * A value indicating whether we're currently working on publishing
   * or pushing the branch to the remote. This value is used to tell
   * the dialog to apply the loading and disabled state which adds a
   * spinner and disables form controls for the duration of the operation.
   */
  readonly isPushingOrPublishing: boolean
}

/**
 * Simple type guard which allows us to substitute the non-obvious
 * this.props.unPushedCommits === undefined checks with
 * renderPublishView(this.props.unPushedCommits).
 */
function renderPublishView(
  unPushedCommits: number | undefined
): unPushedCommits is undefined {
  return unPushedCommits === undefined
}

/**
 * This component gets shown if the user attempts to open a PR with
 * a) An un-published branch
 * b) A branch that is ahead of its base branch
 *
 * In both cases, this asks the user if they'd like to push/publish the branch.
 * If they confirm we push/publish then open the PR page on dotcom.
 */
export class PushBranchCommits extends React.Component<
  IPushBranchCommitsProps,
  IPushBranchCommitsState
> {
  public constructor(props: IPushBranchCommitsProps) {
    super(props)

    this.state = { isPushingOrPublishing: false }
  }

  public render() {
    return (
      <Dialog
        id="push-branch-commits"
        key="push-branch-commits"
        title={this.renderDialogTitle()}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
        loading={this.state.isPushingOrPublishing}
        disabled={this.state.isPushingOrPublishing}
        role="alertdialog"
        ariaDescribedBy="push-branch-commits-title push-branch-commits-message"
      >
        {this.renderDialogContent()}

        <DialogFooter>{this.renderButtonGroup()}</DialogFooter>
      </Dialog>
    )
  }

  private renderDialogContent() {
    if (renderPublishView(this.props.unPushedCommits)) {
      return (
        <DialogContent>
          <p id="push-branch-commits-title">
            {t('pushBranchCommits.publishTitle')}
          </p>
          <Trans
            as="p"
            id="push-branch-commits-message"
            k="pushBranchCommits.publishMessage"
            components={{ ref: <Ref>{this.props.branch.name}</Ref> }}
          />
        </DialogContent>
      )
    }

    return (
      <DialogContent>
        <p id="push-branch-commits-title">
          {t('pushBranchCommits.pushTitle', {
            count: this.props.unPushedCommits,
          })}
        </p>
        <Trans
          as="p"
          id="push-branch-commits-message"
          k="pushBranchCommits.pushMessage"
          components={{ ref: <Ref>{this.props.branch.name}</Ref> }}
        />
      </DialogContent>
    )
  }

  private renderDialogTitle() {
    if (renderPublishView(this.props.unPushedCommits)) {
      return t('pushBranchCommits.publishTitleQ')
    }

    return t('pushBranchCommits.pushTitleQ')
  }

  private renderButtonGroup() {
    if (renderPublishView(this.props.unPushedCommits)) {
      return (
        <OkCancelButtonGroup
          okButtonText={t('pushBranchCommits.publishButton')}
        />
      )
    }

    return (
      <OkCancelButtonGroup
        okButtonText={t('pushBranchCommits.pushButton')}
        cancelButtonText={t('pushBranchCommits.createWithoutPushing')}
        onCancelButtonClick={this.onCreateWithoutPushButtonClick}
      />
    )
  }

  private onCreateWithoutPushButtonClick = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault()
    this.props.onConfirm(this.props.repository, this.props.branch)
    this.props.onDismissed()
  }

  private onSubmit = async () => {
    const { repository, branch } = this.props

    this.setState({ isPushingOrPublishing: true })

    try {
      await this.props.dispatcher.push(repository)
    } finally {
      this.setState({ isPushingOrPublishing: false })
    }

    this.props.onConfirm(repository, branch)
    this.props.onDismissed()
  }
}
