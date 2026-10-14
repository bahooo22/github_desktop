import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'

import { formatDate } from '../../../src/lib/format-date'
import { render, screen } from '../../helpers/ui/render'
import {
  advanceTimersBy,
  enableTestTimers,
  resetTestTimers,
} from '../../helpers/ui/timers'
import { RelativeTime } from '../../../src/ui/relative-time'

const now = Date.parse('2026-03-26T12:00:00.000Z')

describe('RelativeTime', () => {
  beforeEach(() => {
    enableTestTimers(['Date', 'setTimeout'], now)
  })

  afterEach(() => {
    resetTestTimers()
  })

  it('renders recent relative text without a tooltip wrapper when disabled', () => {
    render(<RelativeTime date={new Date(now - 30 * 1000)} tooltip={false} />)

    const text = screen.getByText('just now')

    assert.equal(text.tagName, 'SPAN')
    assert.equal(text.textContent, 'just now')
  })

  it('renders recent relative text with the default tooltip-enabled path', () => {
    render(<RelativeTime date={new Date(now - 30 * 1000)} />)

    const text = screen.getByText('just now')

    assert.equal(text.textContent, 'just now')
  })

  it('updates its rendered text when the date prop changes', () => {
    const view = render(
      <RelativeTime date={new Date(now - 2 * 60 * 1000)} tooltip={false} />
    )

    assert.equal(screen.getByText('2 minutes ago').textContent, '2 minutes ago')

    view.rerender(
      <RelativeTime date={new Date(now - 2 * 60 * 60 * 1000)} tooltip={false} />
    )

    assert.equal(screen.getByText('2 hours ago').textContent, '2 hours ago')
  })

  it('refreshes once the scheduled timeout elapses', () => {
    render(<RelativeTime date={new Date(now - 44 * 1000)} tooltip={false} />)

    assert.equal(screen.getByText('just now').textContent, 'just now')

    advanceTimersBy(16 * 1000)

    assert.equal(screen.getByText('1 minute ago').textContent, '1 minute ago')
  })

  it('counts in seconds and ticks every second when countSeconds is set', () => {
    render(
      <RelativeTime
        date={new Date(now - 12 * 1000)}
        countSeconds={true}
        tooltip={false}
      />
    )

    assert.equal(
      screen.getByText('12 seconds ago').textContent,
      '12 seconds ago'
    )

    // The proof of the tick, not just of the wording: one second of fake time
    // moves the number instead of waiting out the minute.
    advanceTimersBy(1000)

    assert.equal(
      screen.getByText('13 seconds ago').textContent,
      '13 seconds ago'
    )
  })

  it('still says just now without countSeconds', () => {
    render(<RelativeTime date={new Date(now - 12 * 1000)} tooltip={false} />)

    assert.equal(screen.getByText('just now').textContent, 'just now')
  })

  it('counts up to 59 seconds when counting', () => {
    render(
      <RelativeTime
        date={new Date(now - 59 * 1000)}
        countSeconds={true}
        tooltip={false}
      />
    )

    assert.equal(
      screen.getByText('59 seconds ago').textContent,
      '59 seconds ago'
    )
  })

  it('switches to minutes at 60 seconds when counting', () => {
    render(
      <RelativeTime
        date={new Date(now - 60 * 1000)}
        countSeconds={true}
        tooltip={false}
      />
    )

    assert.equal(screen.getByText('1 minute ago').textContent, '1 minute ago')
  })

  it('keeps just now for a partial second even when counting', () => {
    render(
      <RelativeTime
        date={new Date(now - 400)}
        countSeconds={true}
        tooltip={false}
      />
    )

    assert.equal(screen.getByText('just now').textContent, 'just now')
  })

  it('renders an absolute date for older timestamps when onlyRelative is false', () => {
    const then = new Date(now - 8 * 24 * 60 * 60 * 1000)

    render(<RelativeTime date={then} onlyRelative={false} tooltip={false} />)

    const absoluteDate = formatDate(then, { date: true, time: false })

    assert.equal(screen.getByText(absoluteDate).textContent, absoluteDate)
  })
})
