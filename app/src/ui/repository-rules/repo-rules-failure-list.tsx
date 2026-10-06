import * as React from 'react'
import { GitHubRepository } from '../../models/github-repository'
import {
  RepoRulesMetadataFailure,
  RepoRulesMetadataFailures,
} from '../../models/repo-rules'
import { RepoRulesetsForBranchLink } from './repo-rulesets-for-branch-link'
import { RepoRulesetLink } from './repo-ruleset-link'
import { Trans } from '../../lib/l10n'

interface IRepoRulesMetadataFailureListProps {
  readonly repository: GitHubRepository
  readonly branch: string
  readonly failures: RepoRulesMetadataFailures

  /**
   * Text that will come before the standard text, should be the name of the rule
   * that's being checked. For example, "The email in your global Git config" or
   * "This commit message".
   */
  readonly leadingText: string | JSX.Element
}

/**
 * Returns a standard message for failed repo metadata rules.
 */
export class RepoRulesMetadataFailureList extends React.Component<IRepoRulesMetadataFailureListProps> {
  public render() {
    const { repository, branch, failures, leadingText } = this.props

    const totalFails = failures.failed.length + failures.bypassed.length
    const canBypass = failures.status === 'bypass'

    return (
      <div className="repo-rules-failure-list-component">
        <p>
          <Trans
            k={canBypass ? 'repoRules.failsWithBypass' : 'repoRules.fails'}
            params={{ count: totalFails }}
            components={{ subject: <>{leadingText}</> }}
          />{' '}
          <Trans
            k="repoRules.viewAllRulesets"
            components={{
              link: (
                <RepoRulesetsForBranchLink
                  repository={repository}
                  branch={branch}
                />
              ),
            }}
          />
        </p>
        {this.renderRuleFailureList(failures.failed, 'Failed')}
        {this.renderRuleFailureList(failures.bypassed, 'Bypassed')}
      </div>
    )
  }

  private renderRuleFailureList(
    failures: RepoRulesMetadataFailure[],
    label: string
  ) {
    if (failures.length === 0) {
      return null
    }
    const rulesText = __DARWIN__ ? 'Rules' : 'rules'
    const labelId = `repo-rule-list-label-${label.toLowerCase()}`
    return (
      <div className="repo-rule-list">
        <label id={labelId}>
          {label} {rulesText}:
        </label>
        <ul aria-labelledby={labelId}>
          {failures.map(f => (
            <li key={`${f.description}-${f.rulesetId}`}>
              <RepoRulesetLink
                repository={this.props.repository}
                rulesetId={f.rulesetId}
              >
                {f.description}
              </RepoRulesetLink>
            </li>
          ))}
        </ul>
      </div>
    )
  }
}
