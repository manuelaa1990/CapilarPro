import { beforeEach, describe, expect, it } from 'vitest'
import { calculate } from '../engine/calculate'
import { defaultInput } from './schemas'
import { loadCases, quarantinedCaseCount, storageKeys } from './userData'

const savedCaseWithSubcool = (subcoolK: number) => {
  const input = { ...defaultInput(), targetSubcoolK: subcoolK }
  const result = calculate(input)
  return {
    id: 'case-test-1',
    createdAt: '2026-10-28T10:00:00.000Z',
    updatedAt: '2026-10-28T10:00:00.000Z',
    fingerprint: result.fingerprint,
    result,
    actual: null,
    source: 'calculation' as const,
  }
}

describe('userData', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('carga los casos que cumplen el esquema', () => {
    const valid = savedCaseWithSubcool(5)
    window.localStorage.setItem(storageKeys.cases, JSON.stringify([valid]))

    expect(loadCases()).toHaveLength(1)
    expect(quarantinedCaseCount()).toBe(0)
  })

  it('conserva en cuarentena los casos que ya no cumplen el esquema', () => {
    const invalid = savedCaseWithSubcool(31)
    const raw = JSON.stringify([invalid])
    window.localStorage.setItem(storageKeys.cases, raw)

    expect(loadCases()).toEqual([])
    expect(quarantinedCaseCount()).toBe(1)
    expect(window.localStorage.getItem(storageKeys.cases)).toBe(raw)
    expect(window.localStorage.getItem(storageKeys.quarantine)).toContain(
      '"targetSubcoolK":31',
    )
  })
})
