import { describe, expect, it } from 'vitest'
import { confidenceToDatabase } from './saveCalculation'

describe('confidenceToDatabase', () => {
  it('converts the UI percentage score to the database 0–1 range', () => {
    expect(confidenceToDatabase(95)).toBe(0.95)
    expect(confidenceToDatabase(30)).toBe(0.3)
  })
})
