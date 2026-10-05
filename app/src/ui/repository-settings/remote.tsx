import * as React from 'react'
import { IRemote } from '../../models/remote'
import { TextBox } from '../lib/text-box'
import { DialogContent } from '../dialog'
import { t } from '../../lib/l10n'

interface IRemoteProps {
  /** The remote being shown. */
  readonly remote: IRemote

  /** The function to call when the remote URL is changed by the user. */
  readonly onRemoteUrlChanged: (url: string) => void
}

/** The Remote component. */
export class Remote extends React.Component<IRemoteProps, {}> {
  public render() {
    const remote = this.props.remote
    return (
      <DialogContent>
        <TextBox
          placeholder={t('repositorySettings.remote-url-placeholder')}
          label={t('repositorySettings.primary-remote-label', {
            name: remote.name,
          })}
          value={remote.url}
          onValueChanged={this.props.onRemoteUrlChanged}
        />
      </DialogContent>
    )
  }
}
