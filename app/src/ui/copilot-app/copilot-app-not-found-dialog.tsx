import * as React from 'react'
import { copilotAppMarketingUrl } from '../../lib/copilot-app'
import { Dialog, DialogContent, DefaultDialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { Trans } from '../../lib/l10n'

interface ICopilotAppNotFoundDialogProps {
  readonly onDismissed: () => void
  readonly showPreferencesDialog: () => void
}

/** Help the user install or configure GitHub Copilot when it cannot be found. */
export class CopilotAppNotFoundDialog extends React.Component<ICopilotAppNotFoundDialogProps> {
  private onShowPreferences = () => {
    this.props.onDismissed()
    this.props.showPreferencesDialog()
  }

  public render() {
    return (
      <Dialog
        id="copilot-app"
        title="GitHub Copilot"
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <Trans
            as="p"
            k="copilotApp.notFoundMessage"
            components={{
              download: <LinkButton uri={copilotAppMarketingUrl} />,
            }}
          />
          <Trans
            as="p"
            k="copilotApp.notFoundPreferencesHint"
            components={{
              preferences: <LinkButton onClick={this.onShowPreferences} />,
            }}
          />
        </DialogContent>
        <DefaultDialogFooter />
      </Dialog>
    )
  }
}
