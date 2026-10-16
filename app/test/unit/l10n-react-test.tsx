import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as React from 'react'

import { localization } from '../../src/lib/l10n/core'
import { Trans, LocalizationProvider } from '../../src/lib/l10n/react'
import { getStoredGlossForm, setGlossForm } from '../../src/lib/l10n'
import { Language } from '../../src/ui/preferences/language'
import { Dispatcher } from '../../src/ui/dispatcher'
import { render, fireEvent, screen } from '../helpers/ui/render'
import {
  advanceTimersBy,
  enableTestTimers,
  resetTestTimers,
} from '../helpers/ui/timers'

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

describe('l10n tooltip hint', () => {
  // A catalog that carries both a reading and a meaning: the popup has to show
  // two separate lines and the label has to show neither of them.
  const setup = () => {
    localization.resetUserLayers()
    localization.registerFromJson(
      'zzg',
      {
        meta: { name: 'Glossed', gloss: 'zzs', translit: 'tlh' },
        hi: 'nuqneH',
        // A label that carries its own link, the way `about.l10nCredit` and
        // `welcome.termsAndPrivacy` do — the focusable element sits inside the
        // hint target rather than around it.
        hiLink: 'nuqneH <link>tlhIngan Hol</link>',
      },
      'builtin'
    )
    localization.registerFromJson(
      'zzs',
      { hi: 'Привет', hiLink: 'Привет <link>там</link>' },
      'builtin'
    )
    localization.setRequestedLocale('zzg')
  }

  it('leaves the label clean and hands the parts to a popup', () => {
    setup()
    localization.setGlossMode('tooltip')

    render(React.createElement(Trans, { k: 'hi', 'data-testid': 'row' }))

    const row = screen.getByTestId('row')
    const hint = row.querySelector('.l10n-hint')

    assert.ok(hint !== null, 'the popup target is rendered')
    assert.equal(row.querySelector('.l10n-gloss'), null, 'no second line')
    assert.equal(row.textContent, 'nuqneH')

    // Nothing is on screen until the pointer or the keyboard asks for it.
    assert.equal(document.querySelector('.tooltip'), null)

    // The editor picks a string by walking up from the element under the cursor
    // to the nearest key, and that key stays on the `Trans` wrapper while the
    // text itself moved inside the target.
    assert.equal(
      hint?.closest('[data-l10n-key]')?.getAttribute('data-l10n-key'),
      'hi'
    )

    localization.setGlossMode('off')
  })

  it('opens on the focus of the button around it and closes on Escape', () => {
    setup()
    localization.setGlossMode('tooltip')
    enableTestTimers(['setTimeout'])

    render(
      React.createElement(
        'button',
        null,
        React.createElement(Trans, { k: 'hi' })
      )
    )

    const button = document.querySelector('button')
    assert.ok(button !== null, 'the button wrapper is there')

    // A `span` inside a button is never the focused element, and jsdom answers
    // `:focus-visible` with `false` even on a focused button (measured 15.10).
    // `openOnFocus` cannot help here either: it listens on the target, and the
    // button is above it, so the popup is opened through `ancestorFocused`.
    fireEvent.focus(button)
    advanceTimersBy(400)

    const tooltip = document.querySelector('.tooltip')
    assert.ok(tooltip !== null, 'the popup opened on the ancestor focus')

    const lines = tooltip?.querySelectorAll('.tooltip-content > div')
    assert.equal(lines?.length, 2, 'one element per part')
    assert.equal(lines?.[0]?.textContent, 'нукнэх')
    assert.equal(lines?.[1]?.textContent, 'Привет')

    fireEvent.keyDown(document, { key: 'Escape' })
    assert.equal(document.querySelector('.tooltip'), null, 'Escape dismisses')

    resetTestTimers()
    localization.setGlossMode('off')
  })

  // The other half of the keyboard: a translated line that owns its links
  // (`about.l10nCredit`, `welcome.termsAndPrivacy`) puts the focusable element
  // inside the hint target, and those are the screens reachable without a
  // repository.
  it('opens when a link inside the label takes focus', () => {
    setup()
    localization.setGlossMode('tooltip')
    enableTestTimers(['setTimeout'])

    render(
      React.createElement(Trans, {
        k: 'hiLink',
        components: { link: React.createElement('a', { href: '#' }) },
        'data-testid': 'row',
      })
    )

    const link = screen.getByTestId('row').querySelector('a')
    assert.ok(link !== null, 'the label carries its own link')
    assert.equal(document.querySelector('.tooltip'), null)

    // The real focusing path, not a synthetic event: `focus` stays on the anchor
    // while `focusin` bubbles to the target, and the upstream `openOnFocus`
    // handler is the only thing that turns it into a popup.
    link.focus()
    assert.equal(document.activeElement, link, 'the anchor really took focus')
    advanceTimersBy(400)

    const lines = document.querySelectorAll('.tooltip .tooltip-content > div')
    assert.equal(lines.length, 2, 'the popup opened on the inner focus')
    assert.equal(lines[1].textContent, 'Привет там')

    link.blur()
    advanceTimersBy(500)
    assert.equal(
      document.querySelector('.tooltip'),
      null,
      'losing the focus hides it'
    )

    resetTestTimers()
    localization.setGlossMode('off')
  })

  it('keeps the pre-line body class for the block form only', () => {
    setup()

    localization.setGlossMode('block')
    const { unmount } = render(
      React.createElement(
        LocalizationProvider,
        null,
        React.createElement(Trans, { k: 'hi' })
      )
    )
    assert.ok(
      document.body.classList.contains('gloss-enabled'),
      'the block form needs the second line'
    )
    unmount()

    // The rule that turns a newline into a second line belongs to `block`. On a
    // popup it would wrap the label the popup was meant to keep on one line.
    localization.setGlossMode('tooltip')
    render(
      React.createElement(
        LocalizationProvider,
        null,
        React.createElement(Trans, { k: 'hi' })
      )
    )
    assert.equal(
      document.body.classList.contains('gloss-enabled'),
      false,
      'the tooltip form gets no pre-line'
    )

    localization.setGlossMode('off')
  })

  // The hint listens to its focusable ancestor, and a row that scrolls out of
  // the list unmounts while that button stays in the DOM. Listeners left behind
  // would keep the dead component's `setState` reachable from a live button.
  it('takes the focus listeners off the ancestor when it unmounts', () => {
    setup()
    localization.setGlossMode('tooltip')

    // The realm matters: `EventTarget` in this global is Node's, while the
    // elements the renderer builds inherit `addEventListener` from the jsdom
    // chain, so the patch walks up from a real node to the object that owns it.
    let proto: object | null = Object.getPrototypeOf(document.body)
    while (
      proto !== null &&
      !Object.prototype.hasOwnProperty.call(proto, 'addEventListener')
    ) {
      proto = Object.getPrototypeOf(proto)
    }
    assert.ok(proto !== null, 'a prototype owning addEventListener')

    const holder = proto as {
      addEventListener: HTMLButtonElement['addEventListener']
      removeEventListener: HTMLButtonElement['removeEventListener']
    }
    const originalAdd = holder.addEventListener
    const originalRemove = holder.removeEventListener
    const added: Array<[EventTarget, string]> = []
    const removed: Array<[EventTarget, string]> = []

    holder.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) {
      added.push([this, type])
      return originalAdd.call(this, type, listener, options)
    }

    holder.removeEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) {
      removed.push([this, type])
      return originalRemove.call(this, type, listener, options)
    }

    const { unmount } = render(
      React.createElement(
        'button',
        null,
        React.createElement(Trans, { k: 'hi' })
      )
    )
    const button = document.querySelector('button')
    unmount()

    holder.addEventListener = originalAdd
    holder.removeEventListener = originalRemove

    const onButton = (log: Array<[EventTarget, string]>) =>
      log.filter(
        ([node, type]) =>
          node === button && (type === 'focus' || type === 'blur')
      ).length

    assert.ok(onButton(added) > 0, 'the ancestor was listened to')
    assert.equal(
      onButton(removed),
      onButton(added),
      'every focus listener is taken off'
    )

    localization.setGlossMode('off')
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

  it('switching the hint on applies the form picked in the select', () => {
    localization.resetUserLayers()
    localization.registerFromJson(
      'zzg',
      { meta: { name: 'Glossed', gloss: 'zzs' }, hello: 'Hoi' },
      'builtin'
    )
    localization.setRequestedLocale('zzg')
    localization.setGlossMode('off')

    render(React.createElement(Language, { dispatcher }))

    const select = document.querySelector('.language-actions select')
    const checkbox = document.querySelector('.checkbox-component input')
    assert.ok(select !== null, 'the form select sits next to the checkbox')
    assert.ok(checkbox !== null, 'the checkbox is still there')

    fireEvent.change(select, { target: { value: 'tooltip' } })
    assert.equal(
      localization.getGlossMode(),
      'off',
      'picking a form does not switch the hint on'
    )

    fireEvent.click(checkbox)
    assert.equal(
      localization.getGlossMode(),
      'tooltip',
      'the checkbox applies the stored form, not a hard-coded one'
    )

    // Turning the hint off and back on is the case the separate key exists for.
    fireEvent.click(checkbox)
    assert.equal(getStoredGlossForm(), 'tooltip')
    fireEvent.click(checkbox)
    assert.equal(localization.getGlossMode(), 'tooltip')

    fireEvent.click(checkbox)
    localization.setRequestedLocale('en')
    setGlossForm('block')
  })

  it('reshapes a hint that is already on', () => {
    localization.setGlossMode('block')

    setGlossForm('tooltip')
    assert.equal(localization.getGlossMode(), 'tooltip')
    assert.equal(localStorage.getItem('localization-gloss'), 'tooltip')

    // The mode the checkbox was last left in is what an off hint keeps, so a
    // form change has nothing to reshape there.
    localization.setGlossMode('off')
    setGlossForm('block')
    assert.equal(localization.getGlossMode(), 'off')
    assert.equal(getStoredGlossForm(), 'block')
  })
})
