import { describe, expect, it } from 'vitest'
import { defaultInput } from './schemas'
import { calculationInputSchema } from './schemas'

describe('validación del formulario', () => {
  it('acepta la entrada por defecto', () => {
    const result = calculationInputSchema.safeParse(defaultInput())
    expect(result.success).toBe(true)
    expect(defaultInput().frequencyHz).toBe(60)
    expect(defaultInput().compressorLabel).toBe('')
    expect(defaultInput().compressorId).toBe('custom')
    expect(defaultInput().ambientTempC).toBe(32.2)
    expect(defaultInput().returnGasTempC).toBe(32.2)
    expect(defaultInput().slhxActivo).toBe(false)
    expect(defaultInput().slhxPorcentaje).toBe(50)
    expect(defaultInput().slhxDiametroSuccion).toBe('5/16')
  })

  it('rechaza porcentajes SLHX fuera de 30-70', () => {
    const result = calculationInputSchema.safeParse({
      ...defaultInput(),
      slhxPorcentaje: 75,
    })
    expect(result.success).toBe(false)
  })

  it('rechaza un salto térmico insuficiente', () => {
    const result = calculationInputSchema.safeParse({
      ...defaultInput(),
      targetEvapC: 20,
      targetCondC: 24,
    })
    expect(result.success).toBe(false)
  })

  it('exige diámetro y longitud instalados juntos', () => {
    const result = calculationInputSchema.safeParse({
      ...defaultInput(),
      installedDiameterMm: 1.1,
      installedLengthM: null,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path[0] === 'installedLengthM',
        ),
      ).toBe(true)
    }
  })

  it('rechaza longitudes y diámetros fuera de rango', () => {
    const result = calculationInputSchema.safeParse({
      ...defaultInput(),
      installedDiameterMm: 4,
      installedLengthM: 12,
    })
    expect(result.success).toBe(false)
  })
})
