import * as React from 'react'
import { encodePathAsUrl } from '../../lib/path'
import { Button } from '../lib/button'
import { KeyboardShortcut } from '../keyboard-shortcut/keyboard-shortcut'
import { t, Trans } from '../../lib/l10n'

const BlankSlateImage = encodePathAsUrl(
  __dirname,
  'static/empty-no-branches.svg'
)

interface INoBranchesProps {
  /** The callback to invoke when the user wishes to create a new branch */
  readonly onCreateNewBranch: () => void
  /** True to display the UI elements for creating a new branch, false to hide them */
  readonly canCreateNewBranch: boolean
  /** Optional: No branches message */
  readonly noBranchesMessage?: string | JSX.Element
}

export class NoBranches extends React.Component<INoBranchesProps> {
  public render() {
    if (this.props.canCreateNewBranch) {
      return (
        <div className="no-branches">
          <img src={BlankSlateImage} className="blankslate-image" alt="" />

          <div className="title">{t('branches.noBranchFound')}</div>

          <div className="subtitle">{t('branches.createNewBranchInstead')}</div>

          <Button
            className="create-branch-button"
            onClick={this.props.onCreateNewBranch}
            type="submit"
          >
            {__DARWIN__ ? 'Create New Branch' : 'Create new branch'}
          </Button>

          <div className="protip">
            <Trans
              k="branches.createBranchShortcutProTip"
              components={{
                shortcut: (
                  <KeyboardShortcut
                    darwinKeys={['⌘', '⇧', 'N']}
                    keys={['Ctrl', 'Shift', 'N']}
                  />
                ),
              }}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="no-branches">
        {this.props.noBranchesMessage ?? t('branches.noBranchFound')}
      </div>
    )
  }
}
