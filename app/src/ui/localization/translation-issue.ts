import { localization, t } from '../../lib/l10n'
import { displayQualifier } from '../../lib/l10n/format'
import { getVersion } from '../lib/app-proxy'

/**
 * Where translation feedback is collected. The fork's translations live outside
 * the upstream repository, so upstream's issue tracker would drop reports
 * nobody watching can act on.
 */
const ForkIssuesRepository = 'bahooo22/github_desktop'

/**
 * The label this tracker files translation reports under. A repository fact
 * rather than UI text: GitHub matches labels by their exact name, so a catalog
 * entry would offer the Russian label to every language as if it were
 * translatable, and the report would arrive unlabelled.
 */
export const TranslationIssueLabel = 'локализация'

export interface ITranslationIssue {
  readonly title: string
  readonly body: string
  readonly labels?: ReadonlyArray<string>
}

/**
 * A pre-filled `new issue` URL. Everything goes through
 * `URLSearchParams.encode`: a report body carries newlines, markdown and a
 * commit hash, and a hand-joined query string would break on the first `&`.
 */
export function buildTranslationIssueUrl(issue: ITranslationIssue): string {
  const params = new URLSearchParams()
  params.set('title', issue.title)
  params.set('body', issue.body)

  if (issue.labels !== undefined && issue.labels.length > 0) {
    params.set('labels', issue.labels.join(','))
  }

  return `https://github.com/${ForkIssuesRepository}/issues/new?${params.toString()}`
}

/**
 * What the report concerns, as far as the caller can tell. `key` only arrives
 * when the caller has narrowed a list down to one string, and `filter` is left
 * out while nothing is filtered, because then it describes nothing.
 */
export interface ITranslationIssueContext {
  readonly target: string
  readonly key?: string
  readonly filter?: 'missing' | 'translated'
  readonly search: string
}

/**
 * The string as `target` has it right now, form by form: the translator's own
 * override wins, the shipped catalog of that language fills the rest. Not
 * `localization.getCurrent`, which renders for the language on screen — a
 * report about Ukrainian is often written from a Russian interface.
 */
function getFormsOf(target: string, key: string): ReadonlyMap<string, string> {
  const overrides = localization.getUserMessages(target).get(key)
  const builtIn = localization.getBuiltInMessages(target).get(key)

  const forms = new Map<string, string>()

  for (const [qualifier, value] of overrides ?? new Map()) {
    if (value !== '') {
      forms.set(qualifier, value)
    }
  }

  for (const [qualifier, value] of builtIn ?? new Map()) {
    if (value !== '' && !forms.has(qualifier)) {
      forms.set(qualifier, value)
    }
  }

  return forms
}

/** One `> ` line per form, naming the form only when there is more than one. */
function quoteForms(
  entries: ReadonlyArray<readonly [string, string]>
): ReadonlyArray<string> {
  const nameForms = entries.length > 1

  return entries.map(([qualifier, value]) =>
    nameForms && qualifier !== ''
      ? `> ${displayQualifier(qualifier)}: ${value}`
      : `> ${value}`
  )
}

/**
 * The report's body follows the shape the tracker's template asks for: what it
 * is about, how it looks now, what the source says, the proposed wording, why
 * it is better, and the build facts only the application itself knows.
 */
export function buildFeedbackIssueUrl(
  context: ITranslationIssueContext
): string {
  const { target, key, filter, search } = context

  const blocks: Array<string> = [t('localizationEditor.reportIssueScreen')]

  const current: Array<string> = [t('localizationEditor.reportIssueCurrent')]

  if (key === undefined) {
    current.push(t('localizationEditor.reportIssueCurrentHint'))
  } else {
    const forms = [...getFormsOf(target, key)]

    current.push(
      forms.length === 0
        ? `> ${t('localizationEditor.reportIssueUntranslated')}`
        : quoteForms(forms).join('\n')
    )
  }

  blocks.push(current.join('\n'))

  if (key !== undefined) {
    const reference = localization
      .getReference(key)
      .map(variant => [variant.qualifier, variant.template] as const)

    if (reference.length > 0) {
      blocks.push(
        [
          t('localizationEditor.reportIssueReference'),
          ...quoteForms(reference),
        ].join('\n')
      )
    }
  }

  blocks.push(
    [
      t('localizationEditor.reportIssueSuggested'),
      t('localizationEditor.reportIssueSuggestedHint'),
    ].join('\n')
  )

  blocks.push(t('localizationEditor.reportIssueWhy'))

  const details: Array<string> = [
    t('localizationEditor.reportIssueContext'),
    `- ${t('localizationEditor.reportIssueLanguage', { tag: target })}`,
    `- ${t('localizationEditor.reportIssueBuild', {
      version: getVersion(),
      sha: __SHA__.substring(0, 10),
    })}`,
  ]

  if (key !== undefined) {
    details.push(`- ${t('localizationEditor.reportIssueKey', { key })}`)
  }

  if (filter !== undefined) {
    const filterName =
      filter === 'missing'
        ? t('localizationEditor.filterMissing')
        : t('localizationEditor.filterTranslated')

    details.push(
      `- ${t('localizationEditor.reportIssueFilter', { filter: filterName })}`
    )
  }

  const trimmedSearch = search.trim()

  if (trimmedSearch !== '') {
    details.push(
      `- ${t('localizationEditor.reportIssueSearch', {
        search: trimmedSearch,
      })}`
    )
  }

  blocks.push(details.join('\n'))
  blocks.push(t('localizationEditor.reportIssueOtherLanguage'))

  const title =
    key === undefined
      ? t('localizationEditor.reportIssueTitle', { tag: target })
      : t('localizationEditor.reportIssueTitleKey', { key })

  return buildTranslationIssueUrl({
    title,
    body: blocks.join('\n\n'),
    labels: [TranslationIssueLabel],
  })
}
