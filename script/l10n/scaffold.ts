/**
 * Generates a skeleton catalog for a new language tag.
 *
 * Walks the en-tree leaf by leaf: plain leaves stay plain, plural leaves get
 * the declared categories, platform qualifiers are preserved. Values are
 * copies of the English text — an empty string would delete the form at
 * merge time, and the parity gate needs every key to exist from day one.
 *
 *   yarn l10n:scaffold --tag la --name "Latin" --nativeName "Latina" --categories one,other
 *   yarn l10n:scaffold --tag eo --name "Esperanto" --nativeName "Esperanto" --categories one,other
 *
 * `--update` re-runs on an existing file: adds keys that appeared in en
 * after the initial generation, refreshes values that are still byte-for-byte
 * English copies, leaves any other value untouched.
 *
 * `--force` overwrites the target file wholesale (no merge with existing
 * translations).
 */
import * as Fs from 'fs'
import * as Path from 'path'

const localesDir = Path.join(__dirname, '..', '..', 'app', 'locales')

const PLURAL_QUALIFIERS = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
] as const

type Options = {
  tag: string
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  categories: string[]
  user: boolean
  update: boolean
  force: boolean
}

function parseArgs(): Options | undefined {
  const args = process.argv.slice(2)
  const flags = new Map<string, string>()

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2)
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags.set(key, args[i + 1])
        i++
      } else {
        flags.set(key, 'true')
      }
    }
  }

  const tag = flags.get('tag')
  if (tag === undefined) {
    console.error(
      'usage: yarn l10n:scaffold --tag <tag> [--name …] [--nativeName …] [--categories one,other] [--update] [--force]'
    )
    return undefined
  }

  const categories = (flags.get('categories') ?? 'one,other')
    .split(',')
    .filter(c => (PLURAL_QUALIFIERS as ReadonlyArray<string>).includes(c))

  return {
    tag,
    name: flags.get('name') ?? tag,
    nativeName: flags.get('nativeName') ?? tag,
    direction: flags.get('direction') === 'rtl' ? 'rtl' : 'ltr',
    categories,
    user: flags.get('user') === 'true',
    update: flags.get('update') === 'true',
    force: flags.get('force') === 'true',
  }
}

function isQualifierKey(key: string): boolean {
  return key.startsWith('_') || key.startsWith('@')
}

function isPluralGroup(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some(k => k.startsWith('_'))
}

function isPlatformGroup(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some(k => k.startsWith('@'))
}

type Leaf = {
  path: string
  kind: 'plain' | 'plural' | 'platform'
  value: unknown
}

function walkLeaves(
  tree: Record<string, unknown>,
  prefix: string,
  out: Leaf[]
): void {
  for (const [key, value] of Object.entries(tree)) {
    if (prefix === '' && key === 'meta') {
      continue
    }
    const fullKey = prefix === '' ? key : `${prefix}.${key}`

    if (typeof value === 'string') {
      out.push({ path: fullKey, kind: 'plain', value })
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj)

      if (keys.length > 0 && keys.every(isQualifierKey)) {
        if (isPluralGroup(obj)) {
          out.push({ path: fullKey, kind: 'plural', value: obj })
        } else if (isPlatformGroup(obj)) {
          out.push({ path: fullKey, kind: 'platform', value: obj })
        } else {
          out.push({ path: fullKey, kind: 'plain', value })
        }
      } else {
        walkLeaves(obj, fullKey, out)
      }
    } else {
      out.push({ path: fullKey, kind: 'plain', value })
    }
  }
}

/**
 * Expand a leaf into a nested tree path for the output object.
 */
function setLeaf(
  root: Record<string, unknown>,
  dottedPath: string,
  value: unknown
): void {
  const parts = dottedPath.split('.')
  let current: Record<string, unknown> = root

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (
      current[part] === undefined ||
      typeof current[part] !== 'object' ||
      current[part] === null
    ) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

function generate(opts: Options): void {
  const enPath = Path.join(localesDir, 'en.json')
  // eslint-disable-next-line no-sync
  const enTree = JSON.parse(Fs.readFileSync(enPath, 'utf-8'))

  const leaves: Leaf[] = []
  walkLeaves(enTree, '', leaves)

  const out: Record<string, unknown> = {
    meta: {
      name: opts.name,
      nativeName: opts.nativeName,
      direction: opts.direction,
      pluralCategories: opts.categories,
    },
  }

  for (const leaf of leaves) {
    if (leaf.kind === 'plain') {
      setLeaf(out, leaf.path, leaf.value)
    } else if (leaf.kind === 'plural') {
      const pluralObj: Record<string, string> = {}
      for (const cat of opts.categories) {
        const src = leaf.value as Record<string, unknown>
        pluralObj[`_${cat}`] = (src[`_${cat}`] ??
          src['_other'] ??
          src['_one'] ??
          Object.values(src).find(v => typeof v === 'string')) as string
      }
      setLeaf(out, leaf.path, pluralObj)
    } else if (leaf.kind === 'platform') {
      const platObj = { ...(leaf.value as Record<string, unknown>) }
      for (const [k, v] of Object.entries(platObj)) {
        if (typeof v === 'string') {
          platObj[k] = v
        }
      }
      setLeaf(out, leaf.path, platObj)
    }
  }

  const targetPath = Path.join(localesDir, `${opts.tag.toLowerCase()}.json`)

  // eslint-disable-next-line no-sync
  if (opts.update && Fs.existsSync(targetPath) && !opts.force) {
    // eslint-disable-next-line no-sync
    const existing = JSON.parse(Fs.readFileSync(targetPath, 'utf-8'))

    // The generator owns exactly the four fields it is asked about; everything
    // else in `meta` belongs to the file. A re-run that dropped the glossary or
    // the credits would silence a hint and erase an author set up by hand.
    out.meta = {
      ...((existing.meta as Record<string, unknown> | undefined) ?? {}),
      ...(out.meta as Record<string, unknown>),
    }

    const existingLeaves: Leaf[] = []
    walkLeaves(existing, '', existingLeaves)
    const existingMap = new Map(existingLeaves.map(l => [l.path, l]))

    for (const leaf of leaves) {
      const prior = existingMap.get(leaf.path)
      if (prior !== undefined && leaf.kind === 'plain') {
        const newVal =
          typeof prior.value === 'string' ? prior.value : leaf.value
        if (newVal === leaf.value) {
          setLeaf(out, leaf.path, leaf.value)
        } else {
          setLeaf(out, leaf.path, newVal)
        }
      } else if (prior !== undefined && leaf.kind === 'plural') {
        const targetPlural = getPathValue(out, leaf.path) as
          | Record<string, string>
          | undefined
        const existingPlural = prior.value as Record<string, unknown>
        if (targetPlural !== undefined) {
          for (const [k, v] of Object.entries(existingPlural)) {
            if (
              typeof v === 'string' &&
              v !== ((leaf.value as any)?.[k] ?? '')
            ) {
              targetPlural[k] = v
            }
          }
        }
      }
    }
  }

  // eslint-disable-next-line no-sync
  Fs.writeFileSync(targetPath, JSON.stringify(out, null, 2) + '\n', 'utf-8')

  const categories = opts.categories.join(', ')
  console.log(`Wrote ${targetPath}`)
  console.log(`${leaves.length} keys, categories: ${categories}`)
}

function getPathValue(
  root: Record<string, unknown>,
  dottedPath: string
): unknown {
  const parts = dottedPath.split('.')
  let current: unknown = root
  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

generate(parseArgs()!)
