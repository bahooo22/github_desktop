import * as React from 'react'
import { Account } from '../../models/account'
import { IAccountTokenExpiration } from '../../lib/credential-sessions'
import { t } from '../../lib/l10n'
import { Dispatcher } from '../dispatcher'
import { Dialog, DialogContent, DialogError, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Button } from '../lib/button'
import { Select } from '../lib/select'
import { Row } from '../lib/row'

interface ITestTokenExpirationDialogProps {
  readonly accounts: ReadonlyArray<Account>
  readonly dispatcher: Pick<
    Dispatcher,
    | 'getAccountTokenExpirationForTesting'
    | 'setAccountTokenExpirationForTesting'
  >
  readonly onDismissed: () => void
}

interface ITestTokenExpirationDialogState {
  readonly endpoint: string
  readonly expiration: IAccountTokenExpiration | null
  readonly dateTime: string
  readonly busy: boolean
  readonly error: string | null
  readonly message: string | null
}

function localDateTime(expiresAt: number | undefined): string {
  if (expiresAt === undefined) {
    return ''
  }
  const date = new Date(expiresAt)
  return new Date(expiresAt - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19)
}

function describeExpiration(expiresAt: number | undefined): string {
  return expiresAt === undefined
    ? t('testTokenExpirationDialog.unknown')
    : new Date(expiresAt).toLocaleString()
}

/** Session-only controls for exercising access-token expiration and renewal. */
export class TestTokenExpirationDialog extends React.Component<
  ITestTokenExpirationDialogProps,
  ITestTokenExpirationDialogState
