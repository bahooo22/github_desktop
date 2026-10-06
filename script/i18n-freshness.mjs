#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

// tsx loads this file through its CJS interop from the unit test, where
// import.meta.dirname can come out undefined, so locate the repository root
// by walking up from whatever anchor is available.
function findProjectRoot() {
  const candidates = []
  if (import.meta.dirname) {
    candidates.push(import.meta.dirname)
  }
  if (
    typeof import.meta.url === 'string' &&
    import.meta.url.startsWith('file:')
  ) {
    candidates.push(dirname(fileURLToPath(import.meta.url)))
  }
  candidates.push(process.cwd())

  for (const start of candidates) {
    let current = start
    for (let depth = 0; depth < 5; depth++) {
      if (existsSync(join(current, 'app', 'locales', 'en.json'))) {
        return current
      }
      current = resolve(current, '..')
    }
  }
  return process.cwd()
}

const projectRoot = findProjectRoot()
const sourcesDir = join(projectRoot, 'app', 'src')
const localesDir = join(projectRoot, 'app', 'locales')

// ---------------------------------------------------------------------------
// Editable exception lists.
//
// A visible literal is "legal" (i.e. it does not need localization) when it
// is only made of product/service names, or when it does not look like a
// phrase a user would read. Tweak these lists instead of the logic below.
// ---------------------------------------------------------------------------

/** Proper nouns that stay untranslated; longest entries are stripped first. */
export const PRODUCT_NAMES = [
  'GitHub Desktop',
  'GitHub Enterprise Server',
  'GitHub Enterprise',
  'Visual Studio Code',
  'Visual Studio',
  'Android Studio',
  'Windows Terminal',
  'Sublime Text',
  'Git LFS',
  'Git Bash',
  'GitHub',
  'GitLab',
  'Bitbucket',
  'Azure DevOps',
  'SharePoint',
  'OneDrive',
  'PowerShell',
  'PowerPoint',
  'macOS',
  'Windows',
  'Linux',
  'Electron',
  'Node.js',
  'JetBrains',
  'IntelliJ',
  'Rider',
  'PyCharm',
  'WebStorm',
  'RubyMine',
  'PHPStorm',
  'NetBeans',
  'Eclipse',
  'Markdown',
  'Copilot',
  'VS Code',
  'VSCode',
  'Xcode',
  'Neovim',
  'MacVim',
  'BBEdit',
  'TextMate',
  'Sourcetree',
  'GitKraken',
  'Tower',
  'Courier',
  'Atom',
  'Vim',
  'Emacs',
  'Nvim',
  'Shell',
  'Bash',
  'Zsh',
  'Fish',
  'Cmd',
  'npm',
  'npx',
  'yarn',
  'Homebrew',
  'WSL2',
  'WSL',
  'SSH',
  'HTTPS',
  'HTTP',
  'UTF-8',
  'NTFS',
  'JSON',
  'JavaScript',
  'TypeScript',
  'HTML',
  'CSS',
  'Git',
]

/**
 * Context names that mark a string as user facing: JSX attribute names,
 * variable names, object property names and dialog function names.
 * Compared after lowercasing and stripping dashes, so `aria-label` and
 * `ariaLabel` both hit `arialabel`.
 */
export const VISIBLE_NAMES = new Set([
  'title',
  'label',
  'description',
  'tooltip',
  'placeholder',
  'text',
  'buttontext',
  'okbuttontext',
  'cancelbuttontext',
  'submitbuttontext',
  'arialabel',
  'alt',
  'confirmmessage',
  'message',
  'detail',
])

/** CamelCase compounds ending in one of these (okButtonText) are visible too. */
export const VISIBLE_SUFFIXES = [
  'title',
  'label',
  'description',
  'tooltip',
  'placeholder',
  'text',
  'message',
]

/** Calls whose string arguments are shown in a dialog. */
export const DIALOG_CALL_PATTERN =
  /^(show|display|confirm)(?:.*?)(Error|Warning|Dialog|MessageBox|Message)$/i

