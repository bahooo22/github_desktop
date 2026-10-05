/**
 * Rewrites the labels of a native menu template into catalog lookups.
 *
 * Menu items are the one part of the interface that already carries a stable,
 * meaningful identifier for every string (`id: 'clone-repository'`), so the
 * key is derived from it rather than invented. Labels that don't fit the
 * mechanical patterns — interpolated names, helper functions, items without an
 * `id` — are reported instead of guessed at, and get converted by hand.
 *
 *   yarn l10n:menu app/src/main-process/menu/build-default-menu.ts
 *
 * Re-running after adding a menu item only fills in what's missing.
 */
import * as ts from 'typescript'
import * as Fs from 'fs'
import * as Path from 'path'

const localesPath = Path.join(
  __dirname,
  '..',
  '..',
  'app',
  'locales',
  'en.json'
)
const keyPrefix = 'menu'

type Entry = {
  readonly key: string
  readonly value: string | Record<string, string>
}

type Finding = {
  readonly line: number
  readonly reason: string
  readonly text: string
}

const targets = process.argv.slice(2)

if (targets.length === 0) {
  console.error('usage: extract-menu.ts <file.ts> [...]')
  process.exit(1)
}

for (const target of targets) {
  convert(target)
}

function convert(sourcePath: string) {
  const absolute = Path.join(__dirname, '..', '..', sourcePath)
  // eslint-disable-next-line no-sync
  const source = Fs.readFileSync(absolute, 'utf8')
  const sourceFile = ts.createSourceFile(
    absolute,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  )

  const entries = new Array<Entry>()
  const findings = new Array<Finding>()
  const edits = new Array<{ start: number; end: number; text: string }>()

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const id = literalProperty(node, 'id')
      const label = property(node, 'label')

      if (label !== undefined) {
        if (id === undefined) {
          findings.push({
            line: lineOf(source, label.initializer),
            reason: 'no `id` to derive a key from',
            text: label.initializer.getText(sourceFile),
          })
        } else {
          const resolved = resolveLabel(label.initializer, sourceFile)

          if (resolved === undefined) {
            findings.push({
              line: lineOf(source, label.initializer),
              reason: 'label is computed, needs a placeholder or a manual key',
              text: label.initializer.getText(sourceFile),
            })
          } else {
            const key = `${keyPrefix}.${id}`
            entries.push({ key, value: resolved })
            edits.push({
              start: label.initializer.getStart(sourceFile),
              end: label.initializer.getEnd(),
              text: `t('${key}')`,
            })
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (edits.length === 0) {
    console.log(`${sourcePath}: nothing to convert`)
    return
  }

  let rewritten = source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    rewritten =
      rewritten.slice(0, edit.start) + edit.text + rewritten.slice(edit.end)
  }

  if (!/from '\.\.\/\.\.\/lib\/l10n\/core'/.test(rewritten)) {
    rewritten = `import { t } from '../../lib/l10n/core'\n${rewritten}`
  }

  // eslint-disable-next-line no-sync
  Fs.writeFileSync(absolute, rewritten, 'utf8')

  // eslint-disable-next-line no-sync
  const catalog = JSON.parse(Fs.readFileSync(localesPath, 'utf8'))
  catalog[keyPrefix] = catalog[keyPrefix] ?? {}

  let added = 0
  for (const entry of entries) {
    const name = entry.key.slice(keyPrefix.length + 1)
    if (catalog[keyPrefix][name] === undefined) {
      catalog[keyPrefix][name] = entry.value
      added++
    }
  }

  // eslint-disable-next-line no-sync
  Fs.writeFileSync(localesPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8')

  console.log(
    `${sourcePath}: ${edits.length} labels converted, ${added} new catalog entries`
  )

  for (const finding of findings) {
    console.log(`  ${finding.line}: ${finding.reason}\n    ${finding.text}`)
  }
}

function property(node: ts.ObjectLiteralExpression, name: string) {
  return node.properties.find(
    p =>
      ts.isPropertyAssignment(p) &&
      p.name.getText(sourceFileOf(p)).replace(/['"]/g, '') === name
  ) as ts.PropertyAssignment | undefined
}

function literalProperty(node: ts.ObjectLiteralExpression, name: string) {
  const property = node.properties.find(
    p =>
      ts.isPropertyAssignment(p) &&
      p.name.getText().replace(/['"]/g, '') === name
  ) as ts.PropertyAssignment | undefined

  return property !== undefined && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined
}

/**
 * A plain string, or a chain of platform conditionals, which is how this file
 * has always expressed "different wording, or a different `&` mnemonic, per
 * operating system". Nested chains collapse into one set of variants.
 */
function resolveLabel(
  node: ts.Expression,
  file: ts.SourceFile
): string | Record<string, string> | undefined {
  if (ts.isStringLiteral(node)) {
    return node.text
  }

  if (!ts.isConditionalExpression(node)) {
    return undefined
  }

  const platform = platformOf(node.condition, file)
  if (platform === undefined) {
    return undefined
  }

  const yes = resolveLabel(node.whenTrue, file)
  const no = resolveLabel(node.whenFalse, file)

  if (typeof yes !== 'string' || no === undefined) {
    return undefined
  }

  return typeof no === 'string'
    ? { [`@${platform}`]: yes, '@other': no }
    : { [`@${platform}`]: yes, ...no }
}

function platformOf(
  node: ts.Expression,
  file: ts.SourceFile
): string | undefined {
  const text = node.getText(file)

  if (text === '__DARWIN__') {
    return 'darwin'
  }
  if (text === '__WIN32__') {
    return 'win32'
  }
  if (text === '__LINUX__') {
    return 'linux'
  }
  if (text === '!__DARWIN__') {
    return 'other'
  }

  return undefined
}

function sourceFileOf(node: ts.Node): ts.SourceFile {
  return node.getSourceFile()
}

function lineOf(source: string, node: ts.Node): number {
  const position = node.getStart()
  return source.slice(0, position).split('\n').length
}
