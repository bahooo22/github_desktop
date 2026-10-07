import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import { LocalizationEditor } from '../../src/ui/localization/localization-editor'
import {
  buildFeedbackIssueUrl,
  TranslationIssueLabel,
} from '../../src/ui/localization/translation-issue'
import { localization, t } from '../../src/lib/l10n'
import { getVersion } from '../../src/ui/lib/app-proxy'
import { fireEvent, render } from '../helpers/ui/render'

// Same unmistakable fixture the editor's own tests use: one searchable row is
// what lets a search narrow the list down to a single key.
localization.registerFromJson(
  'en',
  { zztest: { plain: 'Plain llama string' } },
  'builtin'
)

const reportLink = () =>
  document.querySelector(
    'a.localization-editor-report-issue'
  ) as HTMLAnchorElement

const searchBox = () =>
  document.querySelector(
    '.localization-editor-toolbar input[type="search"]'
  ) as HTMLInputElement

function issueParams(url: string): URLSearchParams {
  const parsed = new URL(url)
  assert.equal(
    `${parsed.origin}${parsed.pathname}`,
    'https://github.com/bahooo22/github_desktop/issues/new'
  )
  return parsed.searchParams
}

/** The catalog line for `messageKey`, without its interpolated value. */
function linePrefix(messageKey: string, param: string): string {
  return t(messageKey, { [param]: 'zz-sentinel-value' }).replace(
    'zz-sentinel-value',
    ''
  )
}

