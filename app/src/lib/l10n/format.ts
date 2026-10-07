import { PluralQualifierPrefix, PluralQualifiers } from './catalog'
import { Message, TranslationParameters } from './types'

export type Platform = 'darwin' | 'win32' | 'linux'

/**
 * The platform the running build targets. Webpack replaces these globals at
 * build time and the test globals define them too.
 */
export function currentPlatform(): Platform {
  if (__DARWIN__) {
    return 'darwin'
  }
  if (__WIN32__) {
    return 'win32'
  }
  return 'linux'
}

/**
 * Picks the variant of a message that applies here and now.
 *
 * A platform qualifier wins over a plural qualifier: menus are the one place
 * where the same string genuinely differs per operating system (accelerator
 * mnemonics, ellipsis glyphs), and that outranks grammar.
 */
export function selectVariant(
  message: Message,
  locale: string,
  params: TranslationParameters,
  platform: Platform
): string | undefined {
  const forPlatform =
    message.get(`platform:@${platform}`) ?? message.get('platform:@other')

  if (forPlatform !== undefined) {
    return forPlatform
  }

  const forPlural = selectPlural(message, locale, params)
  if (forPlural !== undefined) {
    return forPlural
  }

  const plain = message.get('')
  if (plain !== undefined) {
    return plain
  }

  // A message that only knows about other platforms still has to render
  // something, and showing one of its variants beats showing nothing.
  return message.values().next().value
}

const pluralCategoryCache = new Map<string, ReadonlyArray<string>>()

/**
 * The plural forms `tag` grammatically distinguishes, as bare qualifier keys
 * (`_one`, `_few`, ...) in the canonical order of `PluralQualifiers`.
 *
 * Asked of `Intl` rather than looked up in a hand kept table so that variant
 * selection here, the localization editor and the i18n freshness checker
 * cannot drift apart on which forms a language is required to provide. Cached
 * because `resolvedOptions` is comparatively slow and the editor asks for
 * every row it renders.
 */
export function getPluralCategories(tag: string): ReadonlyArray<string> {
  const cached = pluralCategoryCache.get(tag)

  if (cached !== undefined) {
    return cached
  }

  let supported: ReadonlyArray<string> = ['other']

  try {
    supported = new Intl.PluralRules(tag).resolvedOptions().pluralCategories
  } catch {
    // A hand written catalog can carry a malformed tag. Falling back to the
    // one form every language has beats throwing out of a render pass.
  }

  const names = new Set(supported)
  const categories = PluralQualifiers.filter(q => names.has(q)).map(
    q => `${PluralQualifierPrefix}${q}`
  )

  pluralCategoryCache.set(tag, categories)
  return categories
}

function selectPlural(
  message: Message,
  locale: string,
  params: TranslationParameters
): string | undefined {
  const count = params['count']
  const numeric =
    typeof count === 'number'
      ? count
      : typeof count === 'string' && count !== ''
      ? Number(count)
      : undefined

  const category =
    numeric !== undefined && Number.isFinite(numeric)
      ? new Intl.PluralRules(locale).select(numeric)
      : 'other'

  return message.get(`plural:_${category}`) ?? message.get('plural:_other')
}

/**
 * Substitutes `{placeholders}` into a message.
 *
 * `{name}` inserts the parameter as is, `{size:number}` formats it for the
 * active locale (decimal separators differ, and translators need to be able to
 * move the number inside an inflected sentence), and `{{`/`}}` are escapes.
 */
export function interpolate(
  template: string,
  params: TranslationParameters,
  locale: string
): string {
  let result = ''
  let index = 0

  while (index < template.length) {
    const character = template[index]

    if (character === '{' && template[index + 1] === '{') {
      result += '{'
      index += 2
      continue
    }

    if (character === '}' && template[index + 1] === '}') {
      result += '}'
      index += 2
      continue
    }

    if (character === '{') {
      const end = template.indexOf('}', index)

      if (end === -1) {
        result += template.slice(index)
        break
      }

      result += formatParameter(template.slice(index + 1, end), params, locale)
      index = end + 1
      continue
    }

    result += character
    index++
  }

  return result
}

function formatParameter(
  expression: string,
  params: TranslationParameters,
  locale: string
): string {
  const separator = expression.lastIndexOf(':')
  const name = separator === -1 ? expression : expression.slice(0, separator)
  const format = separator === -1 ? undefined : expression.slice(separator + 1)
  const value = params[name]

  if (value === undefined) {
    return ''
  }

  if (format === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat(locale).format(numeric)
      : String(value)
  }

  if (format === 'percent') {
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat(locale, { style: 'percent' }).format(numeric)
      : String(value)
  }

  return String(value)
}

/** The `{placeholders}` a message refers to, in order of appearance. */
export function findPlaceholders(template: string): ReadonlyArray<string> {
  const names = new Set<string>()
  const pattern = /\{([^{}:]+)(?::[^{}]+)?\}/g

  for (
    let match = pattern.exec(template);
    match;
    match = pattern.exec(template)
  ) {
    names.add(match[1])
  }

  return [...names]
}

/**
 * A qualifier the way a translator reads it: `plural:_one` becomes `_one`,
 * while a bare `_one` or `@win32` is already readable and stays as it is. An
 * empty qualifier means the message has a single form and prints as nothing.
 */
export function displayQualifier(qualifier: string): string {
  const colon = qualifier.indexOf(':')
  return colon === -1 ? qualifier : qualifier.slice(colon + 1)
}