/** Strings matching any of these are technical, not user facing. */
export const TECHNICAL_PATTERNS = [
  /^[a-z][a-z0-9+.-]*:\/\//i, // URLs (https://, file://, ssh://)
  /^[a-z][a-zA-Z0-9]*$/, // single camelCase identifier
  /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/, // dot/kebab/snake key or css class
  /^[A-Z][A-Z0-9_]*$/, // SCREAMING_SNAKE and acronyms (OK, PR, URL)
  /^[A-Za-z0-9_-]+\.[a-zA-Z]{1,5}$/, // file names and extensions
  /^[.#][a-z0-9-]+$/, // css selectors
  /^[/\\~.][/\\]/, // filesystem paths
  /^[^A-Za-z]+$/, // no letters at all (punctuation, digits, braces)
  /^</, // html/xml fragments
  /[\\](?:d|w|s|b|B|D|W|S)[+*{]?/, // regex escape payloads
  /^\^.*\$?$|.*\$[?!]?$/, // regular expressions anchored with ^ or $
  /^#[0-9a-f]{3,8}$/i, // hex colors
  /^\{\{?[A-Za-z0-9_:.-]+\}?$/, // a lone placeholder token
  /^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/, // PascalCase identifier
  /^\$?\{[^}]*\}$/, // bare template interpolation
]

// ---------------------------------------------------------------------------
// Pure helpers, exported for the unit test.
// ---------------------------------------------------------------------------

export function normalizePhrase(text) {
  return text.replace(/\s+/g, ' ').trim()
}

export function extractPlaceholders(text) {
  const stripped = String(text).replace(/\{\{|\}\}/g, '')
  const names = new Set()
  for (const match of stripped.matchAll(/\{([^{}]+)\}/g)) {
    names.add(match[1])
  }
  return [...names]
}

export function isVisibleContextName(rawName) {
  const cased = rawName.replace(/-/g, '')
  if (VISIBLE_NAMES.has(cased.toLowerCase())) {
    return true
  }
  return VISIBLE_SUFFIXES.some(suffix => {
    const index = cased.length - suffix.length
    return (
      index > 0 &&
      cased[index] === suffix[0].toUpperCase() &&
      cased.slice(index).toLowerCase() === suffix
    )
  })
}

/** True when the text is a proper noun mash-up or looks non-user-facing. */
export function isLegalVisibleLiteral(text) {
  const trimmed = text.trim()
  if (trimmed === '') {
    return true
  }
  if (TECHNICAL_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true
  }

  // Only made of product names and punctuation: 'GitHub Desktop', 'Git'.
  let residue = trimmed
  for (const product of [...PRODUCT_NAMES].sort(
    (a, b) => b.length - a.length
  )) {
    residue = residue.split(product).join(' ')
  }
  return /^[^A-Za-z0-9]*$/.test(residue)
}

/** Should this literal be treated as visible UI text? */
export function isUserFacingLiteral(text) {
  const trimmed = normalizePhrase(text)
  if (trimmed === '' || isLegalVisibleLiteral(trimmed)) {
    return false
  }
  // A phrase: more than one word, or a capitalized single word ('Cancel').
  return /\s/.test(trimmed) || /^[A-Z]/.test(trimmed)
}

function templateToText(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  // Rebuild `Fetch ${remote}` as 'Fetch {remote}' so it can be matched
  // against en.json placeholders; complex expressions keep their shape.
  // When an interpolation slot calls t() the template is already localized.
  let text = node.head.text
  for (const span of node.templateSpans) {
    const expr = span.expression
    const name = ts.isIdentifier(expr)
      ? expr.text
      : expr.getText().replace(/\s+/g, ' ')
    if (/(^|[^A-Za-z0-9_$.])t\(/.test(name)) {
      return null
    }
    text += `{${name}}` + span.literal.text
  }
  return text
}

function collectStringLiterals(node, out) {
  const visit = current => {
    if (
      ts.isTemplateExpression(current) ||
      ts.isNoSubstitutionTemplateLiteral(current)
    ) {
      const text = templateToText(current)
      if (text !== null) {
        out.push(text)
      }
      return
    }
    if (ts.isStringLiteralLike(current)) {
      out.push(current.text)
    }
    current.forEachChild(visit)
  }
  node.forEachChild(visit)
  return out
}

/**
 * Extracts visible English literals from one source file: JSX text, string
 * literals inside visible props/variables/properties (including nested in
 * ternaries and `x || 'Close'` fallbacks) and dialog call arguments.
 */
export function extractVisibleLiteralsFromSource(code, fileName) {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    kind
  )

  const found = []
  const push = (text, pos, kind) => {
    const normalized = normalizePhrase(text)
    if (isUserFacingLiteral(normalized)) {
      found.push({
        line: sourceFile.getLineAndCharacterOfPosition(pos).line + 1,
        text: normalized,
        kind,
      })
    }
  }

  const collectFrom = node => {
    const literals = []
    collectStringLiterals(node, literals)
    for (const literal of literals) {
      push(literal, node.getStart(sourceFile), 'code')
    }
  }

  const visit = current => {
    if (ts.isJsxText(current)) {
      // JSX children are fragments of a Trans/element, matched loosely later.
      push(current.text, current.getStart(sourceFile), 'jsx')
    } else if (ts.isJsxAttribute(current)) {
      if (
        isVisibleContextName(current.name.getText(sourceFile)) &&
        current.initializer
      ) {
        collectFrom(current.initializer)
      }
    } else if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      isVisibleContextName(current.name.text) &&
      current.initializer
    ) {
      collectFrom(current.initializer)
    } else if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(current.left) &&
      isVisibleContextName(current.left.text)
    ) {
      collectFrom(current.right)
    } else if (
      ts.isPropertyAssignment(current) &&
      isVisibleContextName(current.name.getText(sourceFile))
    ) {
      collectFrom(current.initializer)
    } else if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      DIALOG_CALL_PATTERN.test(current.expression.text)
    ) {
      for (const arg of current.arguments) {
        collectFrom(arg)
      }
    }
    current.forEachChild(visit)
  }
  sourceFile.forEachChild(visit)

  const seen = new Set()
  return found.filter(({ line, text }) => {
    const key = `${line}:${text}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/** Walks a catalog JSON tree: dotted leaf key -> string or variant record. */
export function flattenCatalogLeaves(catalog) {
  const leaves = new Map()

  const walk = (node, prefix) => {
    if (typeof node === 'string') {
      leaves.set(prefix, node)
      return
    }
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      return
    }
    const entries = Object.entries(node)
    const isVariant =
      entries.length > 0 &&
      entries.every(([key]) => key.startsWith('@') || key.startsWith('_'))

    if (isVariant) {
      leaves.set(prefix, Object.fromEntries(entries))
      return
    }
    for (const [key, value] of entries) {
      walk(value, prefix === '' ? key : `${prefix}.${key}`)
    }
  }

  for (const [key, value] of Object.entries(catalog)) {
    // The meta block (name, nativeName, authors) is per language by design.
    if (key === 'meta') {
      continue
    }
    walk(value, key)
  }
  return leaves
}

/** Every string a catalog can render, whitespace normalized. */
export function collectCatalogStrings(catalog) {
  const strings = new Set()
  for (const leaf of flattenCatalogLeaves(catalog).values()) {
    if (typeof leaf === 'string') {
      strings.add(normalizePhrase(leaf))
    } else {
      for (const variant of Object.values(leaf)) {
        strings.add(normalizePhrase(variant))
      }
    }
  }
  return strings
}

function variantKeys(leaf) {
  return typeof leaf === 'string' ? [] : Object.keys(leaf)
}

const KNOWN_PLURAL_KEYS = ['_zero', '_one', '_two', '_few', '_many', '_other']

const isPluralKey = key => key.startsWith('_')
const isPlatformKey = key => key.startsWith('@')
const leafTexts = leaf =>
  typeof leaf === 'string' ? [leaf] : Object.values(leaf)

/**
 * Leaf shape comparison with en as the reference:
 * - Plural (`_one`/`_other`): a translation must cover every category en
 *   defines and may add the ones its own grammar needs (ru/uk require
 *   `_few`/`_many`), but only from the CLDR set.
 * - en plain -> translation plural: allowed, same grammatical reason.
 * - Platform (`@darwin`/`@other`): the key sets must match, unless the
 *   translation collapses a split whose English variants say the same thing -
 *   they usually differ only in Title Case, which ru/uk do not distinguish.
 * - A collapse is a bug as soon as a menu mnemonic is involved, see
 *   `mnemonicIssues`.
 */
function compareVariantShapes(base, other) {
  const baseKeys = variantKeys(base)
  const otherKeys = variantKeys(other)
  const summary = `(${baseKeys.join(',') || 'plain'}) vs (${
    otherKeys.join(',') || 'plain'
  })`

  if (baseKeys.length === 0) {
    return otherKeys.every(isPluralKey) ? null : summary
  }

  if (baseKeys.every(isPluralKey)) {
    const covers = baseKeys.every(key => otherKeys.includes(key))
    const valid = otherKeys.every(
      key => isPluralKey(key) && KNOWN_PLURAL_KEYS.includes(key)
    )
    return covers && valid ? null : summary
  }

  if (baseKeys.every(isPlatformKey)) {
    if (otherKeys.join() === baseKeys.join()) {
      return null
    }
    const collapsed = otherKeys.length === 0 || otherKeys.every(isPluralKey)
    const mnemonicFree = !leafTexts(base).some(text => text.includes('&'))
    return collapsed && mnemonicFree ? null : summary
  }

  return summary
}

/**
 * Menu mnemonics are asymmetric: `&` underlines a letter on Windows/Linux and
 * renders as a literal ampersand on macOS. So a `&` may only sit in the
 * non-darwin variants, and upstream's mnemonic must not vanish from the
 * translated `@other`, or the localized build loses its Alt shortcuts.
 */
function mnemonicIssues(key, tag, base, other) {
  const found = []
  const variants = leaf =>
    typeof leaf === 'string' ? [['', leaf]] : Object.entries(leaf)

  if (typeof other === 'string') {
    if (
      other.includes('&') &&
      typeof base === 'string' &&
      !base.includes('&')
    ) {
      found.push(
        `${tag}: ${key} adds a '&' en does not have (macOS renders it)`
      )
    }
  } else {
    for (const [variant, text] of Object.entries(other)) {
      if (variant === '@darwin' && text.includes('&')) {
        found.push(
          `${tag}: ${key} keeps '&' in @darwin (macOS renders it literally)`
        )
      }
    }
  }

  const hasMnemonic = leaf =>
    variants(leaf).some(
      ([variant, text]) =>
        variant !== '@darwin' && variant !== '' && text.includes('&')
    )
  if (hasMnemonic(base) && !hasMnemonic(other)) {
    found.push(`${tag}: ${key} lost the menu mnemonic from @other`)
  }

  return found
}

function leafPlaceholders(leaf) {
  const names = new Set()
  const texts = typeof leaf === 'string' ? [leaf] : Object.values(leaf)
  for (const text of texts) {
    for (const name of extractPlaceholders(text)) {
      names.add(name)
    }
  }
  return [...names].sort()
}

/**
 * Compares translated catalogs against the reference catalog (en first).
 * Returns { counts, issues } - empty issues means parity.
 */
export function compareCatalogParity(catalogs) {
  const named = catalogs.map(entry =>
    Array.isArray(entry) ? { tag: entry[0], tree: entry[1] } : entry
  )
  const [reference, ...translations] = named
  const baseLeaves = flattenCatalogLeaves(reference.tree)
  const issues = []
  const counts = { [reference.tag]: baseLeaves.size }

  for (const { tag, tree } of translations) {
    const leaves = flattenCatalogLeaves(tree)
    counts[tag] = leaves.size

    for (const [key, base] of baseLeaves) {
      if (!leaves.has(key)) {
        issues.push(`${tag}: missing key ${key}`)
        continue
      }
      const other = leaves.get(key)

      const shapeDiff = compareVariantShapes(base, other)
      if (shapeDiff !== null) {
        issues.push(`${tag}: ${key} variant shape differs (${shapeDiff})`)
      }
      issues.push(...mnemonicIssues(key, tag, base, other))

      const basePh = leafPlaceholders(base).join(',')
      const otherPh = leafPlaceholders(other).join(',')
      if (basePh !== otherPh) {
        issues.push(
          `${tag}: ${key} placeholders differ (${basePh} vs ${otherPh})`
        )
      }
    }

    for (const key of leaves.keys()) {
      if (!baseLeaves.has(key)) {
        issues.push(`${tag}: unknown key ${key}`)
      }
    }
  }

  return { counts, issues }
}

// ---------------------------------------------------------------------------
// Filesystem / git plumbing for the three CLI modes.
// ---------------------------------------------------------------------------

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function loadCatalogs() {
  return ['en', 'ru', 'uk'].map(tag => ({
    tag,
    tree: readJson(join(localesDir, `${tag}.json`)),
  }))
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* sourceFiles(path)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      yield path
    }
  }
}

function displayPath(path) {
  return relative(projectRoot, path).split(sep).join('/')
}

export function runAudit() {
  const coverage = collectCatalogStrings(loadCatalogs()[0].tree)
  const coverageList = [...coverage]
  const coveredAsFragment = text => coverageList.some(en => en.includes(text))

  let visible = 0
  const uncovered = []

  for (const path of sourceFiles(sourcesDir)) {
    const code = readFileSync(path, 'utf8')
    for (const { line, text, kind } of extractVisibleLiteralsFromSource(
      code,
      path
    )) {
      visible += 1
      // A JSX child only has to be a fragment of a Trans string such as
      // "<current>{current}</current> is already up to date with <base/>".
      const covered =
        coverage.has(text) || (kind === 'jsx' && coveredAsFragment(text))
      if (!covered) {
        uncovered.push(`${displayPath(path)}:${line}: ${text}`)
      }
    }
  }

  for (const finding of uncovered) {
    console.log(finding)
  }
  console.log(`visible literals: ${visible} | uncovered: ${uncovered.length}`)
  return uncovered.length > 0 ? 1 : 0
}

function git(args) {
  // The multi-pattern git grep can print several megabytes of matches;
  // spawnSync's 1 MB default would silently truncate stdout.
  return spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
}

/**
 * Which catalog keys the source asks for. Once a string is localized its
 * English text leaves app/src and only the key stays, so a key nobody renders
 * can only be recognized by its key, never by its text.
 *
 * Keys are not always inside a `t()` call: `snapshot-card.tsx` keeps them in
 * object literals and hands the value to `t()` later. So every quoted token
 * that is shaped like a key counts as a request, and a template literal
 * contributes its static prefix: `t(\`menu.${id}\`)` keeps every `menu.*` alive.
 */
function keysRequestedInSource() {
  const quoted = git([
    'grep',
    '-h',
    '-o',
    '-E',
    "'[A-Za-z][^']*'",
    '--',
    'app/src',
  ])
  const templates = git([
    'grep',
    '-h',
    '-o',
    '-E',
    '`[A-Za-z][^`$]*',
    '--',
    'app/src',
  ])
  if (quoted.status > 1 || templates.status > 1) {
    console.error('git grep failed')
    return null
  }

  const exact = new Set()
  const prefixes = new Set()

  for (const line of quoted.stdout ? quoted.stdout.split('\n') : []) {
    const token = line.slice(1, -1)
    // `settings.notifications` yes, `Not a key.` no: prose has spaces, and a
    // key always has a section in front of the dot.
    if (!token.includes('.') || /\s/.test(token)) {
      continue
    }
    if (token.endsWith('.')) {
      prefixes.add(token)
    } else {
      exact.add(token)
    }
  }

  for (const line of templates.stdout ? templates.stdout.split('\n') : []) {
    const token = line.slice(1)
    if (token.includes('.')) {
      prefixes.add(token)
    }
  }

  return { exact, prefixes }
}

function isRequested(key, requested) {
  if (requested.exact.has(key)) {
    return true
  }
  for (const prefix of requested.prefixes) {
    if (prefix !== '' && key.startsWith(prefix)) {
      return true
    }
  }
  return false
}

/** Pulls phrase-like literals out of raw added diff lines (line based, no AST). */
function addedLineLiterals(line) {
  const out = []
  const content = line.slice(1)
  if (/^\s*(\/\/|\/\*|\*)/.test(content)) {
    return out
  }

  for (const match of content.matchAll(/(['"])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    out.push(match[2].replace(/\\(["'\\])/g, '$1'))
  }
  for (const match of content.matchAll(/`([^`$]*)`/g)) {
    out.push(match[1])
  }

  // JSX children appear as bare text lines between tags.
  const bare = content.trim()
  if (
    bare !== '' &&
    /^[A-Z][a-z]/.test(bare) &&
    /\s/.test(bare) &&
    !/[<>/{}=|;().,[\]'"`]/.test(bare)
  ) {
    out.push(bare)
  }
  return out
}

