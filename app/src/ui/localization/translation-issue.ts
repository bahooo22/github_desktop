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
