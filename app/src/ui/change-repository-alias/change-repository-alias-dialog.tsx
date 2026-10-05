import * as React from 'react'

import { Dispatcher } from '../dispatcher'
import { nameOf, Repository } from '../../models/repository'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { TextBox } from '../lib/text-box'
import { t } from '../../lib/l10n'

interface IChangeRepositoryAliasProps {
  readonly dispatcher: Dispatcher
  readonly onDismissed: () => void
  readonly repository: Repository
}

interface IChangeRepositoryAliasState {
  readonly newAlias: string
}

export class ChangeRepositoryAlias extends React.Component<
  IChangeRepositoryAliasProps,
  IChangeRepositoryAliasState
> {
  public constructor(props: IChangeRepositoryAliasProps) {
    super(props)

    this.state = { newAlias: props.repository.alias ?? props.repository.name }
  }

  public render() {
    const repository = this.props.repository
    const isCreate = repository.alias === null

    return (
      <Dialog
        id="change-repository-alias"
        title={t(
          isCreate
            ? 'repositoryAlias.create-title'
            : 'repositoryAlias.change-title'
        )}
        ariaDescribedBy="change-repository-alias-description"
        onDismissed={this.props.onDismissed}
        onSubmit={this.changeAlias}
      >
        <DialogContent>
          <p id="change-repository-alias-description">
            {t('repositoryAlias.description', { name: nameOf(repository) })}
          </p>
          <p>
            <TextBox
              ariaLabel={t('repositoryAlias.alias')}
              value={this.state.newAlias}
              onValueChanged={this.onNameChanged}
            />
          </p>
          {repository.gitHubRepository !== null && (
            <p className="description">
              {t('repositoryAlias.no-effect-note')}
            </p>
          )}
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t(
              isCreate
                ? 'repositoryAlias.create-ok'
                : 'repositoryAlias.change-ok'
            )}
            okButtonDisabled={this.state.newAlias.length === 0}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onNameChanged = (newAlias: string) => {
    this.setState({ newAlias })
  }

  private changeAlias = () => {
    this.props.dispatcher.changeRepositoryAlias(
      this.props.repository,
      this.state.newAlias
    )
    this.props.onDismissed()
  }
}
