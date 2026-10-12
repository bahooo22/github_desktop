import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  IDownloadSample,
  measureDownload,
} from '../../src/lib/update-download-progress'

function sample(at: number, bytes: number): IDownloadSample {
  return { at, bytes }
}

describe('update download progress', () => {
  it('averages the rate over the window it was given', () => {
    const rate = measureDownload(
      [
        sample(0, 1_000_000),
        sample(1000, 3_000_000),
        sample(2000, 5_000_000),
        sample(3000, 7_000_000),
      ],
      5000
    )

    assert.notEqual(rate, null)
    assert.equal(rate?.elapsedMs, 3000)
    assert.equal(rate?.bytesInWindow, 6_000_000)
    assert.equal(rate?.bytesPerSecond, 2_000_000)
  })

  it('drops readings older than the window', () => {
    // Two whole windows of history: only the readings that fall inside the
    // last five seconds may influence the number, otherwise a stalled start
    // would keep flattering the rate forever.
    const rate = measureDownload(
      [sample(0, 0), sample(4000, 100), sample(8000, 200), sample(12000, 300)],
      5000
    )

    assert.deepEqual(rate, {
      bytesPerSecond: 25,
      bytesInWindow: 100,
      elapsedMs: 4000,
    })
  })

  it('says nothing when the bytes went down', () => {
    // Squirrel restarts a download from scratch when a package turns out to be
    // the wrong one, and zero would read as a stalled download.
    const rate = measureDownload([sample(0, 500), sample(1000, 100)], 5000)
    assert.equal(rate, null)
  })

  it('says nothing about readings taken at the same moment', () => {
    const rate = measureDownload([sample(1000, 100), sample(1000, 200)], 5000)
    assert.equal(rate, null)
  })

  it('needs more than one reading', () => {
    assert.equal(measureDownload([], 5000), null)
    assert.equal(measureDownload([sample(0, 100)], 5000), null)
  })

  it('holds a steady rate across a minute of one-second ticks', () => {
    const mebibytesPerSecond = 2 * 1024 * 1024
    const samples: IDownloadSample[] = []
    for (let tick = 0; tick < 12; tick++) {
      samples.push(sample(tick * 1000, tick * mebibytesPerSecond))
    }

    // The window spans exactly five ticks, so the estimate is the real rate.
    assert.deepEqual(measureDownload(samples, 5000), {
      bytesPerSecond: mebibytesPerSecond,
      bytesInWindow: 5 * mebibytesPerSecond,
      elapsedMs: 5000,
    })

    // A single slow tick in the middle of the window moves the estimate a
    // little, but does not drop it to zero the way a two-point measure would.
    const withStall = [...samples]
    withStall[9] = sample(9000, withStall[8].bytes)
    const stalled = measureDownload(withStall, 5000)
    assert.notEqual(stalled, null)
    assert.ok(stalled!.bytesPerSecond > mebibytesPerSecond * 0.5)
  })
})
