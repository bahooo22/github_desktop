import * as React from 'react'
import { UncommittedChangesStrategy } from '../../models/uncommitted-changes-strategy'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { RadioGroup } from '../lib/radio-group'
import { assertNever } from '../../lib/fatal-error'
import { t } from '../../lib/l10n'

interface IPromptsPreferencesProps {
  readonly confirmRepositoryRemoval: boolean
  readonly confirmDiscardChanges: boolean
  readonly confirmDiscardChangesPermanently: boolean
  readonly confirmDiscardStash: boolean
  readonly confirmCheckoutCommit: boolean
  readonly confirmForcePush: boolean
  readonly confirmUndoCommit: boolean
  readonly askForConfirmationOnCommitFilteredChanges: boolean
  readonly confirmCommitMessageOverride: boolean
  readonly confirmWorktreeRemoval: boolean
  readonly showCommitLengthWarning: boolean
  readonly uncommittedChangesStrategy: UncommittedChangesStrategy
  readonly onConfirmDiscardChangesChanged: (checked: boolean) => void
  readonly onConfirmDiscardChangesPermanentlyChanged: (checked: boolean) => void
  readonly onConfirmDiscardStashChanged: (checked: boolean) => void
  readonly onConfirmCheckoutCommitChanged: (checked: boolean) => void
  readonly onConfirmRepositoryRemovalChanged: (checked: boolean) => void
  readonly onConfirmForcePushChanged: (checked: boolean) => void
  readonly onConfirmUndoCommitChanged: (checked: boolean) => void
  readonly onShowCommitLengthWarningChanged: (checked: boolean) => void
  readonly onUncommittedChangesStrategyChanged: (
    value: UncommittedChangesStrategy
  ) => void
  readonly onAskForConfirmationOnCommitFilteredChanges: (value: boolean) => void
  readonly onConfirmCommitMessageOverrideChanged: (checked: boolean) => void
  readonly onConfirmWorktreeRemovalChanged: (checked: boolean) => void
}

interface IPromptsPreferencesState {
  readonly confirmRepositoryRemoval: boolean
  readonly confirmDiscardChanges: boolean
  readonly confirmDiscardChangesPermanently: boolean
  readonly confirmDiscardStash: boolean
  readonly confirmCheckoutCommit: boolean
  readonly confirmForcePush: boolean
  readonly confirmUndoCommit: boolean
  readonly askForConfirmationOnCommitFilteredChanges: boolean
  readonly confirmCommitMessageOverride: boolean
  readonly confirmWorktreeRemoval: boolean
  readonly uncommittedChangesStrategy: UncommittedChangesStrategy
}

export class Prompts extends React.Component<
  IPromptsPreferencesProps,
  IPromptsPreferencesState
