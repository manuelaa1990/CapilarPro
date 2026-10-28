import { beforeEach, describe, expect, it } from 'vitest'
import { calculate } from '../engine/calculate'
import { defaultInput } from '../store/schemas'
import {
  confidenceToDatabase,
  pendingQueueSize,
  saveCalculation,
} from './saveCalculation'

describe('confidenceToDatabase', () => {
  it('converts the UI percentage score to the database 0–1 range', () => {
    expect(confidenceToDatabase(95)).toBe(0.95)
    expect(confidenceToDatabase(30)).toBe(0.3)
  })
})

describe('saveCalculation', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('no encola ni escribe nada cuando la sincronización está desactivada', async () => {
    const result = calculate(defaultInput())

    await expect(saveCalculation(result)).resolves.toBe('disabled')
    expect(pendingQueueSize()).toBe(0)
    expect(
      window.localStorage.getItem('capilarpro:v1:pending_solutions'),
    ).toBeNull()
  })

  it('trata el modo test como local aunque se pida sincronizar', async () => {
    const result = calculate(defaultInput())

    await expect(saveCalculation(result, true)).resolves.toBe('disabled')
    expect(pendingQueueSize()).toBe(0)
  })
})
