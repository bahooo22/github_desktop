import * as React from 'react'
import { Dispatcher } from '../dispatcher'
import { PopupType } from '../../models/popup'
import { DialogContent } from '../dialog'
import { RadioGroup } from '../lib/radio-group'
import { Button } from '../lib/button'
import {
  localization,
  matchTag,
  t,
  setPreferredLocale,
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
        {this.renderPicker()} {this.renderEditorRow()} {this.renderFolderRow()}
        {this.renderResetRow()}
      </DialogContent>
    )
  }

  private renderPicker() {
    const tags = localization.getAvailableTags().filter(tag => tag !== 'en')
    const requested = localization.getRequestedLocale()
    const selectedKey = requested ?? SystemOption

    const keys = [SystemOption, 'en', ...tags]

    return (
      <RadioGroup<string>
        selectedKey={selectedKey}
        radioButtonKeys={keys}
        onSelectionChanged={this.onSelectionChanged}
        renderRadioButtonLabelContents={this.renderOptionLabel}
      />
    )
  }

  private renderOptionLabel = (key: string) => {
    if (key === SystemOption) {
      return (
        <div className="language-option">
          <span>{t('settings.language.systemDefault')}</span>
          <span className="language-option-detail">
            {this.renderDetectedLine(localization.getSystemLocales())}
          </span>
        </div>
      )
    }

    return this.renderLocaleLabel(key)
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

  private renderLocaleLabel(tag: string) {
    const locale = localization.getLocale(tag)
    if (locale === undefined) {
      return tag
    }

    const total = localization.getBuiltInKeys().length
    const missing =
      tag === 'en'
        ? 0
        : localization.getBuiltInKeys().filter(key => !locale.messages.has(key))
            .length

    const isYours = locale.source === 'user'

    return (
      <div className="language-option">
        <span>
          {locale.name} ({locale.nativeName})
          {isYours && (
            <span className="language-option-badge">
              {t('settings.language.yours')}
            </span>
          )}
        </span>
        <span className="language-option-detail">
          {missing === 0
            ? t('settings.language.complete')
            : t('settings.language.incomplete', { missing, total })}
        </span>
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

  private onSelectionChanged = async (key: string) => {
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
