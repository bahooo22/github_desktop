import assert from 'node:assert'
import { describe, it } from 'node:test'

import { getForkReleaseSummaries } from '../../src/lib/fork-changelog'
import forkChangelog from '../../../changelog-fork.json'
import appPackage from '../../package.json'
import en from '../../locales/en.json'
import ru from '../../locales/ru.json'
import uk from '../../locales/uk.json'

const knownKinds = ['new', 'fixed', 'improved', 'added', 'removed', 'pretext']

/**
 * Значение ключа каталога — строка либо словарьPlatform-вариантов
 * (`{ "@darwin": …, "@other": … }`). И то и другое перевод, пустоту ловит
 * `yarn l10n:parity`.
 */
function catalogValue(catalog: unknown, key: string): string | object | null {
  let value: unknown = catalog

  for (const part of key.split('.')) {
    if (value === null || typeof value !== 'object') {
      return null
    }
    value = (value as Record<string, unknown>)[part]
  }

  if (typeof value === 'string') {
    return value
  }

  if (value !== null && typeof value === 'object') {
    return value
  }

  return null
}

describe('fork changelog', () => {
  const releases = forkChangelog.releases

  it('carries a note for the version this build is made of', () => {
    // Диалог сравнивает первую запись с установленной версией, чтобы решить,
    // предлагать ли установку; запись под чужим номером спрятала бы кнопку или
    // показала бы её при обновлять-нечего.
    assert.ok(
      releases.some(r => r.version === appPackage.version),
      `в changelog-fork.json нет записи для версии ${appPackage.version} — добавьте её при подъёме version`
    )
  })

  it('lists only known note kinds', () => {
    for (const release of releases) {
      for (const note of release.notes) {
        assert.ok(
          knownKinds.includes(note.kind),
          `${note.key}: kind '${note.kind}' не разбирается панелью`
        )
      }
    }
  })

  it('resolves every note in the three catalogs', () => {
    for (const release of releases) {
      for (const note of release.notes) {
        for (const [tag, catalog] of [
          ['en', en],
          ['ru', ru],
          ['uk', uk],
        ] as const) {
          assert.notEqual(
            catalogValue(catalog, note.key),
            null,
            `${tag}: нет ключа ${note.key}`
          )
        }
      }
    }
  })

  it('keeps notes older than the installed build out of the panel', () => {
    assert.equal(getForkReleaseSummaries('2099-01-01').length, 0)
    assert.equal(
      getForkReleaseSummaries('2000-01-01').length,
      releases.length,
      'записи форка должны переживать сборку, вышедшую до них'
    )
  })

  it('puts every note into exactly one section', () => {
    for (const summary of getForkReleaseSummaries('2000-01-01')) {
      const counted =
        summary.pretext.length +
        summary.enhancements.length +
        summary.bugfixes.length +
        summary.other.length

      const release = releases.find(r => r.version === summary.latestVersion)
      assert.notEqual(release, undefined)
      assert.equal(counted, release!.notes.length)
    }
  })
})
