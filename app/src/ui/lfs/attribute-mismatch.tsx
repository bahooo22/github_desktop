import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { t, Trans } from '../../lib/l10n'

interface IAttributeMismatchProps {
  /** Called when the dialog should be dismissed. */
  readonly onDismissed: () => void

  /** Called when the user has chosen to replace the update filters. */
  readonly onUpdateExistingFilters: () => void

  readonly onEditGlobalGitConfig: () => void
}

export class AttributeMismatch extends React.Component<IAttributeMismatchProps> {
  public render() {
    return (
      <Dialog
        id="lfs-attribute-mismatch"
        title={t('lfs.attributeMismatch.title')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
      >
        <DialogContent>
          <Trans
            as="p"
            k="lfs.attributeMismatch.message"
            components={{
              config: <LinkButton onClick={this.props.onEditGlobalGitConfig} />,
            }}
          />
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('lfs.attributeMismatch.update')}
            cancelButtonText={t('lfs.notNow')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = () => {
    this.props.onUpdateExistingFilters()
    this.props.onDismissed()
  }
}
