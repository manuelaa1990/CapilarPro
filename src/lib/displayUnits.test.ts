import { describe, expect, it } from 'vitest'
import {
  diameterDigits,
  diameterFromMm,
  fmtFixed,
  lengthDigits,
  lengthFromM,
} from './displayUnits'

describe('display units', () => {
  it('keeps millimeters and meters as the internal reference', () => {
    expect(diameterFromMm(0.8, 'mm')).toBe(0.8)
    expect(lengthFromM(1.53, 'm')).toBe(1.53)
  })

  it('converts millimeters to inches for display only', () => {
    expect(fmtFixed(diameterFromMm(0.8, 'in'), diameterDigits('in'))).toBe(
      '0,031',
    )
    expect(fmtFixed(diameterFromMm(0.8, 'mm'), diameterDigits('mm'))).toBe(
      '0,80',
    )
  })

  it('converts meters to centimeters and inches', () => {
    expect(lengthFromM(1.53, 'cm')).toBeCloseTo(153)
    expect(fmtFixed(lengthFromM(1.53, 'cm'), lengthDigits('cm'))).toBe('153,0')
    expect(fmtFixed(lengthFromM(1.53, 'in'), lengthDigits('in'))).toBe('60,24')
  })
})
