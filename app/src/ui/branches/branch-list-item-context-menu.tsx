import { IMenuItem } from '../../lib/menu-item'
import { t } from '../../lib/l10n'
import { writeClipboardText } from '../main-process-proxy'
import { Branch, BranchType } from '../../models/branch'

interface IBranchContextMenuConfig {
  branch: Branch
  onRenameBranch?: (branchName: string) => void
  onViewBranchOnGitHub?: () => void
  onViewPullRequestOnGitHub?: () => void
  onDeleteBranch?: (branchName: string) => void
  onCheckoutInNewWorktree?: (branch: Branch) => void
}

export function generateBranchContextMenuItems(
  config: IBranchContextMenuConfig
): IMenuItem[] {
  const {
    branch,
    onRenameBranch,
    onViewBranchOnGitHub,
    onViewPullRequestOnGitHub,
    onDeleteBranch,
    onCheckoutInNewWorktree,
  } = config
  const items = new Array<IMenuItem>()

  if (onRenameBranch !== undefined) {
    items.push({
      label: t('branches.rename'),
      action: () => onRenameBranch(branch.name),
      enabled: branch.type === BranchType.Local,
    })
  }

  items.push({
    label: t('branches.copy-name'),
    action: () => writeClipboardText(branch.name),
  })

  if (onViewBranchOnGitHub !== undefined) {
    items.push({
      label: t('branches.view-on-github'),
      action: () => onViewBranchOnGitHub(),
    })
  }

  if (onViewPullRequestOnGitHub !== undefined) {
    items.push({
      label: t('branches.view-pr-on-github'),
      action: () => onViewPullRequestOnGitHub(),
    })
  }

  if (onCheckoutInNewWorktree !== undefined) {
    items.push({
      label: t('branches.checkout-in-new-worktree'),
      action: () => onCheckoutInNewWorktree(branch),
    })
  }

  items.push({ type: 'separator' })

  if (onDeleteBranch !== undefined) {
    items.push({
      label: t('branches.delete'),
      action: () => onDeleteBranch(branch.name),
    })
  }

  return items
}
