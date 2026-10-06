import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Select } from '../lib/select'
import { RadioGroup } from '../lib/radio-group'
import {
  localization,
  t,
  saveUserLocalization,
  deleteUserLocalization,
  reloadUserLocalizations,
  getLocalizationsDirectory,
  unflattenMessages,
  findPlaceholders,
  Variant,
} from '../../lib/l10n'

type Filter = 'all' | 'missing' | 'translated'

interface ILocalizationEditorProps {
  readonly onDismissed: () => void
}

interface ILocalizationEditorState {
  readonly target: string
  readonly filter: Filter
  readonly search: string
  readonly addingLanguage: boolean
  readonly newTag: string
  readonly newName: string
  readonly newLanguageError: string | undefined
  readonly dirty: boolean
  readonly status: string | undefined
  readonly statusIsError: boolean
}

/**
 * The in-app translation editor.
 *
 * Edits go straight into the user layer of the localization manager, which
 * means the interface updates live while you type (as long as you're editing
 * the language you're looking at), and the Save button is only about writing
 * those in-memory overrides to a JSON file on disk.
 */
export class LocalizationEditor extends React.Component<
  ILocalizationEditorProps,
  ILocalizationEditorState
> {
  private unsubscribe: (() => void) | undefined

  public constructor(props: ILocalizationEditorProps) {
    super(props)

    this.state = {
      target: defaultTarget(),
      filter: 'all',
      search: '',
      addingLanguage: false,
      newTag: '',
      newName: '',
      newLanguageError: undefined,
      dirty: false,
      status: undefined,
      statusIsError: false,
    }
  }

  public componentDidMount() {
    this.unsubscribe = localization.subscribe(() => this.forceUpdate())
  }

  public componentWillUnmount() {
    this.unsubscribe?.()
  }

  public render() {
    return (
      <Dialog
        id="localization-editor"
        title={t('localizationEditor.title')}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSave}
      >
        <DialogContent>
          {this.renderToolbar()}
          {this.state.addingLanguage && this.renderNewLanguageForm()}
          {this.renderProgress()}
          {this.renderList()}
          {this.state.status !== undefined && (
            <p
              className={
                this.state.statusIsError
                  ? 'localization-editor-status error'
                  : 'localization-editor-status'
              }
            >
              {this.state.status}
            </p>
          )}
        </DialogContent>
        {this.renderFooter()}
      </Dialog>
    )
  }

  private renderToolbar() {
    const tags = this.targetTags()

    return (
      <div className="localization-editor-toolbar">
        <Select
          label={t('localizationEditor.target')}
          value={this.state.target}
          onChange={this.onTargetChanged}
        >
          {tags.map(tag => {
            const locale = localization.getLocale(tag)
            return (
              <option key={tag} value={tag}>
                {locale === undefined ? tag : `${locale.name} (${tag})`}
              </option>
            )
          })}
          <option value="__add__">{t('localizationEditor.newLanguage')}</option>
        </Select>

        <TextBox
          className="search"
          type="search"
          placeholder={t('localizationEditor.search')}
          value={this.state.search}
          onValueChanged={this.onSearchChanged}
          ariaLabel={t('localizationEditor.search')}
        />

        <RadioGroup<Filter>
          selectedKey={this.state.filter}
          radioButtonKeys={['all', 'missing', 'translated']}
          onSelectionChanged={this.onFilterChanged}
          renderRadioButtonLabelContents={this.renderFilterLabel}
        />
      </div>
    )
  }

  private renderFilterLabel = (filter: Filter) => {
    switch (filter) {
      case 'all':
        return t('localizationEditor.filterAll')
      case 'missing':
        return t('localizationEditor.filterMissing')
      case 'translated':
        return t('localizationEditor.filterTranslated')
      default:
        return filter
    }
  }

  private renderNewLanguageForm() {
    return (
      <div className="localization-editor-new-language">
        <TextBox
          label={t('localizationEditor.languageName')}
          placeholder="pt-BR"
          value={this.state.newTag}
          onValueChanged={this.onNewTagChanged}
        />
        <TextBox
          label={t('localizationEditor.displayName')}
          placeholder={t('localizationEditor.languageExample')}
          value={this.state.newName}
          onValueChanged={this.onNewNameChanged}
        />
        <div className="actions">
          <Button onClick={this.onCreateLanguage}>
            {t('localizationEditor.create')}
          </Button>
          <Button onClick={this.onCancelAddLanguage}>
            {t('common.cancel')}
          </Button>
        </div>
        <p className="hint">{t('localizationEditor.newLanguageHint')}</p>
        {this.state.newLanguageError !== undefined && (
          <p className="error">{this.state.newLanguageError}</p>
        )}
      </div>
    )
  }

  private renderProgress() {
    const total = localization.getBuiltInKeys().length
    const translated = localization.getUserMessages(this.state.target).size

    return (
      <p className="localization-editor-progress">
        {t('localizationEditor.progress', { translated, total })}
      </p>
    )
  }

  private renderList() {
    const rows = this.visibleKeys()

    if (rows.length === 0) {
      return (
        <p className="localization-editor-empty">
          {localization.getBuiltInKeys().length === 0
            ? t('localizationEditor.empty')
            : t('localizationEditor.noResults')}
        </p>
      )
    }

    return (
      <div className="localization-editor-list">
        {rows.map(key => this.renderRow(key))}
      </div>
    )
  }

  private renderRow(key: string) {
    const reference = localization.getReference(key)
    const user = localization.getUserMessages(this.state.target).get(key)

    return (
      <div key={key} className="translation-row">
        <div className="translation-key">{key}</div>
        {reference.map(variant => this.renderVariant(key, variant, user))}
      </div>
    )
  }

  private renderVariant(
    key: string,
    variant: Variant,
    user: ReadonlyMap<string, string> | undefined
  ) {
    const value = user?.get(variant.qualifier) ?? ''
    const missing = missingPlaceholders(variant.template, value)
    const onValueChanged = this.onVariantValueChanged(key, variant.qualifier)

    return (
      <div key={variant.qualifier} className="translation-variant">
        <div className="reference">
          {variant.qualifier !== '' && (
            <span className="qualifier">
              {displayQualifier(variant.qualifier)}
            </span>
          )}
          <code>{variant.template}</code>
        </div>
        <TextBox
          value={value}
          placeholder={variant.template}
          displayInvalidState={missing.length > 0}
          onValueChanged={onValueChanged}
          ariaLabel={key}
        />
        {missing.length > 0 && value !== '' && (
          <p className="placeholder-warning">
            {t('localizationEditor.placeholderWarning', {
              placeholders: missing.map(m => `{${m}}`).join(', '),
            })}
          </p>
        )}
      </div>
    )
  }

  private renderFooter() {
    const target = localization.getLocale(this.state.target)
    const isUserFile =
      target !== undefined &&
      localization.getUserMessages(this.state.target).size > 0

    return (
      <DialogFooter>
        {isUserFile && (
          <Button
            tooltip={t('localizationEditor.delete')}
            onClick={this.onDelete}
          >
            {t('localizationEditor.delete')}
          </Button>
        )}
        {this.state.dirty && (
          <span className="localization-editor-unsaved">
            {t('localizationEditor.unsaved')}
          </span>
        )}
        <div className="spacer" />
        <Button type="submit" disabled={!this.state.dirty}>
          {t('localizationEditor.save')}
        </Button>
        <Button onClick={this.props.onDismissed}>
          {t('localizationEditor.close')}
        </Button>
      </DialogFooter>
    )
  }

  /** Tags that can be translated into: everything except the en reference. */
  private targetTags(): ReadonlyArray<string> {
    return localization
      .getAvailableTags()
      .filter(tag => tag !== 'en')
      .sort((a, b) => a.localeCompare(b))
  }

  private visibleKeys(): ReadonlyArray<string> {
    const { filter, search, target } = this.state
    const user = localization.getUserMessages(target)
    const needle = search.trim().toLowerCase()

    return localization.getBuiltInKeys().filter(key => {
      if (filter === 'missing' && user.has(key)) {
        return false
      }
      if (filter === 'translated' && !user.has(key)) {
        return false
      }

      if (needle === '') {
        return true
      }

      const texts = [
        key,
        ...localization.getReference(key).map(v => v.template),
      ]
      return texts.some(text => text.toLowerCase().includes(needle))
    })
  }

  private onVariantValueChanged =
    (key: string, qualifier: string) => (value: string) => {
      localization.setUserMessage(this.state.target, key, qualifier, value)
      this.setState({ dirty: true })
    }

  private onNewTagChanged = (newTag: string) => this.setState({ newTag })

  private onNewNameChanged = (newName: string) => this.setState({ newName })

  private onCancelAddLanguage = () =>
    this.setState({ addingLanguage: false, newLanguageError: undefined })

  private onTargetChanged = (e: React.FormEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value

    if (value === '__add__') {
      this.setState({ addingLanguage: true })
      return
    }

    this.setState({ target: value, dirty: false, status: undefined })
  }

  private onSearchChanged = (search: string) => this.setState({ search })

  private onFilterChanged = (filter: Filter) => this.setState({ filter })

  private onCreateLanguage = async () => {
    const { newTag, newName } = this.state
    const tag = newTag.trim()

    const canonicalTags = this.targetTags().map(existing =>
      existing.toLowerCase()
    )
    if (!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*$/.test(tag)) {
      this.setState({ newLanguageError: t('localizationEditor.tagInvalid') })
      return
    }
    if (canonicalTags.includes(tag.toLowerCase())) {
      this.setState({
        newLanguageError: t('localizationEditor.tagExists', { tag }),
      })
      return
    }

    const name = newName.trim() === '' ? tag : newName.trim()
    const error = await saveUserLocalization(tag, {
      meta: { name, nativeName: name },
    })

    if (error !== undefined) {
      this.setState({
        newLanguageError: t('localizationEditor.saveFailed', { error }),
      })
      return
    }

    await reloadUserLocalizations()

    this.setState({
      target: tag,
      addingLanguage: false,
      newTag: '',
      newName: '',
      newLanguageError: undefined,
    })
  }

  private onSave = async () => {
    const tag = this.state.target
    const messages = localization.getUserMessages(tag)
    const locale = localization.getLocale(tag)

    const tree = unflattenMessages(
      messages,
      locale === undefined
        ? undefined
        : {
            name: locale.name,
            nativeName: locale.nativeName,
            direction: locale.direction,
          }
    )

    const error = await saveUserLocalization(tag, tree)

    if (error !== undefined) {
      this.setState({
        dirty: false,
        status: t('localizationEditor.saveFailed', { error }),
        statusIsError: true,
      })
      return
    }

    await reloadUserLocalizations()

    this.setState({
      dirty: false,
      status: t('localizationEditor.saved', {
        path: `${getLocalizationsDirectory()}${tag.toLowerCase()}.json`,
      }),
      statusIsError: false,
    })
  }

  private onDelete = async () => {
    const tag = this.state.target
    const deleted = await deleteUserLocalization(tag)

    if (deleted) {
      await reloadUserLocalizations()
      const next = this.targetTags()[0] ?? 'en'
      this.setState({
        target: next === 'en' ? tag : next,
        dirty: false,
        status: t('localizationEditor.deleted', { tag }),
        statusIsError: false,
      })
    }
  }
}

function defaultTarget(): string {
  const active = localization.getActiveTag()
  const tags = localization.getAvailableTags().filter(tag => tag !== 'en')

  if (tags.includes(active)) {
    return active
  }

  return tags[0] ?? 'en'
}

function displayQualifier(qualifier: string): string {
  const colon = qualifier.indexOf(':')
  return colon === -1 ? qualifier : qualifier.slice(colon + 1)
}

function missingPlaceholders(
  reference: string,
  value: string
): ReadonlyArray<string> {
  if (value === '') {
    return []
  }

  const expected = new Set(findPlaceholders(reference))
  const present = new Set(findPlaceholders(value))

  return [...expected].filter(name => !present.has(name))
}