> {
  private requestId = 0

  /** Built during render so a language change reaches the button labels. */
  private get presets() {
    return [
      {
        id: 'expired',
        label: t('testTokenExpirationDialog.presetExpired'),
        onClick: () => this.usePreset(-1),
      },
      {
        id: 'in-10-min',
        label: t('testTokenExpirationDialog.presetIn10Min'),
        onClick: () => this.usePreset(10),
      },
      {
        id: 'in-1-hour',
        label: t('testTokenExpirationDialog.presetInOneHour'),
        onClick: () => this.usePreset(60),
      },
      {
        id: 'in-62-min',
        label: t('testTokenExpirationDialog.presetIn62Min'),
        onClick: () => this.usePreset(62),
      },
      {
        id: 'in-8-hours',
        label: t('testTokenExpirationDialog.presetIn8Hours'),
        onClick: () => this.usePreset(480),
      },
    ]
  }

  public constructor(props: ITestTokenExpirationDialogProps) {
    super(props)
    this.state = {
      endpoint: props.accounts[0]?.endpoint ?? '',
      expiration: null,
      dateTime: '',
      busy: false,
      error: null,
      message: null,
    }
  }

  public componentDidMount() {
    void this.loadExpiration()
  }

  public componentDidUpdate(prevProps: ITestTokenExpirationDialogProps) {
    const account = this.getSelectedAccount()
    const previousAccount = prevProps.accounts.find(
      a => a.endpoint === this.state.endpoint
    )
    if (
      account === undefined &&
      (this.state.endpoint !== '' || this.props.accounts.length > 0)
    ) {
      this.setState(
        { endpoint: this.props.accounts[0]?.endpoint ?? '' },
        this.loadExpiration
      )
    } else if (account !== previousAccount) {
      void this.loadExpiration()
    }
  }

  public componentWillUnmount() {
    this.requestId++
  }

  public render() {
    const { expiration, busy, error, dateTime, message } = this.state
    const disabled = busy || expiration?.isRefreshable !== true
    return (
      <Dialog
        id="test-token-expiration"
        title={t('testTokenExpirationDialog.title')}
        onSubmit={this.onApply}
        onDismissed={this.props.onDismissed}
      >
        {error !== null && <DialogError>{error}</DialogError>}
        <DialogContent>
          <p>{t('testTokenExpirationDialog.intro')}</p>
          {this.props.accounts.length === 0 ? (
            <p>{t('testTokenExpirationDialog.signInHint')}</p>
          ) : (
            <>
              <Row>
                <Select
                  label={t('testTokenExpirationDialog.account')}
                  value={this.state.endpoint}
                  disabled={busy}
                  onChange={this.onAccountChanged}
                >
                  {this.props.accounts.map(account => (
                    <option key={account.endpoint} value={account.endpoint}>
                      {account.login} ({account.friendlyEndpoint})
                    </option>
                  ))}
                </Select>
              </Row>
              {expiration !== null && (
                <>
                  <p>
                    {t('testTokenExpirationDialog.currentExpiry')}{' '}
                    {describeExpiration(expiration.expiresAt)}
                    {expiration.isOverridden && (
                      <> {t('testTokenExpirationDialog.overridden')}</>
                    )}
                  </p>
                  {expiration.isOverridden && (
                    <p>
                      {t('testTokenExpirationDialog.originalExpiry')}{' '}
                      {describeExpiration(expiration.originalExpiresAt)}
                    </p>
                  )}
                  {!expiration.isRefreshable && (
                    <p>{t('testTokenExpirationDialog.notRefreshable')}</p>
                  )}
                </>
              )}
              <Row>
                <div className="text-box-component">
                  <label htmlFor="test-token-expiration-date-time">
                    {t('testTokenExpirationDialog.expirationLabel')}
                  </label>
                  <input
                    id="test-token-expiration-date-time"
                    type="datetime-local"
                    step={1}
                    value={dateTime}
                    disabled={disabled}
                    required={true}
                    onChange={this.onDateTimeChanged}
                  />
                </div>
              </Row>
              <Row className="token-expiration-presets">
                {this.presets.map(preset => (
                  <Button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    onClick={preset.onClick}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Row>
              <p>{t('testTokenExpirationDialog.refreshHint')}</p>
              <Row>
                <Button
                  type="button"
                  disabled={busy || expiration?.isOverridden !== true}
                  onClick={this.onReset}
                >
                  {t('testTokenExpirationDialog.resetOverride')}
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={this.loadExpiration}
                >
                  {t('testTokenExpirationDialog.reloadDetails')}
                </Button>
              </Row>
            </>
          )}
          {message !== null && <p role="status">{message}</p>}
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText={t('testTokenExpirationDialog.apply')}
            okButtonDisabled={
              disabled || this.getChosenExpiration() === undefined
            }
            cancelButtonText={t('common.close')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private getSelectedAccount() {
    return this.props.accounts.find(a => a.endpoint === this.state.endpoint)
  }

  private getChosenExpiration(): number | undefined {
    const value = new Date(this.state.dateTime).getTime()
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined
  }

  private loadExpiration = async () => {
    const id = ++this.requestId
    const account = this.getSelectedAccount()
    this.setState({
      expiration: null,
      busy: account !== undefined,
      error: null,
      message: null,
    })
    if (account === undefined) {
      return
    }
    try {
      const expiration =
        await this.props.dispatcher.getAccountTokenExpirationForTesting(account)
      if (id === this.requestId) {
        this.setState({
          expiration,
          dateTime: localDateTime(expiration.expiresAt),
          busy: false,
        })
      }
    } catch (error) {
      log.error('Unable to read test token expiration', error)
      if (id === this.requestId) {
        this.setState({
          error:
            error instanceof Error
              ? error.message
              : t('testTokenExpirationDialog.readFailed'),
          busy: false,
        })
      }
    }
  }

  private onAccountChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    this.setState({ endpoint: event.currentTarget.value }, this.loadExpiration)
  }

  private onDateTimeChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ dateTime: event.currentTarget.value, message: null })
  }

  private usePreset(minutes: number) {
    this.setState({
      dateTime: localDateTime(Date.now() + minutes * 60_000),
      message: null,
    })
  }

  private onApply = async () => {
    const expiresAt = this.getChosenExpiration()
    if (expiresAt === undefined) {
      this.setState({
        error: t('testTokenExpirationDialog.chooseValid'),
      })
      return
    }
    await this.updateExpiration(expiresAt)
  }

  private onReset = () => this.updateExpiration(undefined)

  private async updateExpiration(expiresAt: number | undefined) {
    const account = this.getSelectedAccount()
    if (account === undefined) {
      this.setState({ error: t('testTokenExpirationDialog.selectAccount') })
      return
    }
    const id = ++this.requestId
    this.setState({ busy: true, error: null, message: null })
    try {
      const expiration =
        await this.props.dispatcher.setAccountTokenExpirationForTesting(
          account,
          expiresAt
        )
      if (id === this.requestId) {
        this.setState({
          expiration,
          dateTime: localDateTime(expiration.expiresAt),
          busy: false,
          message:
            expiresAt === undefined
              ? t('testTokenExpirationDialog.restored')
              : t('testTokenExpirationDialog.overrideApplied'),
        })
      }
    } catch (error) {
      log.error('Unable to change test token expiration', error)
      if (id === this.requestId) {
        this.setState({
          error:
            error instanceof Error
              ? error.message
              : t('testTokenExpirationDialog.changeFailed'),
          busy: false,
        })
      }
    }
  }
}
