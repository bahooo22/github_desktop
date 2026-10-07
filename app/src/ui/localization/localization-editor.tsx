import * as React from 'react'
import * as Path from 'path'
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
  findUnknownKeys,
  FallbackLocaleTag,
  Variant,
} from '../../lib/l10n'
import { getPluralCategories } from '../../lib/l10n/format'
import { PluralQualifierPrefix, PluralQualifiers } from '../../lib/l10n/catalog'
import { LinkButton } from '../lib/link-button'
import { getVersion } from '../lib/app-proxy'
import {
  buildTranslationIssueUrl,
  TranslationIssueLabel,
} from './translation-issue'

export type Filter = 'all' | 'missing' | 'translated'

export interface ITranslationIssueContext {
  readonly target: string
  /** Set when the current filter/search narrows the list down to one string. */
  readonly key?: string
  readonly filter: Filter
  readonly search: string
}

export function buildEditorTranslationIssueUrl(
  context: ITranslationIssueContext
): string {
  const { target, key, filter, search } = context

  const lines = [t('localizationEditor.reportIssueLanguage', { tag: target })]

  if (key !== undefined) {
    lines.push(t('localizationEditor.reportIssueKey', { key }))
  }

  if (filter !== 'all') {
    const filterName =
      filter === 'missing'
        ? t('localizationEditor.filterMissing')
        : t('localizationEditor.filterTranslated')

    lines.push(
      t('localizationEditor.reportIssueFilter', { filter: filterName })
    )
  }

  const trimmedSearch = search.trim()

  if (trimmedSearch !== '') {
    lines.push(
      t('localizationEditor.reportIssueSearch', { search: trimmedSearch })
    )
  }

  lines.push(
    t('localizationEditor.reportIssueBuild', {
      version: getVersion(),
      sha: __SHA__.substring(0, 10),
    })
  )

  return buildTranslationIssueUrl({
    title: t('localizationEditor.reportIssueTitle', { tag: target }),
    body: lines.join('\n\n'),
    labels: [TranslationIssueLabel],
  })
}

interface ILocalizationEditorProps {
  readonly onDismissed: () => void
}

interface ILocalizationEditorState {
  /** The language being edited, or '' while there is none to edit yet. */
  readonly target: string
  readonly filter: Filter
  readonly search: string
  readonly addingLanguage: boolean
  readonly newTag: string
  readonly newName: string
  readonly newLanguageError: string | undefined
  /** Languages holding edits that have not been written to disk yet. */
  readonly dirtyTags: ReadonlyArray<string>
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

    const target = defaultTarget(this.targetTags(), localization.getActiveTag())

