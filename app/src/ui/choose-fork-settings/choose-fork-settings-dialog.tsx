import * as React from 'react'

import {
  RepositoryWithForkedGitHubRepository,
  getForkContributionTarget,
} from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { Row } from '../lib/row'
import { Dialog, DialogContent, DialogFooter } from '../dialog'

import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { ForkContributionTarget } from '../../models/workflow-preferences'
import { VerticalSegmentedControl } from '../lib/vertical-segmented-control'
import { ForkSettingsDescription } from '../repository-settings/fork-contribution-target-description'
import { t, Trans } from '../../lib/l10n'

interface IChooseForkSettingsProps {
  readonly dispatcher: Dispatcher
  /**
   * The current repository.
   * It needs to be a forked GitHub-based repository
   */
  readonly repository: RepositoryWithForkedGitHubRepository
  /**
   * Event triggered when the dialog is dismissed by the user.
   * This happens both when the user clicks on "Continue" to
   * save their changes or when they click on "Cancel".
   */
  readonly onDismissed: () => void
}

interface IChooseForkSettingsState {
  /** The currently selected ForkContributionTarget value */
  readonly forkContributionTarget: ForkContributionTarget
}

export class ChooseForkSettings extends React.Component<
  IChooseForkSettingsProps,
  IChooseForkSettingsState
> {
  public constructor(props: IChooseForkSettingsProps) {
    super(props)

    this.state = {
      forkContributionTarget: getForkContributionTarget(props.repository),
    }
  }

  public render() {
    const items = [
      {
        title: t('chooseForkSettings.contribute-to-parent'),
        description: (
          <Trans
            k="chooseForkSettings.contribute-to-parent-description"
            params={{
              repository:
                this.props.repository.gitHubRepository.parent.fullName,
            }}
            components={{ strong: <strong /> }}
          />
        ),
        key: ForkContributionTarget.Parent,
      },
      {
        title: t('chooseForkSettings.for-my-own-purposes'),
        description: (
          <Trans
            k="chooseForkSettings.contribute-to-self-description"
            params={{
              repository: this.props.repository.gitHubRepository.fullName,
            }}
            components={{ strong: <strong /> }}
          />
        ),
        key: ForkContributionTarget.Self,
      },
    ]

    return (
      <Dialog
        id="fork-settings"
        title={t('chooseForkSettings.title')}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>
          <Row>
            <VerticalSegmentedControl
              label={t('chooseForkSettings.question-label')}
              items={items}
              selectedKey={this.state.forkContributionTarget}
              onSelectionChanged={this.onSelectionChanged}
            />
          </Row>
          <Row>
            <ForkSettingsDescription
              repository={this.props.repository}
              forkContributionTarget={this.state.forkContributionTarget}
            />
          </Row>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('chooseForkSettings.continue')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSelectionChanged = (value: ForkContributionTarget) => {
    this.setState({
      forkContributionTarget: value,
    })
  }

  private onSubmit = async () => {
    this.props.dispatcher.updateRepositoryWorkflowPreferences(
      this.props.repository,
      {
        forkContributionTarget: this.state.forkContributionTarget,
      }
    )
    this.props.onDismissed()
  }
}
