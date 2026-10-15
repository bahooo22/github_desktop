import { flattenCatalog, mergeMessages, readCatalogMeta } from './catalog'
import {
  currentPlatform,
  getPluralCategories as getPluralCategoriesFromIntl,
  interpolate,
  Platform,
  selectVariant,
  withoutMarkup,
} from './format'
import { transliterate, TranslitScheme } from './translit'
import {
  CatalogProblem,
  Direction,
  GlossMode,
  LocaleDefinition,
  LocaleSummary,
  Message,
  TranslationParameters,
} from './types'

/** The catalog every other catalog is measured against, and always present. */
export const FallbackLocaleTag = 'en'

/**
 * Drop the access key markers from a text that is not a menu label. `&&` is an
 * escaped ampersand and stays, a lone `&` marks the next letter as an accelerator
 * and goes away — left in place it would give the label a second, and unwanted,
 * access key.
 */
function withoutMnemonics(text: string): string {
  return text.replace(/&&|&/g, marker => (marker === '&&' ? '&&' : ''))
}

type Listener = () => void

type CatalogLayer = {
  readonly name: string
  readonly nativeName: string
  readonly direction: Direction
  readonly authors?: ReadonlyArray<string>
  readonly messages: ReadonlyMap<string, Message>

  /**
   * The keys the translator declared finished. `undefined` is a value of its
   * own: the catalog was written before readiness existed and says nothing
   * about it, which is what the editor migrates from.
   */
  readonly ready: ReadonlySet<string> | undefined

  /**
   * The plural categories this catalog declares, as bare CLDR names. When set,
   * it wins over `Intl.PluralRules`: an unknown tag would otherwise pick up the
   * host locale's forms and the row shape would depend on the operating system
   * rather than the language.
   */
  readonly pluralCategories: ReadonlyArray<string> | undefined

  /**
   * The language that carries the meaning of this catalog's strings, or
   * `undefined` when the catalog declares no gloss. Transliterated languages
   * read aloud but do not read as meaning, so the hint comes from a second
   * catalog under the same key.
   */
  readonly gloss: string | undefined

  /**
   * The transcription table that gives the Cyrillic reading of this catalog's
   * own Latin values, or `undefined` when the catalog is written in an alphabet
   * its readers already sound out.
   */
  readonly translit: TranslitScheme | undefined
}

/** One user catalog exactly as it sits on disk, flags included. */
type SavedLayer = {
  readonly messages: ReadonlyMap<string, Message>
  readonly ready: ReadonlySet<string> | undefined
}

/** One message can expand to several rows: a plural or platform per variant. */
export type Variant = {
  /** `''`, a plural qualifier such as `_one`, or a platform one like `@win32`. */
  readonly qualifier: string
  readonly template: string
}

const noMessages: ReadonlyMap<string, Message> = new Map()
const noReadyKeys: ReadonlySet<string> = new Set()

/**
 * Holds the catalogs and answers lookups for whichever language is active.
 *
 * Deliberately a singleton rather than React context: native menus, error
 * handlers and notifications are produced outside the component tree and need
 * the same translation table the UI does.
 *
 * Shipped and user supplied messages stay in separate layers so the editor can
 * tell what a user actually translated, and so dropping an override restores
 * the original wording.
 */
class LocalizationManager {
  private readonly builtins = new Map<string, CatalogLayer>()
  private readonly userLayers = new Map<string, CatalogLayer>()
  private readonly effective = new Map<string, CatalogLayer>()
  private readonly listeners = new Set<Listener>()
  private readonly problems = new Array<CatalogProblem>()
  private readonly missingKeys = new Set<string>()

