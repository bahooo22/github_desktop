import { ru } from 'date-fns/locale/ru'
import { uk } from 'date-fns/locale/uk'

import { localization } from './core'

/**
 * Calendar data — month and weekday names — for the interface languages that
 * date-fns actually ships.
 *
 * The other catalogs have no date-fns counterpart: `en` is what date-fns does
 * by default, and the transliterated ones (`la`, `eo`, `tlh`, `qya`) would have
 * to invent a calendar, so those keep the English one rather than a guess.
 *
 * Imported per locale on purpose: the `date-fns/locale` barrel pulls in every
 * locale the package knows about.
 */
const calendarLocales = { ru, uk }

/**
 * The locale `format` from date-fns should use for the language the interface
 * is currently in, or `undefined` to leave date-fns on its own default.
 */
export function getDateFnsLocale(
  tag: string = localization.getActiveTag()
): typeof calendarLocales[keyof typeof calendarLocales] | undefined {
  return calendarLocales[tag as keyof typeof calendarLocales]
}
