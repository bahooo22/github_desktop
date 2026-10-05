import * as React from 'react'
import { ForkContributionTarget } from '../../models/workflow-preferences'
import { RepositoryWithForkedGitHubRepository } from '../../models/repository'
import { Trans } from '../../lib/l10n'

interface IForkSettingsDescription {
  readonly repository: RepositoryWithForkedGitHubRepository
  readonly forkContributionTarget: ForkContributionTarget
}

export function ForkSettingsDescription(props: IForkSettingsDescription) {
  // We can't use the getNonForkGitHubRepository() helper since we need to calculate
  // the value based on the temporary form state.
  const targetRepository =
    props.forkContributionTarget === ForkContributionTarget.Self
      ? props.repository.gitHubRepository
      : props.repository.gitHubRepository.parent

  const params = { repository: targetRepository.fullName }
  const components = { strong: <strong /> }

  return (
    <ul className="fork-settings-description">
      <li>
        <Trans
          k="repositorySettings.fork-desc-pull-requests"
          params={params}
          components={components}
        />
      </li>
      <li>
        <Trans
          k="repositorySettings.fork-desc-issues"
          params={params}
          components={components}
        />
      </li>
      <li>
        <Trans
          k="repositorySettings.fork-desc-view-on-github"
          params={params}
          components={components}
        />
      </li>
      <li>
        <Trans
          k="repositorySettings.fork-desc-new-branches"
          params={params}
          components={components}
        />
      </li>
      <li>
        <Trans
          k="repositorySettings.fork-desc-autocompletion"
          params={params}
          components={components}
        />
      </li>
    </ul>
  )
}
