import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { AppProvider } from '../store/AppStore'
import { useApp } from '../store/useApp'

const CompressorStateProbe = () => {
  const { input, chooseCompressor } = useApp()
  return (
    <>
      <button type="button" onClick={() => chooseCompressor('secop-sc15g')}>
        Select SC15G
      </button>
      <output data-testid="compressor-input">
        {JSON.stringify({
          compressorId: input.compressorId,
          refSuperheatK: input.refSuperheatK,
          refSubcoolK: input.refSubcoolK,
          frequencyHz: input.frequencyHz,
        })}
      </output>
    </>
  )
}

describe('CapilarPro', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = ''
  })

  it('renderiza la calculadora con un resultado y el ancla de placa', async () => {
    render(<App />)

    expect(
      await screen.findByRole('status', { name: '🟡 Modo Local' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Del dato de placa al capilar/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText('SELECCIÓN')).toBeInTheDocument()
    expect(screen.queryByText(/°C evaporación/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/°C condensación/i)).not.toBeInTheDocument()
    const plateRatio = screen.getByText(/^placa /)
    const pressureRatioMetric = plateRatio.parentElement
    expect(pressureRatioMetric).toHaveTextContent('RC')
    expect(pressureRatioMetric?.children[1]).toHaveTextContent(/^\d+,\d{2}$/)
    expect(plateRatio).toHaveTextContent(/^placa \d+,\d{2}$/)
    expect(screen.getByLabelText('Diámetro seleccionado')).toBeInTheDocument()
    expect(screen.getByLabelText('Longitud seleccionada')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Datos del compresor y placa/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Frecuencia de red' })).toHaveValue(
      '60',
    )
    expect(
      screen.queryByRole('combobox', { name: 'Compresor de la biblioteca' }),
    ).not.toBeInTheDocument()
    const compressorSearch = screen.getByRole('combobox', {
      name: /Código o modelo del compresor/i,
    })
    expect(compressorSearch).toHaveValue('')
    expect(compressorSearch).toHaveAttribute(
      'placeholder',
      'Ingresa nombre o código del compresor',
    )
    expect(screen.getByRole('combobox', { name: 'Refrigerante' })).toHaveValue(
      'R134a',
    )
    expect(screen.getAllByText(/R134a/i).length).toBeGreaterThan(0)
  })

  it('aplica las unidades seleccionadas a todas las recomendaciones visibles', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      within(screen.getByRole('group', { name: 'Unidad del diámetro' })).getByRole(
        'button',
        { name: 'in' },
      ),
    )
    await user.click(
      within(screen.getByRole('group', { name: 'Unidad de la longitud' })).getByRole(
        'button',
        { name: 'cm' },
      ),
    )

    const alternatives = screen
      .getByText('Alternativas de selección')
      .parentElement?.parentElement
    expect(alternatives).toHaveTextContent(/\bin\s*×.*cm/)

    await user.click(screen.getByRole('button', { name: 'Ver desglose técnico' }))
    const dialog = screen.getByRole('dialog', { name: 'Trazabilidad del cálculo' })
    expect(within(dialog).getByText(/D =/)).toHaveTextContent(/in · L =.*cm/)
    expect(within(dialog).getByText(/Banda de longitud:/)).toHaveTextContent(/cm/)
  })

  it('recalcula la selección al activar el SLHX', async () => {
    const user = userEvent.setup()
    render(<App />)

    const fingerprint = screen.getByText(/^CP-[A-F0-9]{8}$/).textContent
    const selectedLength = screen.getByLabelText('Longitud seleccionada')
      .textContent
    const selectedDiameter = screen.getByLabelText('Diámetro seleccionado')
      .textContent
    const slhxSwitch = screen.getByRole('switch', {
      name: 'Intercambiador Capilar/Succión (SLHX)',
    })
    const slhxButton = screen.getByRole('button', {
      name: 'Intercambiador Capilar/Succión (SLHX)',
    })

    expect(slhxSwitch).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.queryByRole('slider', { name: 'Porcentaje de capilar enrollado' }),
    ).not.toBeInTheDocument()
    await user.click(slhxButton)

    expect(slhxButton).toHaveAttribute('aria-pressed', 'true')
    expect(slhxSwitch).toHaveAttribute('aria-checked', 'true')
    const windingSlider = await screen.findByRole('slider', {
      name: 'Porcentaje de capilar enrollado',
    })
    expect(windingSlider).toHaveValue('50')
    const suctionDiameter = screen.getByRole('combobox', {
      name: 'Diámetro del tubo de succión',
    })
    expect(suctionDiameter).toHaveValue('5/16')
    await waitFor(() => {
      expect(screen.getByText(/^CP-[A-F0-9]{8}$/).textContent).not.toBe(
        fingerprint,
      )
      expect(
        screen.getByLabelText('Longitud seleccionada').textContent,
      ).not.toBe(selectedLength)
      expect(
        screen.getByLabelText('Diámetro seleccionado').textContent,
      ).toBe(selectedDiameter)
    })
    expect(screen.getByText(/Total: .* \| Enrollar:/)).toBeInTheDocument()
    const slhxResults = screen.getByRole('group', { name: 'Resultados del SLHX' })
    expect(slhxResults).toHaveTextContent('Longitud enrollada')
    expect(slhxResults).toHaveTextContent('Efectividad real')
    expect(screen.queryByText(/Enrollar .*Efectividad real/)).not.toBeInTheDocument()

    const lengthBeforeDiameterChange = screen.getByLabelText(
      'Longitud seleccionada',
    ).textContent
    await user.selectOptions(suctionDiameter, '1/2')
    expect(suctionDiameter).toHaveValue('1/2')

    await waitFor(() => {
      expect(
        screen.getByLabelText('Longitud seleccionada').textContent,
      ).not.toBe(lengthBeforeDiameterChange)
    })

    const lengthBeforePercentageChange = screen.getByLabelText(
      'Longitud seleccionada',
    ).textContent
    fireEvent.change(windingSlider, { target: { value: '55' } })
    expect(windingSlider).toHaveValue('55')
    await waitFor(() => {
      expect(
        screen.getByLabelText('Longitud seleccionada').textContent,
      ).not.toBe(lengthBeforePercentageChange)
    })

    await user.click(slhxSwitch)
    expect(slhxButton).toHaveAttribute('aria-pressed', 'false')
    expect(slhxSwitch).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.queryByRole('slider', { name: 'Porcentaje de capilar enrollado' }),
    ).not.toBeInTheDocument()
  })

  it('permite editar el código o modelo del compresor', async () => {
    const user = userEvent.setup()
    render(<App />)

    const compressorLabel = screen.getByRole('combobox', {
      name: /Código o modelo del compresor/i,
    })
    await user.clear(compressorLabel)
    expect(compressorLabel).toHaveValue('')
    expect(compressorLabel).toHaveAttribute(
      'placeholder',
      'Ingresa nombre o código del compresor',
    )
    await user.type(compressorLabel, 'QD110H')

    expect(compressorLabel).toHaveValue('QD110H')
  })

  it('permite elegir un compresor del catálogo con el teclado y rellena la placa', async () => {
    const user = userEvent.setup()
    render(<App />)

    const compressorSearch = screen.getByRole('combobox', {
      name: /Código o modelo del compresor/i,
    })
    await user.clear(compressorSearch)
    await user.type(compressorSearch, 'secop sc15g')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(compressorSearch).toHaveValue('Secop SC15G')
    expect(
      screen.getByRole('combobox', { name: 'Frecuencia de red' }),
    ).toHaveValue('50')
    const [capacity, displacement] = screen.getAllByRole('spinbutton')
    expect(capacity).toHaveValue(1300)
    expect(displacement).toHaveValue(15.3)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(11.1)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(8.3)
  })

  it('guarda los datos de placa y frecuencia del SC15G en el estado global', async () => {
    const user = userEvent.setup()
    render(
      <AppProvider>
        <CompressorStateProbe />
      </AppProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Select SC15G' }))

    expect(screen.getByTestId('compressor-input')).toHaveTextContent(
      JSON.stringify({
        compressorId: 'secop-sc15g',
        refSuperheatK: 11.1,
        refSubcoolK: 8.3,
        frequencyHz: 50,
      }),
    )
  })

  it('guarda los nombres personalizados recientes sin autocompletar la placa', async () => {
    const user = userEvent.setup()
    render(<App />)

    const capacity = screen.getAllByRole('spinbutton')[0]
    await user.clear(capacity)
    await user.type(capacity, '1377')
    const compressorSearch = screen.getByRole('combobox', {
      name: /Código o modelo del compresor/i,
    })
    await user.clear(compressorSearch)
    await user.type(compressorSearch, 'Compresor de Juan')
    await user.keyboard('{Enter}')

    expect(compressorSearch).toHaveValue('Compresor de Juan')
    expect(capacity).toHaveValue(1377)
    expect(window.localStorage.getItem('capilarpro:recent_compressors')).toContain(
      'Compresor de Juan',
    )

    await user.clear(compressorSearch)
    await user.type(compressorSearch, 'juan')
    expect(
      screen.getByRole('option', { name: /Compresor de Juan/ }),
    ).toBeInTheDocument()
  })

  it('conserva los datos de placa del compresor personalizado al cambiar de refrigerante', async () => {
    const user = userEvent.setup()
    render(<App />)

    const compressorSearch = screen.getByRole('combobox', {
      name: /Código o modelo del compresor/i,
    })
    await user.clear(compressorSearch)
    await user.type(compressorSearch, 'QD110H')
    await user.keyboard('{Enter}')

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

    expect(compressorSearch).toHaveValue('QD110H')
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

    const capacityInput = screen.getByRole('spinbutton', {
      name: /Capacidad declarada/,
    }) as HTMLInputElement
    expect(Number(capacityInput.value)).toBe(4435.6)
    const displacementInput = screen.getByRole('spinbutton', {
      name: /Desplazamiento/,
    }) as HTMLInputElement
    expect(Number(displacementInput.value)).toBe(0.93)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad de capacidad' }),
      'W',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad de desplazamiento' }),
      'cm³/rev',
    )
    expect(Number(capacityInput.value)).toBe(1300)
    expect(Number(displacementInput.value)).toBe(15.3)
  })

  it('limita los campos numéricos a dos decimales', async () => {
    const user = userEvent.setup()
    render(<App />)

    const evaporation = screen.getByRole('spinbutton', {
      name: 'Evaporación objetivo',
    })
    await user.clear(evaporation)
    await user.type(evaporation, '-10.345')

    expect(evaporation).toHaveValue(-10.35)
  })

  it('actualiza las condiciones de referencia por norma y aplicación', async () => {
    const user = userEvent.setup()
    render(<App />)

    const superheat = screen.getByLabelText('Recalentamiento')
    const subcooling = screen.getByLabelText('Subenfriamiento')
    expect(superheat).toHaveAttribute('readonly')
    expect(subcooling).toHaveAttribute('readonly')
    expect(
      screen.getByText(
        /Valores calculados según el estándar\. Modificar solo si la hoja técnica/i,
      ),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: '¿Tienes otros datos? Editar manualmente',
      }),
    )
    expect(superheat).not.toHaveAttribute('readonly')
    await user.clear(superheat)
    await user.type(superheat, '12')
    expect(superheat).toHaveValue(12)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estándar de ensayo' }),
      'en12900',
    )
    expect(superheat).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(5)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(50)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Aplicación' }),
      'LBP',
    )
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-35)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(40)
    expect(screen.getByLabelText('Temp. Ambiente')).toHaveValue(32.2)
    expect(screen.getByLabelText('Temp. Retorno')).toHaveValue(32.2)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(67.2)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(7.8)

    await user.clear(screen.getByLabelText('Temp. Retorno'))
    await user.type(screen.getByLabelText('Temp. Retorno'), '31')
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(66)

    await user.clear(screen.getByLabelText('Temp. Ambiente'))
    await user.type(screen.getByLabelText('Temp. Ambiente'), '30')
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(10)

    await user.clear(screen.getByLabelText('Evap. referencia'))
    await user.type(screen.getByLabelText('Evap. referencia'), '-30')
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(61)

    await user.clear(screen.getByLabelText('Cond. referencia'))
    await user.type(screen.getByLabelText('Cond. referencia'), '45')
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(15)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estándar de ensayo' }),
      'custom',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Aplicación' }),
      'HBP',
    )
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-30)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(61)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(15)
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

  it('permite editar SH y muestra alerta de bajo salto del condensador', async () => {
    const user = userEvent.setup()
    render(<App />)

    const superheat = screen.getByRole('spinbutton', {
      name: 'Recalentamiento (SH)',
    })
    expect(superheat).toHaveValue(10)

    const returnGas = screen.getByRole('spinbutton', {
      name: 'Temperatura de Retorno de gas',
    })
    await user.clear(returnGas)
    await user.type(returnGas, '12')
    expect(superheat).toHaveValue(17)

    await user.clear(superheat)
    await user.type(superheat, '15')
    expect(returnGas).toHaveValue(10)

    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByText('P sat')).not.toBeInTheDocument()

    const ambient = screen.getByRole('spinbutton', {
      name: 'Temperatura Ambiente',
    })
    await user.clear(ambient)
    await user.type(ambient, '42')
    expect(
      screen.getByText(/Salto térmico bajo entre ambiente y condensación/),
    ).toBeInTheDocument()
  })

  it('no muestra un error de sincronización cuando el envío está desactivado', async () => {
    const user = userEvent.setup()
    render(<App />)

    const ambient = screen.getByRole('spinbutton', {
      name: 'Temperatura Ambiente',
    })
    await user.clear(ambient)
    await user.type(ambient, '42')

    expect(
      await screen.findByText(/Salto térmico bajo entre ambiente y condensación/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/No se pudo sincronizar con Neon/),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Se sincronizará cuando Neon esté disponible/),
    ).not.toBeInTheDocument()
    expect(
      window.localStorage.getItem('capilarpro:v1:pending_solutions'),
    ).toBeNull()
  })

  it('bloquea el guardado si el capilar instalado está incompleto', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /Capilar instalado y notas/i }),
    )
    await user.type(screen.getByLabelText('Diámetro interior instalado'), '0.7')

    await user.click(
      screen.getAllByRole('button', { name: 'Guardar y aprender' })[0],
    )

    expect(
      await screen.findByText(/No se puede guardar: revisa los límites/),
    ).toBeInTheDocument()
    expect(screen.getByText(/0 cálculos en memoria/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Longitud instalada'), '1.2')
    await user.click(
      screen.getAllByRole('button', { name: 'Guardar y aprender' })[0],
    )

    expect(await screen.findByText(/Caso guardado\./)).toBeInTheDocument()
    expect(screen.getByText(/1 cálculos en memoria/)).toBeInTheDocument()
  })
})