  /**
   * Each user layer exactly as it came off the disk, taken in `registerFromJson`
   * after the merge. A language is unsaved when its in-memory layer differs from
   * this snapshot, which is what lets an edit be undone by undoing the edit: a
   * flag that only ever gets set would keep claiming lost work after the field
   * has been emptied again.
   *
   * This is not the editor's bookkeeping: a translation stays in memory until it
   * is saved, and the editor can be closed and reopened while those edits are
   * still there (point-and-translate does exactly that), so the snapshot has to
   * outlive it.
   */
  private readonly savedLayers = new Map<string, SavedLayer>()

  private requestedTag: string | null = null
  private systemTags = new Array<string>()
  private activeTag = FallbackLocaleTag
  private platform: Platform = currentPlatform()
  private glossMode: GlossMode = 'off'

  public registerFromJson(
    tag: string,
    raw: unknown,
    source: 'builtin' | 'user' = 'builtin'
  ): void {
    const layers = source === 'user' ? this.userLayers : this.builtins
    const existing = layers.get(tag)
    const messages = flattenCatalog(raw, this.problems)
    const meta = readCatalogMeta(raw)

    const merged =
      existing === undefined
        ? messages
        : mergeMessages(existing.messages, messages)

    // A built-in catalog is a complete document, so its metadata is only ever
    // what that document says. A user file is a patch over the shipped one and
    // may restate nothing, which is why re-registering a user layer keeps the
    // fields the previous patch declared — `getLayer`'s fallback is to the
    // built-in catalog, not to an earlier version of the same layer.
    const inherited = source === 'user' ? existing : undefined

    const ready =
      meta.ready === undefined ? inherited?.ready : new Set(meta.ready)

    layers.set(tag, {
      name: meta.name ?? inherited?.name ?? tag,
      nativeName: meta.nativeName ?? inherited?.nativeName ?? tag,
      direction: meta.direction ?? inherited?.direction ?? 'ltr',
      authors: meta.authors ?? inherited?.authors,
      messages: merged,
      ready,
      pluralCategories: meta.pluralCategories ?? inherited?.pluralCategories,
      gloss: meta.gloss ?? inherited?.gloss,
      translit: meta.translit ?? inherited?.translit,
    })

    // The snapshot is post-merge on purpose: `saveUserLocalization` registers
    // what it just wrote, and a snapshot of only that write would leave the
    // keys the file already had looking unsaved forever.
    if (source === 'user') {
      this.savedLayers.set(tag, { messages: merged, ready })
    }

    this.effective.clear()
  }

  /** Drops every user override, restoring the shipped wording. */
  public resetUserLayers(): void {
    this.userLayers.clear()
    this.savedLayers.clear()
    this.afterCatalogChange()
  }

  /** Drops the user's overrides for one language, keeping the built-in one. */
  public forgetUserLayer(tag: string): void {
    this.userLayers.delete(tag)
    this.savedLayers.delete(tag)
    this.afterCatalogChange()
  }

  /**
   * The languages the operating system reports, most preferred first. Only
   * consulted while the user has not picked a language themselves.
   */
  public setSystemLocales(tags: ReadonlyArray<string>): void {
    this.systemTags = [...tags]
    this.resolveActiveTag()
  }

  /** `null` restores automatic detection. */
  public setRequestedLocale(tag: string | null): void {
    this.requestedTag = tag
    this.resolveActiveTag()
    this.emit()
  }

  /** Overridable so tests and the main process can pin the platform. */
  public setPlatform(platform: Platform): void {
    this.platform = platform
    this.effective.clear()
  }

  public getRequestedLocale(): string | null {
    return this.requestedTag
  }

  public getActiveTag(): string {
    return this.activeTag
  }

  public getSystemLocales(): ReadonlyArray<string> {
    return this.systemTags
  }

  public getAvailableTags(): ReadonlyArray<string> {
    return [...new Set([...this.builtins.keys(), ...this.userLayers.keys()])]
  }

