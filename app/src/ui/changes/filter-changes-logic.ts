import { IFileListFilterState } from '../../lib/app-state'
import { IChangesListItem } from './filter-changes-list'
import memoizeOne from 'memoize-one'
import { t } from '../../lib/l10n'

/**
 * Apply filter options to determine if a file should be shown
 * Uses AND logic - file must satisfy ALL active filters
 * Note: This is applied after the filterText has been applied
 */
export function applyFilterOptions(
  item: IChangesListItem,
  filters: IFileListFilterState
): boolean {
  // If no filters are active, show all files
  if (countActiveFilterOptions(filters) === 0) {
    return true
  }

  const { change } = item

  if (filters.isIncludedInCommit && !change.isIncludedInCommit()) {
    return false
  }

  if (filters.isExcludedFromCommit && !change.isExcludedFromCommit()) {
    return false
  }

  if (filters.isNewFile && !change.isNew() && !change.isUntracked()) {
    return false
  }

  if (filters.isModifiedFile && !change.isModified()) {
    return false
  }

  if (filters.isDeletedFile && !change.isDeleted()) {
    return false
  }

  // File matches all active filters
  return true
}

/**
 * Check if any files being committed are hidden by the current filter
 * Memoized to avoid recalculating for the same inputs
 */
export const isCommittingFileHiddenByFilter = memoizeOne(
  (
    fileIdsIncludedInCommit: ReadonlyArray<string>,
    filteredItems: Map<string, IChangesListItem>,
    fileCount: number,
    filters: IFileListFilterState
  ): boolean => {
    // All possible files are present in the list (no active filters or all files match active filters)
    if (!hasActiveFilters(filters) || filteredItems.size === fileCount) {
      return false
    }

    // If filtered rows count is 1 and included for commit rows count is 2,
    // there is no way the included for commit rows are visible regardless of
    // what they are.
    if (fileIdsIncludedInCommit.length > filteredItems.size) {
      return true
    }

    // If we can find a file id included in the commit that does not exist in
    // the filtered items, then we are committing a hidden file.
    return fileIdsIncludedInCommit.some(fId => !filteredItems.get(fId))
  }
)

/**
 * Generate message when no files match filters
 */
export function getNoResultsMessage(
  filters: IFileListFilterState
): string | undefined {
  if (!hasActiveFilters(filters)) {
    return undefined
  }

  const activeFilters: string[] = []

  if (filters.filterText) {
    activeFilters.push(`"${filters.filterText}"`)
  }

  if (filters.isIncludedInCommit) {
    activeFilters.push(t('changes.filter.name.included'))
  }

  if (filters.isExcludedFromCommit) {
    activeFilters.push(t('changes.filter.name.excluded'))
  }

  if (filters.isNewFile) {
    activeFilters.push(t('changes.filter.name.new'))
  }

  if (filters.isModifiedFile) {
    activeFilters.push(t('changes.filter.name.modified'))
  }

  if (filters.isDeletedFile) {
    activeFilters.push(t('changes.filter.name.deleted'))
  }

  if (activeFilters.length === 0) {
    return undefined
  }

  return t('changes.no-results-message', {
    filters: formatFilterList(activeFilters),
  })
}

/** The conjunction differs per language, so the shapes live in the catalog. */
function formatFilterList(activeFilters: ReadonlyArray<string>): string {
  if (activeFilters.length === 1) {
    return activeFilters[0]
  }

  if (activeFilters.length === 2) {
    return t('changes.filter.list.two', {
      first: activeFilters[0],
      second: activeFilters[1],
    })
  }

  return t('changes.filter.list.many', {
    others: activeFilters.slice(0, -1).join(', '),
    last: activeFilters[activeFilters.length - 1],
  })
}

/**
 * Count the number of active filter options
 * Note: This does not include the filterText filter
 */
export function countActiveFilterOptions(
  filters: IFileListFilterState
): number {
  return [
    filters.isIncludedInCommit,
    filters.isNewFile,
    filters.isModifiedFile,
    filters.isDeletedFile,
    filters.isExcludedFromCommit,
  ].filter(Boolean).length
}

/**
 * Check if there are any active filters
 */
export function hasActiveFilters(filters: IFileListFilterState): boolean {
  return filters.filterText !== '' || countActiveFilterOptions(filters) > 0
}

/**
 * Apply filters to a changes list item
 * Memoized to avoid recalculating for the same inputs
 */
export const applyFilters = memoizeOne(
  (
    item: IChangesListItem,
    showChangesFilter: boolean,
    filters: IFileListFilterState
  ) => {
    if (!showChangesFilter) {
      return true
    }

    return applyFilterOptions(item, filters)
  }
)