    this.state = {
      target: target ?? '',
      // With nothing but the reference catalog there is no language to pick,
      // so the editor starts in the add-a-language flow instead of selecting
      // a tag the picker doesn't offer.
      addingLanguage: target === undefined,
      filter: 'all',
      search: '',
      newTag: '',
      newName: '',
      newLanguageError: undefined,
      dirtyTags: [],
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
          {this.state.target !== '' && (
            <>
              {this.renderProgress()}
              {this.renderProblems()}
              {this.renderList()}
            </>
          )}
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
          value={this.state.target === '' ? '__add__' : this.state.target}
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

  /**
   * Malformed catalog entries and keys the reference catalog doesn't know.
   * Nothing else surfaces them: loading deliberately skips a broken row
   * instead of throwing, and without this block the translator would only
   * notice the missing string when the interface renders it.
   */
  private renderProblems() {
    const problems = localization.getProblems()
    const unknownKeys = findUnknownKeys(
      localization.getBuiltInMessages(FallbackLocaleTag),
      localization.getUserMessages(this.state.target)
    )

    if (problems.length === 0 && unknownKeys.length === 0) {
      return null
    }

    return (
      <div className="localization-editor-problems">
        {problems.length > 0 && (
          <>
            <p className="problems-title">
              {t('localizationEditor.problemsTitle')}
            </p>
            <ul>
              {problems.map(problem => (
                <li key={`${problem.key} ${problem.reason}`}>
                  {`${problem.key}: ${problem.reason}`}
                </li>
              ))}
            </ul>
          </>
        )}
        {unknownKeys.length > 0 && (
          <>
            <p className="unknown-keys-title">
              {t('localizationEditor.unknownKeysTitle')}
            </p>
            <ul>
              {unknownKeys.map(key => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  private renderProgress() {
    const { target } = this.state
    const user = localization.getUserMessages(target)
    const categories = getPluralCategories(target)

    let total = 0
    let translated = 0

    // Progress counts variants, not keys: a plural whose `_few` is still
    // English is not finished even though the key has an entry.
    for (const key of localization.getBuiltInKeys()) {
      const variants = targetVariants(
        localization.getReference(key),
        categories
      )

      total += variants.length
      translated += countTranslated(variants, user.get(key))
    }

    return (
      <p className="localization-editor-progress">
        {t('localizationEditor.progress', { count: translated, total })}
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
    const { target } = this.state
    const reference = localization.getReference(key)
    const user = localization.getUserMessages(target).get(key)

    return (
      <div key={key} className="translation-row">
        <div className="translation-key">{key}</div>
        {targetVariants(reference, getPluralCategories(target)).map(variant =>
          this.renderVariant(key, variant, user)
        )}
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
    const { target, dirtyTags } = this.state
    const locale = localization.getLocale(target)
    const isUserFile =
      locale !== undefined && localization.getUserMessages(target).size > 0
    const dirty = dirtyTags.includes(target)

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
        {dirty && (
          <span className="localization-editor-unsaved">
            {t('localizationEditor.unsaved')}
          </span>
        )}
        <div className="spacer" />
        <LinkButton
          className="localization-editor-report-issue"
          uri={buildEditorTranslationIssueUrl(this.translationIssueContext())}
        >
          {t('localizationEditor.reportIssue')}
        </LinkButton>
        <Button type="submit" disabled={!dirty}>
          {t('localizationEditor.save')}
        </Button>
        <Button onClick={this.props.onDismissed}>
          {t('localizationEditor.close')}
        </Button>
      </DialogFooter>
    )
  }

  private translationIssueContext(): ITranslationIssueContext {
    const { target, filter, search } = this.state
    const visible = this.visibleKeys()

    return {
      target,
      key: visible.length === 1 ? visible[0] : undefined,
      filter,
      search,
    }
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
    const categories = getPluralCategories(target)

    return localization.getBuiltInKeys().filter(key => {
      const variants = targetVariants(
        localization.getReference(key),
        categories
      )
      const overrides = user.get(key)
      const complete = countTranslated(variants, overrides) === variants.length

      if (filter === 'missing' && complete) {
        return false
      }
      if (filter === 'translated' && !complete) {
        return false
      }

      if (needle === '') {
        return true
      }

      // Searching the translator's own wording matters: by the time they
      // want to revisit a string they have translated, the English text is
      // often the least memorable thing about it.
      const texts = [
        key,
        ...variants.map(v => v.template),
        ...(overrides !== undefined ? [...overrides.values()] : []),
      ]
      return texts.some(text => text.toLowerCase().includes(needle))
    })
  }

  private onVariantValueChanged =
    (key: string, qualifier: string) => (value: string) => {
      const tag = this.state.target
      localization.setUserMessage(tag, key, qualifier, value)
      this.setState(prev => ({
        dirtyTags: prev.dirtyTags.includes(tag)
          ? prev.dirtyTags
          : [...prev.dirtyTags, tag],
      }))
    }

  private onNewTagChanged = (newTag: string) => this.setState({ newTag })

  private onNewNameChanged = (newName: string) => this.setState({ newName })

  private onCancelAddLanguage = () => {
    // With no target language the add form is the only thing to show, so
    // there is nothing to cancel back to.
    if (this.state.target === '') {
      this.setState({ newLanguageError: undefined })
      return
    }

    this.setState({ addingLanguage: false, newLanguageError: undefined })
  }

  private onTargetChanged = (e: React.FormEvent<HTMLSelectElement>) => {
    const value = e.currentTarget.value
    const { target, dirtyTags } = this.state

    if (value !== target && target !== '' && dirtyTags.includes(target)) {
      // Leaving with unsaved edits would lose them for good: the in-memory
      // overrides of the abandoned language have no other path to disk, and
      // the next save reloads every user layer from the files. Put the
      // picker back where it was (React won't restore an unchanged value
      // prop itself) and make the user settle the language first.
      e.currentTarget.value = target
      this.setState({
        status: t('localizationEditor.unsavedSwitch', { tag: target }),
        statusIsError: true,
      })
      return
    }

    if (value === '__add__') {
      this.setState({ addingLanguage: true })
      return
    }

    this.setState({ target: value, status: undefined })
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
            // A user file that never restated the credits still inherits them
            // from the catalog it patches; leaving them out here would make
            // the first save silently drop them from the effective layer.
            ...(locale.authors !== undefined
              ? { authors: locale.authors }
              : {}),
          }
    )

    const error = await saveUserLocalization(tag, tree)

    if (error !== undefined) {
      // Keep the language dirty: the edits are still in memory and clearing
      // the flag here would disable Save with no way to retry.
      this.setState({
        status: t('localizationEditor.saveFailed', { error }),
        statusIsError: true,
      })
      return
    }

    await reloadUserLocalizations()

    this.setState(prev => ({
      dirtyTags: prev.dirtyTags.filter(dirtyTag => dirtyTag !== tag),
      status: t('localizationEditor.saved', {
        path: Path.join(
          getLocalizationsDirectory(),
          `${tag.toLowerCase()}.json`
        ),
      }),
      statusIsError: false,
    }))
  }

  private onDelete = async () => {
    const tag = this.state.target
    const deleted = await deleteUserLocalization(tag)

    if (deleted) {
      await reloadUserLocalizations()

      const next = this.targetTags()[0]
      this.setState(prev => ({
        target: next ?? '',
        addingLanguage: next === undefined,
        dirtyTags: prev.dirtyTags.filter(dirtyTag => dirtyTag !== tag),
        status: t('localizationEditor.deleted', { tag }),
        statusIsError: false,
      }))
    }
  }
}

/**
 * The language to open the editor on: whatever the user is currently reading
 * as long as a translatable catalog for it exists, else the first one. `tags`
 * is the picker's own list (the reference already taken out), so the answer
 * can never name a language the picker doesn't offer; `undefined` asks the
 * editor to start creating one instead.
 */
export function defaultTarget(
  tags: ReadonlyArray<string>,
  activeTag: string
): string | undefined {
  if (tags.length === 0) {
    return undefined
  }

  return tags.includes(activeTag) ? activeTag : tags[0]
}

const PluralKindPrefix = 'plural:'

const CanonicalPluralQualifiers = PluralQualifiers.map(
  qualifier => `${PluralKindPrefix}${PluralQualifierPrefix}${qualifier}`
)

/**
 * Every row a translation of one key needs in `target`: the reference's own
 * variants plus the plural forms the target's grammar distinguishes beyond
 * them. The i18n freshness checker requires exactly this set from a shipped
 * catalog, so without it the missing forms could not be edited at all.
 */
function targetVariants(
  reference: ReadonlyArray<Variant>,
  categories: ReadonlyArray<string>
): ReadonlyArray<Variant> {
  const plurals = reference.filter(v =>
    v.qualifier.startsWith(PluralKindPrefix)
  )

  if (plurals.length === 0) {
    return reference
  }

  const byQualifier = new Map(reference.map(v => [v.qualifier, v]))
  const fallbackTemplate =
    byQualifier.get(`${PluralKindPrefix}${PluralQualifierPrefix}other`)
      ?.template ?? plurals[0].template

  const wanted = new Set([
    ...plurals.map(v => v.qualifier),
    ...categories.map(c => `${PluralKindPrefix}${c}`),
  ])

  const nonPlurals = reference.filter(
    v => !v.qualifier.startsWith(PluralKindPrefix)
  )

  const orderedPlurals = CanonicalPluralQualifiers.filter(q =>
    wanted.has(q)
  ).map(
    qualifier =>
      byQualifier.get(qualifier) ?? {
        qualifier,
        template: fallbackTemplate,
      }
  )

  return [...nonPlurals, ...orderedPlurals]
}

function countTranslated(
  variants: ReadonlyArray<Variant>,
  overrides: ReadonlyMap<string, string> | undefined
): number {
  return overrides === undefined
    ? 0
    : variants.filter(variant => overrides.has(variant.qualifier)).length
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