  /**
   * Every key the shipped catalog defines, sorted. The localization editor
   * walks this list, which is why a user can translate a string they have
   * never seen in the interface.
   */
  public getBuiltInKeys(): ReadonlyArray<string> {
    const fallback = this.builtins.get(FallbackLocaleTag)
    return fallback === undefined ? [] : [...fallback.messages.keys()].sort()
  }

  /** The shipped catalog of `tag`, without any user overrides. */
  public getBuiltInMessages(tag: string): ReadonlyMap<string, Message> {
    return this.builtins.get(tag)?.messages ?? noMessages
  }

  /**
   * The plural forms `tag` distinguishes, as qualified keys (`_one`, `_few`,
   * ...) in the canonical order of `PluralQualifiers`.
   *
   * A catalog that declares `meta.pluralCategories` wins over `Intl`: for any
   * tag CLDR does not know, `Intl.PluralRules` silently falls back to the host
   * locale, so an editor row on a Russian Windows would offer four forms for
   * Klingon and two on an English one. The declaration pins the shape to the
   * language instead of the machine.
   *
   * Languages without a declaration (English, Russian, Ukrainian, Brazilian
   * Portuguese) still answer from `Intl` — for tags CLDR knows, that is
   * already the correct grammar.
   */
  public getPluralCategories(tag: string): ReadonlyArray<string> {
    const declared = this.getLayer(tag)?.pluralCategories

    if (declared !== undefined) {
      return declared.map(c => `_${c}`)
    }

    return getPluralCategoriesFromIntl(tag)
  }

  public getAvailableLocales(): ReadonlyArray<LocaleSummary> {
    return this.getAvailableTags().map(tag => this.getLocale(tag)!)
  }

  public getLocale(tag: string): LocaleDefinition | undefined {
    const layer = this.getLayer(tag)

    if (layer === undefined) {
      return undefined
    }

    return {
      tag,
      name: layer.name,
      nativeName: layer.nativeName,
      direction: layer.direction,
      ...(layer.authors !== undefined ? { authors: layer.authors } : {}),
      ...(layer.gloss !== undefined ? { gloss: layer.gloss } : {}),
      source: this.userLayers.has(tag) ? 'user' : 'builtin',
      messages: layer.messages,
      userMessages: this.userLayers.get(tag)?.messages ?? noMessages,
    }
  }

  /**
   * Which catalog automatic detection would pick right now, or the fallback
   * when none of the system languages has a catalog yet.
   */
  public getDetectedTag(): string {
    return (
      matchTag(this.systemTags, this.getAvailableTags()) ?? FallbackLocaleTag
    )
  }

  public getProblems(): ReadonlyArray<CatalogProblem> {
    return this.problems
  }

