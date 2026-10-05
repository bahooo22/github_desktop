import * as React from 'react'

import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { PathText } from '../lib/path-text'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { UnknownAuthor } from '../../models/author'
import { t } from '../../lib/l10n'

interface IUnknownAuthorsProps {
  readonly authors: ReadonlyArray<UnknownAuthor>
  readonly onCommit: () => void
  readonly onDismissed: () => void
}

/**
 * Don't list more than this number of authors.
 */
const MaxAuthorsToList = 10

/** A component to confirm commit when unknown co-authors were added. */
export class UnknownAuthors extends React.Component<IUnknownAuthorsProps> {
  public constructor(props: IUnknownAuthorsProps) {
    super(props)
  }

  public render() {
    return (
      <Dialog
        id="unknown-authors"
        title={t('unknownAuthors.title')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.commit}
        type="warning"
      >
        <DialogContent>{this.renderAuthorList()}</DialogContent>

        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={t('unknownAuthors.ok')}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private renderAuthorList() {
    if (this.props.authors.length > MaxAuthorsToList) {
      return (
        <p>
          {t('unknownAuthors.many', { count: this.props.authors.length })}
        </p>
      )
    } else {
      return (
        <div>
          <p>{t('unknownAuthors.list')}</p>
          <div className="author-list">
            <ul>
              {this.props.authors.map(a => (
                <li key={a.username}>
                  <PathText path={a.username} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }
  }

  private commit = async () => {
    this.props.onCommit()
    this.props.onDismissed()
  }
}
