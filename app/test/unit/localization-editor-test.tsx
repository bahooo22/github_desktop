import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import {
  LocalizationEditor,
  defaultTarget,
} from '../../src/ui/localization/localization-editor'
import { localization, t } from '../../src/lib/l10n'
import { readCatalogMeta } from '../../src/lib/l10n/catalog'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '../helpers/ui/render'

// The shipped catalogs are registered for every test process by the global
// test setup; merging a few unmistakable rows into them gives the editor its
// fixtures without having to fake the localization manager.
localization.registerFromJson(
  'en',
  {
    zztest: {
      plural: { _one: '{count} widget', _other: '{count} widgets' },
      plain: 'Plain llama string',
    },
  },
  'builtin'
)

// A catalog with translator credits, for the save round trip: `de` has no
// shipped catalog, so the file below stands in for one created through the
// add-a-language flow.
const deCatalog = {
  meta: {
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    authors: ['Ada'],
  },
}

// The dialog content lives in a `<dialog>` that jsdom keeps closed, so every
// role query needs `hidden: true` (as in the other dialog tests here) and the
// two toolbar fields are picked by selector instead.
const targetSelect = () =>
  document.querySelector(
    '.localization-editor-toolbar select'
  ) as HTMLSelectElement

const searchBox = () =>
  document.querySelector(
    '.localization-editor-toolbar input[type="search"]'
  ) as HTMLInputElement

const variantInputs = () =>
  [
    ...document.querySelectorAll('.translation-variant input'),
  ] as HTMLInputElement[]

const qualifierLabels = () =>
  [...document.querySelectorAll('.qualifier')].map(e => e.textContent)

const referenceTemplates = () =>
  [...document.querySelectorAll('.translation-variant .reference code')].map(
    e => e.textContent
  )

function selectTarget(tag: string) {
  fireEvent.change(targetSelect(), { target: { value: tag } })
}

function searchFor(needle: string) {
  fireEvent.change(searchBox(), { target: { value: needle } })
}

function typeInto(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

function saveCalls() {
  const calls: Array<{ tag: string; contents: unknown }> = []
  const previous = ipcRenderer.invoke

  ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
    if (channel === 'save-user-localization') {
      calls.push({ tag: args[0], contents: args[1] })
      return undefined
    }
    if (channel === 'get-localization-state') {
      return undefined
    }
    return previous.call(ipcRenderer, channel, ...args)
  }

  return {
    calls,
    restore: () => {
      ipcRenderer.invoke = previous
    },
  }
}

