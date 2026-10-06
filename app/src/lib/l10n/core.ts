import { flattenCatalog, mergeMessages, readCatalogMeta } from './catalog'
import { currentPlatform, interpolate, Platform, selectVariant } from './format'
import {
  CatalogProblem,
  Direction,
  LocaleDefinition,
  LocaleSummary,
  Message,
  TranslationParameters,
} from './types'

/** The catalog every other catalog is measured against, and always present. */
export const FallbackLocaleTag = 'en'

type Listener = () => void

type CatalogLayer = {
  readonly name: string
  readonly nativeName: string
  readonly direction: Direction
  readonly authors?: ReadonlyArray<string>
  readonly messages: ReadonlyMap<string, Message>
}

/** One message can expand to several rows: a plural or platform per variant. */
export type Variant = {
  /** `''`, a plural qualifier such as `_one`, or a platform one like `@win32`. */
  readonly qualifier: string
  readonly template: string
}

const noMessages: ReadonlyMap<string, Message> = new Map()

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

  private requestedTag: string | null = null
  private systemTags = new Array<string>()
  private activeTag = FallbackLocaleTag
  private platform: Platform = currentPlatform()

  public registerFromJson(
    tag: string,
    raw: unknown,
    source: 'builtin' | 'user' = 'builtin'
  ): void {
    const layers = source === 'user' ? this.userLayers : this.builtins
    const existing = layers.get(tag)
    const messages = flattenCatalog(raw, this.problems)
    const meta = readCatalogMeta(raw)

    layers.set(tag, {
      name: meta.name ?? existing?.name ?? tag,
      nativeName: meta.nativeName ?? existing?.nativeName ?? tag,
      direction: meta.direction ?? existing?.direction ?? 'ltr',
      authors: meta.authors ?? existing?.authors,
      messages:
        existing === undefined
          ? messages
          : mergeMessages(existing.messages, messages),
    })

    this.effective.clear()
  }

  /** Drops every user override, restoring the shipped wording. */
  public resetUserLayers(): void {
    this.userLayers.clear()
    this.afterCatalogChange()
  }

  /** Drops the user's overrides for one language, keeping the built-in one. */
  public forgetUserLayer(tag: string): void {
    this.userLayers.delete(tag)
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

  public translate(key: string, params: TranslationParameters = {}): string {
    const template = this.getTemplate(key, params)

    if (template === undefined) {
      this.missingKeys.add(key)
      return key
    }

    return interpolate(template, params, this.activeTag)
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
      messages,
    })

    this.effective.clear()
    this.emit()
  }

  /** Drops the user's override for `key` so the shipped wording shows again. */
  public clearUserMessage(tag: string, key: string): void {
    const layer = this.userLayers.get(tag)

    if (layer === undefined || !layer.messages.has(key)) {
      return
    }

    const messages = new Map(layer.messages)
    messages.delete(key)
    this.userLayers.set(tag, { ...layer, messages })
    this.effective.clear()
    this.emit()
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
