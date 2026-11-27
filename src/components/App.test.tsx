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

const DeclaredApplicationProbe = () => {
  const { input, result, updateInput } = useApp()
  return (
    <>
      <button
        type="button"
        onClick={() => updateInput({ declaredApplication: 'MBP' })}
      >
        Declare MBP
      </button>
      <output data-testid="declared-application">
        {`${input.declaredApplication ?? 'none'} / ${
          result?.input.declaredApplication ?? 'none'
        }`}
      </output>
    </>
  )
}

const EphemeralInputProbe = () => {
  const { input, updateInput } = useApp()
  return (
    <>
      <button type="button" onClick={() => updateInput({ refrigerantId: 'R600a' })}>
        Change refrigerant
      </button>
      <output data-testid="refrigerant-input">{input.refrigerantId}</output>
    </>
  )
}

describe('CapilarPro', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  it('renderiza la calculadora con un resultado y el ancla de placa', async () => {
    render(<App />)

    expect(
      await screen.findByRole('status', { name: 'Cálculo efímero' }),
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
    expect(screen.getByLabelText('Diámetro seleccionado')).toHaveTextContent(
      /0,\d{3}"/,
    )
    expect(screen.getByLabelText('Longitud seleccionada')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Condición de diseño/i }),
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
    expect(screen.getByRole('combobox', { name: 'Refrigerante de diseño' })).toHaveValue(
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
    expect(alternatives).toHaveTextContent(/"\s*×.*cm/)

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
      ).not.toBe(selectedDiameter)
      expect(
        screen.getByLabelText('Diámetro seleccionado').textContent,
      ).toBe('0,070"')
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

  it('actualiza los datos de placa y frecuencia del SC15G en memoria', async () => {
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

  it('reinicia la entrada a los valores de fábrica en una nueva sesión', async () => {
    const user = userEvent.setup()
    const view = render(
      <AppProvider>
        <EphemeralInputProbe />
      </AppProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Change refrigerant' }))
    expect(screen.getByTestId('refrigerant-input')).toHaveTextContent('R600a')

    view.unmount()
    render(
      <AppProvider>
        <EphemeralInputProbe />
      </AppProvider>,
    )
    expect(screen.getByTestId('refrigerant-input')).toHaveTextContent('R134a')
  })

  it('no conserva sugerencias de compresores personalizados', async () => {
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
    await user.clear(compressorSearch)
    await user.type(compressorSearch, 'juan')
    expect(screen.queryByRole('option', { name: /Compresor de Juan/ })).not.toBeInTheDocument()
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
      screen.getByRole('combobox', { name: 'Refrigerante de diseño' }),
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

    const refrigerant = screen.getByRole('combobox', { name: 'Refrigerante de diseño' })
    const refrigerantOptions = within(refrigerant)
    expect(
      refrigerantOptions.getByRole('option', { name: 'R407C' }),
    ).toBeInTheDocument()
    expect(
      refrigerantOptions.getByRole('option', { name: 'R417A' }),
    ).toBeInTheDocument()
    expect(
      refrigerantOptions.getByRole('option', { name: 'R422D' }),
    ).toBeInTheDocument()
    expect(
      refrigerantOptions.getByRole('option', { name: 'R427A' }),
    ).toBeInTheDocument()
    expect(
      refrigerantOptions.queryByRole('option', { name: /R438A/i }),
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

  it('propaga la condición declarada al motor de cálculo', async () => {
    const user = userEvent.setup()
    render(
      <AppProvider>
        <DeclaredApplicationProbe />
      </AppProvider>,
    )

    expect(screen.getByTestId('declared-application')).toHaveTextContent(
      'HBP / HBP',
    )
    await user.click(screen.getByRole('button', { name: 'Declare MBP' }))
    expect(screen.getByTestId('declared-application')).toHaveTextContent(
      'MBP / MBP',
    )
  })

  it('muestra la ayuda contextual de las condiciones de diseño y requerida', async () => {
    render(<App />)

    const condition = screen.getByRole('combobox', {
      name: 'Condición de diseño',
    })
    const requiredCondition = screen.getByRole('combobox', {
      name: 'Condición requerida',
    })
    expect(condition).toHaveValue('HBP')
    expect(requiredCondition).toHaveValue('HBP')
    const designHelp = screen.getByRole('button', {
      name: 'Más información sobre Condición de diseño',
    })
    const designTooltipId = designHelp.getAttribute('aria-describedby')
    expect(designTooltipId).toBeTruthy()
    const designTooltip = document.getElementById(designTooltipId ?? '')
    expect(designTooltip).toBeInTheDocument()
    expect(designTooltip).toHaveTextContent(
      'Régimen de fábrica o estándar del compresor en el que se declara la capacidad de placa',
    )
    const requiredHelp = screen.getByRole('button', {
      name: 'Más información sobre Condición requerida',
    })
    const requiredTooltipId = requiredHelp.getAttribute('aria-describedby')
    expect(requiredTooltipId).toBeTruthy()
    const requiredTooltip = document.getElementById(requiredTooltipId ?? '')
    expect(requiredTooltip).toBeInTheDocument()
    expect(requiredTooltip).toHaveTextContent(
      'Régimen de operación necesario para el caso o aplicación requerida',
    )
  })

  it('recalcula el balance al cambiar el refrigerante requerido', async () => {
    const user = userEvent.setup()
    render(<App />)

    const designRefrigerant = screen.getByRole('combobox', {
      name: 'Refrigerante de diseño',
    })
    await user.selectOptions(designRefrigerant, 'R22')

    const requiredRefrigerant = screen.getByRole('combobox', {
      name: 'Refrigerante requerido',
    })
    expect(requiredRefrigerant).toHaveValue('R22')

    await user.selectOptions(requiredRefrigerant, 'R134a')

    expect(requiredRefrigerant).toHaveValue('R134a')
    expect(await screen.findByText('Balance de capacidad')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Condición de diseño: HBP · R22 → Condición requerida: HBP · R134a',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/Sin factor empírico/)).toBeInTheDocument()
    expect(
      screen.getByText(/Retrofit: verifica compatibilidad de aceite/),
    ).toBeInTheDocument()
    expect(screen.getByText('Cambio de refrigerante')).toBeInTheDocument()
    expect(
      screen.getByText('Retrofit: aceite, lubricante y carga'),
    ).toBeInTheDocument()
  })

  it('muestra la base de normalización de capacidad y su aviso', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByText(/^Base:/)).not.toBeInTheDocument()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Condición de diseño' }),
      'LBP',
    )

    expect(
      await screen.findByText(
        'Condición de diseño: LBP → Condición requerida: HBP',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Capacidad de placa: 1300 W × 2.75 = 3575 W'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Capacidad ajustada por condición'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Conversión de placa LBP → HBP · 1300 W × 2.75 = 3575 W',
      ),
    ).toBeInTheDocument()
    // Con el balance energético, la capacidad del punto coincide con la
    // capacidad requerida normalizada.
    expect(screen.getByText('3575 W')).toBeInTheDocument()
  })

  it('permite declarar y requerir CBP y convierte con física', async () => {
    const user = userEvent.setup()
    render(<App />)

    const condition = screen.getByRole('combobox', {
      name: 'Condición de diseño',
    })
    const application = screen.getByRole('combobox', {
      name: 'Condición requerida',
    })

    expect(
      within(condition).getByRole('option', {
        name: 'CBP (comercial media-alta)',
      }),
    ).toBeInTheDocument()
    expect(
      within(condition).queryByRole('option', { name: /Misma aplicación/ }),
    ).not.toBeInTheDocument()
    expect(
      within(application).getByRole('option', {
        name: 'CBP · comercial media-alta',
      }),
    ).toBeInTheDocument()

    // La aplicación por defecto es HBP: declarar CBP exige convertir.
    await user.selectOptions(condition, 'CBP')
    expect(condition).toHaveValue('CBP')
    expect(
      await screen.findByText('Conversión de placa'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Condición de diseño: CBP → Condición requerida: HBP',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Factor derivado de la densidad de succión/),
    ).toBeInTheDocument()

    // Al requerir CBP, la referencia estándar también pasa a CBP.
    await user.selectOptions(application, 'CBP')
    expect(application).toHaveValue('CBP')
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(0)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(54.4)
    expect(screen.getByLabelText('Temp. Ambiente')).toHaveValue(35)
    expect(screen.getByLabelText('Temp. Retorno')).toHaveValue(18.3)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(18.3)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(19.4)
  })

  it('mantiene la condición declarada al cambiar la aplicación', async () => {
    const user = userEvent.setup()
    render(<App />)

    const condition = screen.getByRole('combobox', {
      name: 'Condición de diseño',
    })
    const application = screen.getByRole('combobox', {
      name: 'Condición requerida',
    })

    // La condición solo declara la capacidad: no cambia la aplicación.
    await user.selectOptions(condition, 'LBP')
    expect(application).toHaveValue('HBP')
    expect(condition).toHaveValue('LBP')

    // Cambiar la condición requerida mueve el objetivo, no la referencia de
    // diseño: la placa sigue anclada en LBP.
    await user.selectOptions(application, 'MBP')
    expect(condition).toHaveValue('LBP')
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-23.3)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(54.4)
    expect(screen.getByLabelText('Temp. Ambiente')).toHaveValue(35)
    expect(screen.getByLabelText('Temp. Retorno')).toHaveValue(32.2)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(55.5)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(19.4)
    expect(screen.getByLabelText('Evaporación objetivo')).toHaveValue(-6.7)
    expect(screen.getByLabelText('Condensación objetivo')).toHaveValue(54.4)
    expect(screen.getByLabelText('Recalentamiento (SH)')).toHaveValue(25)
    expect(screen.getByText(/LBP · AHRI 540/)).toBeInTheDocument()

    // La capacidad se declara en LBP y se muestra en BTU/h.
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Unidad de capacidad' }),
      'BTU/h',
    )
    const capacity = screen.getByRole('spinbutton', {
      name: /Capacidad declarada/,
    })
    await user.clear(capacity)
    await user.type(capacity, '750')

    expect(
      await screen.findByText(
        'Condición de diseño: LBP → Condición requerida: MBP',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Capacidad de placa: 750 BTU/h × 2.10 = 1575 BTU/h'),
    ).toBeInTheDocument()

    // Banner de conversión sobre el cuadro de estándar de ensayo.
    expect(screen.getByText('Conversión de placa')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Conversión de placa LBP → MBP · 750 BTU/h × 2.1 = 1575 BTU/h',
      ),
    ).toBeInTheDocument()
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

  it('aplica las condiciones AHRI 540 al objetivo sin mover la referencia de diseño', async () => {
    const user = userEvent.setup()
    render(<App />)

    const application = screen.getByRole('combobox', {
      name: 'Condición requerida',
    })
    const expectReference = (
      evapC: number,
      condC: number,
      ambientC: number,
      returnGasC: number,
      superheatK: number,
      subcoolK: number,
    ) => {
      expect(screen.getByLabelText('Evap. referencia')).toHaveValue(evapC)
      expect(screen.getByLabelText('Cond. referencia')).toHaveValue(condC)
      expect(screen.getByLabelText('Temp. Ambiente')).toHaveValue(ambientC)
      expect(screen.getByLabelText('Temp. Retorno')).toHaveValue(returnGasC)
      expect(screen.getByLabelText('Recalentamiento')).toHaveValue(superheatK)
      expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(subcoolK)
    }
    const expectTarget = (
      evapC: number,
      condC: number,
      ambientC: number,
      returnGasC: number,
      superheatK: number,
      subcoolK: number,
    ) => {
      expect(screen.getByLabelText('Evaporación objetivo')).toHaveValue(evapC)
      expect(screen.getByLabelText('Condensación objetivo')).toHaveValue(condC)
      expect(screen.getByLabelText('Temperatura Ambiente')).toHaveValue(ambientC)
      expect(
        screen.getByLabelText('Temperatura de Retorno de gas'),
      ).toHaveValue(returnGasC)
      expect(screen.getByLabelText('Recalentamiento (SH)')).toHaveValue(
        superheatK,
      )
      expect(screen.getByLabelText('Subenfriamiento (SC)')).toHaveValue(
        subcoolK,
      )
    }

    // La placa por defecto es AHRI 540 en HBP.
    expectReference(7.2, 54.4, 35, 18.3, 11.1, 19.4)

    await user.selectOptions(application, 'LBP')
    expectTarget(-23.3, 54.4, 35, 32.2, 55.5, 19.4)
    expectReference(7.2, 54.4, 35, 18.3, 11.1, 19.4)

    await user.selectOptions(application, 'MBP')
    expectTarget(-6.7, 54.4, 35, 18.3, 25, 19.4)
    expectReference(7.2, 54.4, 35, 18.3, 11.1, 19.4)

    await user.selectOptions(application, 'CBP')
    expectTarget(0, 54.4, 35, 18.3, 18.3, 19.4)
    expectReference(7.2, 54.4, 35, 18.3, 11.1, 19.4)

    await user.selectOptions(application, 'HBP')
    expectTarget(7.2, 54.4, 35, 18.3, 11.1, 19.4)
    expectReference(7.2, 54.4, 35, 18.3, 11.1, 19.4)
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
      screen.getByRole('combobox', { name: 'Condición requerida' }),
      'LBP',
    )
    // La condición requerida mueve el objetivo (EN 12900 LBP)...
    expect(screen.getByLabelText('Evaporación objetivo')).toHaveValue(-35)
    expect(screen.getByLabelText('Condensación objetivo')).toHaveValue(40)
    expect(screen.getByLabelText('Temperatura Ambiente')).toHaveValue(32.2)
    expect(
      screen.getByLabelText('Temperatura de Retorno de gas'),
    ).toHaveValue(32.2)
    expect(screen.getByLabelText('Recalentamiento (SH)')).toHaveValue(67.2)
    expect(screen.getByLabelText('Subenfriamiento (SC)')).toHaveValue(7.8)
    // ...y la referencia de diseño sigue en EN 12900 HBP.
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(5)
    expect(screen.getByLabelText('Cond. referencia')).toHaveValue(50)
    expect(screen.getByLabelText('Temp. Ambiente')).toHaveValue(32.2)
    expect(screen.getByLabelText('Temp. Retorno')).toHaveValue(32.2)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(27.2)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(17.8)

    await user.clear(screen.getByLabelText('Temp. Retorno'))
    await user.type(screen.getByLabelText('Temp. Retorno'), '31')
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(26)

    await user.clear(screen.getByLabelText('Temp. Ambiente'))
    await user.type(screen.getByLabelText('Temp. Ambiente'), '30')
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(20)

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
      screen.getByRole('combobox', { name: 'Condición requerida' }),
      'HBP',
    )
    expect(screen.getByLabelText('Evap. referencia')).toHaveValue(-30)
    expect(screen.getByLabelText('Recalentamiento')).toHaveValue(61)
    expect(screen.getByLabelText('Subenfriamiento')).toHaveValue(15)
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

})
