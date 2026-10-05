import * as React from 'react'
import { Dialog, DialogContent, DefaultDialogFooter } from '../dialog'
import { InstalledCLIPath } from '../lib/install-cli'
import { t, Trans } from '../../lib/l10n'

interface ICLIInstalledProps {
  /** Called when the popup should be dismissed. */
  readonly onDismissed: () => void
}

/** Tell the user the CLI tool was successfully installed. */
export class CLIInstalled extends React.Component<ICLIInstalledProps, {}> {
  public render() {
    const path = InstalledCLIPath

    return (
      <Dialog
        title={t('cli.installed-title')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.props.onDismissed}
      >
        <DialogContent>
          <Trans
            as="div"
            k="cli.installed-info"
            params={{ path }}
            components={{ strong: <strong /> }}
          />
        </DialogContent>
        <DefaultDialogFooter buttonText={t('common.ok')} />
      </Dialog>
    )
  }
}
