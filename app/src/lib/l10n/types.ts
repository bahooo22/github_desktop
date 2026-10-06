/**
 * Types for the localization catalogs.
 *
 * A catalog is a nested tree of keys whose leaves are either a plain message
 * or a set of qualified messages. A qualified message is an object whose keys
 * are all qualifiers (see `isQualifiers`) and whose values are messages:
 *
 *   "files-changed": { "_one": "{count} file changed",
 *                      "_other": "{count} files changed" }
 *
 *   "new-repository": { "@darwin": "New Repository…",
 *                       "@other": "New &repository…" }
 */
export type CatalogValue = string | { [key: string]: CatalogValue }

export type CatalogTree = { [key: string]: CatalogValue }

/** An entry in a catalog that could not be loaded, with the reason why. */
export type CatalogProblem = {
  readonly key: string
  readonly reason: string
}

/** The `meta` block at the root of a catalog file. */
export type LocaleMeta = {
  readonly name: string
  readonly nativeName: string
  readonly direction?: Direction
  readonly authors?: ReadonlyArray<string>
}

/** A single leaf, indexed by the qualifier it applies under. */
export type Message = ReadonlyMap<string, string>

export type Direction = 'ltr' | 'rtl'

export type LocaleDefinition = {
  /** BCP-47 tag used to look this locale up, e.g. `ru-RU`. */
  readonly tag: string

  /** English name, shown in the language picker. */
  readonly name: string

  /** Name in the language itself, shown next to `name`. */
  readonly nativeName: string

  readonly direction: Direction

  /** Translator credits from the catalog's `meta.authors` block. */
  readonly authors?: ReadonlyArray<string>

  /** Where the catalog came from, which decides whether it is editable. */
  readonly source: 'builtin' | 'user'

  /** Everything the language can answer with: built-in plus user overrides. */
  readonly messages: ReadonlyMap<string, Message>

  /** Only the entries the user supplied, which is what the editor writes. */
  readonly userMessages: ReadonlyMap<string, Message>
}

export type LocaleSummary = Omit<LocaleDefinition, 'messages'>

/** Parameters substituted into `{placeholders}` within a message. */
export type TranslationParameters = Readonly<
  Record<string, string | number | boolean | undefined>
>

/** A catalog the user created, as found on disk. */
export type UserLocalizationFile = {
  readonly tag: string
  readonly path: string

  /** Parsed JSON, or `undefined` when `error` explains why it couldn't be. */
  readonly contents?: unknown
  readonly error?: string
}

/** Everything the renderer needs from disk before the first render. */
export type LocalizationState = {
  /** The languages the operating system reports, most preferred first. */
  readonly systemLocales: ReadonlyArray<string>

  /** The language the user picked, or `null` for automatic detection. */
  readonly preferredLocale: string | null

  /** Folder user catalogs are read from and written to. */
  readonly directory: string

  readonly files: ReadonlyArray<UserLocalizationFile>
}
