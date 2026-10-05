import * as React from 'react'
import { encodePathAsUrl } from '../../lib/path'
import { t } from '../../lib/l10n'

const BlankSlateImage = encodePathAsUrl(
  __dirname,
  'static/multiple-files-selected.svg'
)

interface IMultipleSelectionProps {
  /** Called when the user chooses to open the repository. */
  readonly count: number
}
/** The component to display when there are no local changes. */
export class MultipleSelection extends React.Component<
  IMultipleSelectionProps,
  {}
> {
  public render() {
    return (
      <div className="panel blankslate" id="no-changes">
        <img src={BlankSlateImage} className="blankslate-image" alt="" />
        <div>{t('changes.files-selected', { count: this.props.count })}</div>
      </div>
    )
  }
}
