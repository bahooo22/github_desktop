import * as React from 'react'

import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Ref } from '../lib/ref'
import { LinkButton } from '../lib/link-button'
import { PasswordTextBox } from '../lib/password-text-box'
import { t, Trans } from '../../lib/l10n'

interface IGenericGitAuthenticationProps {
  /** The remote url with which the user tried to authenticate. */
  readonly remoteUrl: string

  /** The function to call when the user saves their credentials. */
  readonly onSave: (username: string, password: string) => void

  /** The function to call when the user dismisses the dialog. */
  readonly onDismiss: () => void

  /**
   * In case the username is predetermined. Setting this will prevent
   * the popup from allowing the user to change the username.
   */
  readonly username?: string
}

interface IGenericGitAuthenticationState {
  readonly username: string
  readonly password: string
}

/** Shown to enter the credentials to authenticate to a generic git server. */
export class GenericGitAuthentication extends React.Component<
  IGenericGitAuthenticationProps,
  IGenericGitAuthenticationState
> {
  public constructor(props: IGenericGitAuthenticationProps) {
    super(props)

    this.state = { username: this.props.username ?? '', password: '' }
  }

  public render() {
    const disabled = !this.state.password.length || !this.state.username.length
    const remote = <Ref>{this.props.remoteUrl}</Ref>
    return (
      <Dialog
        id="generic-git-auth"
        title={t('genericGitAuth.title')}
        onDismissed={this.props.onDismiss}
        onSubmit={this.save}
        role="alertdialog"
        ariaDescribedBy="generic-git-auth-error"
      >
        <DialogContent>
          {this.props.username !== undefined ? (
            <Trans
              as="p"
              id="generic-git-auth-error"
              k="genericGitAuth.messageWithUser"
              params={{
                remoteUrl: this.props.remoteUrl,
                username: this.props.username,
              }}
              components={{ url: <Ref />, user: <Ref /> }}
            />
          ) : (
            <Trans
              as="p"
              id="generic-git-auth-error"
              k="genericGitAuth.message"
              params={{ remoteUrl: this.props.remoteUrl }}
              components={{ url: remote }}
            />
          )}

          {this.props.username === undefined && (
            <Row>
              <TextBox
                label={t('genericGitAuth.username')}
                autoFocus={true}
                value={this.state.username}
                onValueChanged={this.onUsernameChange}
              />
            </Row>
          )}

          <Row>
            <PasswordTextBox
              label={t('genericGitAuth.password')}
              value={this.state.password}
              onValueChanged={this.onPasswordChange}
              ariaDescribedBy="generic-git-auth-password-description"
            />
          </Row>

          <Row>
            <Trans
              id="generic-git-auth-password-description"
              k="genericGitAuth.patDescription"
              components={{
                link: (
                  <LinkButton uri="https://github.com/desktop/desktop/tree/development/docs/integrations" />
                ),
              }}
            />
          </Row>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup okButtonDisabled={disabled} />
        </DialogFooter>
      </Dialog>
    )
  }

  private onUsernameChange = (value: string) => {
    this.setState({ username: value })
  }

  private onPasswordChange = (value: string) => {
    this.setState({ password: value })
  }

  private save = () => {
    this.props.onSave(
      this.props.username ?? this.state.username,
      this.state.password
    )
    this.props.onDismiss()
  }
}
