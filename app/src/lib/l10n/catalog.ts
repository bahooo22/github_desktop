import { CatalogProblem, CatalogTree, LocaleMeta, Message } from './types'

/** Reserved root entry carrying the catalog's own metadata. */
export const MetaKey = 'meta'

export const PluralQualifiers = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
] as const

export const PlatformQualifiers = ['darwin', 'win32', 'linux', 'other'] as const

export const PluralQualifierPrefix = '_'
export const PlatformQualifierPrefix = '@'

const known = new Map<string, string>([
  ...PluralQualifiers.map(q => [`_${q}`, 'plural'] as [string, string]),
  ...PlatformQualifiers.map(q => [`@${q}`, 'platform'] as [string, string]),
])

function isQualifierKey(key: string): boolean {
  return (
    key.startsWith(PluralQualifierPrefix) ||
    key.startsWith(PlatformQualifierPrefix)
  )
}

/**
 * Turns the nested JSON a translator edits into the flat `key -> message` form
 * the runtime looks up.
 *
 * Malformed entries are collected in `problems` and skipped rather than
 * thrown: a single bad row in a hand written user catalog must not blank the
 * application, and the localization editor surfaces the list instead.
 */
export function flattenCatalog(
  raw: unknown,
  problems: CatalogProblem[] = []
): Map<string, Message> {
  const messages = new Map<string, Message>()
  flatten(raw, '', messages, problems)
  return messages
}

function flatten(
  raw: unknown,
  prefix: string,
  out: Map<string, Message>,
  problems: CatalogProblem[]
) {
  const label = prefix === '' ? '<root>' : prefix

  if (typeof raw === 'string') {
    out.set(prefix, new Map([['', raw]]))
    return
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push({ key: label, reason: 'expected a message or a group' })
    return
  }

  const entries = Object.entries(raw)
  if (entries.length === 0) {
    problems.push({ key: label, reason: 'empty group' })
    return
  }

  const qualifierEntries = entries.filter(([k]) => isQualifierKey(k))

  // Every key is a qualifier, so this leaf selects a variant of one message
  // rather than grouping several messages.
  if (qualifierEntries.length === entries.length) {
    const variants = new Map<string, string>()
    for (const [qualifier, value] of qualifierEntries) {
      const kind = known.get(qualifier)

      if (kind === undefined) {
        problems.push({
          key: label,
          reason: `unknown qualifier '${qualifier}'`,
        })
        continue
      }

      if (typeof value !== 'string') {
        problems.push({ key: label, reason: `'${qualifier}' is not a message` })
        continue
      }

      // A message can vary by platform and by plural category at the same
      // time; the two prefixes keep them apart so selection stays predictable.
      variants.set(`${kind}:${qualifier}`, value)
    }

    if (variants.size > 0) {
      out.set(prefix, variants)
    }
    return
  }

  if (qualifierEntries.length > 0) {
    problems.push({
      key: label,
      reason: 'qualifiers cannot be mixed with message names',
    })
  }

  for (const [key, value] of entries) {
    if (isQualifierKey(key) || (prefix === '' && key === MetaKey)) {
      continue
    }
    flatten(value, prefix === '' ? key : `${prefix}.${key}`, out, problems)
  }
}

/**
 * The `meta` block of a catalog file. A user catalog that doesn't declare one
 * still loads: its metadata is inherited from the built-in catalog it patches.
 */
export function readCatalogMeta(raw: unknown): Partial<LocaleMeta> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const meta = (raw as Record<string, unknown>)[MetaKey]

  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
    return {}
  }

  const { name, nativeName, direction, authors } = meta as Record<
    string,
    unknown
  >

  return {
    ...(typeof name === 'string' ? { name } : {}),
    ...(typeof nativeName === 'string' ? { nativeName } : {}),
    ...(direction === 'rtl' || direction === 'ltr' ? { direction } : {}),
    ...(Array.isArray(authors) && authors.every(a => typeof a === 'string')
      ? { authors: authors as string[] }
      : {}),
  }
}

/**
 * Messages from `overlay` win over `base`, which is how a user supplied
 * translation replaces one string without restating the whole catalog.
 */
export function mergeMessages(
  base: ReadonlyMap<string, Message>,
  overlay: ReadonlyMap<string, Message>
): Map<string, Message> {
  const merged = new Map(base)
  for (const [key, message] of overlay) {
    merged.set(key, message)
  }
  return merged
}

/** Keys `overlay` defines but `base` doesn't, dotted and sorted. */
export function findUnknownKeys(
  base: ReadonlyMap<string, Message>,
  overlay: ReadonlyMap<string, Message>
): ReadonlyArray<string> {
  return [...overlay.keys()]
    .filter(k => !base.has(k))
    .sort((a, b) => a.localeCompare(b))
}

/**
 * The inverse of `flattenCatalog`: turns a flat `key -> message` map back into
 * the nested JSON a human expects to find in a catalog file, which is what the
 * localization editor writes to disk.
 */
export function unflattenMessages(
  messages: ReadonlyMap<string, Message>,
  meta?: Partial<LocaleMeta>
): CatalogTree {
  const tree: Record<string, unknown> = {}

  if (meta !== undefined) {
    tree[MetaKey] = { ...meta }
  }

  for (const [key, message] of messages) {
    const segments = key.split('.')
    let parent: Record<string, unknown> = tree

    for (const segment of segments.slice(0, -1)) {
      const next = parent[segment]
      if (next === null || typeof next !== 'object' || Array.isArray(next)) {
        // A leaf defined earlier is being expanded into a group; the previous
        // value has nowhere to live in the nested form, so it gives way.
        parent[segment] = {}
      } else {
        parent[segment] = next
      }
      parent = parent[segment] as Record<string, unknown>
    }

    const leaf = segments[segments.length - 1]

    if (message.size === 1 && message.has('')) {
      parent[leaf] = message.get('')
    } else {
      const variants: Record<string, string> = {}
      for (const [qualified, template] of message) {
        // Stored as `plural:_one` / `platform:@win32`, written back as `_one`
        // / `@win32` so the file stays something a translator can hand-edit.
        const colon = qualified.indexOf(':')
        variants[qualified.slice(colon + 1)] = template
      }
      parent[leaf] = variants
    }
  }

  return tree as CatalogTree
}
