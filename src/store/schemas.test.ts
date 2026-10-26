import { describe, expect, it } from 'vitest'
import { defaultInput } from './schemas'
import { calculationInputSchema } from './schemas'

describe('validación del formulario', () => {
  it('acepta la entrada por defecto', () => {
    const result = calculationInputSchema.safeParse(defaultInput())
    expect(result.success).toBe(true)
    expect(defaultInput().frequencyHz).toBe(60)
  })

  it('migrates RPM from previously saved cases to a supported frequency', () => {
    const legacyInput: Record<string, unknown> = { ...defaultInput(), rpm: 2900 }
    delete legacyInput.frequencyHz
    const result = calculationInputSchema.safeParse(legacyInput)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.frequencyHz).toBe(50)
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
