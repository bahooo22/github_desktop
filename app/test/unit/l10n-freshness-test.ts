import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// The freshness checker is a plain .mjs CLI utility (no allowJs in tsconfig);
// script/i18n-freshness.d.mts carries its types, tsx runs the JavaScript.
import {
  changelogNoteKeys,
  collectCatalogStrings,
  compareCatalogParity,
  countUntranslatedLeaves,
  extractPlaceholders,
  extractVisibleLiteralsFromSource,
  flattenCatalogLeaves,
  hasIgnoreAnnotation,
  ignoresWholeFile,
  innermostCallee,
  isDiagnosticCallee,
  isLegalVisibleLiteral,
  isPathBuildingCallee,
  isUserFacingLiteral,
  keysRequestedFromSource,
  keysRequestedInSource,
  keysRequestedInSources,
  requestedKeysMissingFromCatalog,
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
      `      <Checkbox label="Clear repository account assignments" />`,
      `      <span className="panel blankslate">ignored</span>`,
      `    </div>`,
      `  )`,
      `}`,
      `const item: any = { label: 'Repository Settings', action: () => {} }`,
    ].join('\n')

    const texts: Array<string> = extractVisibleLiteralsFromSource(
      code,
      'x.tsx'
    ).map((literal: { text: string }) => literal.text)

    assert.ok(texts.includes('Current Branch'))
    assert.ok(texts.includes('Current branch'))
    assert.ok(texts.includes('Choose a branch to compare'))
    assert.ok(texts.includes('Close'))
    // Литерал может быть инициализатором сам, без фигурных скобок: тогда у
    // него нет детей, и обход, начатый от детей, его пропускал.
    assert.ok(texts.includes('Clear repository account assignments'))
    assert.ok(texts.includes('Repository Settings'))
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

  it('compares the markup tags a leaf declares', () => {
    const reference = {
      commitMessage: {
        'no-write-access':
          'You do not have write access to <strong>{name}</strong>. <link>Create a fork</link>.',
        'rule-failures-title': '<rules>One or more rules</rules> failed',
      },
    }

    const broken = compareCatalogParity([
      { tag: 'en', tree: reference },
      {
        tag: 'xx',
        tree: {
          commitMessage: {
            // Потеря <strong> не видна ни по ключам, ни по плейсхолдерам:
            // имя репозитория просто перестаёт быть выделенным.
            'no-write-access':
              'Нет доступа на запись к {name}. <link>Создать форк</link>.',
            'rule-failures-title': '<rules>Одно или несколько правил</rules>',
          },
        },
      },
    ])

    assert.deepEqual(
      broken.issues.filter(issue => issue.includes('markup differs')),
      [
        'xx: commitMessage.no-write-access markup differs (link,strong vs link)',
      ],
      `expected exactly the lost <strong> in ${JSON.stringify(broken.issues)}`
    )

    // Разное число форм одного и того же листа — не потеря разметки: `ru`, `uk`
    // и `qya` имеют один, два или три ряда чисел там, где `en` имеет два.
    const legal = compareCatalogParity([
      { tag: 'en', tree: reference },
      {
        tag: 'yy',
        tree: {
          commitMessage: {
            'no-write-access':
              'Нет доступа на запись к <strong>{name}</strong>. <link>Создать форк</link>.',
            'rule-failures-title': '<rules>Одно или несколько правил</rules>',
          },
        },
      },
    ])
    assert.deepEqual(legal.issues, [])

    const pluralForms = compareCatalogParity([
      {
        tag: 'en',
        tree: {
          rules: {
            count: {
              _one: '<strong>{count}</strong> rule',
              _other: '<strong>{count}</strong> rules',
            },
          },
        },
      },
      {
        tag: 'zz',
        tree: {
          rules: {
            count: {
              _one: '<strong>{count}</strong> правило',
              _few: '<strong>{count}</strong> правила',
              _many: '<strong>{count}</strong> правил',
              _other: '<strong>{count}</strong> правила',
            },
          },
        },
      },
    ])
    assert.deepEqual(pluralForms.issues, [])
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

    // The main process helper takes the level as its first argument, so the
    // callee is a bare `log` and the dotted pattern does not see it.
    assert.equal(innermostCallee(`      log('error', `), 'log')
    assert.equal(isDiagnosticCallee('log'), true)

    // `join(home, 'Library', 'Application Support', appName)` is a directory
    // name: asking to localize it would move the support folder.
    assert.equal(innermostCallee(`    return join(home, 'Library', `), 'join')
    assert.equal(isPathBuildingCallee('join'), true)
    assert.equal(isPathBuildingCallee('path.resolve'), true)
    assert.equal(isPathBuildingCallee('showPopup'), false)
  })

  it('excuses machine-read text from the audit', () => {
    // The helpers of fatal-error.ts throw their message, so the text ends up
    // in a stack trace; the assertion is what keeps it out of the audit.
    assert.equal(isDiagnosticCallee('assertNever'), true)
    assert.equal(isDiagnosticCallee('assertNonNullable'), true)
    assert.equal(isDiagnosticCallee('fatalError'), true)
    assert.equal(isDiagnosticCallee('forceUnwrap'), true)

    const textsOf = (callee: string) =>
      extractVisibleLiteralsFromSource(
        [
          `export function render(props: any) {`,
          `  const text = props.done`,
          `    ? 'Committing changes'`,
          `    : ${callee}(props.status, 'Unknown hook status: ' + props.status)`,
          `  return <div title={'Push ' + props.remote}>{text}</div>`,
          `}`,
        ].join('\n'),
        'x.tsx'
      ).map((literal: { text: string }) => literal.text)

    // normalizePhrase drops the trailing space, so compare with the text the
    // measure really produces: an expectation carrying the raw literal would
    // pass even if nothing was excluded.
    const sorted = (texts: ReadonlyArray<string>) => [...texts].sort()
    assert.deepEqual(sorted(textsOf('showPopup')), [
      'Committing changes',
      'Push',
      'Unknown hook status:',
    ])
    assert.deepEqual(sorted(textsOf('assertNever')), [
      'Committing changes',
      'Push',
    ])
    assert.deepEqual(sorted(textsOf('fatalError')), [
      'Committing changes',
      'Push',
    ])

    // An `l10n-ignore` annotation is written above the statement, while the
    // template it excuses can sit several lines lower; the window is six.
    const lines = [
      `// l10n-ignore: git parses this payload`,
      `const hunkText = hunk.lines`,
      `  .map(`,
      `    line =>`,
      `      line.noTrailingNewLine`,
      `        ? '\\\\ No newline at end of file'`,
      `        : ''`,
      `  )`,
    ]
    assert.equal(hasIgnoreAnnotation(lines, 6), true)
    assert.equal(hasIgnoreAnnotation(lines, 7), true)
    assert.equal(hasIgnoreAnnotation(lines, 12), false)

    const annotated = lines.join('\n')
    const plain = lines.slice(1).join('\n')
    const marked = extractVisibleLiteralsFromSource(annotated, 'x.tsx').map(
      (literal: { text: string }) => literal.text
    )
    const unmarked = extractVisibleLiteralsFromSource(plain, 'x.tsx').map(
      (literal: { text: string }) => literal.text
    )
    assert.ok(
      unmarked.includes('\\ No newline at end of file'),
      'without the annotation the marker stays a finding'
    )
    assert.ok(
      !marked.includes('\\ No newline at end of file'),
      'the annotation must excuse the machine marker'
    )
  })

  it('excuses a whole file whose head declares the directive', () => {
    const code = [
      `// l10n-ignore-file: only reachable behind a development flag`,
      `export const labels = ['Install', 'Uninstall']`,
    ].join('\n')
    assert.equal(ignoresWholeFile(code), true)
    assert.equal(
      ignoresWholeFile(code.split('\n').slice(1).join('\n')),
      false,
      'without the directive the same file stays in the audit'
    )
    assert.equal(
      ignoresWholeFile(`${'const x = 1\n'.repeat(10)}${code}`),
      false,
      'a directive below the head of the file is not a directive'
    )
    // The directive says nothing about a neighbouring literal: the line
    // annotation must not pick it up, or one comment would excuse a whole list.
    assert.equal(hasIgnoreAnnotation(code.split('\n'), 2), false)

    for (const path of [
      'app/src/main-process/menu/build-test-menu.ts',
      'app/src/ui/lib/test-ui-components/test-ui-components.ts',
    ]) {
      assert.ok(
        ignoresWholeFile(readFileSync(join(process.cwd(), path), 'utf8')),
        `${path} declares itself test-only`
      )
    }
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

// Seven catalogs can agree with each other and still be missing an entry,
// because the source asks for it and en never had it: turning an upstream
// literal into `t()` without adding the key puts the key itself on the button,
// since that is what the runtime returns for an unknown request. The loose
// git-grep list cannot be used here - it reads prose like `Not a key.` as a
// request, which would blame the catalog for 145 strings that ask for nothing.
describe('keys the source asks for', () => {
  // Walking app/src with the TypeScript parser costs about three seconds, and
  // both cases below need the same result.
  const requested = keysRequestedInSources()

  it('counts only t() and Trans k= as requests', () => {
    const code = [
      "t('a.b')",
      "t('c.d', { count: 1 })",
      'const el = <Trans k="e.f" params={{ x }} />',
      't(`menu.${id}`)',
      "const prose = 'Not a key.'",
      "showError('git.pull.failed')",
      't(name)',
    ].join('\n')

    const { exact, prefixes } = keysRequestedFromSource(code, 'probe.tsx')

    assert.deepEqual([...exact.keys()], ['a.b', 'c.d', 'e.f'])
    assert.deepEqual([...prefixes.keys()], ['menu.'])
  })

  it('has nothing to report on the shipped catalog', () => {
    assert.deepEqual(
      requestedKeysMissingFromCatalog(loadCatalog('en'), requested),
      []
    )
  })

  it('names the call site whose leaf is taken out of the catalog', () => {
    const catalog = loadCatalog('en')
    const leaves = flattenCatalogLeaves(catalog)
    const victim = [...requested.exact].find(([key]) => leaves.has(key))
    assert.ok(victim !== undefined, 'no request resolves to a real leaf')

    const [key, where] = victim
    const path = key.split('.')
    let node: Record<string, unknown> = catalog
    for (const segment of path.slice(0, -1)) {
      node = node[segment] as Record<string, unknown>
    }
    delete node[path[path.length - 1]]

    assert.deepEqual(requestedKeysMissingFromCatalog(catalog, requested), [
      `${where}: ${key}`,
    ])
  })

  // `--upstream` reads the other direction off the loose grep pass, and that
  // pass cannot see a key the source only quotes through data:
  // `fork-changelog.ts` resolves `t(note.key)` for every note of the fork.
  it('keeps every release note of the fork requested', () => {
    const notes = changelogNoteKeys()
    assert.ok(notes.length > 0, 'changelog-fork.json has no notes')

    const requested = keysRequestedInSource()
    assert.ok(requested !== null, 'git grep failed')

    for (const key of notes) {
      assert.ok(requested.exact.has(key), `${key} counted as dead`)
    }

    // Without this the assertions above would also pass on a measure that
    // treats every key as requested.
    assert.equal(requested.exact.has('releaseNotes.fork.noSuchRelease'), false)
  })
})
