import { t } from '../../lib/l10n'

const RestrictedFileExtensions = ['.cmd', '.exe', '.bat', '.sh']

// NOTE: метки вычисляются при первом импорте модуля, поэтому смена языка
// применяется к ним после перезапуска приложения. Экспорт оставлен константами
// строкового типа: на них завязаны потребители, которых мы правим параллельно
// и менять сигнатуру нельзя.
export const CopyFilePathLabel = t('contextMenu.copyFilePath')

export const CopyRelativeFilePathLabel = t('contextMenu.copyRelativeFilePath')

export const CopySelectedPathsLabel = t('contextMenu.copyPaths')

export const CopySelectedRelativePathsLabel = t('contextMenu.copyRelativePaths')

export const DefaultEditorLabel = t('contextMenu.openInExternalEditor')

export const DefaultShellLabel = t('contextMenu.openInShell')

export const RevealInFileManagerLabel = t('contextMenu.revealInFileManager')

export const TrashNameLabel = t('contextMenu.trashName')

export const OpenWithDefaultProgramLabel = t(
  'contextMenu.openWithDefaultProgram'
)

export function isSafeFileExtension(extension: string): boolean {
  if (__WIN32__) {
    return RestrictedFileExtensions.indexOf(extension.toLowerCase()) === -1
  }
  return true
}
