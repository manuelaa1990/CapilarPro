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
})
