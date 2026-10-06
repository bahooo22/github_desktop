import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  flattenCatalog,
  mergeMessages,
  unflattenMessages,
} from '../../src/lib/l10n/catalog'
import { interpolate, selectVariant } from '../../src/lib/l10n/format'
import { matchTag, localization } from '../../src/lib/l10n/core'
import { Message } from '../../src/lib/l10n/types'

function message(entries: ReadonlyArray<[string, string]>): Message {
  return new Map(entries)
}

describe('l10n catalog', () => {
  it('flattens nested groups into dotted keys', () => {
    const messages = flattenCatalog({
      menu: { about: 'About', exit: 'Exit' },
    })

    assert.equal(messages.get('menu.about')?.get(''), 'About')
    assert.equal(messages.get('menu.exit')?.get(''), 'Exit')
  })

  it('keeps plural and platform qualifiers apart', () => {
    const problems: Array<{ key: string; reason: string }> = []
    const messages = flattenCatalog(
      {
        files: { _one: '{n} file', _other: '{n} files' },
        quit: { '@darwin': 'Quit', '@other': 'E&xit' },
      },
      problems
    )

    assert.deepEqual(
      [...messages.get('files')!],
      [
        ['plural:_one', '{n} file'],
        ['plural:_other', '{n} files'],
      ]
    )
    assert.deepEqual(
      [...messages.get('quit')!],
      [
        ['platform:@darwin', 'Quit'],
        ['platform:@other', 'E&xit'],
      ]
    )
    assert.deepEqual(problems, [])
  })

  it('skips the meta block and reports mixed qualifiers', () => {
    const problems: Array<{ key: string; reason: string }> = []
    const messages = flattenCatalog(
      {
        meta: { name: 'Test' },
        broken: { _one: 'one', plain: 'mixed' },
      },
      problems
    )

    assert.equal(messages.has('meta'), false)
    assert.equal(messages.has('broken'), false)
    assert.equal(problems.length, 1)
    assert.match(problems[0].reason, /cannot be mixed/)
  })

  it('round-trips a user layer through unflatten', () => {
    const source = {
      menu: {
        about: 'О программе',
        pull: { '@darwin': 'Забрать', '@other': '&Забрать' },
      },
      changes: { files: { _one: '{n} файл', _few: '{n} файла' } },
    }

    const flat = flattenCatalog(source)
    const back = unflattenMessages(flat)

    assert.deepEqual(back, source)
  })

  it('merges an overlay key by key', () => {
    const base = flattenCatalog({ a: { b: 'keep', c: 'replace' } })
    const overlay = new Map([['a.c', message([['', 'replaced']])]])
    const merged = mergeMessages(base, overlay)

    assert.equal(merged.get('a.b')?.get(''), 'keep')
    assert.equal(merged.get('a.c')?.get(''), 'replaced')
  })
})

describe('l10n format', () => {
  it('interpolates plain and formatted parameters', () => {
    assert.equal(
      interpolate(
        '{name} changed {count:number} files',
        { name: 'BaHooo', count: 1234.5 },
        'en'
      ),
      'BaHooo changed 1,234.5 files'
    )
  })

  it('uses locale separators for numbers', () => {
    assert.equal(
      interpolate('{n:number}', { n: 1234.5 }, 'ru'),
      new Intl.NumberFormat('ru').format(1234.5)
    )
  })

  it('unescapes doubled braces and drops missing parameters', () => {
    assert.equal(interpolate('{{literal}} {missing}', {}, 'en'), '{literal} ')
  })

  it('prefers the platform variant over plurals', () => {
    const m = message([
      ['platform:@win32', 'E&xit'],
      ['platform:@other', 'Quit'],
      ['plural:_one', 'ignored'],
      ['', 'ignored'],
    ])

    assert.equal(selectVariant(m, 'en', { count: 1 }, 'win32'), 'E&xit')
    assert.equal(selectVariant(m, 'en', { count: 1 }, 'darwin'), 'Quit')
  })

  it('selects plural categories per language', () => {
    const m = message([
      ['plural:_one', '{count} file'],
      ['plural:_few', '{count} файла'],
      ['plural:_many', '{count} файлов'],
      ['plural:_other', '{count} файла'],
    ])

    assert.equal(selectVariant(m, 'ru', { count: 1 }, 'win32'), '{count} file')
    assert.equal(selectVariant(m, 'ru', { count: 3 }, 'win32'), '{count} файла')
    assert.equal(
      selectVariant(m, 'ru', { count: 5 }, 'win32'),
      '{count} файлов'
    )
    assert.equal(selectVariant(m, 'en', { count: 0 }, 'win32'), '{count} файла')
  })

  it('falls back to the plain message when no qualifier applies', () => {
    assert.equal(
      selectVariant(message([['', 'plain']]), 'en', {}, 'linux'),
      'plain'
    )
  })
})

