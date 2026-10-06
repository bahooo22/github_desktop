import * as Fs from 'fs'
import * as FsAsync from 'fs/promises'
import * as Path from 'path'
import { app, shell } from 'electron'

import { LocalizationState, UserLocalizationFile } from '../lib/l10n/types'
import { localization } from '../lib/l10n/core'
import { registerBuiltInLocales } from '../lib/l10n/builtins'
import * as ipcMain from './ipc-main'

/**
 * Folder where users keep their own translations. Everything in it is plain
 * JSON so a translation can be shared by copying a file, and the application
 * never needs write access to its own resources to support a new language.
 */
export function getLocalizationsDirectory(): string {
  return Path.join(app.getPath('userData'), 'localizations')
}

/**
 * Electron can report an empty preferred-language list while still knowing the
 * single locale the session runs in (headless Linux being the common case), so
 * fall back to that instead of silently dropping to the default language.
 */
function getSystemLocales(): ReadonlyArray<string> {
  const preferred = app.getPreferredSystemLanguages()
  if (preferred.length > 0) {
    return preferred
  }

  const single = app.getLocale()
  return single === '' ? [] : [single]
}

/**
 * Where the chosen language is stored. It lives next to the catalogs rather
 * than in localStorage so the main process can honour it when building the
 * native menu, long before any renderer exists.
 */
function getPreferencesPath(): string {
  return Path.join(getLocalizationsDirectory(), 'settings.json')
}

/** Files in the folder that aren't catalogs. */
const ReservedFileNames = new Set(['settings.json'])

/**
 * Language tags become file names, so anything that could escape the folder
 * (`..`, slashes, backslashes) is rejected outright rather than sanitized.
 */
export function isValidLocalizationTag(tag: string): boolean {
  return (
    tag.length >= 2 &&
    tag.length <= 35 &&
    /^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*$/.test(tag)
  )
}

function fileNameForTag(tag: string): string {
  if (!isValidLocalizationTag(tag)) {
    throw new Error(`Invalid language tag: ${tag}`)
  }
  return `${tag.toLowerCase()}.json`
}

function toFile(
  path: string,
  contents: string
): UserLocalizationFile | undefined {
  const name = Path.basename(path)

  if (!name.endsWith('.json') || ReservedFileNames.has(name)) {
    return undefined
  }

  const tag = name.slice(0, -'.json'.length)

  if (!isValidLocalizationTag(tag)) {
    return { tag, path, error: `'${tag}' is not a valid language code` }
  }

  try {
    return { tag, path, contents: JSON.parse(contents) }
  } catch (e) {
    return { tag, path, error: `${e}` }
  }
}

function parsePreferredLocale(contents: string): string | null {
  try {
    const language = JSON.parse(contents)?.language
    return language === null || typeof language === 'string' ? language : null
  } catch (e) {
    // No file yet, or a corrupt one: automatic detection is the right answer.
    return null
  }
}

/**
 * Registers everything the main process can translate with.
 *
 * Deliberately synchronous: this runs on the launch path immediately before
 * the first application menu is built, and an async read would let the menu
 * render in English for a frame or two.
 */
export function initializeMainProcessLocalization(): void {
  registerBuiltInLocales()

  const directory = getLocalizationsDirectory()

  let entries = new Array<string>()
  try {
    // eslint-disable-next-line no-sync
    entries = Fs.readdirSync(directory).sort()
  } catch (e) {
    // First run: the folder doesn't exist until someone adds a translation.
  }

  for (const name of entries) {
    const path = Path.join(directory, name)
    let contents: string
    try {
      // eslint-disable-next-line no-sync
      contents = Fs.readFileSync(path, 'utf8')
    } catch (e) {
      continue
    }

    const file = toFile(path, contents)
    if (file?.contents !== undefined) {
      localization.registerFromJson(file.tag, file.contents, 'user')
    }
  }

  let preferredLocale: string | null = null
  try {
    // eslint-disable-next-line no-sync
    const raw = Fs.readFileSync(getPreferencesPath(), 'utf8')
    preferredLocale = parsePreferredLocale(raw)
  } catch (e) {
    // No preference yet, so follow the operating system.
  }

  localization.setSystemLocales(getSystemLocales())
  localization.setRequestedLocale(preferredLocale)
}

