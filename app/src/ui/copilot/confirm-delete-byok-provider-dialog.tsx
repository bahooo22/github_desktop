import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Ref } from '../lib/ref'
import { IBYOKProvider } from '../../lib/copilot/byok'
import { t, Trans } from '../../lib/l10n'

interface IConfirmDeleteCopilotBYOKProviderDialogProps {
  readonly provider: IBYOKProvider
  readonly onConfirm: (provider: IBYOKProvider) => void
  readonly onDismissed: () => void
}

/**
 * Confirmation prompt shown before removing a BYOK Copilot provider. The
 * provider is removed from local storage and any stored secret is purged
 * from the OS keychain.
 */
export class ConfirmDeleteCopilotBYOKProviderDialog extends React.Component<IConfirmDeleteCopilotBYOKProviderDialogProps> {
  public render() {
    return (
      <Dialog
        id="confirm-delete-copilot-byok-provider"
        title={t('copilotByokProvider.removeTitle')}
        type="warning"
        onSubmit={this.onConfirm}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="confirm-delete-copilot-byok-provider-message"
      >
        <DialogContent>
          <p id="confirm-delete-copilot-byok-provider-message">
            <Trans
              k="copilotByokProvider.removeQuestion"
              components={{ ref: <Ref>{this.props.provider.name}</Ref> }}
            />{' '}
            {this.renderSecretConsequence()}
          </p>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t('copilotByokProvider.remove')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderSecretConsequence() {
    switch (this.props.provider.authKind) {
      case 'apiKey':
        return t('copilotByokProvider.removeApiKeyConsequence')
      case 'bearer':
        return t('copilotByokProvider.removeBearerConsequence')
      case 'none':
        return t('copilotByokProvider.removeNoAuthConsequence')
    }
  }

  private onConfirm = () => {
    this.props.onConfirm(this.props.provider)
    this.props.onDismissed()
  }
}
