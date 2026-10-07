import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  flattenCatalog,
  readCatalogMeta,
  unflattenMessages,
} from '../../src/lib/l10n/catalog'
import { getPluralCategories } from '../../src/lib/l10n/format'

describe('plural categories', () => {
  it('answers with the qualifier keys the grammar distinguishes', () => {
    assert.deepEqual(getPluralCategories('en'), ['_one', '_other'])
    assert.deepEqual(getPluralCategories('ru'), [
      '_one',
      '_few',
      '_many',
      '_other',
    ])
    assert.deepEqual(getPluralCategories('uk'), [
      '_one',
      '_few',
      '_many',
      '_other',
    ])
    assert.deepEqual(getPluralCategories('ja'), ['_other'])
  })

  it('keeps the canonical CLDR order, not the resolvedOptions order', () => {
    // Irish declares its categories in a different order than `PluralRules`
    // happens to report them in; the editor walks this list to lay its rows
    // out and the order must not depend on the engine's mood.
    assert.deepEqual(getPluralCategories('ga'), [
      '_one',
      '_two',
      '_few',
      '_many',
      '_other',
    ])
  })

  it('survives a malformed tag instead of throwing from a render pass', () => {
    assert.deepEqual(getPluralCategories(''), ['_other'])
    assert.deepEqual(getPluralCategories('not a tag!!'), ['_other'])
  })
})

describe('catalog meta round trip', () => {
  it('writes and reads back the authors block', () => {
    const flat = flattenCatalog({
      files: { _one: '{count} fichier', _other: '{count} fichiers' },
    })

    const tree = unflattenMessages(flat, {
      name: 'French',
      nativeName: 'Français',
      direction: 'ltr',
      authors: ['Ada', 'Linus'],
    })

    assert.deepEqual(readCatalogMeta(tree), {
      name: 'French',
      nativeName: 'Français',
      direction: 'ltr',
      authors: ['Ada', 'Linus'],
    })
  })

  it('keeps messages and meta apart through unflatten', () => {
    const flat = flattenCatalog({ greeting: 'Servus' })
    const tree = unflattenMessages(flat, {
      name: 'German',
      nativeName: 'Deutsch',
      authors: ['Ada'],
    })

    assert.deepEqual(readCatalogMeta(tree).authors, ['Ada'])
    // The meta block must not become translatable content.
    assert.equal(flattenCatalog(tree).has('meta'), false)
    assert.equal(flattenCatalog(tree).get('greeting')?.get(''), 'Servus')
  })

  it('omits the authors block when the locale has none', () => {
    const flat = flattenCatalog({ greeting: 'Hola' })
    const tree = unflattenMessages(flat, {
      name: 'Spanish',
      nativeName: 'Español',
      direction: 'ltr',
    })

    assert.deepEqual(readCatalogMeta(tree), {
      name: 'Spanish',
      nativeName: 'Español',
      direction: 'ltr',
    })
  })
})
