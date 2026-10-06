import { shell } from '../../lib/app-shell'
import { Dispatcher } from '../dispatcher'
import { t } from '../../lib/l10n'

export async function openFile(
  fullPath: string,
  dispatcher: Dispatcher
): Promise<void> {
  const errorMessage = await shell.openPath(fullPath)

  if (errorMessage !== '') {
    const error = {
      name: 'no-external-program',
      message: t('openFile.noExternalProgram', { fullPath }),
    }
    await dispatcher.postError(error)
  }
}