describe('l10n matching', () => {
  const available = ['en', 'ru', 'pt-BR']

  it('matches region tags onto language catalogs', () => {
    assert.equal(matchTag(['ru-RU', 'en-US'], available), 'ru')
    assert.equal(matchTag(['RU'], available), 'ru')
  })

  it('respects preference order', () => {
    assert.equal(matchTag(['de', 'pt', 'ru'], available), 'pt-BR')
  })

  it('returns undefined when nothing matches', () => {
    assert.equal(matchTag(['zh-CN'], available), undefined)
  })
})

describe('l10n manager', () => {
  const en = {
    meta: { name: 'English', nativeName: 'English' },
    greeting: 'Hello',
    bye: 'Goodbye',
  }
  const ru = {
    meta: { name: 'Russian', nativeName: 'Русский' },
    greeting: 'Привет',
  }

  const fresh = () => {
    localization.setPlatform('win32')
    localization.setRequestedLocale(null)
    localization.setSystemLocales([])
    localization.resetUserLayers()
    localization.registerFromJson('en', en, 'builtin')
    localization.registerFromJson('ru', ru, 'builtin')
  }

  it('detects the active language from system preferences', () => {
    fresh()
    localization.setSystemLocales(['ru-RU', 'en-US'])

    assert.equal(localization.getActiveTag(), 'ru')
    assert.equal(localization.translate('greeting'), 'Привет')
  })

  it('falls back to the reference catalog for missing keys', () => {
    fresh()
    localization.setSystemLocales(['ru'])

    assert.equal(localization.translate('bye'), 'Goodbye')
    assert.equal(localization.has('bye'), true)
  })

  it('lets a user override one key and restore it', () => {
    fresh()
    localization.setRequestedLocale('ru')

    localization.setUserMessage('ru', 'bye', '', 'До свидания')
    assert.equal(localization.translate('bye'), 'До свидания')

    localization.clearUserMessage('ru', 'bye')
    assert.equal(localization.translate('bye'), 'Goodbye')
  })

  it('a user-only catalog becomes selectable', () => {
    fresh()
    localization.registerFromJson('tk', { greeting: 'Salam' }, 'user')

    assert.equal(localization.getAvailableTags().includes('tk'), true)
    localization.setRequestedLocale('tk')
    assert.equal(localization.getActiveTag(), 'tk')
    assert.equal(localization.translate('greeting'), 'Salam')
    assert.equal(localization.translate('bye'), 'Goodbye')
  })

  it('hands the catalog authors to the interface', () => {
    fresh()
    localization.registerFromJson(
      'de',
      {
        meta: { name: 'German', nativeName: 'Deutsch', authors: ['Ada'] },
        greeting: 'Hallo',
      },
      'builtin'
    )

    assert.deepEqual(localization.getLocale('de')?.authors, ['Ada'])

    // A user override that restates no metadata keeps crediting the authors of
    // the catalog it patches.
    localization.registerFromJson('de', { greeting: 'Servus' }, 'user')
    assert.deepEqual(localization.getLocale('de')?.authors, ['Ada'])
    localization.setRequestedLocale('de')
    assert.equal(localization.getActiveTag(), 'de')
    assert.equal(localization.translate('greeting'), 'Servus')
  })

  it('notifies subscribers when the language changes', () => {
    fresh()
    let notifications = 0
    const unsubscribe = localization.subscribe(() => notifications++)

    localization.setRequestedLocale('en')
    assert.ok(notifications >= 1)

    unsubscribe()
    const before = notifications
    localization.setRequestedLocale('ru')
    assert.equal(notifications, before)
  })
})
