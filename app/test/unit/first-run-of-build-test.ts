import assert from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
  getBuildFirstRun,
  recordBuildFirstRun,
} from '../../src/lib/first-run-of-build'

const storageKey = 'first-run-of-build'

const DAY = 24 * 60 * 60 * 1000

function seed(value: unknown) {
  localStorage.setItem(storageKey, JSON.stringify(value))
}

function readStored(): any {
  const raw = localStorage.getItem(storageKey)
  return raw === null ? undefined : JSON.parse(raw)
}

/** Текущий коммит сборки так же переопределяют тесты: он обычный глобал. */
function withSha(sha: string, run: () => void) {
  const previous = (globalThis as any).__SHA__
  ;(globalThis as any).__SHA__ = sha
  try {
    run()
  } finally {
    ;(globalThis as any).__SHA__ = previous
  }
}

describe('first run of build', () => {
  beforeEach(() => {
    localStorage.removeItem(storageKey)
  })

  afterEach(() => {
    localStorage.removeItem(storageKey)
  })

  it('writes the current time for a build it has not seen', () => {
    recordBuildFirstRun()

    const firstRun = getBuildFirstRun()
    assert.ok(firstRun !== undefined, 'после записи дата есть')
    assert.ok(
      Math.abs(Date.now() - firstRun!.getTime()) < 5_000,
      'записано время этого запуска, а не что-то из кэша'
    )
    assert.equal(readStored().sha, __SHA__)
  })

  it('leaves the stored date alone when the same build starts again', () => {
    // Это и есть устойчивость счётчика: перезапуск той же сборки не обнуляет
    // «первый запуск».
    const tenDaysAgo = Date.now() - 10 * DAY
    seed({ sha: __SHA__, firstRunAt: tenDaysAgo })

    recordBuildFirstRun()

    assert.equal(readStored().firstRunAt, tenDaysAgo)
    assert.equal(getBuildFirstRun()!.getTime(), tenDaysAgo)
  })

  it('resets exactly once when the build commit changes', () => {
    const tenDaysAgo = Date.now() - 10 * DAY
    seed({ sha: 'older-build-commit', firstRunAt: tenDaysAgo })

    recordBuildFirstRun()

    const afterUpdate = readStored().firstRunAt
    assert.ok(
      Math.abs(Date.now() - afterUpdate) < 5_000,
      'новая сборка записывает своё время'
    )
    assert.equal(readStored().sha, __SHA__)

    // Второй вызов той же сборки ничего не должен двигать.
    recordBuildFirstRun()
    assert.equal(readStored().firstRunAt, afterUpdate)
  })

  it('treats a build commit it does not match as unknown', () => {
    // Только записанный этой сборкой возраст имеет смысл показать.
    seed({ sha: 'another-build-commit', firstRunAt: Date.now() - DAY })
    assert.equal(getBuildFirstRun(), undefined)
  })

  it('rewrites a date from the future instead of a negative age', () => {
    // Ручная правка ключа, перенесённый профиль или переведённые часы.
    const fromFuture = Date.now() + 30 * DAY
    seed({ sha: __SHA__, firstRunAt: fromFuture })

    assert.equal(getBuildFirstRun(), undefined, 'такую дату показывать нельзя')

    recordBuildFirstRun()

    const fixed = getBuildFirstRun()
    assert.ok(fixed !== undefined && fixed.getTime() <= Date.now())
    assert.ok(Math.abs(Date.now() - fixed!.getTime()) < 5_000)
  })

  it('repairs a malformed value rather than throwing', () => {
    localStorage.setItem(storageKey, '{not json')
    assert.equal(getBuildFirstRun(), undefined)

    recordBuildFirstRun()
    assert.ok(getBuildFirstRun() !== undefined)

    seed({ sha: __SHA__, firstRunAt: 'вчерашнее число' })
    assert.equal(getBuildFirstRun(), undefined)
    recordBuildFirstRun()
    assert.equal(typeof readStored().firstRunAt, 'number')
  })

  it('survives a build constant changed under a still-valid record', () => {
    const tenDaysAgo = Date.now() - 10 * DAY
    seed({ sha: 'first-build', firstRunAt: tenDaysAgo })

    withSha('first-build', () => {
      // Той же сборкой — значит возраст не трогаем.
      recordBuildFirstRun()
      assert.equal(getBuildFirstRun()!.getTime(), tenDaysAgo)
    })

    // Другая сборка (та, что реально запущена) — записывает своё время.
    recordBuildFirstRun()
    assert.ok(Math.abs(Date.now() - readStored().firstRunAt) < 5_000)
  })
})
