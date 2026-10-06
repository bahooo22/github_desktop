import { IMenuItem } from '../../lib/menu-item'
import { t } from '../../lib/l10n'

interface IPullRequestContextMenuConfig {
  onViewPullRequestOnGitHub?: () => void
  onCheckoutInNewWorktree?: () => void
}

export function generatePullRequestContextMenuItems(
  config: IPullRequestContextMenuConfig
): IMenuItem[] {
  const { onViewPullRequestOnGitHub, onCheckoutInNewWorktree } = config
  const items = new Array<IMenuItem>()

  if (onViewPullRequestOnGitHub !== undefined) {
    items.push({
      label: t('branches.view-pr-on-github'),
      action: () => onViewPullRequestOnGitHub(),
    })
  }

  if (onCheckoutInNewWorktree !== undefined) {
    items.push({
      label: t('branches.checkout-in-new-worktree'),
      action: () => onCheckoutInNewWorktree(),
    })
  }

  return items
}