  /** Keys looked up but absent from every catalog, for the coverage report. */
  public getMissingKeys(): ReadonlyArray<string> {
    return [...this.missingKeys].sort()
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Turns the glossary language on or off. The mode belongs to the manager
   * rather than to the preferences screen because the main process builds the
   * native menu outside the component tree and needs the same decision.
   */
  public setGlossMode(mode: GlossMode): void {
    if (mode === this.glossMode) {
      return
    }

    this.glossMode = mode
    this.emit()
  }

  public getGlossMode(): GlossMode {
    return this.glossMode
  }

  /**
   * The glossary language of the active catalog, or `undefined` when nothing
   * can gloss it. A catalog that names its own tag is a mistake, not a hint,
   * and the answer for it is the same as for no declaration at all.
   */
  public getGlossTag(): string | undefined {
    const gloss = this.getLayer(this.activeTag)?.gloss
    return gloss !== undefined && gloss !== this.activeTag ? gloss : undefined
  }

  /**
   * The same key as the glossary language renders it, or `undefined` when the
   * gloss catalog has no such key. Selection runs through `selectVariant` for
   * the gloss language, so a plural row is glossed in the plural form that
   * language itself requires.
   */
  public getGloss(
    key: string,
    params: TranslationParameters = {}
  ): string | undefined {
    if (this.glossMode === 'off') {
      return undefined
    }

    const glossTag = this.getGlossTag()

    if (glossTag === undefined) {
      return undefined
    }

    const message = this.getLayer(glossTag)?.messages.get(key)

    if (message === undefined) {
      return undefined
    }

    const template = selectVariant(message, glossTag, params, this.platform)

    // The hint is printed as text in both modes — a second line in the
    // renderer, parentheses in the menu — and nobody turns a `<link>` in it
    // into an element, so the markup would only be noise.
    return template === undefined
      ? undefined
      : withoutMarkup(interpolate(template, params, glossTag))
  }

  /**
   * The transcription table the active catalog declares, or `undefined` when it
   * is written in an alphabet its readers already sound out. Asked by the
   * renderer to decide whether a hint exists at all, the same way `getGlossTag`
   * is asked for the glossary.
   */
  public getTranslitScheme(): TranslitScheme | undefined {
    return this.getLayer(this.activeTag)?.translit
  }

  /**
   * The active text as it reads in Cyrillic, or `undefined` when there is
   * nothing to read: no table declared, the hint is off, or the row was never
   * translated.
   *
   * Two guards answer that last case, and both exist because a masked catalog
   * holds English. A row nobody wrote yet is byte for byte the reference text,
   * so it is refused by comparison — the same measure `--untranslated` counts
   * with. What survives that is then read letter by letter, and a Latin letter
   * the language does not have ends the transcription instead of passing
   * through: spelling `Cancel` with a Klingon table would print a plausible
   * Klingon word over an English one, which is a hint that invents a
   * pronunciation nobody wrote.
   */
  public getTranscription(
    key: string,
    params: TranslationParameters = {}
  ): string | undefined {
    const scheme = this.getTranslitScheme()

    if (scheme === undefined || this.glossMode === 'off') {
      return undefined
    }

    const template = this.getTemplate(key, params)

    if (template === undefined) {
      return undefined
    }

    const reference = this.builtins.get(FallbackLocaleTag)?.messages.get(key)

    if (reference !== undefined) {
      const original = selectVariant(
        reference,
        FallbackLocaleTag,
        params,
        this.platform
      )

      if (original === template) {
        return undefined
      }
    }

    // The table runs over the template, before substitution: `{count}` and
    // `<link>` are not language text, and the value that fills them belongs to
    // the caller, not to the catalog. So they pass through untouched and the
    // parameters are interpolated into the transcription as they came.
    const transcript = transliterate(template, scheme)

    return transcript === undefined
      ? undefined
      : withoutMarkup(interpolate(transcript, params, this.activeTag))
  }

  /**
   * Everything shown under the translated text: the Cyrillic reading of the
   * catalog's own Latin value first, then the glossary language. Which of the
   * two exist depends on the catalog, and a language that declares both is
   * exactly the case this hint is for — `tlhIngan Hol` read aloud, then meant.
   *
   * The mode decides the shape: a line each for `block`, one joined line for
   * `inline`, because a native menu label cannot hold a second one.
   */
  public getHint(
    key: string,
    params: TranslationParameters = {}
  ): string | undefined {
    const parts = [
      this.getTranscription(key, params),
      this.getGloss(key, params),
    ].filter(part => part !== undefined && part !== '')

    if (parts.length === 0) {
      return undefined
    }

    return parts.join(this.glossMode === 'inline' ? ' — ' : '\n')
  }

  public translate(key: string, params: TranslationParameters = {}): string {
    const template = this.getTemplate(key, params)

    if (template === undefined) {
      this.missingKeys.add(key)
      return key
    }

    const text = interpolate(template, params, this.activeTag)
    const hint = this.getHint(key, params)

    if (hint === undefined) {
      return text
    }

    // The renderer asks for `block` and gets a newline; the main process pins
    // `inline` at startup because menu labels cannot hold a second line. The
    // shipped Russian catalog marks its own mnemonics, and a label may carry
    // exactly one of them, so the hint is stripped on that path.
    return this.glossMode === 'inline'
      ? `${text} (${withoutMnemonics(hint)})`
      : `${text}\n${hint}`
  }

  /**
   * The selected variant before substitution. `Trans` needs this because it
   * replaces `<name>` tags with elements rather than with text.
   */
  public getTemplate(
    key: string,
    params: TranslationParameters = {}
  ): string | undefined {
    const message = this.getMessage(key)

    return message === undefined
      ? undefined
      : selectVariant(message, this.activeTag, params, this.platform)
  }

  /**
   * The message as shipped in the `en` catalog, placeholders included, so a
   * translator can see which `{count}` and `&` mnemonics the sentence relies
   * on.
   */
  public getReference(key: string): ReadonlyArray<Variant> {
    return this.builtins.get(FallbackLocaleTag)?.messages.has(key) === true
      ? toVariants(this.builtins.get(FallbackLocaleTag)!.messages.get(key)!)
      : []
  }

  /** The same key as it currently renders, per variant. */
  public getCurrent(key: string): ReadonlyArray<Variant> {
    const message = this.getMessage(key)
    return message === undefined ? [] : toVariants(message)
  }

  public has(key: string): boolean {
    return this.getMessage(key) !== undefined
  }

  /**
   * Writes one override into the user layer of `tag`, which is what the
   * localization editor and point-and-translate both call. An empty `value`
   * removes that variant again.
   */
  public setUserMessage(
    tag: string,
    key: string,
    qualifier: string,
    value: string
  ): void {
    const layer = this.userLayers.get(tag)
    const message = new Map(layer?.messages.get(key) ?? [])

    if (value === '') {
      message.delete(qualifier)
    } else {
      message.set(qualifier, value)
    }

    const messages = new Map(layer?.messages ?? [])
    if (message.size === 0) {
      messages.delete(key)
    } else {
      messages.set(key, message)
    }

    this.userLayers.set(tag, {
      name: layer?.name ?? tag,
      nativeName: layer?.nativeName ?? tag,
      direction: layer?.direction ?? 'ltr',
      // The rebuild has to restate every metadata field: dropping the credits
      // here would make editing one string erase the authors of the file.
      authors: layer?.authors,
      ready: layer?.ready,
      pluralCategories: layer?.pluralCategories,
      gloss: layer?.gloss,
      translit: layer?.translit,
      messages,
    })

    this.effective.clear()
    this.emit()
  }

  /**
   * The keys `tag` declares finished, or `undefined` for the one catalog that
   * declares nothing but still holds work: a user file written before readiness
   * existed. The editor counts the rows such a file has filled in as ready,
   * because calling them drafts would zero the progress of every catalog the
   * previous version wrote.
   *
   * A language that has no file yet is not that case and answers with an empty
   * set: nothing has been declared, and a freshly typed row must stay a draft
   * until the translator says otherwise — otherwise the last form typed in it
   * would mark the row ready on its own, which is the symptom the flag exists
   * to remove.
   */
  public getReadyKeys(tag: string): ReadonlySet<string> | undefined {
    const declared =
      this.userLayers.get(tag)?.ready ?? this.savedLayers.get(tag)?.ready

    if (declared !== undefined) {
      return declared
    }

    const saved = this.savedLayers.get(tag)

    return saved !== undefined && saved.messages.size > 0
      ? undefined
      : noReadyKeys
  }

  /**
   * Marks one key ready or drops the mark. Readiness is a decision of the
   * translator, not a property of the text: a row with every form filled in is
   * still a draft until it is declared, which is what keeps the first typed
   * letter from counting as a translation.
   */
  public setKeyReady(tag: string, key: string, ready: boolean): void {
    const layer = this.userLayers.get(tag)
    const keys = new Set(layer?.ready ?? [])

    if (ready) {
      keys.add(key)
    } else {
      keys.delete(key)
    }

    this.userLayers.set(tag, {
      name: layer?.name ?? tag,
      nativeName: layer?.nativeName ?? tag,
      direction: layer?.direction ?? 'ltr',
      authors: layer?.authors,
      messages: layer?.messages ?? noMessages,
      // An empty set still keeps the layer: dropping the last flag must not
      // make the language look untouched, or the save button disappears with
      // the change the user just made.
      ready: keys,
      pluralCategories: layer?.pluralCategories,
      gloss: layer?.gloss,
      translit: layer?.translit,
    })

    this.effective.clear()
    this.emit()
  }

  /**
   * Replaces the readiness list wholesale. The editor calls this before its
   * very first flag on a catalog whose file has no `ready` section: that file
   * is read as "every complete row is ready", so a lone `setKeyReady` would
   * narrow the reading down to the one row clicked, and the progress counter of
   * a translator who had finished half the catalog would collapse on the click.
   */
  public setReadyKeys(tag: string, keys: ReadonlySet<string>): void {
    const layer = this.userLayers.get(tag)

    this.userLayers.set(tag, {
      name: layer?.name ?? tag,
      nativeName: layer?.nativeName ?? tag,
      direction: layer?.direction ?? 'ltr',
      authors: layer?.authors,
      messages: layer?.messages ?? noMessages,
      ready: new Set(keys),
      pluralCategories: layer?.pluralCategories,
      gloss: layer?.gloss,
      translit: layer?.translit,
    })

    this.effective.clear()
    this.emit()
  }

  /**
   * The languages holding overrides that have not been written to disk. What
   * decides whether the editor can save is here rather than in the dialog, so
   * closing and reopening the dialog cannot strand an edit.
   */
  public getUnsavedTags(): ReadonlyArray<string> {
    const tags = new Set([
      ...this.userLayers.keys(),
      ...this.savedLayers.keys(),
    ])
    return [...tags].filter(tag => this.hasUnsavedMessages(tag))
  }

  public hasUnsavedMessages(tag: string): boolean {
    const current = this.userLayers.get(tag)
    const saved = this.savedLayers.get(tag)

    return (
      !messagesEqual(
        current?.messages ?? noMessages,
        saved?.messages ?? noMessages
      ) || !readyEqual(current?.ready, saved?.ready)
    )
  }

  /**
   * Whether `tag` has a user catalog on disk. Reverting every edit empties the
   * in-memory layer but leaves the file, so this is what the editor asks when
   * it decides whether there is a translation to delete.
   */
  public hasUserFile(tag: string): boolean {
    return this.savedLayers.has(tag)
  }

  public getUserMessages(tag: string): ReadonlyMap<string, Message> {
    return this.userLayers.get(tag)?.messages ?? noMessages
  }

  private getLayer(tag: string): CatalogLayer | undefined {
    const cached = this.effective.get(tag)
    if (cached !== undefined) {
      return cached
    }

    const builtin = this.builtins.get(tag)
    const user = this.userLayers.get(tag)

    if (builtin === undefined && user === undefined) {
      return undefined
    }

    const metadata = user ?? builtin!
    const layer: CatalogLayer = {
      name: metadata.name,
      nativeName: metadata.nativeName,
      direction: metadata.direction,
      // The effective layer is what `getLocale` hands to the caller, so a field
      // left out here is invisible to the interface even though the catalog
      // declares it. Authors fall back to the built-in catalog a user layer
      // patches, like the other metadata it doesn't restate.
      authors: metadata.authors ?? builtin?.authors,
      ready: metadata.ready ?? builtin?.ready,
      // A user file that restates `pluralCategories` overrides the shipped
      // catalog; one that doesn't inherits it, the same rule `authors` uses.
      pluralCategories: metadata.pluralCategories ?? builtin?.pluralCategories,
      gloss: metadata.gloss ?? builtin?.gloss,
      translit: metadata.translit ?? builtin?.translit,
      messages:
        builtin === undefined
          ? user!.messages
          : user === undefined
          ? builtin.messages
          : mergeMessages(builtin.messages, user.messages),
    }

    this.effective.set(tag, layer)
    return layer
  }

  private getMessage(key: string): Message | undefined {
    const active = this.getLayer(this.activeTag)

    if (active !== undefined && this.activeTag !== FallbackLocaleTag) {
      const message = active.messages.get(key)
      if (message !== undefined) {
        return message
      }
    }

    return (
      this.getLayer(FallbackLocaleTag)?.messages.get(key) ??
      active?.messages.get(key)
    )
  }

  private resolveActiveTag(): void {
    const tag =
      this.requestedTag ??
      matchTag(this.systemTags, this.getAvailableTags()) ??
      FallbackLocaleTag

    if (tag !== this.activeTag) {
      this.activeTag = tag
    }
  }

  private afterCatalogChange(): void {
    this.effective.clear()
    this.resolveActiveTag()
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function toVariants(message: Message): ReadonlyArray<Variant> {
  return [...message].map(([qualifier, template]) => ({ qualifier, template }))
}

/**
 * Whether two layers define the same keys with the same variants. Key order is
 * deliberately not compared: a save rewrites the file and reading it back
 * yields catalog order, which would otherwise look like an edit.
 */
function messagesEqual(
  a: ReadonlyMap<string, Message>,
  b: ReadonlyMap<string, Message>
): boolean {
  if (a.size !== b.size) {
    return false
  }

  for (const [key, message] of a) {
    const other = b.get(key)

    if (other === undefined || !sameTemplates(message, other)) {
      return false
    }
  }

  return true
}

function sameTemplates(a: Message, b: Message): boolean {
  if (a.size !== b.size) {
    return false
  }

  for (const [qualifier, template] of a) {
    if (b.get(qualifier) !== template) {
      return false
    }
  }

  return true
}

/**
 * Whether two readiness lists say the same thing. `undefined` is compared as a
 * value of its own: a catalog that predates readiness is not the same as one
 * that declares an empty list, and treating them alike would hide the very
 * first save that has to write the section into the file.
 */
function readyEqual(
  a: ReadonlySet<string> | undefined,
  b: ReadonlySet<string> | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b
  }

  if (a.size !== b.size) {
    return false
  }

  for (const key of a) {
    if (!b.has(key)) {
      return false
    }
  }

  return true
}
/**
 * Maps the language tags the system advertises onto the tags we have a catalog
 * for. Each preferred tag is resolved in turn (BCP-47 lookup style): an exact
 * match first, then any catalog sharing its base language, so `ru-RU` and
 * `ru-UA` both select `ru`. A tag that matches nothing falls through to the
 * next preferred language, which keeps the user's own priority intact.
 */
export function matchTag(
  preferred: ReadonlyArray<string>,
  available: ReadonlyArray<string>
): string | undefined {
  const normalized = new Map(available.map(tag => [canonical(tag), tag]))

  for (const tag of preferred) {
    const exact = normalized.get(canonical(tag))
    if (exact !== undefined) {
      return exact
    }

    const language = baseLanguage(tag)
    const partial = [...normalized].find(
      ([candidate]) => baseLanguage(candidate) === language
    )

    if (partial !== undefined) {
      return partial[1]
    }
  }

  return undefined
}

function canonical(tag: string): string {
  return tag.toLowerCase().replace(/_/g, '-')
}

function baseLanguage(tag: string): string {
  return canonical(tag).split('-')[0]
}

export const localization = new LocalizationManager()

/**
 * The message for `key` in the active language. Falls back to the `en` catalog
 * and finally to the key itself, which keeps an unconverted string visible
 * instead of silently blank.
 */
export function t(key: string, params?: TranslationParameters): string {
  return localization.translate(key, params)
}
