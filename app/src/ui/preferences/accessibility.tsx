import * as React from 'react'
import { DialogContent } from '../dialog'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { t } from '../../lib/l10n'

interface IAccessibilityPreferencesProps {
  readonly underlineLinks: boolean
  readonly onUnderlineLinksChanged: (value: boolean) => void

  readonly showDiffCheckMarks: boolean
  readonly onShowDiffCheckMarksChanged: (value: boolean) => void
}

export class Accessibility extends React.Component<
  IAccessibilityPreferencesProps,
  {}
> {
  public constructor(props: IAccessibilityPreferencesProps) {
    super(props)
  }

  public render() {
    return (
      <DialogContent>
        <div className="accessibility-section">
          <h2>{t('settings.accessibility.title')}</h2>
          <Checkbox
            label={t('settings.accessibility.underline-links')}
            value={
              this.props.underlineLinks ? CheckboxValue.On : CheckboxValue.Off
            }
            onChange={this.onUnderlineLinksChanged}
            ariaDescribedBy="underline-setting-description"
          />
          <p
            id="underline-setting-description"
            className="settings-description"
          >
            {t('settings.accessibility.underline-description')}{' '}
            {this.renderExampleLink()}
          </p>

          <Checkbox
            label={t('settings.accessibility.show-diff-check-marks')}
            value={
              this.props.showDiffCheckMarks
                ? CheckboxValue.On
                : CheckboxValue.Off
            }
            onChange={this.onShowDiffCheckMarksChanged}
            ariaDescribedBy="diff-checkmarks-setting-description"
          />
          <p
            id="diff-checkmarks-setting-description"
            className="settings-description"
          >
            {t('settings.accessibility.show-diff-check-marks-description')}
          </p>
        </div>
      </DialogContent>
    )
  }

  private renderExampleLink() {
    // The example link is rendered with inline style to override the global
    // underline setting since this is a non-interactive visual preview.
    const style = {
      textDecoration: this.props.underlineLinks ? 'underline' : 'none',
    }

    return (
      <span className="link-button-component example-link" style={style}>
        {t('settings.accessibility.example-link')}
      </span>
    )
  }

  private onUnderlineLinksChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onUnderlineLinksChanged(event.currentTarget.checked)
  }

  private onShowDiffCheckMarksChanged = (
    event: React.FormEvent<HTMLInputElement>
  ) => {
    this.props.onShowDiffCheckMarksChanged(event.currentTarget.checked)
  }
}
