/**
 * Hand-written types for `i18n-freshness.mjs`. The checker stays plain
 * JavaScript (tsconfig has no allowJs and it runs straight under node), so this
 * is what lets the unit test call it without `any`.
 */

/** A catalog leaf: either the text itself or a platform/plural variant record. */
export type CatalogLeaf = string | Record<string, string>

export type CatalogTree = Record<string, unknown>

export interface ICatalogEntry {
  readonly tag: string
  readonly tree: CatalogTree
}

/** A visible English literal still hardcoded in a source file. */
export interface IVisibleLiteral {
  readonly line: number
  readonly text: string
  readonly kind: 'code' | 'jsx'
}

export interface ICatalogParityResult {
  readonly counts: Record<string, number>
  readonly issues: ReadonlyArray<string>
}

/**
 * Key requests found in one file, mapped to the line that asked. A prefix
 * entry comes from ``t(`menu.${id}`)`` and stands for the whole family.
 */
export interface IKeyRequests {
  readonly exact: Map<string, number>
  readonly prefixes: Map<string, number>
}

/** The same requests over the whole source tree, mapped to `file:line`. */
export interface IKeyRequestSites {
  readonly exact: Map<string, string>
  readonly prefixes: Map<string, string>
}

/**
 * Requests collected off `git grep`: a bare set of tokens, because a loose
 * reading has no line to blame.
 */
export interface IKeyRequestTokens {
  readonly exact: Set<string>
  readonly prefixes: Set<string>
}

/** How much of a catalog is still the English text of the same place. */
export interface IUntranslatedCount {
  readonly untranslated: number
  readonly compared: number
  readonly unmatched: number
}

/** One tag whose measured count sits on one side of its ceiling. */
export interface IUntranslatedCeilingPair {
  readonly tag: string
  readonly count: number
  readonly ceiling: number
}

/**
 * The four ways the ceiling table and the catalogs can disagree. `violations`
 * and `missing` are red, `stale` is red because it means the table describes a
 * catalog that no longer loads, and `under` is only the hint that a ceiling can
 * be lowered.
 */
export interface IUntranslatedCeilingResult {
  readonly violations: ReadonlyArray<IUntranslatedCeilingPair>
  readonly missing: ReadonlyArray<string>
  readonly stale: ReadonlyArray<string>
  readonly under: ReadonlyArray<IUntranslatedCeilingPair>
}

export const PRODUCT_NAMES: ReadonlyArray<string>
export const VISIBLE_NAMES: ReadonlySet<string>
export const VISIBLE_SUFFIXES: ReadonlyArray<string>
export const DIALOG_CALL_PATTERN: RegExp
export const TECHNICAL_PATTERNS: ReadonlyArray<RegExp>

export function normalizePhrase(text: string): string
export function extractPlaceholders(text: string): ReadonlyArray<string>
export function isVisibleContextName(rawName: string): boolean
export function isLegalVisibleLiteral(text: string): boolean
export function isUserFacingLiteral(text: string): boolean
/** Callee of the innermost still-open bracket in a piece of source text. */
export function innermostCallee(text: string): string
/**
 * True for logger, `throw new Error` and the assertion helpers of
 * `fatal-error.ts`, whose text never reaches the UI.
 */
export function isDiagnosticCallee(callee: string): boolean
/** True for `join(...)`/`resolve(...)`, whose arguments are path segments. */
export function isPathBuildingCallee(callee: string): boolean
/** Annotation that excuses a machine-read string from the audit. */
export const L10N_IGNORE_ANNOTATION: 'l10n-ignore'
/** Directive that takes a whole file out of the audit, in its head. */
export const L10N_IGNORE_FILE: string
/** Does the file declare the directive among its first ten lines? */
export function ignoresWholeFile(code: string): boolean
/** Is the literal on this 1-based line excused by the annotation? */
export function hasIgnoreAnnotation(
  lines: ReadonlyArray<string>,
  lineNumber: number
): boolean
export function extractVisibleLiteralsFromSource(
  code: string,
  fileName: string
): ReadonlyArray<IVisibleLiteral>
export function flattenCatalogLeaves(
  catalog: CatalogTree
): Map<string, CatalogLeaf>
export function collectCatalogStrings(catalog: CatalogTree): ReadonlySet<string>
export function countUntranslatedLeaves(
  enLeaves: Map<string, CatalogLeaf>,
  targetLeaves: Map<string, CatalogLeaf>
): IUntranslatedCount
/** The highest accepted number of untranslated forms per tag. */
export const UNTRANSLATED_CEILINGS: Readonly<Record<string, number>>
export function checkUntranslatedCeilings(
  counts: Readonly<Record<string, number>>,
  ceilings?: Readonly<Record<string, number>>
): IUntranslatedCeilingResult
export function compareCatalogParity(
  catalogs: ReadonlyArray<ICatalogEntry | readonly [string, CatalogTree]>
): ICatalogParityResult
/** Key of every release-note of the fork, from `changelog-fork.json`. */
export function changelogNoteKeys(): ReadonlyArray<string>
/** Requests seen by `git grep` over app/src, or null when grep failed. */
export function keysRequestedInSource(): IKeyRequestTokens | null
export function keysRequestedFromSource(
  code: string,
  fileName: string
): IKeyRequests
export function keysRequestedInSources(): IKeyRequestSites
/** Requests `catalog` cannot answer, as `file:line: key` findings. */
export function requestedKeysMissingFromCatalog(
  catalog: CatalogTree,
  requested?: IKeyRequestSites
): ReadonlyArray<string>

/** CLI modes; each returns the process exit code for its findings. */
export function runAudit(): number
export function runUpstream(ref: string | undefined): number
export function runParity(): number
export function runBundles(): number
/** One catalog against its ceiling, or every catalog but `en` as the gate. */
export function runUntranslated(tag?: string): number
