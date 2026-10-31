import {
  BookOpen,
  Calculator,
  Database,
  ShieldCheck,
} from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { TabId } from '../types'
import { Logo } from './Logo'
import { useApp } from '../store/useApp'

const navItems: Array<{
  id: TabId
  label: string
  short: string
  icon: typeof Calculator
}> = [
  { id: 'calculator', label: 'Calculadora', short: 'Calcular', icon: Calculator },
  { id: 'model', label: 'El modelo', short: 'Modelo', icon: BookOpen },
]

export const Layout = ({ children }: { children: ReactNode }) => {
  const { tab, navigate } = useApp()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:min-h-screen lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-instrument-grid bg-[size:22px_22px] opacity-60" />
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-mint-500/10 blur-3xl" />
        <div className="relative flex h-full flex-col p-6">
          <button
            type="button"
            onClick={() => navigate('calculator')}
            className="text-left"
            aria-label="CapilarPro — Ir a la calculadora"
          >
            <Logo name="CapilarPro" light />
          </button>

          <div className="mt-12 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
            Espacio de trabajo
          </div>
          <nav className="mt-3 space-y-1.5" aria-label="Navegación principal">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all',
                    active
                      ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]'
                      : 'text-white/60 hover:bg-white/[0.05] hover:text-white/80',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      active
                        ? 'bg-mint-400 text-ink-950'
                        : 'bg-white/[0.04] text-white/60 group-hover:text-white/70',
                    )}
                  >
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-mint-400 shadow-[0_0_8px_#40d7bd]" />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 pt-8">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2.5 text-[10px] text-white/60">
              <ShieldCheck size={13} className="text-mint-400/70" />
              <span className="leading-tight">Sin almacenamiento ni conexión de datos</span>
            </div>

            <div className="flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-wider text-white/60">
              <span>CP-HEM-1.0</span>
              <span className="flex items-center gap-1">
                <Database size={9} />
                v1.0
              </span>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-900/[0.07] bg-frost-100/90 px-5 py-3 backdrop-blur-xl lg:px-9 xl:px-12">
          <button
            type="button"
            onClick={() => navigate('calculator')}
            aria-label="CapilarPro — Ir a la calculadora"
          >
            <Logo name="CapilarPro" compact />
          </button>
          <div className="flex items-center gap-2">
            <span role="status" aria-label="Cálculo efímero" className="text-[10px] font-semibold text-ink-600">Cálculo efímero</span>
          </div>
        </header>

        <main className="mx-auto min-h-screen w-full max-w-[1640px] px-5 pb-28 pt-7 sm:px-7 lg:px-9 lg:pb-14 lg:pt-9 xl:px-12">
          {children}
        </main>
      </div>

      <nav
        className="fixed bottom-4 left-4 right-4 z-40 grid grid-cols-2 rounded-2xl border border-white/10 bg-ink-950/95 p-1.5 shadow-float backdrop-blur-xl lg:hidden"
        aria-label="Navegación móvil"
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-bold uppercase tracking-wide transition-colors',
                active ? 'bg-white/10 text-mint-300' : 'text-white/60',
              )}
            >
              <Icon size={17} strokeWidth={2.2} />
              {item.short}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
