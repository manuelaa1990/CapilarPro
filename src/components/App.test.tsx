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
    expect(screen.getByText(/Datos reales de la placa/i)).toBeInTheDocument()
    expect(screen.getAllByText(/R134a/i).length).toBeGreaterThan(0)
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
