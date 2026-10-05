import * as React from 'react'
import * as Path from 'path'

import { t } from '../../lib/l10n'
import { Repository } from '../../models/repository'

import { LinkButton } from '../lib/link-button'

interface IBinaryFileProps {
  readonly repository: Repository
  readonly path: string
  /**
   * Called when the user requests to open a binary file in an the
   * system-assigned application for said file type.
   */
  readonly onOpenBinaryFile: (fullPath: string) => void
}

/** represents the default view for a file that we cannot render a diff for */
export class BinaryFile extends React.Component<IBinaryFileProps, {}> {
  private open = () => {
    const fullPath = Path.join(this.props.repository.path, this.props.path)
    this.props.onOpenBinaryFile(fullPath)
  }

  public render() {
    return (
      <div className="panel binary" id="diff">
        <div className="image-header">{t('diff.binary.changed')}</div>
        <div className="image-header">
          <LinkButton onClick={this.open}>
            {t('diff.binary.openInExternalProgram')}
          </LinkButton>
        </div>
      </div>
    )
  }
}
