import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import { localization } from '../../src/lib/l10n/core'
import { Trans } from '../../src/lib/l10n/react'
import { Language } from '../../src/ui/preferences/language'
import { Dispatcher } from '../../src/ui/dispatcher'
import { render, screen } from '../helpers/ui/render'

describe('l10n Trans with a gloss', () => {
  // A transliterated language reads aloud but does not read as meaning, so
  // `meta.gloss` points at a catalog whose text for the same key is shown
  // underneath. The fixture mirrors the shipped tlh/ru pair without touching
  // their catalogs.
  //
  // The tags stay well-formed (`zzg`, `zzs`): the screen under test formats the
  // detected-language count with `Intl.NumberFormat`, and a syntactically
  // invalid tag throws there instead of falling back — the failure would say
  // nothing about the gloss.
  const setup = () => {
    localization.resetUserLayers()
    localization.registerFromJson(
      'zzg',
      {
        meta: { name: 'Glossed', gloss: 'zzs' },
        hello: 'Hoi <link>there</link>',
      },
      'builtin'
    )
    localization.registerFromJson(
      'zzs',
      { greeting: 'Привет', hello: 'Привет <link>там</link>' },
      'builtin'
    )
    localization.setRequestedLocale('zzg')
  }

  it('renders the gloss as its own span and keeps the markup intact', () => {
    setup()
    localization.setGlossMode('block')

    const link = React.createElement('b', null, 'LINK-CHILD')
    render(
      React.createElement(Trans, {
        k: 'hello',
        components: { link },
        'data-testid': 'row',
      })
    )

    const gloss = screen.getByTestId('row').querySelector('.l10n-gloss')

    assert.ok(gloss !== null, 'the gloss element is rendered')
    assert.equal(gloss?.textContent, 'Привет там')

    // The frame the translator wrote survives: the `<link>` still expands into
    // the provided element rather than into literal markup.
    assert.ok(
      screen.getByTestId('row').querySelector('b') !== null,
      'the link component still renders'
    )

    localization.setGlossMode('off')
  })

  it('renders no gloss element while the mode is off', () => {
    setup()
    localization.setGlossMode('off')

    render(
      React.createElement(Trans, {
        k: 'hello',
        components: { link: 'LINK' },
        'data-testid': 'row',
      })
    )

    assert.equal(screen.getByTestId('row').querySelector('.l10n-gloss'), null)
  })
})

describe('Language preferences and the gloss switch', () => {
  const dispatcher = {
    showPopup: () => {},
    postError: () => {},
  } as unknown as Dispatcher

  it('the checkbox appears only for catalogs that declare a gloss', () => {
    localization.setRequestedLocale('en')

    const { unmount } = render(React.createElement(Language, { dispatcher }))
    assert.equal(document.querySelector('.checkbox-component'), null)
    unmount()

    localization.registerFromJson(
      'zzg',
      { meta: { name: 'Glossed', gloss: 'zzs' }, hello: 'Hoi' },
      'builtin'
    )
    localization.setRequestedLocale('zzg')

    render(React.createElement(Language, { dispatcher }))
    assert.notEqual(document.querySelector('.checkbox-component'), null)

    localization.setRequestedLocale('en')
  })
})
