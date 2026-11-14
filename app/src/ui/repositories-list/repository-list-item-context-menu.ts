import {
  Repository,
  getRepositoryAccountIdentity,
} from '../../models/repository'
import { Account, isSameAccount } from '../../models/account'
import { IMenuItem } from '../../lib/menu-item'
import { Repositoryish } from './group-repositories'
import { writeClipboardText } from '../main-process-proxy'
import { t } from '../../lib/l10n'
import {
  RevealInFileManagerLabel,
  DefaultEditorLabel,
  DefaultShellLabel,
} from '../lib/context-menu'

interface IRepositoryListItemContextMenuConfig {
  repository: Repositoryish
  shellLabel: string | undefined
  externalEditorLabel: string | undefined
  askForConfirmationOnRemoveRepository: boolean
  /** The signed-in accounts. */
  accounts: ReadonlyArray<Account>
  onViewOnGitHub: (repository: Repositoryish) => void
  onOpenInShell: (repository: Repositoryish) => void
  onShowRepository: (repository: Repositoryish) => void
  onOpenInExternalEditor: (repository: Repositoryish) => void
  onRemoveRepository: (repository: Repositoryish) => void
  onChangeRepositoryAlias: (repository: Repository) => void
  onRemoveRepositoryAlias: (repository: Repository) => void
  onCreateWorktree?: (repository: Repository) => void
  onShowWorktrees?: (repository: Repository) => void
  onChangeRepositoryAccount: (repository: Repository, login: string) => void
  onShowRepositorySettings: (repository: Repository) => void
}

export const generateRepositoryListContextMenu = (
  config: IRepositoryListItemContextMenuConfig
) => {
  const { repository } = config
  const missing = repository instanceof Repository && repository.missing
  const github =
    repository instanceof Repository && repository.gitHubRepository != null
  const openInExternalEditor = config.externalEditorLabel
    ? t('contextMenu.openIn', { name: config.externalEditorLabel })
    : DefaultEditorLabel
  const openInShell = config.shellLabel
    ? t('contextMenu.openIn', { name: config.shellLabel })
    : DefaultShellLabel

  const items: ReadonlyArray<IMenuItem> = [
    ...buildAliasMenuItems(config),
    ...buildWorktreeMenuItems(config),
    ...buildAccountMenuItems(config),
    ...buildRepositorySettingsMenuItems(config),
    {
      label: t('repositoriesList.copyRepoName'),
      action: () => writeClipboardText(repository.name),
    },
    {
      label: t('repositoriesList.copyRepoPath'),
      action: () => writeClipboardText(repository.path),
    },
    { type: 'separator' },
    {
      label: t('menu.view-repository-on-github'),
      action: () => config.onViewOnGitHub(repository),
      enabled: github,
    },
    {
      label: openInShell,
      action: () => config.onOpenInShell(repository),
      enabled: !missing,
    },
    {
      label: RevealInFileManagerLabel,
      action: () => config.onShowRepository(repository),
      enabled: !missing,
    },
    {
      label: openInExternalEditor,
      action: () => config.onOpenInExternalEditor(repository),
      enabled: !missing,
    },
    { type: 'separator' },
    {
      label: config.askForConfirmationOnRemoveRepository
        ? t('menu.remove-repository-confirm')
        : t('menu.remove-repository'),
      action: () => config.onRemoveRepository(repository),
    },
  ]

  return items
}

const buildAliasMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  const items: Array<IMenuItem> = [
    {
      label:
        repository.alias == null
          ? t('repositoriesList.createAlias')
          : t('repositoriesList.changeAlias'),
      action: () => config.onChangeRepositoryAlias(repository),
    },
  ]

  if (repository.alias !== null) {
    items.push({
      label: t('repositoriesList.removeAlias'),
      action: () => config.onRemoveRepositoryAlias(repository),
    })
  }

  return items
}

const buildWorktreeMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository, onCreateWorktree, onShowWorktrees } = config

  if (!(repository instanceof Repository)) {
    return []
  }

  if (onCreateWorktree === undefined && onShowWorktrees === undefined) {
    return []
  }

  const items: Array<IMenuItem> = []

  if (onShowWorktrees !== undefined) {
    items.push({
      label: t('repositoriesList.showWorktrees'),
      action: () => onShowWorktrees(repository),
    })
  }

  if (onCreateWorktree !== undefined) {
    items.push({
      label: t('menu.create-worktree'),
      action: () => onCreateWorktree(repository),
    })
  }

  return items
}

/**
 * Build the Account submenu used to reassign a repository to another
 * signed-in account on its endpoint.
 *
 * The submenu is omitted when there is nothing to choose between: when the
 * repository is assigned and its endpoint has only one retained account
 * identity, or when it's unassigned and no account is signed in on its
 * endpoint. An assigned account that has been signed out is still listed
 * (checked and disabled) so users can see the current association.
 */
const buildAccountMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository } = config

  if (
    !(repository instanceof Repository) ||
    repository.gitHubRepository === null
  ) {
    return []
  }

  const { endpoint } = repository.gitHubRepository
  const assigned = getRepositoryAccountIdentity(repository)
  const eligible = config.accounts.filter(a => a.endpoint === endpoint)
  const signedOut =
    assigned !== null && !eligible.some(a => isSameAccount(a, assigned))
  const retainedCount = eligible.length + (signedOut ? 1 : 0)

  if (assigned === null ? eligible.length === 0 : retainedCount <= 1) {
    return []
  }

  const submenu: Array<IMenuItem> = []

  if (signedOut) {
    submenu.push({
      label: t('repositorySettings.account-signed-out-item', {
        login: assigned.login,
      }),
      type: 'checkbox',
      checked: true,
      enabled: false,
    })
  }

  for (const account of eligible) {
    const checked = isSameAccount(account, assigned)
    submenu.push({
      label: `@${account.login}`,
      type: 'checkbox',
      checked,
      action: checked
        ? undefined
        : () => config.onChangeRepositoryAccount(repository, account.login),
    })
  }

  return [{ label: 'Account', submenu }]
}

const buildRepositorySettingsMenuItems = (
  config: IRepositoryListItemContextMenuConfig
): ReadonlyArray<IMenuItem> => {
  const { repository } = config

  if (!(repository instanceof Repository) || repository.missing) {
    return []
  }

  return [
    {
      label: t('menu.show-repository-settings'),
      action: () => config.onShowRepositorySettings(repository),
    },
  ]
}
