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

/** How much of a catalog is still the English text of the same place. */
export interface IUntranslatedCount {
  readonly untranslated: number
  readonly compared: number
  readonly unmatched: number
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
/** True for logger/`throw new Error` calls, whose text never reaches the UI. */
export function isDiagnosticCallee(callee: string): boolean
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
export function compareCatalogParity(
  catalogs: ReadonlyArray<ICatalogEntry | readonly [string, CatalogTree]>
): ICatalogParityResult

/** CLI modes; each returns the process exit code for its findings. */
export function runAudit(): number
export function runUpstream(ref: string | undefined): number
export function runParity(): number
export function runBundles(): number
