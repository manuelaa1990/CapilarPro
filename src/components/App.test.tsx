import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'

describe('CapilarPro', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = ''
  })

  it('renderiza la calculadora con un resultado y el ancla de placa', async () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /Del dato de placa al capilar/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Recomendación primaria')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Datos del compresor y placa/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Frecuencia de red' })).toHaveValue(
      '60',
    )
    expect(screen.getByRole('combobox', { name: 'Refrigerante' })).toHaveValue(
      'R134a',
    )
    expect(screen.getAllByText(/R134a/i).length).toBeGreaterThan(0)
  })

  it('permite editar el código o modelo del compresor', async () => {
    const user = userEvent.setup()
    render(<App />)

    const compressorLabel = screen.getByRole('textbox', {
      name: /Código o modelo del compresor/i,
    })
    await user.clear(compressorLabel)
    await user.type(compressorLabel, 'QD110H')

    expect(compressorLabel).toHaveValue('QD110H')
  })

  it('conserva los datos de placa del compresor personalizado al cambiar de refrigerante', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Compresor de la biblioteca' }),
      'custom',
    )

    const [capacity, displacement] = screen.getAllByRole('spinbutton')
    await user.clear(capacity)
    await user.type(capacity, '987')
    await user.clear(displacement)
    await user.type(displacement, '12.4')
    await user.clear(screen.getByLabelText('Evap. referencia'))
    await user.type(screen.getByLabelText('Evap. referencia'), '-18')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Refrigerante' }),
      'R600a',
    )

    expect(
      screen.getByRole('combobox', { name: 'Compresor de la biblioteca' }),
    ).toHaveValue('custom')
    expect(capacity).toHaveValue(987)
    expect(displacement).toHaveValue(12.4)
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-18)
  })

  it('muestra solo los nombres de refrigerantes y advierte para mezclas zeotrópicas', async () => {
    const user = userEvent.setup()
    render(<App />)

    const refrigerant = screen.getByRole('combobox', { name: 'Refrigerante' })
    expect(
      screen.getByRole('option', { name: 'R407C' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'R417A' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'R422D' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'R427A' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /R438A/i }),
    ).not.toBeInTheDocument()

    await user.selectOptions(refrigerant, 'R407C')
    expect(
      screen.getByText(
        '⚠️ Mezcla zeotrópica. Cargar siempre en fase líquida.',
      ),
    ).toBeInTheDocument()
  })

  it('conserva el valor físico al cambiar unidades de capacidad y desplazamiento', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad de capacidad' }),
      'BTU/h',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad de desplazamiento' }),
      'in³/rev',
    )

    expect(screen.getByRole('spinbutton', { name: /Capacidad declarada/ })).toHaveValue(
      1300 * 3.412,
    )
    const displacementInput = screen.getByRole('spinbutton', {
      name: /Desplazamiento/,
    }) as HTMLInputElement
    expect(Number(displacementInput.value)).toBeCloseTo(15.3 / 16.387, 8)
  })

  it('actualiza las condiciones de referencia por norma y aplicación', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Norma del dato de placa' }),
      'en12900',
    )
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(5)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(50)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Aplicación' }),
      'LBP',
    )
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-35)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(40)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(20)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(0)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Norma del dato de placa' }),
      'custom',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Aplicación' }),
      'HBP',
    )
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-35)
  })

  it('navega al historial y carga los casos de demostración', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: 'Historial' })[0])
    expect(
      await screen.findByRole('heading', {
        name: /Cada caso real hace que el modelo sea tuyo/i,
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Cargar 3 casos de demostración/i,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('Cálculos')).toBeInTheDocument()
    })
    expect(screen.getByText('3 de 3')).toBeInTheDocument()
    expect(screen.getAllByText('Validados').length).toBeGreaterThan(0)
  })
})
