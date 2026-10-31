import { Component, useEffect, type ReactNode } from 'react'
import { AppProvider } from './store/AppStore'
import { useApp } from './store/useApp'
import { Layout } from './components/Layout'
import { CalculatorPage } from './pages/CalculatorPage'
import { ModelPage } from './pages/ModelPage'

const RoutedPage = () => {
  const { tab } = useApp()

  useEffect(() => {
    document.title = 'CapilarPro · Ingeniería de capilares'
    document.documentElement.lang = 'es'
  }, [])

  switch (tab) {
    case 'model':
      return <ModelPage />
    default:
      return <CalculatorPage />
  }
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-frost-100 p-6">
          <div className="panel max-w-md p-8 text-center">
            <p className="eyebrow">Error inesperado</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em]">
              La interfaz no pudo continuar
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              Recarga la página para volver a abrir CapilarPro.
            </p>
            <pre className="mt-4 overflow-auto rounded-xl bg-ink-950 p-3 text-left font-mono text-[10px] text-red-200">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              className="btn-primary mt-5"
              onClick={() => window.location.reload()}
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export const App = () => (
  <ErrorBoundary>
    <AppProvider>
      <Layout>
        <RoutedPage />
      </Layout>
    </AppProvider>
  </ErrorBoundary>
)
