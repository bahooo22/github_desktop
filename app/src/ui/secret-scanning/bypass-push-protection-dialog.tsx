import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { ISecretScanResult } from './push-protection-error-dialog'
import { VerticalSegmentedControl } from '../lib/vertical-segmented-control'
import { t } from '../../lib/l10n'

export enum BypassReason {
  FalsePositive = 'false_positive',
  UsedInTests = 'used_in_tests',
  WillFixLater = 'will_fix_later',
}

export type BypassReasonType =
  | BypassReason.FalsePositive
  | BypassReason.UsedInTests
  | BypassReason.WillFixLater

interface IBypassPushProtectionDialogProps {
  /** The secret to be bypassed */
  readonly secret: ISecretScanResult

  /** The function to call when the user clicks the bypass button */
  readonly bypassPushProtection: (
    secret: ISecretScanResult,
    reason: BypassReasonType
  ) => void

  readonly onDismissed: () => void
}

interface IBypassPushProtectionDialogState {
  readonly reason: BypassReasonType
}
/**
 * The dialog shown when a user wants to bypass the push protection feature of secret scanning.
 */
export class BypassPushProtectionDialog extends React.Component<
  IBypassPushProtectionDialogProps,
  IBypassPushProtectionDialogState
> {
  public constructor(props: IBypassPushProtectionDialogProps) {
    super(props)
    this.state = {
      reason: BypassReason.FalsePositive,
    }
  }

  public render() {
    const items = [
      {
        title: t('secretScanning.bypassDialog.usedInTestsTitle'),
        description: t('secretScanning.bypassDialog.usedInTestsDescription'),
        key: BypassReason.UsedInTests,
      },
      {
        title: t('secretScanning.bypassDialog.falsePositiveTitle'),
        description: t('secretScanning.bypassDialog.falsePositiveDescription'),
        key: BypassReason.FalsePositive,
      },
      {
        title: t('secretScanning.bypassDialog.willFixLaterTitle'),
        description: t('secretScanning.bypassDialog.willFixLaterDescription'),
        key: BypassReason.WillFixLater,
      },
    ]

    return (
      <Dialog
        title={t('secretScanning.bypassDialog.title')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.bypassPushProtection}
        className="bypass-push-protection-dialog"
      >
        <DialogContent>
          <VerticalSegmentedControl
            label={t('secretScanning.bypassDialog.reasonLabel', {
              description: this.props.secret.description,
            })}
            items={items}
            selectedKey={this.state.reason}
            onSelectionChanged={this.onSelectionChanged}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('secretScanning.bypassDialog.ok')}
            destructive={true}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSelectionChanged = (reason: BypassReasonType) => {
    this.setState({ reason })
  }

  private bypassPushProtection = () => {
    this.props.bypassPushProtection(this.props.secret, this.state.reason)
  }
}
