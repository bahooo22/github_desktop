import * as React from 'react'
import { Account } from '../../models/account'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { t } from '../../lib/l10n'

interface IConfirmAccountSignOutProps {
  readonly account: Account
  readonly repositoryCount: number
  readonly onComplete: (clearAssignments: boolean | undefined) => void
  readonly onDismissed: () => void
}

interface IConfirmAccountSignOutState {
  readonly clearAssignments: boolean
}

/** Confirms sign-out and whether repository assignments should be cleared. */
export class ConfirmAccountSignOut extends React.Component<
  IConfirmAccountSignOutProps,
  IConfirmAccountSignOutState
> {
  public constructor(props: IConfirmAccountSignOutProps) {
    super(props)
    this.state = { clearAssignments: false }
  }

  private onChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.setState({ clearAssignments: event.currentTarget.checked })
  }

  private onSubmit = () => {
    this.props.onComplete(this.state.clearAssignments)
    this.props.onDismissed()
  }

  private onDismissed = () => {
    this.props.onComplete(undefined)
    this.props.onDismissed()
  }

  public render() {
    const { account, repositoryCount } = this.props
    return (
      <Dialog
        id="confirm-account-sign-out"
        title={t('confirmAccountSignOut.title', {
          login: account.login,
        })}
        onSubmit={this.onSubmit}
        onDismissed={this.onDismissed}
      >
        <DialogContent>
          <p>
            {t('confirmAccountSignOut.assignments-count', {
              count: repositoryCount,
              login: account.login,
              endpoint: account.friendlyEndpoint,
            })}
          </p>
          <p>{t('confirmAccountSignOut.keep-assignments')}</p>
          <Checkbox
            label={t('confirmAccountSignOut.clear-assignments-label')}
            value={
              this.state.clearAssignments ? CheckboxValue.On : CheckboxValue.Off
            }
            onChange={this.onChange}
          />
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('confirmAccountSignOut.sign-out')}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
