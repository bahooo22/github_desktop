import * as React from 'react'
import { t } from '../../lib/l10n'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverAppearEffect,
  PopoverDecoration,
} from '../lib/popover'
import { OkCancelButtonGroup } from '../dialog'

interface IWhitespaceHintPopoverProps {
  readonly anchor: HTMLElement | null
  readonly anchorPosition: PopoverAnchorPosition
  /** Called when the user changes the hide whitespace in diffs setting. */
  readonly onHideWhitespaceInDiffChanged: (checked: boolean) => void
  readonly onDismissed: () => void
}

export class WhitespaceHintPopover extends React.Component<IWhitespaceHintPopoverProps> {
  public render() {
    return (
      <Popover
        anchor={this.props.anchor}
        anchorPosition={this.props.anchorPosition}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.onDismissed}
        className={'whitespace-hint'}
        appearEffect={PopoverAppearEffect.Shake}
        ariaLabelledby="whitespace-hint-header"
        ariaDescribedBy="whitespace-hint-message"
      >
        <h3 id="whitespace-hint-header">{t('diff.whitespaceHint.title')}</h3>
        <p id="whitespace-hint-message" className="byline">
          {t('diff.whitespaceHint.message')}
        </p>
        <div className="popover-footer">
          <OkCancelButtonGroup
            okButtonText={t('diff.whitespaceHint.yes')}
            cancelButtonText={t('diff.whitespaceHint.no')}
            onCancelButtonClick={this.onDismissed}
            onOkButtonClick={this.onShowWhitespaceChanges}
          />
        </div>
      </Popover>
    )
  }

  private onShowWhitespaceChanges = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    this.props.onHideWhitespaceInDiffChanged(false)
    this.props.onDismissed()
  }

  private onDismissed = (event?: React.MouseEvent | MouseEvent) => {
    event?.preventDefault()
    this.props.onDismissed()
  }
}
