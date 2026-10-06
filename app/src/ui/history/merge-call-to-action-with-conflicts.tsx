import * as React from 'react'

import { HistoryTabMode } from '../../lib/app-state'
import { Repository } from '../../models/repository'
import { Branch } from '../../models/branch'
import { Dispatcher } from '../dispatcher'
import { ActionStatusIcon } from '../lib/action-status-icon'
import { MergeTreeResult } from '../../models/merge'
import { ComputedAction } from '../../models/computed-action'
import {
  DropdownSelectButton,
  IDropdownSelectButtonOption,
} from '../dropdown-select-button'
import { getMergeOptions, updateRebasePreview } from '../lib/update-branch'
import {
  MultiCommitOperationKind,
  isIdMultiCommitOperation,
} from '../../models/multi-commit-operation'
import { RebasePreview } from '../../models/rebase'
import { t, Trans } from '../../lib/l10n'

interface IMergeCallToActionWithConflictsProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly mergeStatus: MergeTreeResult | null
  readonly currentBranch: Branch
  readonly comparisonBranch: Branch
  readonly commitsBehind: number
}

interface IMergeCallToActionWithConflictsState {
  readonly selectedOperation: MultiCommitOperationKind
  readonly rebasePreview: RebasePreview | null
}

export class MergeCallToActionWithConflicts extends React.Component<
  IMergeCallToActionWithConflictsProps,
  IMergeCallToActionWithConflictsState
