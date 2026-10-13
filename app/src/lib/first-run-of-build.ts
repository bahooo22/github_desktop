import { getObject, setObject } from './local-storage'

/**
 * Возраст сборки, а не возраст последней проверки обновлений.
 *
 * Единственная дата, которую апстримный апдейтер держит в состоянии, — это
 * `last-successful-update-check` (`update-store.ts`), и её обновляет каждая
 * удачная проверка, в том числе автостарт и таймер на 4 часа. Поэтому фраза
 * «установлено … назад» на ней обнуляется, хотя установка не происходила.
 *
 * Различать сборки по версии нельзя: `app/package.json:6` держит апстримную базу
 * (`3.6.8-beta2`), и все сборки форка на одном мерже имеют одну и ту же базу —
 * форк отличается только коммитом, из которого его собрали. Он и приходит в
 * renderer как `__SHA__` (`globals.d.ts:41`), тот же номер показан в диалоге
 * «О программе» (`about.tsx:458`). Отсюда ключ — SHA: он меняется ровно один раз
 * при обновлении и не меняется при перезапуске той же сборки.
 */
const storageKey = 'first-run-of-build'

interface IStoredFirstRun {
  readonly sha: string
  /** Epoch миллисекунды первого запуска этой сборки. */
  readonly firstRunAt: number
}

/**
 * Значение живёт в localStorage и может быть испорчено или из будущего (ручная
 * правка, перенос профиля между машинами, переведённые часы). Такую дату
 * показывать нельзя — возраст получился бы отрицательным.
 */
function parseStored(value: IStoredFirstRun | undefined): Date | undefined {
  if (value === undefined || typeof value !== 'object') {
    return undefined
  }

  const { sha, firstRunAt } = value

  if (typeof sha !== 'string' || typeof firstRunAt !== 'number') {
    return undefined
  }

  if (!Number.isFinite(firstRunAt)) {
    return undefined
  }

  const date = new Date(firstRunAt)
  const timestamp = date.getTime()

  if (timestamp !== firstRunAt || timestamp > Date.now()) {
    return undefined
  }

  return date
}

/**
 * Записать время первого запуска этой сборки. Повторный вызов той же сборкой
 * ничего не трогает — на этом держится устойчивость счётчика к перезапускам и к
 * проверкам обновлений.
 */
export function recordBuildFirstRun(): void {
  const stored = getObject<IStoredFirstRun>(storageKey)

  if (stored?.sha === __SHA__ && parseStored(stored) !== undefined) {
    return
  }

  setObject(storageKey, { sha: __SHA__, firstRunAt: Date.now() })
}

/** Когда сборка с текущим `__SHA__` запустилась впервые. */
export function getBuildFirstRun(): Date | undefined {
  const stored = getObject<IStoredFirstRun>(storageKey)

  if (stored?.sha !== __SHA__) {
    return undefined
  }

  return parseStored(stored)
}
