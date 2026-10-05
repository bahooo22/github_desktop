import * as React from 'react'
import { DialogContent } from '../dialog'
import { TextArea } from '../lib/text-area'
import { LinkButton } from '../lib/link-button'
import { Ref } from '../lib/ref'
import { t, Trans } from '../../lib/l10n'

interface IGitIgnoreProps {
  readonly text: string | null
  readonly onIgnoreTextChanged: (text: string) => void
  readonly onShowExamples: () => void
}

/** A view for creating or modifying the repository's gitignore file */
export class GitIgnore extends React.Component<IGitIgnoreProps, {}> {
  public render() {
    return (
      <DialogContent>
        <Trans
          k="repositorySettings.gitignore-description"
          components={{
            ref: <Ref />,
            link: <LinkButton onClick={this.props.onShowExamples} />,
          }}
          as="p"
          id="ignored-files-description"
        />

        <TextArea
          ariaLabel={t('repositorySettings.ignored-files')}
          ariaDescribedBy="ignored-files-description"
          placeholder={t('repositorySettings.ignored-files')}
          value={this.props.text || ''}
          onValueChanged={this.props.onIgnoreTextChanged}
          textareaClassName="gitignore"
        />
      </DialogContent>
    )
  }
}
