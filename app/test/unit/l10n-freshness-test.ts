import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// The freshness checker is a plain .mjs CLI utility (no allowJs in tsconfig);
// script/i18n-freshness.d.mts carries its types, tsx runs the JavaScript.
import {
  collectCatalogStrings,
  compareCatalogParity,
  countUntranslatedLeaves,
  extractPlaceholders,
  extractVisibleLiteralsFromSource,
  flattenCatalogLeaves,
  innermostCallee,
  isDiagnosticCallee,
  isLegalVisibleLiteral,
  isUserFacingLiteral,
} from '../../../script/i18n-freshness.mjs'

function loadCatalog(tag: string) {
  const path = join(process.cwd(), 'app', 'locales', `${tag}.json`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

const catalogs = () =>
  ['en', 'ru', 'uk'].map(tag => ({ tag, tree: loadCatalog(tag) }))

describe('l10n freshness', () => {
  it('keeps ru and uk in key, variant and placeholder parity with en', () => {
    const { counts, issues } = compareCatalogParity(catalogs())

    assert.deepEqual(issues, [])
    assert.equal(counts.en, counts.ru)
    assert.equal(counts.en, counts.uk)
    assert.ok(counts.en > 1000)
  })

  it('only uses placeholders the interpolation layer understands', () => {
    const knownFormats = ['number', 'percent']

    for (const { tag, tree } of catalogs()) {
      for (const text of collectCatalogStrings(tree)) {
        for (const placeholder of extractPlaceholders(text)) {
          const [name, format] = placeholder.split(':')
          assert.match(
            name,
            /^[A-Za-z][A-Za-z0-9]*$/,
            `${tag}: bad placeholder name in '${text}'`
          )
          if (format !== undefined) {
            assert.ok(
              knownFormats.includes(format),
              `${tag}: unknown format '${format}' in '${text}'`
            )
          }
        }
      }
    }
  })

  it('extracts placeholders, formats and escaped braces apart', () => {
    assert.deepEqual(
      extractPlaceholders('{count:number} files by {name} at {{now}}'),
      ['count:number', 'name']
    )
  })

  it('detects visible literals in props, jsx text and assignments', () => {
    const code = [
      `const description = __DARWIN__ ? 'Current Branch' : 'Current branch'`,
      `export function C(props: any) {`,
      `  return (`,
      `    <div aria-label="branch list item">`,
      `      Choose a branch to compare`,
      `      <Footer okButtonText={props.buttonText || 'Close'} />`,
      `      <span className="panel blankslate">ignored</span>`,
      `    </div>`,
      `  )`,
      `}`,
    ].join('\n')

    const texts: Array<string> = extractVisibleLiteralsFromSource(
      code,
      'x.tsx'
    ).map((literal: { text: string }) => literal.text)

    assert.ok(texts.includes('Current Branch'))
    assert.ok(texts.includes('Current branch'))
    assert.ok(texts.includes('Choose a branch to compare'))
    assert.ok(texts.includes('Close'))
    assert.ok(!texts.includes('panel blankslate'))
    assert.ok(!texts.includes('ignored'))
  })

  it('keeps menu mnemonics on the platform that uses them', () => {
    const reference = {
      menu: {
        file: { '@darwin': 'File', '@other': '&File' },
        view: { '@darwin': 'View', '@other': '&View' },
        // Same words, only macOS Title Case: a translation may collapse this.
        help: { '@darwin': 'Show Help', '@other': 'Show help' },
      },
    }

    const broken = compareCatalogParity([
      { tag: 'en', tree: reference },
      {
        tag: 'xx',
        tree: {
          menu: {
            // Collapsed split: the `&` now reaches macOS as a literal, and the
            // @darwin variant carries one.
            file: '&Файл',
            view: { '@darwin': '&Вид', '@other': 'Вид' },
            help: {
              '@darwin': 'Показать &Справку',
              '@other': 'Показать справку',
            },
          },
        },
      },
    ])

    assert.ok(
      broken.issues.some(issue => issue.includes('macOS renders it literally')),
      `expected a darwin mnemonic finding in ${JSON.stringify(broken.issues)}`
    )
    assert.ok(
      broken.issues.some(issue => issue.includes('lost the menu mnemonic')),
      `expected a lost mnemonic finding in ${JSON.stringify(broken.issues)}`
    )

    const legal = compareCatalogParity([
      { tag: 'en', tree: reference },
      {
        tag: 'yy',
        tree: {
          menu: {
            file: { '@darwin': 'Файл', '@other': '&Файл' },
            view: { '@darwin': 'Вид', '@other': '&Вид' },
            help: 'Показать справку',
          },
        },
      },
    ])
    assert.deepEqual(legal.issues, [])
  })

  it('tells log and throw text apart from interface text', () => {
    assert.equal(
      innermostCallee(`    log.warn(`),
      'log.warn',
      'the callee of an open logger call must be found'
    )
    assert.equal(
      innermostCallee(`  throw new Error(`),
      'throw new Error',
      'an exception constructor must be found'
    )
    assert.equal(
      innermostCallee(`  const label = 'Current branch`),
      '',
      'a line with no open call has no callee'
    )
    assert.equal(
      innermostCallee(`log.info('Already logged up')`),
      '',
      'a balanced call must not leak into the next line'
    )
    assert.equal(
      innermostCallee(`  // the user's own catalog\n  console.error(`),
      'console.error',
      'an apostrophe in a comment must not open a string'
    )

    assert.equal(isDiagnosticCallee('log.warn'), true)
    assert.equal(isDiagnosticCallee('console.error'), true)
    assert.equal(isDiagnosticCallee('throw new Error'), true)
    assert.equal(isDiagnosticCallee('new TypeError'), true)
    assert.equal(isDiagnosticCallee('showPopup'), false)
    assert.equal(isDiagnosticCallee('showErrorDialog'), false)
    assert.equal(isDiagnosticCallee(''), false)
  })

  it('treats product names and technical strings as legal', () => {
    assert.equal(isLegalVisibleLiteral('GitHub Desktop'), true)
    assert.equal(isLegalVisibleLiteral('https://github.com/login'), true)
    assert.equal(isLegalVisibleLiteral('branch-list-item'), true)
    assert.equal(isLegalVisibleLiteral('selectedRepository'), true)
    assert.equal(isLegalVisibleLiteral('Publish this branch to GitHub'), false)

    assert.equal(isUserFacingLiteral('Git'), false)
    assert.equal(isUserFacingLiteral('Save'), true)
    assert.equal(isUserFacingLiteral('^a[0-9]$'), false)
  })
})

// The counter decides when a language counts as finished. A variant record used
// to be compared with `===`, which never matches two records, so every plural
// and platform row stayed out of the count and a catalog of pure English copies
// could read as translated.
describe('untranslated counter', () => {
  it('counts a variant record form by form', () => {
    const en = flattenCatalogLeaves({
      commits: { _one: 'commit', _other: 'commits' },
    })
    const target = flattenCatalogLeaves({
      commits: { _one: 'коммит', _other: 'commits' },
    })

    assert.deepEqual(countUntranslatedLeaves(en, target), {
      untranslated: 1,
      compared: 2,
      unmatched: 0,
    })
  })

  it('judges a form English does not have by the English text of the key', () => {
    const en = flattenCatalogLeaves({ files: 'files' })
    const target = flattenCatalogLeaves({
      files: { _one: 'files', _other: 'ghantoH' },
    })

    assert.deepEqual(countUntranslatedLeaves(en, target), {
      untranslated: 1,
      compared: 2,
      unmatched: 0,
    })
  })

  it('falls back to the English general form for a form English lacks', () => {
    // Russian carries four forms where English has two, so `_few` and `_many`
    // have no English row of their own. Measured on `ru`: without this fallback
    // the counter compares 1 806 forms instead of 1 902, and 210 forms instead
    // of 114 fall out of the count entirely.
    const en = flattenCatalogLeaves({
      commits: { _one: 'commit', _other: 'commits' },
    })
    const target = flattenCatalogLeaves({
      commits: { _one: 'коммит', _few: 'commits', _many: 'коммитов' },
    })

    assert.deepEqual(countUntranslatedLeaves(en, target), {
      untranslated: 1,
      compared: 3,
      unmatched: 0,
    })
  })

  it('leaves a form with no English original out of the count', () => {
    const en = flattenCatalogLeaves({ modified: 'modified' })
    const target = flattenCatalogLeaves({
      modified: 'modified',
      'copilot.ai-credits-per-tokens': { _few: 'tokenów' },
    })

    assert.deepEqual(countUntranslatedLeaves(en, target), {
      untranslated: 1,
      compared: 1,
      unmatched: 1,
    })
  })
})
