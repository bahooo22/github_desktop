import mem from 'mem'
import QuickLRU from 'quick-lru'
import { localization } from './l10n/core'

// Initializing a date formatter is expensive but formatting is relatively cheap
// so we cache them based on the locale and their options. The maxSize of a 100
// is only as an escape hatch, we don't expect to ever create more than a
// handful different formatters.
const getRelativeFormatter = mem(
  (locale: string, options: Intl.RelativeTimeFormatOptions) =>
    new Intl.RelativeTimeFormat(locale, options),
  {
    cache: new QuickLRU({ maxSize: 100 }),
    cacheKey: (...args) => JSON.stringify(args),
  }
)

export interface IFormatRelativeOptions {
  /**
   * Сворачивать возраст от недели и дальше в недели (`numeric: 'always'`), а не в
   * дни и «в прошлом месяце». Нужно только счётчику «первый запуск этой сборки»:
   * `numeric: 'auto'` (дефолт апстрима) на недельной и больше дистанции даёт
   * «на прошлой неделе» / «в прошлом месяце» — из них не выходит шкала «неделя →
   * 2/3/4 недели → месяц». Дефолт не меняется: списки коммитов и PR по-прежнему
   * показывают «8 дней назад».
   */
  readonly coarseAfterWeek?: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Границы шкалы: полные сутки 7–13 → 1 неделя, 14–20 → 2, 21–27 → 3, 28–34 → 4. */
const DAYS_PER_WEEK = 7

/** После 34 суток идёт месяц — четвёртая неделя верхняя граница шкалы. */
const MAX_COARSE_WEEKS = 4

export function formatRelative(ms: number, options?: IFormatRelativeOptions) {
  const locale = localization.getActiveTag()
  const formatter = getRelativeFormatter(locale, { numeric: 'auto' })

  const sign = ms < 0 ? -1 : 1

  // Lifted and adopted from
  // https://github.com/github/time-elements/blob/428b02c9/src/relative-time.ts#L57
  const sec = Math.round(Math.abs(ms) / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  const month = Math.round(day / 30)
  const year = Math.round(month / 12)

  if (sec < 45) {
    return formatter.format(sec * sign, 'second')
  } else if (min < 45) {
    return formatter.format(min * sign, 'minute')
  } else if (hr < 24) {
    return formatter.format(hr * sign, 'hour')
  }

  if (options?.coarseAfterWeek === true) {
    // Полные сутки, а не округлённые: шкала меряется границами 7/14/21/28/35.
    const wholeDays = Math.floor(Math.abs(ms) / MS_PER_DAY)

    if (wholeDays >= DAYS_PER_WEEK) {
      const coarse = getRelativeFormatter(locale, { numeric: 'always' })
      const weeks = Math.floor(wholeDays / DAYS_PER_WEEK)

      if (weeks <= MAX_COARSE_WEEKS) {
        return coarse.format(weeks * sign, 'week')
      }

      return month < 18
        ? coarse.format(month * sign, 'month')
        : coarse.format(year * sign, 'year')
    }
  }

  if (day < 30) {
    return formatter.format(day * sign, 'day')
  } else if (month < 18) {
    return formatter.format(month * sign, 'month')
  } else {
    return formatter.format(year * sign, 'year')
  }
}