/**
 * Without AST context the line based scan only keeps capitalized
 * multi-word phrases; single words and lowercase lists (css classes,
 * technical keys) need the AST to be judged, so they are skipped here.
 */
function isPlausibleNewUiString(text) {
  return isUserFacingLiteral(text) && /\s/.test(text) && /^[A-Z]/.test(text)
}

export function runUpstream(ref) {
  const target = ref || 'upstream/development'

  const verify = git(['rev-parse', '--verify', '--quiet', `${target}^{commit}`])
  if (verify.status !== 0 || !verify.stdout.trim()) {
    console.log(
      `Ref '${target}' is not available locally. Fetch it first, e.g.:`
    )
    console.log('  git fetch upstream development')
    console.log('Nothing to check; skipping the upstream comparison.')
    return 0
  }

  const info = git(['log', '-1', '--format=%h %cd %s', '--date=short', target])
  console.log(`upstream ref: ${target} (${info.stdout.trim()})`)

  // Compare against the working tree, not HEAD: the point of this mode is to
  // tell whether the translations on disk are current, and half of them are
  // usually still uncommitted while the work is in progress.
  const diff = git(['diff', '--no-color', target, '--', 'app/src'])
  if (diff.status !== 0) {
    console.error(`git diff failed: ${diff.stderr.trim()}`)
    return 1
  }

  const coverage = collectCatalogStrings(loadCatalogs()[0].tree)
  const missing = new Set()
  let currentFile = ''

  for (const line of diff.stdout.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length)
      continue
    }
    if (!line.startsWith('+') || line.startsWith('+++')) {
      continue
    }
    for (const literal of addedLineLiterals(line)) {
      const text = normalizePhrase(literal)
      if (isPlausibleNewUiString(text) && !coverage.has(text)) {
        missing.add(`${currentFile} ${text}`)
      }
    }
  }

  const missingList = [...missing]
  if (missingList.length === 0) {
    console.log('new upstream strings not localized yet: none')
  } else {
    console.log(`new upstream strings not localized yet: ${missingList.length}`)
    printCapped(missingList)
  }

  // The other direction: keys that no source file asks for any more, which
  // every translation then carries as dead weight.
  const requested = keysRequestedInSource()
  if (requested === null) {
    console.error('git grep failed')
    return 1
  }

  const dead = [...flattenCatalogLeaves(loadCatalogs()[0].tree).keys()].filter(
    key => !isRequested(key, requested)
  )

  if (dead.length === 0) {
    console.log('catalog keys no source asks for: none')
  } else {
    console.log(`catalog keys no source asks for: ${dead.length}`)
    printCapped(dead)
  }

  return missingList.length > 0 || dead.length > 0 ? 1 : 0
}