describe('localization editor', () => {
  let restoreSend: (() => void) | null = null
  let restoreInvoke: (() => void) | null = null

  beforeEach(() => {
    localization.resetUserLayers()
    localization.setRequestedLocale(null)

    // The dialog pings the main process when it opens; the test mock has no
    // `send`, and the editor test never asserts on it.
    const previousSend = ipcRenderer.send as any
    ipcRenderer.send = () => {}
    restoreSend = () => {
      ipcRenderer.send = previousSend
    }
  })

  afterEach(() => {
    restoreSend?.()
    restoreSend = null
    restoreInvoke?.()
    restoreInvoke = null
  })

  it('picks a target the language picker actually offers', () => {
    assert.equal(defaultTarget(['ru', 'uk'], 'uk'), 'uk')
    assert.equal(defaultTarget(['ru', 'uk'], 'en'), 'ru')
    assert.equal(defaultTarget(['uk', 'ru'], 'en'), 'uk')
    assert.equal(defaultTarget([], 'en'), undefined)
    assert.equal(defaultTarget([], 'ru'), undefined)

    const view = render(<LocalizationEditor onDismissed={() => {}} />)

    const select = targetSelect()
    const options = [...select.options]
      .map(o => o.value)
      .filter(value => value !== '__add__')

    assert.ok(!options.includes('en'), 'en must not be translatable')
    assert.notEqual(select.value, 'en')
    assert.ok(options.includes(select.value))

    view.unmount()

    localization.setRequestedLocale('uk')
    render(<LocalizationEditor onDismissed={() => {}} />)
    assert.equal(targetSelect().value, 'uk')
  })

  it('renders the plural forms the target language needs', () => {
    render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plural')

    assert.deepEqual(qualifierLabels(), ['_one', '_few', '_many', '_other'])
    assert.equal(variantInputs().length, 4)
    // The rows en does not define are shown against the `_other` reference,
    // which is the form they stand in for.
    assert.deepEqual(referenceTemplates(), [
      '{count} widget',
      '{count} widgets',
      '{count} widgets',
      '{count} widgets',
    ])
  })

  it('counts progress and filters per variant, not per key', () => {
    render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plural')

    assert.match(
      document.querySelector('.localization-editor-progress')!.textContent!,
      /Translated by me: 0 strings of/
    )

    const [first, , , fourth] = variantInputs()
    typeInto(first, '{count} виджет')
    typeInto(fourth, '{count} виджетов')

    assert.match(
      document.querySelector('.localization-editor-progress')!.textContent!,
      /Translated by me: 2 strings of/
    )

    fireEvent.click(
      screen.getByRole('radio', {
        name: t('localizationEditor.filterTranslated'),
        hidden: true,
      })
    )
    // Partially translated is not translated.
    assert.equal(screen.queryByText('zztest.plural'), null)

    fireEvent.click(
      screen.getByRole('radio', {
        name: t('localizationEditor.filterMissing'),
        hidden: true,
      })
    )
    assert.ok(screen.getByText('zztest.plural'))

    const inputs = variantInputs()
    typeInto(inputs[1], '{count} виджета')
    typeInto(inputs[2], '{count} виджетов')

    assert.match(
      document.querySelector('.localization-editor-progress')!.textContent!,
      /Translated by me: 4 strings of/
    )

    fireEvent.click(
      screen.getByRole('radio', {
        name: t('localizationEditor.filterTranslated'),
        hidden: true,
      })
    )
    assert.ok(screen.getByText('zztest.plural'))
  })

  it('refuses to leave a language with unsaved changes', async () => {
    render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plain')

    typeInto(variantInputs()[0], 'тестовый перевод строки')

    assert.ok(screen.queryByText(t('localizationEditor.unsaved')))

    selectTarget('uk')

    assert.ok(
      screen.getByText(t('localizationEditor.unsavedSwitch', { tag: 'ru' }), {
        exact: false,
      })
    )
    assert.equal(targetSelect().value, 'ru')
    assert.equal(variantInputs()[0].value, 'тестовый перевод строки')

    fireEvent.click(
      screen.getByRole('button', {
        name: t('localizationEditor.save'),
        hidden: true,
      })
    )

    await waitFor(() =>
      assert.equal(screen.queryByText(t('localizationEditor.unsaved')), null)
    )

    selectTarget('uk')
    assert.equal(targetSelect().value, 'uk')
  })

  it('finds keys by the wording of the translation itself', () => {
    render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plain')
    typeInto(variantInputs()[0], 'уникальныйпереводдляпоиска')

    searchFor('уникальныйпереводдляпоиска')

    assert.ok(screen.getByText('zztest.plain'))
  })

  it('keeps the author credits when saving through the editor', async () => {
    const { calls, restore } = saveCalls()
    restoreInvoke = restore

    localization.registerFromJson('de', deCatalog, 'user')

    // The initial target is the first translatable tag, which is `de` now
    // that the catalog above exists.
    render(<LocalizationEditor onDismissed={() => {}} />)
    assert.equal(targetSelect().value, 'de')

    searchFor('zztest.plain')
    typeInto(variantInputs()[0], 'Hallo')

    fireEvent.click(
      screen.getByRole('button', {
        name: t('localizationEditor.save'),
        hidden: true,
      })
    )

    await waitFor(() => assert.equal(calls.length, 1))

    const { tag, contents } = calls[0]
    assert.equal(tag, 'de')

    const meta = readCatalogMeta(contents)
    assert.deepEqual(meta.authors, ['Ada'])
    assert.equal(meta.name, 'German')
    assert.equal(meta.nativeName, 'Deutsch')
    assert.equal(meta.direction, 'ltr')

    const tree = contents as Record<string, Record<string, string>>
    assert.equal(tree.zztest.plain, 'Hallo')

    await waitFor(() =>
      assert.ok(screen.queryByText(t('localizationEditor.unsaved')) === null)
    )
  })

  it('surfaces catalog problems and unknown keys', () => {
    localization.registerFromJson(
      'ru',
      {
        broken: { _one: 'один', mixed: 'смесь' },
        'zztest-orphan': 'ключ не из исходного каталога',
      },
      'user'
    )

    render(<LocalizationEditor onDismissed={() => {}} />)
    selectTarget('ru')

    // Scoped to the block because the editor also lists, as translatable
    // rows, the very strings it uses to label that block.
    const block = within(
      document.querySelector('.localization-editor-problems')!
    )

    assert.ok(block.getByText(t('localizationEditor.problemsTitle')))
    assert.ok(
      block.getByText(/broken: qualifiers cannot be mixed/, { exact: false })
    )

    assert.ok(block.getByText(t('localizationEditor.unknownKeysTitle')))
    assert.ok(block.getByText('zztest-orphan'))
    assert.ok(block.getByText('broken.mixed'))
  })
})
