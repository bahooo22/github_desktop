import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as React from 'react'
import { ipcRenderer } from 'electron'

import {
  buildEditorTranslationIssueUrl,
  LocalizationEditor,
} from '../../src/ui/localization/localization-editor'
import { localization, t } from '../../src/lib/l10n'
import { TranslationIssueLabel } from '../../src/ui/localization/translation-issue'
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
    const url = buildEditorTranslationIssueUrl({
      target: 'ru',
      key: 'zztest.plain',
      filter: 'missing',
      search: '  llama  ',
    })

    const params = issueParams(url)
    assert.equal(
      params.get('title'),
      t('localizationEditor.reportIssueTitle', { tag: 'ru' })
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
    const url = buildEditorTranslationIssueUrl({
      target: 'uk',
      filter: 'all',
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

    view.unmount()
  })

  it('names the string once a search narrows the list down to it', () => {
    const view = render(<LocalizationEditor onDismissed={() => {}} />)

    fireEvent.change(searchBox(), { target: { value: 'zztest.plain' } })

    const body = issueParams(reportLink().getAttribute('href')!).get('body')!
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
