import { describe, expect, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import { calculate } from './calculate'

/**
 * Caso real validado en campo: compresor de R404A de 1900 BTU/h con placa
 * MBP usado en LBP a -23,3 °C. En banco se instaló un capilar de 0,074"
 * (1,88 mm) x 1,20 m y la máquina enfrió correctamente.
 *
 * 1900 BTU/h = 556,8 W. El punto de placa queda en la condición MBP de la
 * semilla; el capilar se dimensiona en la condición requerida LBP.
 */
const fieldCase = () => ({
  ...defaultInput(),
  refrigerantId: 'R404A' as const,
  requiredRefrigerantId: 'R404A' as const,
  application: 'LBP' as const,
  declaredApplication: 'MBP' as const,
  ratedCapacity: 1900,
  capacityUnit: 'BTU/h' as const,
  targetEvapC: -23.3,
  targetCondC: 54.4,
  targetReturnGasTempC: 32.2,
})

const commercialIdsMm = [
  0.66, 0.787, 0.914, 1.067, 1.219, 1.372, 1.626, 1.778, 1.905, 2.032,
  2.159, 2.286, 2.54,
]

describe('caso de campo R404A 1900 BTU/h (MBP) en LBP -23,3 °C', () => {
  it('elige únicamente entre diámetros comerciales', () => {
    const result = calculate(fieldCase())

    expect(commercialIdsMm).toContain(result.capillary.diameterMm)
    expect(result.capillary.lengthM).toBeGreaterThan(0)
  })

  /**
   * PENDIENTE DE MODELO. Con 11,8 kg/h el balance homogéneo pide ~118 m de
   * tubo de 1,905 mm para caer de 2544 a 265 kPa; que la respuesta sea
   * 1,20 m exigiría un caudal de ~136 kg/h (~5,7 kW). Faltan dos cosas:
   *   1. confirmar si 0,074" es el diámetro exterior (interior = 0,042" = 1,067 mm);
   *   2. el multiplicador de fricción bifásica, que el modelo homogéneo no tiene.
   * Queda como xfail: cuando el motor reproduzca la geometría de campo, Vitest
   * la marcará como fallo y habrá que quitar el `.fails`.
   */
  it.fails('reproduce el capilar de 0,074" x 1,20 m', () => {
    const result = calculate(fieldCase())
    const { diameterMm, lengthM } = result.capillary

    expect([1.905, 1.778]).toContain(diameterMm)
    expect(lengthM).toBeGreaterThan(0.9)
    expect(lengthM).toBeLessThan(1.6)
  })
})
