import forkChangelog from '../../../changelog-fork.json'
import { ReleaseNote, ReleaseSummary } from '../models/release-notes'
import { formatDate } from './format-date'
import { t } from './l10n/core'

/**
 * Записи форка живут в отдельном `changelog-fork.json`, а не в апстримном
 * `changelog.json`: апстрим перезаписывает свой файл на каждом мерже, и общая
 * история релизов терялась бы при первом же конфликте.
 *
 * Тексты заметок — ключи каталога, а не строки: панель «Примечания к выпуску»
 * входит в локализованный UI, и запись о локализации на одном языке
 * противоречила бы самому своему содержанию.
 */
function toReleaseNote(kind: string, message: string): ReleaseNote {
  if (
    kind === 'new' ||
    kind === 'fixed' ||
    kind === 'improved' ||
    kind === 'added' ||
    kind === 'removed' ||
    kind === 'pretext'
  ) {
    return { kind, message }
  }

  return { kind: 'other', message }
}

/**
 * Что добавила наша сборка к апстримной версии того же номера.
 *
 * Отбор по дате публикации, а не по `semver.gt`, как для апстримных записей:
 * форк различает сборки хешем коммита и датой, а номер версии держит
 * апстримным (см. `app/src/lib/fork-release.ts`), поэтому сравнение версий
 * отсекло бы запись о той самой сборке, которая установлена.
 *
 * `version` в файле — тоже апстримный номер: по нему диалог решает, показывать
 * ли кнопку установки
 * (`app/src/ui/release-notes/release-notes-dialog.tsx:142`), и равенство
 * установленной версии означает «обновлять нечем, просто закрой».
 */
export function getForkReleaseSummaries(
  buildDate: string
): ReadonlyArray<ReleaseSummary> {
  const installedAt = new Date(buildDate).getTime()

  return forkChangelog.releases
    .filter(release => new Date(release.pub_date).getTime() >= installedAt)
    .sort(
      (a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime()
    )
    .map(release => {
      const notes = release.notes.map(note =>
        toReleaseNote(note.kind, t(note.key))
      )

      return {
        latestVersion: release.version,
        datePublished: formatDate(new Date(release.pub_date), {
          time: false,
          dateStyle: 'long',
        }),
        pretext: notes.filter(n => n.kind === 'pretext'),
        enhancements: notes.filter(
          n => n.kind === 'new' || n.kind === 'added' || n.kind === 'improved'
        ),
        bugfixes: notes.filter(n => n.kind === 'fixed'),
        other: notes.filter(n => n.kind === 'removed' || n.kind === 'other'),
        thankYous: [],
      }
    })
}
