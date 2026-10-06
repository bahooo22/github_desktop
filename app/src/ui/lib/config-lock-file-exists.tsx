import * as React from 'react'
import { Ref } from './ref'
import { LinkButton } from './link-button'
import { unlink } from 'fs/promises'
import { Trans } from '../../lib/l10n'

interface IConfigLockFileExistsProps {
  /**
   * The path to the lock file that's preventing a configuration
   * file update.
   */
  readonly lockFilePath: string

  /**
   * Called when the lock file has been deleted and the configuration
   * update can be retried
   */
  readonly onLockFileDeleted: () => void

  /**
   * Called if the lock file couldn't be deleted
   */
  readonly onError: (e: Error) => void
}

export class ConfigLockFileExists extends React.Component<IConfigLockFileExistsProps> {
  private onDeleteLockFile = async () => {
    try {
      await unlink(this.props.lockFilePath)
    } catch (e) {
      // We don't care about failure to unlink due to the
      // lock file not existing any more
      if (e.code !== 'ENOENT') {
        this.props.onError(e)
        return
      }
    }

    this.props.onLockFileDeleted()
  }
  public render() {
    return (
      <div className="config-lock-file-exists-component">
        <Trans
          as="p"
          k="configLockFile.exists"
          params={{ lockFilePath: this.props.lockFilePath }}
          components={{ ref: <Ref /> }}
        />
        <Trans
          as="p"
          k="configLockFile.deleteAndRetry"
          components={{
            link: <LinkButton onClick={this.onDeleteLockFile} />,
          }}
        />
      </div>
    )
  }
}