describe('localization editor - translation issue report', () => {
  let restoreIpcSend: (() => void) | null = null

  beforeEach(() => {
    localization.resetUserLayers()
    localization.setRequestedLocale(null)

    const previousSend = ipcRenderer.send as any
    ipcRenderer.send = () => {}
    restoreIpcSend = () => {
      ipcRenderer.send = previousSend
    }
  })

  afterEach(() => {
    restoreIpcSend?.()
    restoreIpcSend = null
  })

  it('carries language, key, filter, search and build into the body', () => {
    const url = buildFeedbackIssueUrl({
      target: 'ru',
      key: 'zztest.plain',
      filter: 'missing',
      search: '  llama  ',
    })

    const params = issueParams(url)
    assert.equal(
      params.get('title'),
      t('localizationEditor.reportIssueTitleKey', { key: 'zztest.plain' })
    )
    // The tracker's label name, not a translatable string — see
    // TranslationIssueLabel.
    assert.equal(params.get('labels'), TranslationIssueLabel)

    const body = params.get('body')!
    assert.ok(
      body.includes(t('localizationEditor.reportIssueLanguage', { tag: 'ru' }))
    )
    assert.ok(
      body.includes(
        t('localizationEditor.reportIssueKey', { key: 'zztest.plain' })
      )
    )
    assert.ok(
      body.includes(
        t('localizationEditor.reportIssueFilter', {
          filter: t('localizationEditor.filterMissing'),
        })
      )
    )
    assert.ok(
      body.includes(
        t('localizationEditor.reportIssueSearch', { search: 'llama' })
      )
    )
    assert.ok(
      body.includes(
        t('localizationEditor.reportIssueBuild', {
          version: getVersion(),
          sha: __SHA__.substring(0, 10),
        })
      )
    )
  })

  it('leaves out the lines that describe nothing', () => {
    const url = buildFeedbackIssueUrl({
      target: 'uk',
      search: '',
    })

    const body = issueParams(url).get('body')!
    assert.ok(
      !body.includes(linePrefix('localizationEditor.reportIssueKey', 'key'))
    )
    assert.ok(
      !body.includes(
        linePrefix('localizationEditor.reportIssueSearch', 'search')
      )
    )
    assert.ok(
      !body.includes(
        linePrefix('localizationEditor.reportIssueFilter', 'filter')
      )
    )
  })

  it('fills in the screen, the wording and the original instead of asking', () => {
    const url = buildFeedbackIssueUrl({
      target: 'ru',
      key: 'zztest.plain',
      search: '',
    })

    const body = issueParams(url).get('body')!
    const blocks = body.split('\n\n')

    // Membership alone would pass for any permutation of the blocks, and the
    // template is a reading order, not a list of fields.
    const headings = [
      'reportIssueScreen',
      'reportIssueCurrent',
      'reportIssueReference',
      'reportIssueSuggested',
      'reportIssueWhy',
      'reportIssueContext',
      'reportIssueOtherLanguage',
    ]

    let previous = -1
    for (const key of headings) {
      const at = blocks.findIndex(block =>
        block.startsWith(t(`localizationEditor.${key}`))
      )
      assert.ok(
        at > previous,
        `${key} has to come after ${
          headings[headings.indexOf(key) - 1]
        } (found ${at} after ${previous})`
      )
      previous = at
    }

    // The heading and its quote are one block, not two.
    const current = blocks.find(block =>
      block.startsWith(t('localizationEditor.reportIssueCurrent'))
    )!
    assert.equal(
      current.split('\n')[1],
      `> ${t('localizationEditor.reportIssueUntranslated')}`
    )

    // The en template is what the translator is being asked about, so the
    // report quotes it rather than describing it.
    assert.ok(body.includes('Plain llama string'))

    // The build facts come before the string key, the way the template lists
    // them: language, build, key.
    const context = blocks.find(block =>
      block.startsWith(t('localizationEditor.reportIssueContext'))
    )!
    assert.ok(
      context.indexOf(
        t('localizationEditor.reportIssueBuild', {
          version: getVersion(),
          sha: __SHA__.substring(0, 10),
        })
      ) <
        context.indexOf(
          t('localizationEditor.reportIssueKey', {
            key: 'zztest.plain',
          })
        )
    )
  })

  it('keeps an empty shipped form out of the quote', () => {
    // A catalog can carry a form whose value is still empty; quoting it would
    // put a line with nothing after the colon into the report.
    localization.registerFromJson(
      'zzform',
      { zztest: { plain: { _one: '', _other: '' } } },
      'builtin'
    )

    const body = issueParams(
      buildFeedbackIssueUrl({
        target: 'zzform',
        key: 'zztest.plain',
        search: '',
      })
    ).get('body')!

    assert.ok(!body.includes('> _one:'), 'an empty form is not quoted')
    assert.ok(
      body.includes(t('localizationEditor.reportIssueUntranslated')),
      'the report says the string is not translated instead'
    )
  })

  it('quotes the translated forms, naming them when there is more than one', () => {
    localization.setUserMessage('ru', 'zztest.plain', '', 'Одна сойка')

    const single = issueParams(
      buildFeedbackIssueUrl({
        target: 'ru',
        key: 'zztest.plain',
        search: '',
      })
    )
      .get('body')!
      .split('\n')

    assert.ok(single.includes('> Одна сойка'))
    assert.ok(
      !single.some(line => line.startsWith('> :')),
      'a lone form is not given a name'
    )

    localization.setUserMessage('ru', 'zztest.plain', 'plural:_one', 'одна')
    localization.setUserMessage('ru', 'zztest.plain', 'plural:_other', 'много')

    const plural = issueParams(
      buildFeedbackIssueUrl({
        target: 'ru',
        key: 'zztest.plain',
        search: '',
      })
    )
      .get('body')!
      .split('\n')

    assert.ok(plural.includes('> _one: одна'))
    assert.ok(plural.includes('> _other: много'))
  })

  it('offers the action even when no single string is in view', () => {
    const view = render(<LocalizationEditor onDismissed={() => {}} />)

    const link = reportLink()
    assert.ok(link !== null)

    const params = issueParams(link.getAttribute('href')!)
    assert.equal(
      params.get('title'),
      t('localizationEditor.reportIssueTitle', { tag: 'ru' })
    )
    assert.ok(
      !params
        .get('body')!
        .includes(linePrefix('localizationEditor.reportIssueKey', 'key'))
    )
    // The editor shows everything here, which is not a filter worth reporting:
    // the mapping of `all` to "no filter" lives in the editor, so this is where
    // a regression would surface.
    assert.ok(
      !params
        .get('body')!
        .includes(linePrefix('localizationEditor.reportIssueFilter', 'filter')),
      'showing every string is not reported as a filter'
    )

    // The footer is a row of buttons; the report link is what wraps onto the
    // line under them, so it has to be the last thing in there.
    const footer = link.parentElement
    assert.ok(footer !== null)
    assert.equal(footer.lastElementChild, link)
    assert.ok(
      footer.querySelectorAll('button').length >= 2,
      'the buttons stay in front of the link'
    )

    view.unmount()
  })

  it('names the string once a search narrows the list down to it', () => {
    const view = render(<LocalizationEditor onDismissed={() => {}} />)

    fireEvent.change(searchBox(), { target: { value: 'zztest.plain' } })

    const href = reportLink().getAttribute('href')!
    const params = issueParams(href)
    assert.equal(
      params.get('title'),
      t('localizationEditor.reportIssueTitleKey', { key: 'zztest.plain' })
    )

    const body = params.get('body')!
    assert.ok(
      body.includes(
        t('localizationEditor.reportIssueKey', { key: 'zztest.plain' })
      )
    )
    assert.ok(
      body.includes(
        t('localizationEditor.reportIssueSearch', { search: 'zztest.plain' })
      )
    )

    view.unmount()
  })
})
