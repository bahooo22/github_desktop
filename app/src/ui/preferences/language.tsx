import * as React from 'react'
import { Dispatcher } from '../dispatcher'
import { PopupType } from '../../models/popup'
import { DialogContent } from '../dialog'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import {
  localization,
  matchTag,
  t,
  setPreferredLocale,
  setGlossMode,
  setGlossForm,
  getStoredGlossForm,
  reloadUserLocalizations,
  getLocalizationsDirectory,
  getUnreadableLocalizations,
  deleteUserLocalization,
  openLocalizationsFolder,
  LocalizationsReloaded,
} from '../../lib/l10n'

const SystemOption = '__system__'

interface ILanguagePreferencesProps {
  readonly dispatcher: Dispatcher
}

interface ILanguagePreferencesState {
  /** Bumped on every localization change so the derived renders stay fresh. */
  readonly revision: number
  readonly reloaded?: LocalizationsReloaded
  readonly confirmingResetAll: boolean
}

/**
 * The Language preferences tab: which language to use (with the operating
 * system's own languages detected automatically), and the entry points to the
 * user's translation folder and the in-app translation editor.
 */
export class Language extends React.Component<
  ILanguagePreferencesProps,
  ILanguagePreferencesState
> {
  private unsubscribe: (() => void) | undefined

  public constructor(props: ILanguagePreferencesProps) {
    super(props)
    this.state = { revision: 0, confirmingResetAll: false }
  }

  public componentDidMount() {
    this.unsubscribe = localization.subscribe(() =>
      this.setState({ revision: this.state.revision + 1 })
    )
  }

  public componentWillUnmount() {
    this.unsubscribe?.()
  }

  public render() {
    return (
      <DialogContent>
        <h2>{t('settings.language.title')}</h2>
        <p className="settings-description">
          {t('settings.language.description')}
        </p>
        {this.renderPicker()} {this.renderGlossRow()} {this.renderEditorRow()}{' '}
        {this.renderFolderRow()}
        {this.renderResetRow()}
      </DialogContent>
    )
  }

  /**
   * A native drop-down rather than one radio button per language: the list
   * grows with every translation a user adds, and a closed select scrolls
   * where a stack of labelled radios would push the rest of the page down.
   */
  private renderPicker() {
    const tags = localization.getAvailableTags().filter(tag => tag !== 'en')
    const requested = localization.getRequestedLocale()
    const selectedKey = requested ?? SystemOption

    const keys = [SystemOption, 'en', ...tags]

    return (
      <div className="language-picker">
        <Select
          label={t('settings.language.available')}
          value={selectedKey}
          onChange={this.onSelectionChanged}
        >
          {keys.map(key => (
            <option key={key} value={key}>
              {this.renderOptionLabel(key)}
            </option>
          ))}
        </Select>
        <p className="language-option-detail">
          {this.renderDetail(selectedKey)}
        </p>
      </div>
    )
  }

  private renderOptionLabel = (key: string) => {
    if (key === SystemOption) {
      return t('settings.language.systemDefault')
    }

    const locale = localization.getLocale(key)
    if (locale === undefined) {
      return key
    }

    const label = `${locale.name} (${locale.nativeName})`

    return locale.source === 'user'
      ? `${label} - ${t('settings.language.yours')}`
      : label
  }

  private renderDetectedLine(system: ReadonlyArray<string>) {
    const languages = system.join(', ')

    if (system.length === 0) {
      return t('settings.language.noMatch', { languages })
    }

    const hasMatch =
      matchTag(system, localization.getAvailableTags()) !== undefined

    return hasMatch
      ? t('settings.language.detected', { languages })
      : t('settings.language.noMatch', { languages })
  }

  /** How much of the interface the current selection actually covers. */
  private renderDetail(key: string) {
    if (key === SystemOption) {
      return this.renderDetectedLine(localization.getSystemLocales())
    }

    const locale = localization.getLocale(key)
    if (locale === undefined) {
      return null
    }

    const total = localization.getBuiltInKeys().length
    const missing =
      key === 'en'
        ? 0
        : localization
            .getBuiltInKeys()
            .filter(builtInKey => !locale.messages.has(builtInKey)).length

    return missing === 0
      ? t('settings.language.complete')
      : t('settings.language.incomplete', { missing, total })
  }

  /**
   * The hint switch and its form, shown only when the active language declares
   * a glossary catalog in its `meta`. For every other language the row would be
   * a checkbox that cannot do anything.
   */
  private renderGlossRow() {
    const glossTag = localization.getGlossTag()

    if (glossTag === undefined) {
      return null
    }

    const glossLocale = localization.getLocale(glossTag)

    return (
      <div className="language-settings-row">
        <div>
          <h3>{t('settings.language.gloss')}</h3>
          <p className="settings-description">
            {t('settings.language.glossHint', {
              language: glossLocale?.nativeName ?? glossTag,
            })}
          </p>
        </div>
        <div className="language-actions">
          <Select
            label={t('settings.language.glossForm')}
            value={getStoredGlossForm()}
            onChange={this.onGlossFormChanged}
          >
            <option value="block">
              {t('settings.language.glossFormBlock')}
            </option>
            <option value="tooltip">
              {t('settings.language.glossFormTooltip')}
            </option>
          </Select>
          <Checkbox
            value={
              localization.getGlossMode() === 'off'
                ? CheckboxValue.Off
                : CheckboxValue.On
            }
            onChange={this.onGlossChanged}
          />
        </div>
      </div>
    )
  }

  private renderEditorRow() {
    return (
      <div className="language-settings-row">
        <div>
          <h3>{t('settings.language.editor')}</h3>
          <p className="settings-description">
            {t('settings.language.editorHint')}
          </p>
        </div>
        <Button onClick={this.onOpenEditor}>
          {t('settings.language.editor')}
        </Button>
      </div>
    )
  }

  private renderFolderRow() {
    const directory = getLocalizationsDirectory()
    const unreadable = getUnreadableLocalizations()

    return (
      <div className="language-settings-row">
        <div>
          <p className="settings-description">
            {t('settings.language.folderHint', { path: directory })}
          </p>
          {this.state.reloaded !== undefined &&
            this.renderReloadedLine(this.state.reloaded)}
          {unreadable.map(problem => (
            <p key={problem} className="language-problem">
              {problem}
            </p>
          ))}
        </div>
        <div className="language-actions">
          <Button onClick={this.onReload}>
            {t('settings.language.reload')}
          </Button>
          <Button onClick={openLocalizationsFolder}>
            {t('settings.language.openFolder')}
          </Button>
        </div>
      </div>
    )
  }

  private renderReloadedLine(reloaded: LocalizationsReloaded) {
    const { loaded, failed } = reloaded

    return (
      <p className="settings-description">
        {t('settings.language.reloaded', { count: loaded })}
        {failed.length > 0 && ` (${failed.join(', ')})`}
      </p>
    )
  }

  private renderResetRow() {
    const requested = localization.getRequestedLocale()
    const hasUserLayers = localization
      .getAvailableTags()
      .some(tag => localization.getLocale(tag)?.source === 'user')

    if (!hasUserLayers) {
      return null
    }

    return (
      <div className="language-settings-row">
        <p className="settings-description">
          {this.state.confirmingResetAll
            ? t('settings.language.confirmResetAll')
            : t('settings.language.resetAll')}
        </p>
        <div className="language-actions">
          {requested !== null &&
            localization.getLocale(requested)?.source === 'user' && (
              <Button onClick={this.onResetRequested}>
                {t('settings.language.reset')}
              </Button>
            )}
          {this.state.confirmingResetAll ? (
            <Button onClick={this.onResetAll}>
              {t('settings.language.resetAll')}
            </Button>
          ) : (
            <Button onClick={this.onConfirmResetAll}>
              {t('settings.language.resetAll')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  private onSelectionChanged = async (
    ev: React.FormEvent<HTMLSelectElement>
  ) => {
    const key = ev.currentTarget.value
    const tag = key === SystemOption ? null : key

    const error = await setPreferredLocale(tag)
    if (error !== undefined) {
      this.props.dispatcher.postError(new Error(error))
    }
  }

  private onReload = async () => {
    const reloaded = await reloadUserLocalizations()
    this.setState({ reloaded })
  }

  private onGlossChanged = (ev: React.FormEvent<HTMLInputElement>) => {
    const on = ev.currentTarget.checked
    // The form the user last picked, not a hard-coded one: switching the hint
    // off and back on is meant to bring the shape they had, not the default.
    setGlossMode(on ? getStoredGlossForm() : 'off')
  }

  private onGlossFormChanged = (ev: React.FormEvent<HTMLSelectElement>) => {
    const value = ev.currentTarget.value
    setGlossForm(value === 'tooltip' ? 'tooltip' : 'block')
  }

  private onOpenEditor = () => {
    this.props.dispatcher.showPopup({ type: PopupType.LocalizationEditor })
  }

  private onResetRequested = async () => {
    const tag = localization.getRequestedLocale()
    if (tag !== null) {
      await deleteUserLocalization(tag)
      await reloadUserLocalizations()
    }
  }

  private onConfirmResetAll = () => {
    this.setState({ confirmingResetAll: true })
  }

  private onResetAll = async () => {
    const userTags = localization
      .getAvailableTags()
      .filter(tag => localization.getLocale(tag)?.source === 'user')

    for (const tag of userTags) {
      await deleteUserLocalization(tag)
    }

    localization.resetUserLayers()
    await reloadUserLocalizations()
    this.setState({ confirmingResetAll: false })
  }
}
