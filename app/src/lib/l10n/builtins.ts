import en from '../../../locales/en.json'
import ru from '../../../locales/ru.json'
import uk from '../../../locales/uk.json'
import { localization } from './core'

/**
 * Catalogs shipped with the application. Both processes import this module so
 * that the native menu and the renderer translate from exactly the same table;
 * adding a language is one import plus one JSON file.
 */
const shippedCatalogs: Readonly<Record<string, unknown>> = { en, ru, uk }

export function registerBuiltInLocales(): void {
  for (const [tag, contents] of Object.entries(shippedCatalogs)) {
    localization.registerFromJson(tag, contents, 'builtin')
  }
}
