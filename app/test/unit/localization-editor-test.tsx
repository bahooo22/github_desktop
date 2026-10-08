import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import {
  LocalizationEditor,
  defaultTarget,
} from '../../src/ui/localization/localization-editor'
import {
  armPickMode,
  disarmPickMode,
  isPickModeArmed,
} from '../../src/ui/localization/pick-mode'
import { Dispatcher } from '../../src/ui/dispatcher'
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

// The example comes from the language being edited, and from the language on
// screen while the target has no row yet, so the fixture needs a Russian side
// too; the shipped ru catalog has never seen the keys above.
localization.registerFromJson(
  'ru',
  {
    zztest: {
      plural: { _one: '{count} виджет', _other: '{count} виджетов' },
      plain: 'Обычная строка ламы',
    },
  },
  'builtin'
)

// Two `Trans` rows, present in both catalogs: markup is the one thing the two
// previews of the example disagree about, because only one of them can be
// copied out of the window.
localization.registerFromJson(
  'en',
  {
    zzmarkup: {
      link: 'Check out the <link>beta channel</link>',
      time: 'Committed <time/>',
      checked: 'last checked <time /> ago',
    },
  },
  'builtin'
)

localization.registerFromJson(
  'ru',
  {
    zzmarkup: {
      link: 'Ознакомьтесь с <link>бета-каналом</link>',
      time: 'Отправлено <time/>',
      checked: 'проверено <time /> назад',
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

const placeholders = () => variantInputs().map(input => input.placeholder)

// One entry per rendered variant: the example's wording, or `undefined` where
// the row has no example line at all. Which rows have none is as much a part of
// the behaviour as what the others show.
const exampleVariants = () =>
  [...document.querySelectorAll('.translation-variant')].map(
    variant => variant.querySelector('.example code')?.textContent
  )

// The editor only ever needs `showPopup`, and which popup it asks for is the
// app's business, tested through the real tree rather than a fake dispatcher.
const fakeDispatcher = {
  showPopup: () => {},
} as unknown as Dispatcher

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

  it('falls back to the language on screen while the target has no form yet', () => {
    localization.setRequestedLocale('ru')

    render(<LocalizationEditor onDismissed={() => {}} />)
    selectTarget('uk')
    searchFor('zztest.plain')

    // Ukrainian has no `zztest` row to offer, so the hint is Russian (the
    // language being read) while the line above stays the English source the
    // `{count}`s and `&`s come from.
    assert.deepEqual(placeholders(), ['Обычная строка ламы'])
    assert.deepEqual(exampleVariants(), ['Обычная строка ламы'])
    assert.deepEqual(referenceTemplates(), ['Plain llama string'])
    assert.equal(
      document.querySelector('.translation-variant .example .caption')!
        .textContent,
      t('localizationEditor.exampleCaption')
    )
  })

  it('shows the target language its own wording when that language is edited', () => {
    localization.setRequestedLocale('ru')

    render(<LocalizationEditor onDismissed={() => {}} />)
    selectTarget('ru')
    searchFor('zztest.plain')

    // The case the interface language used to answer for: editing Russian
    // shows the Russian form of the row, not its English original, and the
    // original keeps its place on the reference line above.
    assert.deepEqual(placeholders(), ['Обычная строка ламы'])
    assert.deepEqual(exampleVariants(), ['Обычная строка ламы'])
    assert.deepEqual(referenceTemplates(), ['Plain llama string'])
  })

  it('offers the target forms it has and the original for the forms it lacks', () => {
    // Russian answers for `_one` and `_other`; the two plural forms it has no
    // equivalent for fall through to the language on screen, and `de` carries
    // only `_other` there, so those rows are left with the English original.
    localization.registerFromJson(
      'de',
      { zztest: { plural: { _other: '{count} Widgets' } } },
      'user'
    )
    localization.setRequestedLocale('de')

    render(<LocalizationEditor onDismissed={() => {}} />)
    selectTarget('ru')
    searchFor('zztest.plural')

    assert.deepEqual(qualifierLabels(), ['_one', '_few', '_many', '_other'])
    assert.deepEqual(placeholders(), [
      '{count} виджет',
      '{count} widgets',
      '{count} widgets',
      '{count} виджетов',
    ])
    assert.deepEqual(exampleVariants(), [
      '{count} виджет',
      undefined,
      undefined,
      '{count} виджетов',
    ])
  })

  it('has no examples at all while the interface is English', () => {
    localization.setRequestedLocale('en')

    render(<LocalizationEditor onDismissed={() => {}} />)
    selectTarget('uk')
    searchFor('zztest')

    // Both fixture keys at once: an English interface is the original itself,
    // and a target catalog with no row of its own has nothing to add either.
    assert.equal(variantInputs().length, 5)
    assert.deepEqual(placeholders(), referenceTemplates())
    assert.deepEqual(exampleVariants(), [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it('keeps markup out of the ghost text and inside the copyable example', () => {
    localization.setRequestedLocale('en')

    render(<LocalizationEditor onDismissed={() => {}} />)
    selectTarget('ru')
    searchFor('zzmarkup')

    // The example line is the row a translator copies, so it stays paste-ready
    // with the `<link>` wrapper. The placeholder only reads out the sentence,
    // and the `<time/>` it stands for is an element, not text, so it goes
    // along with the space before it.
    assert.deepEqual(referenceTemplates(), [
      'last checked <time /> ago',
      'Check out the <link>beta channel</link>',
      'Committed <time/>',
    ])
    assert.deepEqual(exampleVariants(), [
      'проверено <time /> назад',
      'Ознакомьтесь с <link>бета-каналом</link>',
      'Отправлено <time/>',
    ])
    assert.deepEqual(placeholders(), [
      'проверено назад',
      'Ознакомьтесь с бета-каналом',
      'Отправлено',
    ])
  })

  it('counts progress and filters per variant, not per key', () => {
    render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plural')

    assert.match(
      document.querySelector('.localization-editor-progress')!.textContent!,
      /Translated by me: 0 of [\d,]+ translation forms/
    )

    const [first, , , fourth] = variantInputs()
    typeInto(first, '{count} виджет')
    typeInto(fourth, '{count} виджетов')

    assert.match(
      document.querySelector('.localization-editor-progress')!.textContent!,
      /Translated by me: 2 of [\d,]+ translation forms/
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
      /Translated by me: 4 of [\d,]+ translation forms/
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

  it('offers to save an edit again after the dialog was reopened', async () => {
    const view = render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plain')
    typeInto(variantInputs()[0], 'несохранённыйперевод')

    // Point-and-translate closes the dialog so the interface can be clicked
    // into, and comes back as a new instance: the edit is still only in memory,
    // so the new one has to know there is something to save.
    view.unmount()
    render(<LocalizationEditor onDismissed={() => {}} />)

    selectTarget('ru')
    searchFor('zztest.plain')

    assert.ok(screen.queryByText(t('localizationEditor.unsaved')))
    assert.equal(variantInputs()[0].value, 'несохранённыйперевод')

    fireEvent.click(
      screen.getByRole('button', {
        name: t('localizationEditor.save'),
        hidden: true,
      })
    )

    // The reopened dialog really can write: the flag it acted on came from the
    // store, not from anything this instance remembered.
    await waitFor(() =>
      assert.equal(screen.queryByText(t('localizationEditor.unsaved')), null)
    )
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

  it('opens a picked string on its own row with the empty form focused', () => {
    // jsdom has no layout, so scrolling can only be stubbed, not asserted.
    const scrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = () => {}

    try {
      render(
        <LocalizationEditor onDismissed={() => {}} initialKey="zztest.plain" />
      )

      const rows = [
        ...document.querySelectorAll('.translation-row .translation-key'),
      ]
      assert.deepEqual(
        rows.map(row => row.textContent),
        ['zztest.plain'],
        'the picked row should be the only one on screen'
      )
      assert.equal(searchBox().value, 'zztest.plain')
      assert.equal(document.activeElement, variantInputs()[0])
    } finally {
      Element.prototype.scrollIntoView = scrollIntoView
    }
  })

  it('offers the pick only where the editor can be reopened', () => {
    render(<LocalizationEditor onDismissed={() => {}} />)

    // Without a dispatcher the pick could only close the dialog for good, so
    // the button that does it is left out rather than shown broken.
    assert.equal(
      screen.queryByRole('button', {
        name: t('localizationEditor.pick'),
        hidden: true,
      }),
      null
    )

    render(
      <LocalizationEditor onDismissed={() => {}} dispatcher={fakeDispatcher} />
    )

    assert.ok(
      screen.getByRole('button', {
        name: t('localizationEditor.pick'),
        hidden: true,
      })
    )
  })
})

describe('pick mode', () => {
  afterEach(() => {
    disarmPickMode()
    document.body.innerHTML = ''
  })

  function pickedNode(key: string): HTMLElement {
    const span = document.createElement('span')
    span.setAttribute('data-l10n-key', key)
    span.textContent = 'hello'

    const wrapper = document.createElement('div')
    wrapper.appendChild(span)
    document.body.appendChild(wrapper)

    return span
  }

  function dispatchClick(target: HTMLElement): MouseEvent {
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(click)
    return click
  }

  it('picks the key off the closest ancestor and leaves nothing behind', () => {
    const span = pickedNode('zztest.plain')
    const picked: Array<string> = []

    armPickMode(
      key => picked.push(key),
      () => {}
    )

    assert.ok(document.body.classList.contains('l10n-pick-mode'))

    // The app must not see the pick: a listener that would catch the click
    // while it bubbles out of the labelled element stays silent.
    let reachedTheApp = false
    const appListener = () => (reachedTheApp = true)
    document.body.addEventListener('click', appListener)

    const click = dispatchClick(span)

    document.body.removeEventListener('click', appListener)

    assert.deepEqual(picked, ['zztest.plain'])
    assert.equal(click.defaultPrevented, true)
    assert.equal(reachedTheApp, false, 'the app must not see the pick click')
    assert.equal(isPickModeArmed(), false)
    assert.ok(!document.body.classList.contains('l10n-pick-mode'))

    // After the pick the page behaves normally again: clicks travel and are
    // not prevented, so a missed hover cannot disable the interface.
    const afterwards = dispatchClick(span)
    assert.equal(afterwards.defaultPrevented, false)
    assert.deepEqual(picked, ['zztest.plain'])
  })

  it('falls back to the visible words when no key is on the element', () => {
    const label = document.createElement('span')
    label.textContent = 'Fetch   origin'
    const wrapper = document.createElement('div')
    wrapper.appendChild(label)
    document.body.appendChild(wrapper)

    const picked: Array<string> = []
    armPickMode(
      query => picked.push(query),
      () => {}
    )

    // The editor searches by text too, so the collapsed words are a usable
    // query even though nothing in the DOM names the catalog entry.
    dispatchClick(label)
    assert.deepEqual(picked, ['Fetch origin'])
    assert.equal(isPickModeArmed(), false)
  })

  it('leaves a click on a paragraph unreported and the mode armed', () => {
    const paragraph = document.createElement('p')
    paragraph.textContent = `word `.repeat(20)

    const picked: Array<string> = []
    armPickMode(
      query => picked.push(query),
      () => {}
    )

    dispatchClick(paragraph)
    assert.deepEqual(picked, [])
    assert.equal(
      isPickModeArmed(),
      true,
      'a pick that found nothing must stay armed'
    )

    disarmPickMode()
  })

  it('highlights the row under the cursor while armed', () => {
    const span = pickedNode('app.title')
    armPickMode(
      () => {},
      () => {}
    )

    fireEvent.mouseOver(span)
    assert.ok(span.classList.contains('l10n-pick-target'))

    fireEvent.mouseOut(span)
    assert.ok(!span.classList.contains('l10n-pick-target'))

    disarmPickMode()
  })

  it('re-arming swaps the session instead of stacking a second one', () => {
    const span = pickedNode('changes.show-changes')
    const first: Array<string> = []
    const second: Array<string> = []

    armPickMode(
      key => first.push(key),
      () => {}
    )
    armPickMode(
      key => second.push(key),
      () => {}
    )

    dispatchClick(span)

    // Stacked listeners would deliver the same click to both sessions.
    assert.deepEqual(first, [])
    assert.deepEqual(second, ['changes.show-changes'])
    assert.equal(isPickModeArmed(), false)

    // And one click must not fire the callback twice through leftover
    // listeners from the replaced session.
    dispatchClick(span)
    assert.deepEqual(second, ['changes.show-changes'])
  })

  it('Escape cancels the pick and tears everything down', () => {
    let cancelled = 0
    armPickMode(
      () => assert.fail('a cancelled pick must not report a string'),
      () => cancelled++
    )

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(escape)

    // The editor was closed to make the interface clickable, so the cancel
    // callback is the only thing that gives it back.
    assert.equal(cancelled, 1)
    assert.equal(isPickModeArmed(), false)
    assert.ok(!document.body.classList.contains('l10n-pick-mode'))

    const click = dispatchClick(pickedNode('zztest.plain'))
    assert.equal(click.defaultPrevented, false)
  })
})
