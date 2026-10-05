import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../../dialog'
import { OkCancelButtonGroup } from '../../dialog/ok-cancel-button-group'
import { t } from '../../../lib/l10n'

interface ICopilotConflictResolutionAlwaysNudgeProps {
  readonly onAlwaysUseCopilot: () => void
  readonly onDecline: () => void
  readonly onDismissed: () => void
}

/**
 * Dialog nudging the user to enable the "Always use Copilot when conflicts are
 * detected" setting after they've used Copilot conflict resolution multiple
 * times in a row.
 */
export class CopilotConflictResolutionAlwaysNudge extends React.Component<ICopilotConflictResolutionAlwaysNudgeProps> {
  private onYes = () => {
    this.props.onAlwaysUseCopilot()
  }

  private onNo = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.props.onDecline()
  }

  public render() {
    return (
      <Dialog
        id="copilot-conflict-resolution-always-nudge"
        title={t('multiCommit.alwaysNudge.title')}
        onSubmit={this.onYes}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>
          <p>
            {t('multiCommit.alwaysNudge.message', {
              path: t('multiCommit.alwaysNudge.path'),
            })}
          </p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('multiCommit.alwaysNudge.yes')}
            cancelButtonText={t('multiCommit.alwaysNudge.no')}
            onCancelButtonClick={this.onNo}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
