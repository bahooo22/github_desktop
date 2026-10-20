import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import { localization } from '../../src/lib/l10n/core'
import {
  hintRuns,
  startHintStyling,
  styledRuns,
} from '../../src/lib/l10n/hint-style'
import { Trans } from '../../src/lib/l10n/react'
import { render, screen } from '../helpers/ui/render'

/**
 * The hint's runs are drawn by a `MutationObserver` over the whole document, so
 * the tests are about the two things that layer can get wrong: the words a user
 * reads after it has run (nothing may be added, lost or reordered) and the text
 * node React owns (it has to stay where React left it, and it has to give the
 * words back when the hint goes away).
 */

/** The catalog pairs with the shipped `tlh` table: `nuqneH` reads `нукнэх`. */
const setup = () => {
  localization.resetUserLayers()
  localization.registerFromJson(
    'zzg',
    { meta: { name: 'Glossed', gloss: 'zzs', translit: 'tlh' }, hi: 'nuqneH' },
    'builtin'
  )
  localization.registerFromJson('zzs', { hi: 'Привет' }, 'builtin')
  localization.setRequestedLocale('zzg')
  localization.setGlossMode('block')
}

/**
 * The observer's callback is a microtask, and a `setTimeout` turn is what lets
 * every microtask queued before it run.
 */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

/**
 * A text node of a real label, put in the document the way React would: the
 * node is created first, then it gets its string, and the observer is what
 * notices.
 */
const label = (text: string) => {
  const host = document.createElement('div')
  const node = document.createTextNode(text)
  host.appendChild(node)
  document.body.appendChild(host)
  return { host, node }
}

describe('l10n hint runs', () => {
  it('reads the composed label apart into the runs it shows', () => {
    const runs = styledRuns('nuqneH\n[нукнэх] Привет')
    assert.deepEqual(runs, [
      { text: 'nuqneH\n', className: 'l10n-original' },
      { text: '[нукнэх]', className: 'l10n-reading' },
      { text: ' Привет', className: 'l10n-meaning' },
    ])
  })

  it('leaves anything that is not a hint line alone', () => {
    // No second line at all, and a second line that is prose: a commit message
    // is the text this layer must never touch.
    assert.equal(styledRuns('nuqneH'), undefined)
    assert.equal(styledRuns('a summary\nand its description'), undefined)
    // An empty bracket holds no reading, so there is nothing to italicize and
    // no reason to believe the line is a hint.
    assert.equal(styledRuns('nuqneH\n[] Привет'), undefined)
    // Two candidate lines: only the one the composition appends last is the
    // hint, and a bracketed line above it is just text.
    assert.deepEqual(
      styledRuns('a\n[wip] b\nnuqneH\n[нукнэх] Привет')?.map(r => r.className),
      ['l10n-original', 'l10n-reading', 'l10n-meaning']
    )
  })

  it('keeps the parts it is given rather than guessing them back', () => {
    assert.deepEqual(hintRuns('нукнэх', 'Привет'), [
      { text: '[нукнэх]', className: 'l10n-reading' },
      { text: ' Привет', className: 'l10n-meaning' },
    ])
    // Either half can be the only one there is, and a gloss with no reading in
    // front of it starts the line itself — no bracket, no leading space.
    assert.deepEqual(hintRuns('нукнэх', undefined), [
      { text: '[нукнэх]', className: 'l10n-reading' },
    ])
    assert.deepEqual(hintRuns(undefined, 'Привет'), [
      { text: 'Привет', className: 'l10n-meaning' },
    ])
  })
})

