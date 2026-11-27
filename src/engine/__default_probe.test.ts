import { describe, it } from 'vitest'
import { defaultInput } from '../store/schemas'
import { calculate } from './calculate'

describe('default probe', () => {
  it('logs default', () => {
    const input = defaultInput()
    const r = calculate(input)
    console.log(JSON.stringify({
      input,
      refSat: r.referenceSaturation,
      targetSat: r.targetSaturation,
      comp: r.compressor,
    }, null, 2))
  })
})
