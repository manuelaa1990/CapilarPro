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
    expect(defaultInput().slhxEfectividad).toBe(0.7)
  })

  it('migrates saved inputs without SLHX settings to the defaults', () => {
    const legacyInput: Record<string, unknown> = { ...defaultInput() }
    delete legacyInput.slhxActivo
    delete legacyInput.slhxEfectividad

    const result = calculationInputSchema.safeParse(legacyInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slhxActivo).toBe(false)
      expect(result.data.slhxEfectividad).toBe(0.7)
    }
  })

  it('rechaza una efectividad SLHX fuera de 0-1', () => {
    const result = calculationInputSchema.safeParse({
      ...defaultInput(),
      slhxEfectividad: 1.1,
    })
    expect(result.success).toBe(false)
  })

  it('migrates saved test temperatures to the standard defaults', () => {
    const legacyInput: Record<string, unknown> = { ...defaultInput() }
    delete legacyInput.ambientTempC
    delete legacyInput.returnGasTempC

    const result = calculationInputSchema.safeParse(legacyInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ambientTempC).toBe(32.2)
      expect(result.data.returnGasTempC).toBe(32.2)
    }
  })

  it('migrates saved operation points and derives return-gas temperature from legacy SH', () => {
    const legacyInput: Record<string, unknown> = {
      ...defaultInput(),
      targetEvapC: -10,
      targetSuperheatK: 12,
    }
    delete legacyInput.targetReturnGasTempC
    delete legacyInput.targetAmbientTempC

    const result = calculationInputSchema.safeParse(legacyInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.targetReturnGasTempC).toBe(2)
      expect(result.data.targetAmbientTempC).toBe(32.2)
    }
  })

  it('migrates RPM from previously saved cases to a supported frequency', () => {
    const legacyInput: Record<string, unknown> = { ...defaultInput(), rpm: 2900 }
    delete legacyInput.frequencyHz
    const result = calculationInputSchema.safeParse(legacyInput)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.frequencyHz).toBe(50)
  })

  it('migrates saved plate fields and assigns default metric units', () => {
    const legacyInput: Record<string, unknown> = {
      ...defaultInput(),
      ratedCapacityW: 1300,
      displacementCm3Rev: 15.3,
    }
    delete legacyInput.ratedCapacity
    delete legacyInput.capacityUnit
    delete legacyInput.displacement
    delete legacyInput.displacementUnit

    const result = calculationInputSchema.safeParse(legacyInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ratedCapacity).toBe(1300)
      expect(result.data.capacityUnit).toBe('W')
      expect(result.data.displacement).toBe(15.3)
      expect(result.data.displacementUnit).toBe('cm³/rev')
    }
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