> {
  public constructor(props: IPromptsPreferencesProps) {
    super(props)

    this.state = {
      confirmRepositoryRemoval: this.props.confirmRepositoryRemoval,
      confirmDiscardChanges: this.props.confirmDiscardChanges,
      confirmDiscardChangesPermanently:
        this.props.confirmDiscardChangesPermanently,
      confirmDiscardStash: this.props.confirmDiscardStash,
      confirmCheckoutCommit: this.props.confirmCheckoutCommit,
      confirmForcePush: this.props.confirmForcePush,
      confirmUndoCommit: this.props.confirmUndoCommit,
      uncommittedChangesStrategy: this.props.uncommittedChangesStrategy,
      askForConfirmationOnCommitFilteredChanges:
        this.props.askForConfirmationOnCommitFilteredChanges,
      confirmCommitMessageOverride: this.props.confirmCommitMessageOverride,
      confirmWorktreeRemoval: this.props.confirmWorktreeRemoval,
    }
  }

  private onConfirmDiscardChangesChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmDiscardChanges: value })
    this.props.onConfirmDiscardChangesChanged(value)
  }

  private onConfirmDiscardChangesPermanentlyChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmDiscardChangesPermanently: value })
    this.props.onConfirmDiscardChangesPermanentlyChanged(value)
  }

  private onConfirmDiscardStashChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmDiscardStash: value })
    this.props.onConfirmDiscardStashChanged(value)
  }

  private onConfirmCheckoutCommitChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmCheckoutCommit: value })
    this.props.onConfirmCheckoutCommitChanged(value)
  }

  private onConfirmForcePushChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmForcePush: value })
    this.props.onConfirmForcePushChanged(value)
  }

  private onConfirmUndoCommitChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmUndoCommit: value })
    this.props.onConfirmUndoCommitChanged(value)
  }

  private onAskForConfirmationOnCommitFilteredChanges = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ askForConfirmationOnCommitFilteredChanges: value })
    this.props.onAskForConfirmationOnCommitFilteredChanges(value)
  }

  private onConfirmCommitMessageOverrideChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmCommitMessageOverride: value })
    this.props.onConfirmCommitMessageOverrideChanged(value)
  }

  private onConfirmWorktreeRemovalChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmWorktreeRemoval: value })
    this.props.onConfirmWorktreeRemovalChanged(value)
  }

  private onConfirmRepositoryRemovalChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    const value = event.currentTarget.checked

    this.setState({ confirmRepositoryRemoval: value })
    this.props.onConfirmRepositoryRemovalChanged(value)
  }

  private onUncommittedChangesStrategyChanged = (
    value: UncommittedChangesStrategy
  ) => {
    this.setState({ uncommittedChangesStrategy: value })
    this.props.onUncommittedChangesStrategyChanged(value)
  }

  private onShowCommitLengthWarningChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onShowCommitLengthWarningChanged(event.currentTarget.checked)
  }

  private renderSwitchBranchOptionLabel = (key: UncommittedChangesStrategy) => {
    switch (key) {
      case UncommittedChangesStrategy.AskForConfirmation:
        return t('settings.prompts.ask-me-where-changes-go')
      case UncommittedChangesStrategy.MoveToNewBranch:
        return t('settings.prompts.always-move-to-new-branch')
      case UncommittedChangesStrategy.StashOnCurrentBranch:
        return t('settings.prompts.always-stash-on-current-branch')
      default:
        return assertNever(key, `Unknown uncommitted changes strategy: ${key}`)
    }
  }

  private renderSwitchBranchOptions = () => {
    const options = [
      UncommittedChangesStrategy.AskForConfirmation,
      UncommittedChangesStrategy.MoveToNewBranch,
      UncommittedChangesStrategy.StashOnCurrentBranch,
    ]

    const selectedKey =
      options.find(o => o === this.state.uncommittedChangesStrategy) ??
      UncommittedChangesStrategy.AskForConfirmation

    return (
      <div className="advanced-section">
        <h2 id="switch-branch-heading">
          {t('settings.prompts.switch-branch-heading')}
        </h2>

        <RadioGroup<UncommittedChangesStrategy>
          ariaLabelledBy="switch-branch-heading"
          selectedKey={selectedKey}
          radioButtonKeys={options}
          onSelectionChanged={this.onUncommittedChangesStrategyChanged}
          renderRadioButtonLabelContents={this.renderSwitchBranchOptionLabel}
        />
      </div>
    )
  }

  private renderCommittingFilteredChangesPrompt = () => {
    return (
      <Checkbox
        label={t('settings.prompts.committing-changes-hidden-by-filter')}
        value={
          this.state.askForConfirmationOnCommitFilteredChanges
            ? CheckboxValue.On
            : CheckboxValue.Off
        }
        onChange={this.onAskForConfirmationOnCommitFilteredChanges}
      />
    )
  }

  public render() {
    return (
      <DialogContent>
        <div className="advanced-section">
          <h2 id="show-confirm-dialog-heading">
            {t('settings.prompts.show-confirmation-dialog-before')}
          </h2>
          <div role="group" aria-labelledby="show-confirm-dialog-heading">
            <Checkbox
              label={t('settings.prompts.removing-repositories')}
              value={
                this.state.confirmRepositoryRemoval
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmRepositoryRemovalChanged}
            />
            <Checkbox
              label={t('settings.prompts.discarding-changes')}
              value={
                this.state.confirmDiscardChanges
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmDiscardChangesChanged}
            />
            <Checkbox
              label={t('settings.prompts.discarding-changes-permanently')}
              value={
                this.state.confirmDiscardChangesPermanently
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmDiscardChangesPermanentlyChanged}
            />
            <Checkbox
              label={t('settings.prompts.discarding-stash')}
              value={
                this.state.confirmDiscardStash
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmDiscardStashChanged}
            />
            <Checkbox
              label={t('settings.prompts.checking-out-a-commit')}
              value={
                this.state.confirmCheckoutCommit
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmCheckoutCommitChanged}
            />
            <Checkbox
              label={t('settings.prompts.force-pushing')}
              value={
                this.state.confirmForcePush
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmForcePushChanged}
            />
            <Checkbox
              label={t('settings.prompts.undoing-commit')}
              value={
                this.state.confirmUndoCommit
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmUndoCommitChanged}
            />
            <Checkbox
              label={t('settings.prompts.overriding-commit-message')}
              value={
                this.state.confirmCommitMessageOverride
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmCommitMessageOverrideChanged}
            />
            <Checkbox
              label={t('settings.prompts.removing-worktrees')}
              value={
                this.state.confirmWorktreeRemoval
                  ? CheckboxValue.On
                  : CheckboxValue.Off
              }
              onChange={this.onConfirmWorktreeRemovalChanged}
            />
            {this.renderCommittingFilteredChangesPrompt()}
          </div>
        </div>
        {this.renderSwitchBranchOptions()}
        <div className="advanced-section">
          <h2>{t('settings.prompts.commit-length')}</h2>
          <Checkbox
            label={t('settings.prompts.show-commit-length-warning')}
            value={
              this.props.showCommitLengthWarning
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onShowCommitLengthWarningChanged}
          />
        </div>
      </DialogContent>
    )
  }
}
