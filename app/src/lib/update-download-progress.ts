/**
 * Один отсчёт незаконченного пакета обновления: сколько байт было на диске и
 * в какой момент.
 */
export interface IDownloadSample {
  /** Миллисекунды от эпохи, как их отдаёт `Date.now`. */
  readonly at: number

  /** Байты обновления, найденные на диске в этот момент. */
  readonly bytes: number
}

/** Скорость загрузки, измеренная между двумя отсчётами. */
export interface IDownloadRate {
  readonly bytesPerSecond: number

  /** Байты, пришедшие за измеренный отрезок. */
  readonly bytesInWindow: number

  /** Длина отрезка, за который измерена скорость, в миллисекундах. */
  readonly elapsedMs: number
}

/**
 * Прогресс скачивания обновления: его снимает main-process и раз в секунду
 * отдаёт renderer-у, поэтому тип общий для обеих сторон канала.
 */
export interface IUpdateDownloadProgress {
  readonly downloadedBytes: number

  /** Ноль, когда скачиваемый пакет не описан в `RELEASES` (дельта). */
  readonly totalBytes: number

  /** Проценты, или `null`, если общего размера не знаем. */
  readonly percent: number | null

  /** Байт в секунду, или `null`, пока отсчётов мало. */
  readonly bytesPerSecond: number | null
}

/**
 * Скорость загрузки по последним отсчётам, усреднённая за окно `windowMs`.
 *
 * Усреднение по окну, а не по двум последним точкам, нужно потому, что монитор
 * опрашивает диск раз в секунду: одна пауза между тиками (диск, антивирус)
 * иначе превратилась бы в провал до нуля и такой же скачок назад.
 *
 * Возвращает `null`, когда скорости сказать нельзя: отсчётов меньше двух, они
 * взяты в один момент времени, или байт стало меньше. Уменьшение — это не
 * «ноль байт в секунду», а смена пакета (Squirrel Windows переписывает
 * загрузку заново), и показывать ноль значило бы врать о зависшей загрузке.
 */
export function measureDownload(
  samples: ReadonlyArray<IDownloadSample>,
  windowMs: number = 5000
): IDownloadRate | null {
  if (samples.length < 2) {
    return null
  }

  const last = samples[samples.length - 1]
  const windowStart = last.at - windowMs

  // Самый ранний отсчёт внутри окна; если весь список старше окна, берём
  // первый — иначе первое тиканье после долгой паузы осталось бы без меры.
  let first = samples[0]
  for (const sample of samples) {
    if (sample.at >= windowStart) {
      first = sample
      break
    }
  }

  const elapsedMs = last.at - first.at
  if (elapsedMs <= 0) {
    return null
  }

  const bytesInWindow = last.bytes - first.bytes
  if (bytesInWindow < 0) {
    return null
  }

  return {
    bytesPerSecond: (bytesInWindow / elapsedMs) * 1000,
    bytesInWindow,
    elapsedMs,
  }
}
