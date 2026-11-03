import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Dispatcher } from '../dispatcher'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Account } from '../../models/account'
import { Ref } from '../lib/ref'
import { t, Trans } from '../../lib/l10n'

interface IInvalidatedTokenProps {
  readonly dispatcher: Pick<Dispatcher, 'showAccountSignInDialog'>
  readonly account: Account
  readonly onDismissed: () => void
}

/**
 * Dialog that alerts user that their GitHub (Enterprise) account token is not
 * valid and they need to sign in again.
 */
export class InvalidatedToken extends React.Component<IInvalidatedTokenProps> {
  public render() {
    const { account } = this.props

    return (
      <Dialog
        id="invalidated-token"
        type="warning"
        title={t('invalidatedToken.title')}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>
          <Trans
            k="invalidatedToken.message"
            params={{
              login: account.login,
              endpoint: account.friendlyEndpoint,
            }}
            components={{ ref: <Ref /> }}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('invalidatedToken.yes')}
            cancelButtonText={t('invalidatedToken.no')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = () => {
    const { dispatcher, onDismissed, account } = this.props

    onDismissed()

    // Other accounts may still be signed in to the same endpoint, so sign
    // back in to this specific account rather than any account.
    dispatcher.showAccountSignInDialog(account.endpoint, account.login)
  }
}
