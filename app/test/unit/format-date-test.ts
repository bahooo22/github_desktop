import assert from 'node:assert'
import { describe, it } from 'node:test'

import { formatDate } from '../../src/lib/format-date'
import {
  dateFormats,
  timeFormats,
  defaultDateFormat,
  defaultTimeFormat,
} from '../../src/models/formatting-preferences'
import { localization } from '../../src/lib/l10n'

/**
 * date-fns takes the calendar names from its own locale data, not from the
 * interface catalogs, so a Russian interface used to print `Oct 28, 2026` while
 * it printed everything else in Russian. This date is a month whose English and
 * Russian names share no letters.
 */
const date = new Date(2026, 9, 28, 2, 32, 0)

function inRussian(run: () => void) {
  localization.setRequestedLocale('ru')
  try {
    run()
  } finally {
    localization.setRequestedLocale(null)
  }
}

function patternOf<T extends { pattern: string }>(
  list: ReadonlyArray<T>,
  value: string
): T {
  const match = list.find(f => f.pattern === value)
  assert.notEqual(match, undefined, `${value} is one of the offered patterns`)
  return match!
}

describe('formatDate follows the interface language', () => {
  it('keeps the English calendar when the interface is in English', () => {
    const formatted = formatDate(date)

    assert.ok(formatted.includes('Oct'), formatted)
    assert.ok(!/[А-Яа-яЁё]/.test(formatted), formatted)
  })

  it('names the month in Russian when the interface is in Russian', () => {
    inRussian(() => {
      const formatted = formatDate(date)

      assert.ok(formatted.includes('окт'), formatted)
      assert.ok(!formatted.includes('Oct'), formatted)
    })
  })

  it('keeps the time of day in the line', () => {
    // The About dialog shows when a build was published, and the time is part
    // of that answer by design (28.10.2026). Measured as «there is a time
    // portion», because whether it reads 02:32 or 2:32 дп is the user's
    // formatting preference, not something this line should decide.
    inRussian(() => {
      const formatted = formatDate(date)

      assert.ok(formatted.includes(':'), formatted)
      assert.ok(formatted.includes('2026'), formatted)
    })
  })

  it('previews the offered patterns in the interface language too', () => {
    // Read lazily: the lists are built when the module loads, long before the
    // user picks a language, so a value computed there would stay English in
    // the Preferences dialog no matter what the interface speaks. Each list is
    // measured on its own — one property read before the language changes and
    // the same property read after it — otherwise a lazy time list would hide a
    // frozen date list and the assertion would pass on half-broken code.
    const check = <T extends { readonly pattern: string }>(
      list: ReadonlyArray<T & { readonly example: string }>,
      pattern: string
    ) => {
      const entry = patternOf(list, pattern)
      const english = entry.example

      inRussian(() => {
        assert.notEqual(
          entry.example,
          english,
          `${pattern} follows the language`
        )
      })
    }

    check(dateFormats, defaultDateFormat)
    check(timeFormats, defaultTimeFormat)

    inRussian(() => {
      assert.ok(
        /[А-Яа-яЁё]/.test(patternOf(dateFormats, 'MMM d, yyyy').example)
      )
    })
  })
})
