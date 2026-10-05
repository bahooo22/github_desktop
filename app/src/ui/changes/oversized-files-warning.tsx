import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { PathText } from '../lib/path-text'
import { Dispatcher } from '../dispatcher'
import { Repository } from '../../models/repository'
import { ICommitContext } from '../../models/commit'
import { DefaultCommitMessage } from '../../models/commit-message'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { t, Trans } from '../../lib/l10n'

const GitLFSWebsiteURL =
  'https://help.github.com/articles/versioning-large-files/'

interface IOversizedFilesProps {
  readonly oversizedFiles: ReadonlyArray<string>
  readonly onDismissed: () => void
  readonly dispatcher: Dispatcher
  readonly context: ICommitContext
  readonly repository: Repository
}

/** A dialog to display a list of files that are too large to commit. */
export class OversizedFiles extends React.Component<IOversizedFilesProps> {
  public constructor(props: IOversizedFilesProps) {
    super(props)
  }

  public render() {
    return (
      <Dialog
        id="oversized-files"
        title={t('changes.files-too-large')}
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        type="warning"
      >
        <DialogContent>
          <Trans
            k="changes.oversized-files-warning"
            components={{ strong: <strong /> }}
          />
          {this.renderFileList()}
          <p className="recommendation">
            <Trans
              k="changes.oversized-files-recommendation"
              components={{ link: <LinkButton uri={GitLFSWebsiteURL} /> }}
            />
          </p>
        </DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t('changes.commit-anyway')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderFileList() {
    return (
      <div className="files-list">
        <ul>
          {this.props.oversizedFiles.map(fileName => (
            <li key={fileName}>
              <PathText path={fileName} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  private onSubmit = async () => {
    this.props.onDismissed()

    await this.props.dispatcher.commitIncludedChanges(
      this.props.repository,
      this.props.context
    )

    this.props.dispatcher.setCommitMessage(
      this.props.repository,
      DefaultCommitMessage
    )
  }
}