/**
 * Everything the renderer needs to translate before it renders. Unreadable
 * files come back with an `error` instead of throwing: one broken file must
 * not stop the application from starting.
 */
export async function getLocalizationState(): Promise<LocalizationState> {
  const directory = getLocalizationsDirectory()

  let entries = new Array<string>()
  try {
    entries = (await FsAsync.readdir(directory)).sort()
  } catch (e) {
    // The folder only exists once someone adds a translation.
  }

  const files = (
    await Promise.all(
      entries.map(async name => {
        const path = Path.join(directory, name)
        try {
          return toFile(path, await FsAsync.readFile(path, 'utf8'))
        } catch (e) {
          return undefined
        }
      })
    )
  ).filter((f): f is UserLocalizationFile => f !== undefined)

  let preferredLocale: string | null = null
  try {
    preferredLocale = parsePreferredLocale(
      await FsAsync.readFile(getPreferencesPath(), 'utf8')
    )
  } catch (e) {
    // No preference yet.
  }

  return {
    systemLocales: getSystemLocales(),
    preferredLocale,
    directory,
    files,
  }
}

/**
 * Writes a user catalog, returning an error message rather than throwing so
 * the caller can show it in the dialog that triggered the save.
 */
export async function saveUserLocalization(
  tag: string,
  contents: object
): Promise<string | undefined> {
  if (!isValidLocalizationTag(tag)) {
    return `'${tag}' is not a valid language code`
  }

  const directory = getLocalizationsDirectory()

  try {
    await FsAsync.mkdir(directory, { recursive: true })
    await FsAsync.writeFile(
      Path.join(directory, fileNameForTag(tag)),
      JSON.stringify(contents, null, 2) + '\n',
      'utf8'
    )
  } catch (e) {
    return `${e}`
  }

  return undefined
}

export async function savePreferredLocale(
  tag: string | null
): Promise<string | undefined> {
  if (tag !== null && !isValidLocalizationTag(tag)) {
    return `'${tag}' is not a valid language code`
  }

  try {
    await FsAsync.mkdir(getLocalizationsDirectory(), { recursive: true })
    await FsAsync.writeFile(
      getPreferencesPath(),
      JSON.stringify({ language: tag }, null, 2) + '\n',
      'utf8'
    )
  } catch (e) {
    return `${e}`
  }

  return undefined
}

export async function deleteUserLocalization(tag: string): Promise<boolean> {
  if (!isValidLocalizationTag(tag)) {
    return false
  }

  try {
    await FsAsync.unlink(
      Path.join(getLocalizationsDirectory(), fileNameForTag(tag))
    )
    return true
  } catch (e) {
    return false
  }
}

/**
 * Wires up the channels the renderer uses to read and edit translations.
 * `localeChanged` fires when the renderer has settled on a different language
 * and the native menu needs to be rebuilt.
 */
export function registerLocalizationIpc(localeChanged: (tag: string) => void) {
  ipcMain.handle('get-localization-state', () => getLocalizationState())

  ipcMain.handle('set-preferred-locale', (_, tag) => savePreferredLocale(tag))

  ipcMain.handle('save-user-localization', (_, tag, contents) =>
    saveUserLocalization(tag, contents)
  )

  ipcMain.handle('delete-user-localization', (_, tag) =>
    deleteUserLocalization(tag)
  )

  ipcMain.handle('show-user-localizations-folder', async () => {
    const directory = getLocalizationsDirectory()
    await FsAsync.mkdir(directory, { recursive: true })
    await shell.openPath(directory)
  })

  ipcMain.on('update-localization', (_, tag) => localeChanged(tag))
}