function printCapped(list, cap = 50) {
  for (const item of list.slice(0, cap)) {
    console.log(`  ${item}`)
  }
  if (list.length > cap) {
    console.log(`  ... and ${list.length - cap} more`)
  }
}

export function runParity() {
  const { counts, issues } = compareCatalogParity(loadCatalogs())
  for (const [tag, count] of Object.entries(counts)) {
    console.log(`${tag}: ${count} leaf keys`)
  }
  printCapped(issues, 100)
  console.log(`parity issues: ${issues.length}`)
  return issues.length > 0 ? 1 : 0
}

// ---------------------------------------------------------------------------
// Shipped bundles.
//
// `out/` is what the sources compile to; the copies that actually ship are
// rolled out from it by hand, so a copy rolled out before the last build keeps
// serving an older interface forever and nothing in the build notices. This
// mode compares the copies against `out/` and looks for every shipped language
// inside them.

const buildDir = join(projectRoot, 'out')

/** Directories a finished bundle is expected to have been rolled out to. */
const shippedApps = [
  join(projectRoot, 'bin', 'resources', 'app'),
  join(projectRoot, 'dist', 'desktop-linux-x64', 'resources', 'app'),
  join(projectRoot, 'dist', 'GitHubDesktop-win32-x64', 'resources', 'app'),
]

