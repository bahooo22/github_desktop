import assert from 'node:assert'
import { describe, it } from 'node:test'

import { formatRelative } from '../../src/lib/format-relative'
import { getRelativeTimeInfoFromDate } from '../../src/ui/relative-time'
import { formatDate } from '../../src/lib/format-date'
import { localization } from '../../src/lib/l10n'

const DAY = 24 * 60 * 60 * 1000

/** Возраст N суток назад, чтобы Intl считал прошлое. */
function daysAgo(days: number) {
  return -days * DAY
}

function inRussian(run: () => void) {
  localization.setRequestedLocale('ru')
  try {
    run()
  } finally {
    localization.setRequestedLocale(null)
  }
}

describe('formatRelative without the coarse scale', () => {
  // Дефолт обязан остаться апстримным: списки коммитов и PR показывают дни и
  // «в прошлом месяце», а не «1 месяц назад».
  it('keeps days for anything under a week', () => {
    assert.equal(formatRelative(daysAgo(3)), '3 days ago')
    assert.equal(formatRelative(daysAgo(6)), '6 days ago')
  })

  it('keeps the word-based forms past a week', () => {
    assert.equal(formatRelative(daysAgo(8)), '8 days ago')
    assert.equal(formatRelative(daysAgo(35)), 'last month')

    inRussian(() => {
      assert.equal(formatRelative(daysAgo(8)), '8 дней назад')
      assert.equal(formatRelative(daysAgo(35)), 'в прошлом месяце')
    })
  })

  it('still answers hours below a day', () => {
    assert.equal(
      formatRelative(-3 * 60 * 60 * 1000, { coarseAfterWeek: true }),
      '3 hours ago'
    )
    assert.equal(formatRelative(-3 * 60 * 60 * 1000), '3 hours ago')
  })
})

describe('formatRelative on the weekly scale', () => {
  it('counts whole weeks between a week and a month', () => {
    const cases: ReadonlyArray<readonly [number, string]> = [
      [7, '1 week ago'],
      [8, '1 week ago'],
      [13, '1 week ago'],
      [14, '2 weeks ago'],
      [20, '2 weeks ago'],
      [21, '3 weeks ago'],
      [27, '3 weeks ago'],
      [28, '4 weeks ago'],
      [34, '4 weeks ago'],
      [35, '1 month ago'],
      [60, '2 months ago'],
    ]

    for (const [days, expected] of cases) {
      assert.equal(
        formatRelative(daysAgo(days), { coarseAfterWeek: true }),
        expected,
        `${days} суток`
      )
    }
  })

  it('keeps the same boundaries in Russian', () => {
    // Плюралы отдаёт Intl — здесь они зафиксированы как фактический вывод.
    const cases: ReadonlyArray<readonly [number, string]> = [
      [6, '6 дней назад'],
      [7, '1 неделю назад'],
      [13, '1 неделю назад'],
      [14, '2 недели назад'],
      [27, '3 недели назад'],
      [28, '4 недели назад'],
      [35, '1 месяц назад'],
    ]

    inRussian(() => {
      for (const [days, expected] of cases) {
        assert.equal(
          formatRelative(daysAgo(days), { coarseAfterWeek: true }),
          expected,
          `${days} суток`
        )
      }
    })
  })

  it('does not fall back to the auto wording past a week', () => {
    inRussian(() => {
      const coarse = formatRelative(daysAgo(10), { coarseAfterWeek: true })
      assert.ok(
        !coarse.includes('прошлой'),
        `неделя названа числом, а не «${coarse}»`
      )
    })
  })
})

describe('RelativeTime past a week on the coarse scale', () => {
  it('collapses to an absolute date without the flag', () => {
    const then = new Date(Date.now() - 10 * DAY)
    const info = getRelativeTimeInfoFromDate(then, false)

    // Ветка «дольше недели» без флага сворачивается в дату и теряет тик.
    assert.equal(
      info.relativeText,
      formatDate(then, { time: false, dateStyle: 'medium' })
    )
    assert.equal(info.duration, undefined)
  })

  it('keeps the relative weekly form and a reschedule tick with the flag', () => {
    const then = new Date(Date.now() - 10 * DAY)
    const info = getRelativeTimeInfoFromDate(then, false, true)

    assert.equal(info.relativeText, '1 week ago')
    assert.equal(info.duration, 6 * 60 * 60 * 1000)
  })

  it('keeps counting weeks in Russian under the interface language', () => {
    const then = new Date(Date.now() - 24 * DAY)

    inRussian(() => {
      const info = getRelativeTimeInfoFromDate(then, false, true)
      assert.equal(info.relativeText, '3 недели назад')
    })
  })
})
