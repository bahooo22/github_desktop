import {
  ValidNotificationPullRequestReview,
  ValidNotificationPullRequestReviewState,
} from '../../lib/valid-notification-pull-request-review'
import * as octicons from '../octicons/octicons.generated'
import { OcticonSymbol } from '../octicons'
import { t } from '../../lib/l10n'

/** Returns the user-facing verb for a given review's state. */
export function getVerbForPullRequestReview(
  review: ValidNotificationPullRequestReview
) {
  switch (review.state) {
    case 'APPROVED':
      return t('notifications.verb.approved')
    case 'CHANGES_REQUESTED':
      return t('notifications.verb.requestedChanges')
    case 'COMMENTED':
      return t('notifications.verb.reviewed')
  }
}

type ReviewStateIcon = {
  symbol: OcticonSymbol
  className: string
}

/** Returns the icon info (symbol and class) for a given review's state. */
export function getPullRequestReviewStateIcon(
  state: ValidNotificationPullRequestReviewState
): ReviewStateIcon {
  switch (state) {
    case 'APPROVED':
      return {
        symbol: octicons.check,
        className: 'pr-review-approved',
      }
    case 'CHANGES_REQUESTED':
      return {
        symbol: octicons.fileDiff,
        className: 'pr-review-changes-requested',
      }
    case 'COMMENTED':
      return {
        symbol: octicons.eye,
        className: 'pr-review-commented',
      }
  }
}
