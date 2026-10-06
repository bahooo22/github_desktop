import * as React from 'react'
import { Dialog, DialogContent, DialogFooter, DialogError } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'
import { Select } from '../lib/select'
import { Row } from '../lib/row'
import { IBYOKModel } from '../../lib/copilot/byok'
import {
  formatReasoningEffort,
  ReasoningEffort,
  ReasoningEffortOrder,
} from '../../lib/stores/copilot-store'
import { t, Trans } from '../../lib/l10n'

const NoReasoningEffort = '__none__'

interface IEditCopilotBYOKModelDialogProps {
  /** The model being edited, or `null` when adding a new model. */
  readonly model: IBYOKModel | null
  /**
   * Existing model IDs in the same provider, used to detect duplicates.
   * Excludes the model being edited.
   */
  readonly otherModelIds: ReadonlyArray<string>
  readonly onSave: (model: IBYOKModel) => void
  readonly onDismissed: () => void
}

interface IEditCopilotBYOKModelDialogState {
  readonly id: string
  readonly name: string
  readonly reasoningEffort: ReasoningEffort | typeof NoReasoningEffort
  readonly errorMessage: string | null
}

/**
 * Add/edit dialog for a single model belonging to a BYOK Copilot provider.
 * The model is returned to the parent via the `onSave` callback prop and is
 * not persisted directly.
 */
export class EditCopilotBYOKModelDialog extends React.Component<
  IEditCopilotBYOKModelDialogProps,
  IEditCopilotBYOKModelDialogState
> {
  public constructor(props: IEditCopilotBYOKModelDialogProps) {
    super(props)
    this.state = {
      id: props.model?.id ?? '',
      name: props.model?.name ?? '',
      reasoningEffort: props.model?.reasoningEffort ?? NoReasoningEffort,
      errorMessage: null,
    }
  }

  public render() {
    const isEditing = this.props.model !== null
    const title = isEditing
      ? t('copilotByokModel.editTitle')
      : t('copilotByokModel.addTitle')

    return (
      <Dialog
        id="edit-copilot-byok-model"
        title={title}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
      >
        {this.state.errorMessage !== null && (
          <DialogError>{this.state.errorMessage}</DialogError>
        )}
        <DialogContent>
          <Row className="copilot-byok-field">
            <TextBox
              label={t('copilotByokModel.displayNameLabel')}
              value={this.state.name}
              onValueChanged={this.onNameChanged}
              placeholder="GPT-4o"
              autoFocus={true}
            />
            <p className="copilot-byok-field-hint">
              {t('copilotByokModel.friendlyNameHint')}
            </p>
          </Row>
          <Row className="copilot-byok-field">
            <TextBox
              label={t('copilotByokModel.modelIdentifierLabel')}
              value={this.state.id}
              onValueChanged={this.onIdChanged}
              placeholder="gpt-4o"
              required={true}
            />
            <Trans
              as="p"
              className="copilot-byok-field-hint"
              k="copilotByokModel.exactNameHint"
              components={{ code: <code /> }}
            />
          </Row>
          <Row className="copilot-byok-field">
            <Select
              label={t('copilotByokModel.reasoningEffortLabel')}
              value={this.state.reasoningEffort}
              onChange={this.onReasoningEffortChanged}
            >
              <option value={NoReasoningEffort}>
                {t('copilotByokModel.defaultReasoningOption')}
              </option>
              {ReasoningEffortOrder.map(effort => (
                <option key={effort} value={effort}>
                  {formatReasoningEffort(effort)}
                </option>
              ))}
            </Select>
            <p className="copilot-byok-field-hint">
              <Trans k="copilotByokModel.reasoningHint" />
            </p>
          </Row>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={
              isEditing ? t('copilotByokModel.save') : t('copilotByokModel.add')
            }
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onIdChanged = (id: string) => this.setState({ id })

  private onNameChanged = (name: string) => this.setState({ name })

  private onReasoningEffortChanged = (
    event: React.FormEvent<HTMLSelectElement>
  ) => {
    const value = event.currentTarget.value
    this.setState({
      reasoningEffort:
        value === NoReasoningEffort
          ? NoReasoningEffort
          : (value as ReasoningEffort),
    })
  }

  private onSubmit = () => {
    const validationError = this.validate()
    if (validationError !== null) {
      this.setState({ errorMessage: validationError })
      return
    }

    const id = this.state.id.trim()
    const name = this.state.name.trim() === '' ? id : this.state.name.trim()
    const model: IBYOKModel = {
      id,
      name,
      ...(this.state.reasoningEffort !== NoReasoningEffort
        ? { reasoningEffort: this.state.reasoningEffort }
        : {}),
    }

    this.props.onSave(model)
    this.props.onDismissed()
  }

  private validate(): string | null {
    const id = this.state.id.trim()
    if (id === '') {
      return t('copilotByokModel.identifierRequired')
    }
    if (this.props.otherModelIds.includes(id)) {
      return t('copilotByokModel.identifierExists', { id })
    }
    return null
  }
}