> {
  /**
   * This is obtained by either the merge status or the rebase preview. Depending
   * on which option is selected in the dropdown.
   */
  private get computedAction(): ComputedAction | null {
    if (this.state.selectedOperation === MultiCommitOperationKind.Rebase) {
      return this.state.rebasePreview !== null
        ? this.state.rebasePreview.kind
        : null
    }
    return this.props.mergeStatus !== null ? this.props.mergeStatus.kind : null
  }

  /**
   * This is obtained by either the merge status or the rebase preview. Depending
   * on which option is selected in the dropdown.
   */
  private get commitCount(): number {
    const { selectedOperation, rebasePreview } = this.state
    if (selectedOperation === MultiCommitOperationKind.Rebase) {
      return rebasePreview !== null &&
        rebasePreview.kind === ComputedAction.Clean
        ? rebasePreview.commitsAhead.length
        : 0
    }

    return this.props.commitsBehind
  }

  public constructor(props: IMergeCallToActionWithConflictsProps) {
    super(props)

    this.state = {
      selectedOperation: MultiCommitOperationKind.Merge,
      rebasePreview: null,
    }
  }

  private isUpdateBranchDisabled(): boolean {
    if (this.commitCount <= 0) {
      return true
    }

    const { selectedOperation, rebasePreview } = this.state
    if (selectedOperation === MultiCommitOperationKind.Rebase) {
      return (
        rebasePreview === null || rebasePreview.kind !== ComputedAction.Clean
      )
    }

    return (
      this.props.mergeStatus != null &&
      this.props.mergeStatus.kind === ComputedAction.Invalid
    )
  }

  private updateRebasePreview = async (baseBranch: Branch) => {
    const { currentBranch: targetBranch, repository } = this.props
    updateRebasePreview(baseBranch, targetBranch, repository, rebasePreview => {
      this.setState({ rebasePreview })
    })
  }

  private onOperationChange = (option: IDropdownSelectButtonOption) => {
    if (!isIdMultiCommitOperation(option.id)) {
      return
    }

    this.setState({ selectedOperation: option.id })
    if (option.id === MultiCommitOperationKind.Rebase) {
      this.updateRebasePreview(this.props.comparisonBranch)
    }
  }

  private onOperationInvoked = async (
    event: React.MouseEvent<HTMLButtonElement>,
    selectedOption: IDropdownSelectButtonOption
  ) => {
    if (!isIdMultiCommitOperation(selectedOption.id)) {
      return
    }
    event.preventDefault()

    const { dispatcher, repository } = this.props

    await this.dispatchOperation(selectedOption.id)

    dispatcher.executeCompare(repository, {
      kind: HistoryTabMode.History,
    })

    dispatcher.updateCompareForm(repository, {
      showBranchList: false,
      filterText: '',
    })
  }

  private async dispatchOperation(
    operation: MultiCommitOperationKind
  ): Promise<void> {
    const {
      dispatcher,
      currentBranch,
      comparisonBranch,
      repository,
      mergeStatus,
    } = this.props

    if (operation === MultiCommitOperationKind.Rebase) {
      const commits =
        this.state.rebasePreview !== null &&
        this.state.rebasePreview.kind === ComputedAction.Clean
          ? this.state.rebasePreview.commitsAhead
          : []
      return dispatcher.startRebase(
        repository,
        comparisonBranch,
        currentBranch,
        commits
      )
    }

    const isSquash = operation === MultiCommitOperationKind.Squash
    dispatcher.initializeMultiCommitOperation(
      repository,
      {
        kind: MultiCommitOperationKind.Merge,
        isSquash,
        sourceBranch: comparisonBranch,
      },
      currentBranch,
      [],
      currentBranch.tip.sha
    )
    dispatcher.incrementMetric('mergesInitiatedFromComparison')

    return dispatcher.mergeBranch(
      repository,
      comparisonBranch,
      mergeStatus,
      isSquash
    )
  }

  public render() {
    const disabled = this.isUpdateBranchDisabled()
    const mergeDetails = this.commitCount > 0 ? this.renderMergeStatus() : null

    return (
      <div className="merge-cta">
        {mergeDetails}

        <DropdownSelectButton
          checkedOption={this.state.selectedOperation}
          options={getMergeOptions()}
          dropdownAriaLabel="Merge options"
          disabled={disabled}
          onCheckedOptionChange={this.onOperationChange}
          onSubmit={this.onOperationInvoked}
        />
      </div>
    )
  }

  private renderMergeStatus() {
    if (this.computedAction === null) {
      return null
    }

    return (
      <div className="merge-status-component">
        <ActionStatusIcon
          status={{ kind: this.computedAction }}
          classNamePrefix="merge-status"
        />

        {this.renderStatusDetails()}
      </div>
    )
  }

  private renderStatusDetails() {
    const { currentBranch, comparisonBranch, mergeStatus } = this.props
    const { selectedOperation } = this.state
    if (this.computedAction === null) {
      return null
    }
    switch (this.computedAction) {
      case ComputedAction.Loading:
        return this.renderLoadingMessage()
      case ComputedAction.Clean:
        return this.renderCleanMessage(currentBranch, comparisonBranch)
      case ComputedAction.Invalid:
        return this.renderInvalidMessage()
    }

    if (
      selectedOperation !== MultiCommitOperationKind.Rebase &&
      mergeStatus !== null &&
      mergeStatus.kind === ComputedAction.Conflicts
    ) {
      return this.renderConflictedMergeMessage(
        currentBranch,
        comparisonBranch,
        mergeStatus.conflictedFiles
      )
    }
    return null
  }

  private renderLoadingMessage() {
    const isRebase =
      this.state.selectedOperation === MultiCommitOperationKind.Rebase
    return (
      <div className="merge-message merge-message-loading">
        {isRebase
          ? t('multiCommit.rebaseChooseBranch.loading')
          : t('multiCommit.mergeChooseBranch.checkingMergeability')}
      </div>
    )
  }

  private renderCleanMessage(currentBranch: Branch, branch: Branch) {
    if (this.commitCount <= 0) {
      return null
    }

    if (this.state.selectedOperation === MultiCommitOperationKind.Rebase) {
      return (
        <Trans
          as="div"
          className="merge-message"
          k="multiCommit.rebaseChooseBranch.applyCommits"
          params={{
            count: this.commitCount,
            currentBranch: currentBranch.name,
            baseBranch: branch.name,
          }}
          components={{
            current: <strong />,
            summary: <strong />,
            base: <strong />,
          }}
        />
      )
    }

    return (
      <Trans
        as="div"
        className="merge-message"
        k="multiCommit.mergeChooseBranch.cleanMerge"
        params={{
          count: this.commitCount,
          branch: branch.name,
          currentBranch: currentBranch.name,
        }}
        components={{
          summary: <strong />,
          from: <strong />,
          into: <strong />,
        }}
      />
    )
  }

  private renderInvalidMessage() {
    if (this.state.selectedOperation === MultiCommitOperationKind.Rebase) {
      return (
        <div className="merge-message">
          {t('multiCommit.rebaseChooseBranch.invalid')}
        </div>
      )
    }

    return (
      <div className="merge-message">
        {t('multiCommit.mergeChooseBranch.unrelatedHistories')}
      </div>
    )
  }

  private renderConflictedMergeMessage(
    currentBranch: Branch,
    branch: Branch,
    count: number
  ) {
    return (
      <Trans
        as="div"
        className="merge-message"
        k="multiCommit.mergeChooseBranch.conflicts"
        params={{
          count,
          branch: branch.name,
          currentBranch: currentBranch.name,
        }}
        components={{
          summary: <strong />,
          from: <strong />,
          into: <strong />,
        }}
      />
    )
  }
}