describe('l10n hint styling layer', () => {
  it('draws the runs beside the node and leaves the words where they were', async () => {
    setup()
    startHintStyling()

    const text = localization.translate('hi')
    assert.equal(text, 'nuqneH\n[нукнэх] Привет')

    const { host, node } = label(text)
    await flush()

    assert.deepEqual(
      Array.from(host.querySelectorAll('span')).map(s => s.className),
      ['l10n-original', 'l10n-reading', 'l10n-meaning']
    )

    // The invariant everything else rests on: the element reads exactly as it
    // did before the layer ran, so selection, copy and find-in-page and the
    // editor's `closest('[data-l10n-key]')` text all see the same string.
    assert.equal(host.textContent, text)

    // The node React owns stays in the tree, holding nothing. `commitTextUpdate`
    // writes into this very node, and replacing it would leave React writing
    // into a detached one.
    assert.equal(host.firstChild, node)
    assert.equal(node.data, '')

    // Blank node, no runs of its own: the next turn must find the label exactly
    // as this one left it. If the layer read its own blanking as a hint that
    // went away, this is where the words would disappear from the screen.
    await flush()
    assert.equal(host.querySelectorAll('span').length, 3)
    assert.equal(host.textContent, text)
    assert.equal(node.data, '')

    localization.setGlossMode('off')
  })

  it('gives the text back when the hint is gone', async () => {
    setup()
    startHintStyling()

    const { host, node } = label(localization.translate('hi'))
    await flush()
    assert.equal(host.querySelectorAll('span').length, 3)

    // This is the write React makes when the mode turns off: the same node gets
    // the plain string. The runs have to go and the node has to hold the words
    // again — a blank node with no runs would erase the label from the screen.
    node.data = 'nuqneH'
    await flush()

    assert.equal(host.querySelectorAll('span').length, 0)
    assert.equal(host.textContent, 'nuqneH')
    assert.equal(node.data, 'nuqneH')

    localization.setGlossMode('off')
  })

  it('rebuilds the runs when the language rewrites the label', async () => {
    setup()
    startHintStyling()

    const { host, node } = label(localization.translate('hi'))
    await flush()

    localization.registerFromJson('zzs', { hi: 'Салют' }, 'user')
    const next = localization.translate('hi')
    node.data = next
    await flush()

    assert.equal(host.textContent, next)
    assert.equal(
      host.querySelector('.l10n-meaning')?.textContent,
      ' Салют',
      'the new glossary text is the one on screen'
    )
    assert.equal(host.querySelectorAll('.l10n-reading').length, 1)

    localization.resetUserLayers()
    localization.setGlossMode('off')
  })

  it('takes its runs with the node it styled', async () => {
    setup()
    startHintStyling()

    const { host, node } = label(localization.translate('hi'))
    await flush()
    assert.equal(host.querySelectorAll('span').length, 3)

    // A row that unmounts while its parent stays: React removes the text node
    // on its own, and a run left behind would keep the old hint on screen.
    host.removeChild(node)
    await flush()

    assert.equal(host.querySelectorAll('span').length, 0)
    assert.equal(host.textContent, '')

    localization.setGlossMode('off')
  })

  it('never splits a value the platform reads back', async () => {
    setup()
    startHintStyling()

    const select = document.createElement('select')
    const option = document.createElement('option')
    option.textContent = localization.translate('hi')
    select.appendChild(option)
    document.body.appendChild(select)
    await flush()

    // An element inside an `option` would not change how it looks — the label is
    // drawn by the platform — but it does change `value` and what a form
    // submits.
    assert.equal(option.querySelectorAll('span').length, 0)
    assert.equal(option.textContent, 'nuqneH\n[нукнэх] Привет')

    select.remove()
    localization.setGlossMode('off')
  })

  it('leaves a plain text with no hint exactly as it is', async () => {
    setup()
    startHintStyling()

    const { host, node } = label('Some commit summary\nand its description')
    await flush()

    assert.equal(host.querySelectorAll('span').length, 0)
    assert.equal(node.data, 'Some commit summary\nand its description')

    localization.setGlossMode('off')
  })

  // The `Trans` path already knows which half of the hint is the reading, so it
  // draws the runs itself. The observer must not run over them a second time:
  // doubled runs would read the hint twice.
  it('adds nothing to the elements `Trans` already drew', async () => {
    setup()
    startHintStyling()

    render(React.createElement(Trans, { k: 'hi', 'data-testid': 'row' }))
    await flush()

    const row = screen.getByTestId('row')

    assert.equal(row.querySelectorAll('.l10n-reading').length, 1)
    assert.equal(row.querySelectorAll('.l10n-meaning').length, 1)
    assert.equal(row.querySelector('.l10n-original')?.textContent, 'nuqneH')
    assert.equal(row.textContent, 'nuqneH[нукнэх] Привет')

    localization.setGlossMode('off')
  })
})
