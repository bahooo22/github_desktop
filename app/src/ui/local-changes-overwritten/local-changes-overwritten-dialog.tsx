import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DefaultDialogFooter,
} from '../dialog'
import { t } from '../../lib/l10n'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Repository } from '../../models/repository'
import { RetryAction, RetryActionType } from '../../models/retry-actions'
import { Dispatcher } from '../dispatcher'
import { PathText } from '../lib/path-text'
import { assertNever } from '../../lib/fatal-error'
import { PopupType } from '../../models/popup'

interface ILocalChangesOverwrittenDialogProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  /**
   * Whether there's already a stash entry for the local branch.
   */
  readonly hasExistingStash: boolean
  /**
   * The action that should get executed if the user selects "Stash and Continue".
   */
  readonly retryAction: RetryAction
  /**
   * Callback to use when the dialog gets closed.
   */
  readonly onDismissed: () => void

  /**
   * The files that prevented the operation from completing, i.e. the files
   * that would be overwritten.
   */
  readonly files: ReadonlyArray<string>
}
interface ILocalChangesOverwrittenDialogState {
  readonly stashing: boolean
}

export class LocalChangesOverwrittenDialog extends React.Component<
  ILocalChangesOverwrittenDialogProps,
  ILocalChangesOverwrittenDialogState
> {
  public constructor(props: ILocalChangesOverwrittenDialogProps) {
    super(props)
    this.state = { stashing: false }
  }

  public render() {
    const overwrittenText =
      this.props.files.length > 0
        ? ` ${t('localChangesOverwritten.followingFilesOverwritten')}`
        : null

    return (
      <Dialog
        title="Error"
        id="local-changes-overwritten"
        loading={this.state.stashing}
        disabled={this.state.stashing}
        onDismissed={this.onDismissPopup}
        onSubmit={this.onSubmit}
        type="error"
        role="alertdialog"
        ariaDescribedBy="local-changes-error-description"
      >
        <DialogContent>
          <div id="local-changes-error-description">
            <p>
              {t('localChangesOverwritten.unableWhenChanges', {
                action: this.getRetryActionName(),
              })}
              {overwrittenText}
            </p>
            {this.renderFiles()}
            {this.renderStashText()}
          </div>
        </DialogContent>
        {this.renderFooter()}
      </Dialog>
    )
  }

  private renderFiles() {
    const { files } = this.props
    if (files.length === 0) {
      return null
    }

    return (
      <div className="files-list">
        <ul>
          {files.map(fileName => (
            <li key={fileName}>
              <PathText path={fileName} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  private get canStashChanges() {
    return (
      !this.props.hasExistingStash &&
      !this.state.stashing &&
      this.props.retryAction.type !== RetryActionType.PopStash
    )
  }

  private renderStashText() {
    if (!this.canStashChanges) {
      return null
    }

    return <p>{t('localChangesOverwritten.stashAndRecover')}</p>
  }

  private renderFooter() {
    if (!this.canStashChanges) {
      return <DefaultDialogFooter />
    }

    return (
      <DialogFooter>
        <OkCancelButtonGroup
          okButtonText={t('localChangesOverwritten.stashAndContinue')}
          okButtonTitle={t('localChangesOverwritten.stashHintTitle')}
          cancelButtonText={t('common.close')}
        />
      </DialogFooter>
    )
  }

  private onSubmit = async () => {
    const { hasExistingStash, repository, dispatcher, retryAction } = this.props

    if (hasExistingStash) {
      // When there's an existing stash we don't let the user stash the changes
      // and we only show a "Close" button on the modal. In that case, the
      // "Close" button submits the dialog and should only dismiss it.
      this.props.onDismissed()
      return
    }

    this.setState({ stashing: true })

    // We know that there's no stash for the current branch so we can safely
    // tell createStashForCurrentBranch not to show a confirmation dialog which
    // would disrupt the async flow (since you can't await a dialog).
    const createdStash = await dispatcher.createStashForCurrentBranch(
      repository,
      false
    )

    this.props.onDismissed()

    if (createdStash) {
      await dispatcher.performRetry(retryAction)
    }
  }

  /**
   * on Dismiss, abort rebase if the retryAction is rebase, then call the onDismissed callback
   */
  private onDismissPopup = async () => {
    const { dispatcher, retryAction, onDismissed } = this.props
    // default dismiss handler , closes the popup via onPopupDismissedFn
    onDismissed()

    // Rebase flow is interrupted, user aborting due to unstashed changes, close outer multi commit operation popup
    if (retryAction.type === RetryActionType.Rebase) {
      dispatcher.closePopup(PopupType.MultiCommitOperation)
    }
  }

  /**
   * Returns a user-friendly string to describe the current retryAction.
   */
  private getRetryActionName() {
    switch (this.props.retryAction.type) {
      case RetryActionType.Checkout:
        return t('localChangesOverwritten.action.checkout')
      case RetryActionType.Pull:
        return t('localChangesOverwritten.action.pull')
      case RetryActionType.Merge:
        return t('localChangesOverwritten.action.merge')
      case RetryActionType.Rebase:
        return t('localChangesOverwritten.action.rebase')
      case RetryActionType.Clone:
        return t('localChangesOverwritten.action.clone')
      case RetryActionType.Fetch:
        return t('localChangesOverwritten.action.fetch')
      case RetryActionType.Push:
        return t('localChangesOverwritten.action.push')
      case RetryActionType.CherryPick:
      case RetryActionType.CreateBranchForCherryPick:
        return t('localChangesOverwritten.action.cherryPick')
      case RetryActionType.Squash:
        return t('localChangesOverwritten.action.squash')
      case RetryActionType.Reorder:
        return t('localChangesOverwritten.action.reorder')
      case RetryActionType.DiscardChanges:
        return t('localChangesOverwritten.action.discardChanges')
      case RetryActionType.PopStash:
        return t('localChangesOverwritten.action.restoreStashedChanges')
      default:
        assertNever(
          this.props.retryAction,
          `Unknown retryAction: ${this.props.retryAction}`
        )
    }
  }
}
