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
    const base = flattenCatalog({
      a: {
        b: 'keep',
        c: 'replace',
        d: { _one: 'base one', _other: 'base other' },
      },
    })
    const overlay = new Map([
      ['a.c', message([['', 'replaced']])],
      ['a.d', message([['plural:_one', 'overlay one']])],
    ])
    const merged = mergeMessages(base, overlay)

    assert.equal(merged.get('a.b')?.get(''), 'keep')
    assert.equal(merged.get('a.c')?.get(''), 'replaced')
    assert.equal(merged.get('a.d')?.get('plural:_one'), 'overlay one')
  })

  it('merges an overlay form by form, not message by message', () => {
    const base = flattenCatalog({
      files: {
        _one: '{count} файл',
        _few: '{count} файла',
        _many: '{count} файлов',
        _other: '{count} файла',
      },
    })
    const overlay = new Map([
      ['files', message([['plural:_one', '{count} файл-ка']])],
    ])

    const merged = mergeMessages(base, overlay)
    const files = merged.get('files')!

    assert.equal(files.get('plural:_one'), '{count} файл-ка')

    // The forms the override says nothing about stay shipped: dropping them
    // would leave the plural categories to whatever variant happens to be
    // ordered first in the message.
    assert.equal(files.get('plural:_few'), '{count} файла')
    assert.equal(files.get('plural:_many'), '{count} файлов')
    assert.equal(files.get('plural:_other'), '{count} файла')
  })

  it('keeps the built-in plural forms under a plain-form override', () => {
    const base = flattenCatalog({
      files: { _one: 'один', _few: 'мало', _many: 'много', _other: 'прочее' },
    })
    const overlay = new Map([['files', message([['', 'своя строка']])]])

    const merged = mergeMessages(base, overlay)

    // A key `en` spells without plurals still counts: the shipped forms of the
    // language win over a plain override, so the wording agrees with the number.
    assert.equal(
      selectVariant(merged.get('files')!, 'ru', { count: 5 }, 'win32'),
      'много'
    )
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

  it('falls back to the singular text for a plural category nothing has', () => {
    const m = message([
      ['plural:_few', '{count} файла'],
      ['plural:_one', '{count} файл'],
    ])

    // The forms are stored in the order the translator typed them in, so the
    // answer has to come from the grammar and not from whichever entry the
    // message happens to lead with.
    assert.equal(selectVariant(m, 'ru', { count: 5 }, 'win32'), '{count} файл')
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

    // Writing an empty value is the revert: the variant goes, and so does the
    // key once nothing is left in it.
    localization.setUserMessage('ru', 'bye', '', '')
    assert.equal(localization.translate('bye'), 'Goodbye')
  })

  it('counts an edit that was typed back out as saved', () => {
    fresh()
    assert.deepEqual(localization.getUnsavedTags(), [])

    localization.setUserMessage('ru', 'bye', '', 'До свидания')
    assert.equal(localization.hasUnsavedMessages('ru'), true)
    assert.equal(localization.hasUnsavedMessages('de'), false)
    assert.deepEqual(localization.getUnsavedTags(), ['ru'])

    // This language has no user file at all, so erasing the wording again makes
    // the layer match the disk exactly — and there is nothing left to save. The
    // editor has to say so, because a warning that survives its own undo is a
    // warning the user cannot get rid of.
    localization.setUserMessage('ru', 'bye', '', '')
    assert.equal(localization.hasUnsavedMessages('ru'), false)
    assert.deepEqual(localization.getUnsavedTags(), [])
  })

  it('measures unsaved against what the file already says', () => {
    fresh()
    localization.registerFromJson('ru', { bye: 'Прощайте' }, 'user')

    assert.equal(localization.hasUserFile('ru'), true)
    assert.equal(localization.hasUnsavedMessages('ru'), false)

    localization.setUserMessage('ru', 'bye', '', 'До свидания')
    assert.equal(localization.hasUnsavedMessages('ru'), true)

    // Back to the wording the file holds is clean again, and the file is still
    // there, so there remains something to delete.
    localization.setUserMessage('ru', 'bye', '', 'Прощайте')
    assert.equal(localization.hasUnsavedMessages('ru'), false)
    assert.equal(localization.hasUserFile('ru'), true)

    // Erasing what the file itself contains is a change of its own: only a save
    // or a reload settles it.
    localization.setUserMessage('ru', 'bye', '', '')
    assert.equal(localization.hasUnsavedMessages('ru'), true)
  })

  it('clears every unsaved language when the user layers are reloaded', () => {
    fresh()

    localization.setUserMessage('de', 'bye', '', 'Auf Wiedersehen')
    assert.deepEqual(localization.getUnsavedTags(), ['de'])

    // What a save leaves behind is a memory that matches the files, which is
    // how the editor gets there: reload the user layers from disk.
    localization.resetUserLayers()
    assert.deepEqual(localization.getUnsavedTags(), [])

    localization.setUserMessage('de', 'bye', '', 'Auf Wiedersehen')
    assert.deepEqual(localization.getUnsavedTags(), ['de'])
    localization.forgetUserLayer('de')
    assert.deepEqual(localization.getUnsavedTags(), [])
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

  it('reads readiness from the file and reports nothing for a catalog without it', () => {
    fresh()

    // A catalog written before readiness existed says nothing about it, and
    // that is not the same as declaring an empty list: the editor migrates the
    // first and honors the second.
    assert.equal(localization.getReadyKeys('ru'), undefined)

    localization.registerFromJson(
      'de',
      {
        meta: { name: 'German', nativeName: 'Deutsch', ready: ['bye'] },
        greeting: 'Hallo',
      },
      'user'
    )

    assert.deepEqual([...localization.getReadyKeys('de')!], ['bye'])
    assert.equal(localization.hasUnsavedMessages('de'), false)
  })

  it('counts a readiness flag as a change of its own', () => {
    fresh()
    localization.registerFromJson('ru', { greeting: 'Привет' }, 'user')

    assert.equal(localization.hasUnsavedMessages('ru'), false)

    localization.setKeyReady('ru', 'greeting', true)
    assert.equal(localization.hasUnsavedMessages('ru'), true)
    assert.deepEqual(localization.getUnsavedTags(), ['ru'])

    // Marking and unmarking did not return the file to what it says: the file
    // declares no readiness at all, so writing the section is a save of its own.
    localization.setKeyReady('ru', 'greeting', false)
    assert.deepEqual([...localization.getReadyKeys('ru')!], [])
    assert.equal(localization.hasUnsavedMessages('ru'), true)
  })

  it('keeps the user layer after the last readiness flag goes', () => {
    fresh()
    localization.registerFromJson(
      'de',
      { meta: { ready: ['bye'] }, greeting: 'Hallo' },
      'user'
    )

    localization.setKeyReady('de', 'bye', false)

    // An empty list still has to reach the disk: if dropping the last flag made
    // the language look untouched, the save button would go away with it.
    assert.equal(localization.hasUserFile('de'), true)
    assert.equal(localization.hasUnsavedMessages('de'), true)
    assert.deepEqual(localization.getUnsavedTags(), ['de'])
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
