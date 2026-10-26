import { describe, expect, it } from 'vitest'
import {
  fmt,
  fmtCompact,
  formatDecimalInput,
  limitDecimalInput,
} from './format'

describe('numeric formatting', () => {
  it('limits displayed values to two decimal places', () => {
    expect(fmt(1.2345, 4)).toBe('1,23')
    expect(fmtCompact(1.2345, 4)).toBe('1,23')
  })

  it('limits numeric input to two decimal places', () => {
    expect(limitDecimalInput('12.345')).toBe('12.35')
    expect(limitDecimalInput('-0.234')).toBe('-0.23')
    expect(limitDecimalInput('12.3')).toBe('12.3')
    expect(formatDecimalInput(12.3456)).toBe('12.35')
  })
})
