import * as ipcRenderer from '../ipc-renderer'
import { LocalizationState } from './types'
import { localization } from './core'
import { registerBuiltInLocales } from './builtins'

export { localization, t, matchTag, FallbackLocaleTag } from './core'
export type { Variant } from './core'
export { unflattenMessages, findUnknownKeys } from './catalog'
export { findPlaceholders } from './format'
export type { LocaleMeta } from './types'
export {
  Trans,
  LocalizationProvider,
  useLocalization,
  getDirection,
} from './react'
export { registerBuiltInLocales } from './builtins'
export type {
  CatalogProblem,
  CatalogTree,
  LocaleDefinition,
  LocaleSummary,
  LocalizationState,
  TranslationParameters,
  UserLocalizationFile,
} from './types'

export type LocalizationsReloaded = {
  readonly loaded: number
  readonly failed: ReadonlyArray<string>
  readonly directory: string
}

let state: LocalizationState | undefined

/**
 * Loads every catalog and works out which language to render in. Must run
 * before the first render so that no English flashes past a user whose system
 * speaks another language.
 */
export async function initializeLocalization(): Promise<void> {
  registerBuiltInLocales()

  state = await readState()

  applyState(state)

  // The native menu is built in the main process, which can't see our
  // selection, so every language change has to be pushed over there. Only on
  // an actual change though: editor keystrokes also emit, and rebuilding the
  // whole menu for each of them would be pure waste.
  let lastTag = localization.getActiveTag()
  localization.subscribe(() => {
    const tag = localization.getActiveTag()
    if (tag !== lastTag) {
      lastTag = tag
      ipcRenderer.send('update-localization', tag)
    }
  })
}

function applyState(next: LocalizationState | undefined) {
  // An empty list from the main process means "nothing detected", not "the
  // user speaks no language", so the renderer's own view still gets a say.
  const fromMain = next?.systemLocales ?? []
  localization.setSystemLocales(
    fromMain.length > 0
      ? fromMain
      : (typeof navigator === 'undefined' ? [] : navigator.languages) ?? []
  )

  localization.setRequestedLocale(next?.preferredLocale ?? null)
}

async function readState(): Promise<LocalizationState | undefined> {
  try {
    return await ipcRenderer.invoke('get-localization-state')
  } catch (e) {
    // The crash window and unit tests have no main process to talk to; the
    // shipped catalogs are enough to render something sensible there.
    log.warn('Could not read user localizations from disk', e)
    return undefined
  }
}

/**
 * Re-reads the user's translation files. Called by the settings screen after
 * the user has edited or dropped in a catalog, which makes a hand written
 * translation visible without a restart.
 *
 * The user layers are rebuilt from scratch rather than merged on top of what
 * is already in memory, so keys that were removed from a file disappear from
 * the interface too.
 */
export async function reloadUserLocalizations(): Promise<LocalizationsReloaded> {
  const next = await readState()
  state = next

  localization.resetUserLayers()
  for (const file of next?.files ?? []) {
    if (file.contents !== undefined) {
      localization.registerFromJson(file.tag, file.contents, 'user')
    }
  }

  const loaded = next?.files.filter(f => f.contents !== undefined).length ?? 0
  const failed = (next?.files ?? [])
    .filter(f => f.error !== undefined)
    .map(f => f.tag)

  return { loaded, failed, directory: next?.directory ?? '' }
}

export function getLocalizationsDirectory(): string {
  return state?.directory ?? ''
}

export function getUnreadableLocalizations(): ReadonlyArray<string> {
  return (state?.files ?? [])
    .filter(f => f.error !== undefined)
    .map(f => `${f.tag}: ${f.error}`)
}

/**
 * Persists a user catalog to disk and registers it straight away, so the
 * editor can show its own result without another round trip.
 */
export async function saveUserLocalization(
  tag: string,
  contents: object
): Promise<string | undefined> {
  const error = await ipcRenderer.invoke(
    'save-user-localization',
    tag,
    contents
  )

  if (error === undefined) {
    state = await readState()
    localization.registerFromJson(tag, contents, 'user')
  }

  return error
}

export async function deleteUserLocalization(tag: string): Promise<boolean> {
  const deleted = await ipcRenderer.invoke('delete-user-localization', tag)

  if (deleted) {
    state = await readState()
    localization.forgetUserLayer(tag)
  }

  return deleted
}

/**
 * Changes the language. `null` goes back to following the operating system.
 * The write goes to disk first so the choice survives a restart, and the
 * renderer picks the new language from the same call either way.
 */
export async function setPreferredLocale(
  tag: string | null
): Promise<string | undefined> {
  const error = await ipcRenderer.invoke('set-preferred-locale', tag)

  if (error !== undefined) {
    return error
  }

  state = state === undefined ? undefined : { ...state, preferredLocale: tag }
  localization.setRequestedLocale(tag)
  return undefined
}

export function openLocalizationsFolder(): void {
  ipcRenderer.invoke('show-user-localizations-folder')
}
