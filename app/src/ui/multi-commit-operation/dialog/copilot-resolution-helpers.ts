import { ManualConflictResolution } from '../../../models/manual-conflict-resolution'
import {
  ConflictedFileStatus,
  GitStatusEntry,
  isManualConflict,
  ManualConflict,
} from '../../../models/status'
import * as octicons from '../../octicons/octicons.generated'
import { t } from '../../../lib/l10n'

export type CopilotFileResolutionChoice = 'copilot' | 'ours' | 'theirs'

/** Icon for each resolution choice. */
export const resolutionChoices = {
  copilot: { icon: octicons.copilot },
  ours: { icon: octicons.chevronLeft },
  theirs: { icon: octicons.chevronRight },
} as const

/** Label for each resolution choice, translated at render time. */
export function getResolutionChoiceLabel(
  choice: CopilotFileResolutionChoice
): string {
  switch (choice) {
    case 'copilot':
      return 'Copilot'
    case 'ours':
      return t('multiCommit.resolutionChoice.current')
    case 'theirs':
      return t('multiCommit.resolutionChoice.incoming')
  }
}

/**
 * Derive the resolution choice for a file from the manual resolutions map.
 * Defaults to 'copilot' when no manual override is set.
 */
export function getResolutionChoiceForFile(
  path: string,
  manualResolutions: Map<string, ManualConflictResolution>
): CopilotFileResolutionChoice {
  const manual = manualResolutions.get(path)
  if (manual === ManualConflictResolution.ours) {
    return 'ours'
  }
  if (manual === ManualConflictResolution.theirs) {
    return 'theirs'
  }
  return 'copilot'
}

/**
 * Returns true when the conflicted file status represents a delete-vs-modify
 * conflict: one side deleted the file, the other modified it.
 */
export function isDeleteConflictFile(
  status: ConflictedFileStatus
): status is ManualConflict {
  if (!isManualConflict(status)) {
    return false
  }
  const { us, them } = status.entry
  return (
    (us === GitStatusEntry.Deleted && them !== GitStatusEntry.Deleted) ||
    (them === GitStatusEntry.Deleted && us !== GitStatusEntry.Deleted)
  )
}

/**
 * For a delete-vs-modify conflict, returns which side deleted the file.
 */
export function getDeletedSide(
  status: ManualConflict
): 'ours' | 'theirs' | undefined {
  if (status.entry.us === GitStatusEntry.Deleted) {
    return 'ours'
  }
  if (status.entry.them === GitStatusEntry.Deleted) {
    return 'theirs'
  }
  return undefined
}

/**
 * Context menu labels for a delete-vs-modify conflict file. Returns
 * user-friendly labels like "Keep file (from branch-x)" and
 * "Delete file (from branch-y)" mapped to 'ours' and 'theirs'.
 */
export function getDeleteConflictLabels(
  status: ManualConflict,
  ourBranch?: string,
  theirBranch?: string
): { readonly oursLabel: string; readonly theirsLabel: string } {
  const deletedSide = getDeletedSide(status)

  if (deletedSide === 'ours') {
    return {
      oursLabel: ourBranch
        ? t('multiCommit.deleteConflict.deleteFileOn', {
            branch: ourBranch,
          })
        : t('multiCommit.deleteConflict.deleteFile'),
      theirsLabel: theirBranch
        ? t('multiCommit.deleteConflict.keepFileFrom', {
            branch: theirBranch,
          })
        : t('multiCommit.deleteConflict.keepFile'),
    }
  }

  return {
    oursLabel: ourBranch
      ? t('multiCommit.deleteConflict.keepFileFrom', { branch: ourBranch })
      : t('multiCommit.deleteConflict.keepFile'),
    theirsLabel: theirBranch
      ? t('multiCommit.deleteConflict.deleteFileOn', { branch: theirBranch })
      : t('multiCommit.deleteConflict.deleteFile'),
  }
}

/**
 * For a delete-vs-modify conflict, returns the resolution choice label
 * ("Keep file" or "Delete file") for the current choice.
 */
export function getDeleteConflictChoiceLabel(
  choice: CopilotFileResolutionChoice,
  status: ManualConflict
): string {
  const deletedSide = getDeletedSide(status)

  if (choice === 'copilot') {
    return 'Copilot'
  }

  if (deletedSide === 'ours') {
    return choice === 'ours'
      ? t('multiCommit.deleteConflict.deleteFile')
      : t('multiCommit.deleteConflict.keepFile')
  }

  return choice === 'ours'
    ? t('multiCommit.deleteConflict.keepFile')
    : t('multiCommit.deleteConflict.deleteFile')
}

/**
 * Returns the ours/theirs dropdown labels for a conflicted file, handling
 * both delete-vs-modify and regular text conflicts.
 */
export function getOursTheirsLabels(
  status: ConflictedFileStatus | undefined,
  ourBranch?: string,
  theirBranch?: string
): { readonly oursLabel: string; readonly theirsLabel: string } {
  if (status !== undefined && isDeleteConflictFile(status)) {
    return getDeleteConflictLabels(status, ourBranch, theirBranch)
  }

  const oursLabel = ourBranch
    ? t('multiCommit.conflictChoice.currentFromFile', { branch: ourBranch })
    : t('multiCommit.conflictChoice.currentFile')
  const theirsLabel = theirBranch
    ? t('multiCommit.conflictChoice.incomingFromFile', { branch: theirBranch })
    : t('multiCommit.conflictChoice.incomingFile')
  return { oursLabel, theirsLabel }
}
