import * as React from 'react'
import memoizeOne from 'memoize-one'
import { SignInResult } from '../../lib/stores/sign-in-store'
import {
  Account,
  getFriendlyEndpoint,
  isSameAccount,
} from '../../models/account'
import { PopupType } from '../../models/popup'
import {
  RepositoryWithGitHubRepository,
  getRepositoryAccountIdentity,
} from '../../models/repository'
import { AccountPicker } from '../account-picker'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Dispatcher } from '../dispatcher'
import { Button } from '../lib/button'
import { t } from '../../lib/l10n'

interface IRepositoryAccountDialogProps {
  readonly repository: RepositoryWithGitHubRepository
  readonly accounts: ReadonlyArray<Account>
  readonly dispatcher: Dispatcher
  readonly onComplete: (account: Account | undefined) => void
  readonly onDismissed: () => void
}

interface IRepositoryAccountDialogState {
  readonly choosingAnotherAccount: boolean
  readonly selectedAccount: Account | null
}

/** Requests an identity for a repository without persisting the choice. */
export class RepositoryAccountDialog extends React.Component<
  IRepositoryAccountDialogProps,
  IRepositoryAccountDialogState
> {
  private getEndpointAccounts = memoizeOne(
    (accounts: ReadonlyArray<Account>, endpoint: string) =>
      accounts.filter(a => a.endpoint === endpoint)
  )

  public constructor(props: IRepositoryAccountDialogProps) {
    super(props)
    this.state = {
      choosingAnotherAccount: false,
      selectedAccount: null,
    }
  }

  private get endpoint() {
    return this.props.repository.gitHubRepository.endpoint
  }

  private get accounts() {
    return this.getEndpointAccounts(this.props.accounts, this.endpoint)
  }

  private get requiresSignIn() {
    const identity = getRepositoryAccountIdentity(this.props.repository)
    return (
      !this.state.choosingAnotherAccount &&
      identity !== null &&
      !this.props.accounts.some(a => isSameAccount(a, identity))
    )
  }

  private complete = (account: Account | undefined) => {
    this.props.onComplete(account)
    this.props.onDismissed()
  }

  private onDismissed = () => this.complete(undefined)

  private onChooseAnotherAccount = () => {
    this.setState({ choosingAnotherAccount: true })
  }

  private onSelectedAccountChanged = (selectedAccount: Account) => {
    this.setState({ selectedAccount })
  }

  private onAssignedAccountSignInResult = (result: SignInResult) => {
    if (result.kind !== 'success') {
      return
    }

    this.props.dispatcher.closePopup(PopupType.SignIn)
    if (
      isSameAccount(
        result.account,
        getRepositoryAccountIdentity(this.props.repository)
      )
    ) {
      this.complete(result.account)
    }
  }

  private onSubmit = () => {
    const { dispatcher, repository } = this.props
    if (this.requiresSignIn) {
      if (repository.login !== null) {
        dispatcher.showAccountSignInDialog(
          this.endpoint,
          repository.login,
          this.onAssignedAccountSignInResult
        )
      }
    } else if (this.state.selectedAccount !== null) {
      this.complete(this.state.selectedAccount)
    }
  }

  private renderRequiresSignIn(friendlyEndpoint: string) {
    const { repository } = this.props
    return (
      <>
        <p>
          {t('repositoryAccount.assignedTo', {
            name: repository.name,
            login: repository.login ?? '',
            endpoint: friendlyEndpoint,
          })}
        </p>
        {this.accounts.length > 0 && (
          <Button onClick={this.onChooseAnotherAccount}>
            {t('repositoryAccount.chooseAnotherAccount')}
          </Button>
        )}
      </>
    )
  }

  private renderChooseAccount(friendlyEndpoint: string) {
    return (
      <>
        <p>
          {t('repositoryAccount.chooseAccount', {
            name: this.props.repository.name,
            endpoint: friendlyEndpoint,
          })}
        </p>
        <AccountPicker
          accounts={this.accounts}
          selectedAccount={this.state.selectedAccount}
          onSelectedAccountChanged={this.onSelectedAccountChanged}
          openButtonClassName="dialog-preferred-focus"
        />
      </>
    )
  }

  public render() {
    const requiresSignIn = this.requiresSignIn
    const friendlyEndpoint = getFriendlyEndpoint(this.endpoint)
    return (
      <Dialog
        id="repository-account"
        title={t('repositoryAccount.title')}
        onDismissed={this.onDismissed}
        onSubmit={this.onSubmit}
      >
        <DialogContent>
          {requiresSignIn
            ? this.renderRequiresSignIn(friendlyEndpoint)
            : this.renderChooseAccount(friendlyEndpoint)}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={
              requiresSignIn
                ? t('repositoryAccount.signIn')
                : t('repositoryAccount.useAccount')
            }
            okButtonDisabled={
              !requiresSignIn && this.state.selectedAccount === null
            }
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
