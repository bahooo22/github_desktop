import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DefaultDialogFooter,
} from '../dialog'
import { Dispatcher } from '../dispatcher'
import {
  RepositoryWithGitHubRepository,
  isRepositoryWithForkedGitHubRepository,
} from '../../models/repository'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { sendNonFatalException } from '../../lib/helpers/non-fatal-exception'
import { Account } from '../../models/account'
import { API } from '../../lib/api'
import { LinkButton } from '../lib/link-button'
import { PopupType } from '../../models/popup'
import { t, Trans } from '../../lib/l10n'

interface ICreateForkDialogProps {
  readonly dispatcher: Dispatcher
  readonly repository: RepositoryWithGitHubRepository
  readonly account: Account
  readonly onDismissed: () => void
}

interface ICreateForkDialogState {
  readonly loading: boolean
  readonly error?: Error
}

/**
 * Dialog offering to create a fork of the given repository
 */
export class CreateForkDialog extends React.Component<
  ICreateForkDialogProps,
  ICreateForkDialogState
> {
  public constructor(props: ICreateForkDialogProps) {
    super(props)
    this.state = { loading: false }
  }
  /**
   *  Starts fork process on GitHub!
   */
  private onSubmit = async () => {
    this.setState({ loading: true })
    const { gitHubRepository } = this.props.repository
    const api = API.fromAccount(this.props.account)
    try {
      const fork = await api.forkRepository(
        gitHubRepository.owner.login,
        gitHubRepository.name
      )
      this.props.dispatcher.incrementMetric('forksCreated')
      const updatedRepository =
        await this.props.dispatcher.convertRepositoryToFork(
          this.props.repository,
          fork
        )
      this.setState({ loading: false })
      this.props.onDismissed()

      if (isRepositoryWithForkedGitHubRepository(updatedRepository)) {
        this.props.dispatcher.showPopup({
          type: PopupType.ChooseForkSettings,
          repository: updatedRepository,
        })
      }
    } catch (e) {
      log.error(`Fork creation through API failed (${e})`)
      sendNonFatalException('forkCreation', e)
      this.setState({ error: e, loading: false })
    }
  }

  public render() {
    return (
      <Dialog
        title={t('forks.do-you-want-to-fork')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.state.error ? undefined : this.onSubmit}
        dismissDisabled={this.state.loading}
        loading={this.state.loading}
        type={this.state.error ? 'error' : 'normal'}
        key={this.props.repository.name}
        id="create-fork"
      >
        {this.state.error !== undefined
          ? renderCreateForkDialogError(
              this.props.repository,
              this.props.account,
              this.state.error
            )
          : renderCreateForkDialogContent(
              this.props.repository,
              this.props.account,
              this.state.loading
            )}
      </Dialog>
    )
  }
}

/** Standard (non-error) message and buttons for `CreateForkDialog` */
function renderCreateForkDialogContent(
  repository: RepositoryWithGitHubRepository,
  account: Account,
  loading: boolean
) {
  return (
    <>
      <DialogContent>
        <Trans
          k="forks.no-write-access"
          params={{ fullName: repository.gitHubRepository.fullName }}
          components={{ strong: <strong /> }}
          as="p"
        />
        <Trans
          k="forks.fork-question"
          params={{
            forkName: `${account.login}/${repository.gitHubRepository.name}`,
          }}
          components={{ strong: <strong /> }}
          as="p"
        />
      </DialogContent>
      <DialogFooter>
        <OkCancelButtonGroup
          destructive={true}
          okButtonText={t('forks.fork-this-repository')}
          okButtonDisabled={loading}
          cancelButtonDisabled={loading}
        />
      </DialogFooter>
    </>
  )
}

/** Error state message (and buttons) for `CreateForkDialog` */
function renderCreateForkDialogError(
  repository: RepositoryWithGitHubRepository,
  account: Account,
  error: Error
) {
  const suggestion =
    repository.gitHubRepository.htmlURL !== null ? (
      <Trans
        k="forks.create-fork-manually"
        components={{
          link: <LinkButton uri={repository.gitHubRepository.htmlURL} />,
        }}
      />
    ) : undefined
  return (
    <>
      <DialogContent>
        <div>
          <Trans
            k="forks.fork-creation-failed"
            params={{
              forkName: `${account.login}/${repository.gitHubRepository.name}`,
            }}
            components={{ strong: <strong /> }}
          />
          {suggestion}
        </div>
        <details>
          <summary>{t('forks.error-details')}</summary>
          <pre className="error">{error.message}</pre>
        </details>
      </DialogContent>
      <DefaultDialogFooter />
    </>
  )
}
