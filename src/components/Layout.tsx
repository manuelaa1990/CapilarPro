import {
  BookOpen,
  Calculator,
  Database,
  History,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { TabId } from '../types'
import { Logo } from './Logo'
import { useApp } from '../store/useApp'
import { useNeonStatus } from '../store/neonStatusContext'

const navItems: Array<{
  id: TabId
  label: string
  short: string
  icon: typeof Calculator
}> = [
  { id: 'calculator', label: 'Calculadora', short: 'Calcular', icon: Calculator },
  { id: 'history', label: 'Historial', short: 'Historial', icon: History },
  { id: 'model', label: 'El modelo', short: 'Modelo', icon: BookOpen },
  { id: 'settings', label: 'Ajustes', short: 'Ajustes', icon: Settings2 },
]

export const Layout = ({ children }: { children: ReactNode }) => {
  const { tab, navigate, settings, cases, learned, storageMode } = useApp()
  const { status } = useNeonStatus()
  const neonConnected = status === 'connected'

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
            <Logo name={settings.appName} light />
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
                  {item.id === 'history' && cases.length > 0 && (
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">
                      {cases.length}
                    </span>
                  )}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-mint-400 shadow-[0_0_8px_#40d7bd]" />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 pt-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
              <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-mint-400/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-mint-300">
                  <Sparkles size={12} />
                  Memoria de taller
                </div>
                <p className="mt-2 font-display text-[24px] font-semibold leading-none text-white">
                  {learned.actualCases}
                  <span className="ml-1.5 text-[11px] font-medium text-white/60">
                    validados
                  </span>
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-mint-500 to-mint-300 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, learned.actualCases * 12 + 6)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-white/60">
                    {cases.length} casos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('history')}
                  className="mt-3 text-[10px] font-bold uppercase tracking-[0.13em] text-mint-300/80 transition-colors hover:text-mint-200"
                >
                  Ver historial →
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2.5 text-[10px] text-white/60">
              <ShieldCheck size={13} className="text-mint-400/70" />
              <span className="leading-tight">
                Cálculo local · {storageMode}
                <br />
                Sincronización Neon opcional
              </span>
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
            <Logo name={settings.appName} compact />
          </button>
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-label={neonConnected ? '🟢 Neon Conectado' : '🟡 Modo Local'}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[9px] font-bold tracking-wide sm:text-[10px]',
                neonConnected
                  ? 'border-mint-500/25 text-mint-700'
                  : 'border-amber-500/25 text-amber-700',
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  neonConnected ? 'bg-mint-500' : 'bg-amber-500',
                )}
              />
              <span>{neonConnected ? 'Neon Conectado' : 'Modo Local'}</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('history')}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-900/10 bg-white text-ink-800"
              aria-label="Abrir historial"
            >
              <History size={15} />
            </button>
          </div>
        </header>

        <main className="mx-auto min-h-screen w-full max-w-[1640px] px-5 pb-28 pt-7 sm:px-7 lg:px-9 lg:pb-14 lg:pt-9 xl:px-12">
          {children}
        </main>
      </div>

      <nav
        className="fixed bottom-4 left-4 right-4 z-40 grid grid-cols-4 rounded-2xl border border-white/10 bg-ink-950/95 p-1.5 shadow-float backdrop-blur-xl lg:hidden"
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