/** Bundles that embed the catalogs, so a missing language shows up in these. */
const catalogBundles = ['main.js', 'renderer.js', 'crash.js']

function digestOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * Whether a bundle contains a piece of text, in the raw form or as the
 * `\uXXXX` escapes webpack may have emitted instead.
 */
function bundleContains(path, text) {
  const contents = readFileSync(path)
  if (contents.includes(text, 'utf8')) {
    return true
  }

  const escaped = [...text]
    .map(char => {
      const code = char.codePointAt(0)
      return code < 128 ? char : `\\u${code.toString(16).padStart(4, '0')}`
    })
    .join('')

  return escaped !== text && contents.includes(escaped, 'utf8')
}

function runBundles() {
  if (!existsSync(buildDir)) {
    console.error('no out/ directory: build the app first (yarn build:dev)')
    return 1
  }

  const built = readdirSync(buildDir).filter(name => name.endsWith('.js'))
  if (built.length === 0) {
    console.error('out/ contains no bundles')
    return 1
  }

  const languages = readdirSync(localesDir)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const tag = basename(name, '.json')
      const catalog = readJson(join(localesDir, name))
      return { tag, name: catalog?.meta?.nativeName ?? tag }
    })

  let problems = 0

  for (const app of shippedApps) {
    const label = displayPath(app)

    if (!existsSync(app)) {
      console.log(`${label}: not rolled out (skipped)`)
      continue
    }

    const stale = built.filter(name => {
      const shipped = join(app, name)
      return (
        !existsSync(shipped) ||
        digestOf(shipped) !== digestOf(join(buildDir, name))
      )
    })

    const missingLanguages = languages.filter(
      language =>
        !catalogBundles.every(name => !existsSync(join(app, name))) &&
        catalogBundles.some(
          name =>
            existsSync(join(app, name)) &&
            !bundleContains(join(app, name), language.name)
        )
    )

    if (stale.length === 0 && missingLanguages.length === 0) {
      console.log(`${label}: matches out/, all languages present`)
      continue
    }

    problems++
    console.log(
      `${label}: ${stale.length} bundle(s) differ from out/` +
        (missingLanguages.length > 0
          ? `, missing language(s): ${missingLanguages
              .map(language => language.tag)
              .join(', ')}`
          : '')
    )
    printCapped(stale, 20)
  }

  console.log(`shipped copies out of date: ${problems}`)
  return problems > 0 ? 1 : 0
}

function main() {
  const args = process.argv.slice(2)
  const mode = args[0]

  if (mode === '--audit') {
    process.exitCode = runAudit()
  } else if (mode === '--parity') {
    process.exitCode = runParity()
  } else if (mode === '--upstream') {
    const ref = args[1] && !args[1].startsWith('--') ? args[1] : undefined
    process.exitCode = runUpstream(ref)
  } else if (mode === '--bundles') {
    process.exitCode = runBundles()
  } else {
    console.log(
      'usage: node script/i18n-freshness.mjs [--audit | --parity | --upstream [ref] | --bundles]'
    )
    process.exitCode = mode === undefined ? 1 : 0
  }
}

const invokedDirectly =
  typeof import.meta.url === 'string' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  main()
}
