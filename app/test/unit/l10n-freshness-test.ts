import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// The freshness checker is a plain .mjs CLI utility (no allowJs in tsconfig);
// script/i18n-freshness.d.mts carries its types, tsx runs the JavaScript.
import {
  collectCatalogStrings,
  compareCatalogParity,
  extractPlaceholders,
  extractVisibleLiteralsFromSource,
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
