import { useEffect, useId, useState, type ReactNode } from 'react'
import { Info, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export const Card = ({
  children,
  className,
  muted = false,
}: {
  children: ReactNode
  className?: string
  muted?: boolean
}) => (
  <section className={clsx(muted ? 'panel-muted' : 'panel', className)}>
    {children}
  </section>
)

export const Badge = ({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'mint' | 'amber' | 'red' | 'blue' | 'dark'
  className?: string
}) => {
  const tones = {
    neutral: 'border-ink-900/10 bg-white text-ink-700',
    mint: 'border-mint-500/20 bg-mint-500/10 text-mint-700',
    amber: 'border-ember-500/25 bg-ember-500/10 text-[#a55a10]',
    red: 'border-red-500/20 bg-red-50 text-red-700',
    blue: 'border-sky-500/20 bg-sky-50 text-sky-700',
    dark: 'border-white/10 bg-white/10 text-white/80',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export const InfoTip = ({ label, children }: { label: string; children: ReactNode }) => (
  <span className="group relative inline-flex">
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-900/5 hover:text-ink-800"
    >
      <Info size={12} strokeWidth={2.5} />
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink-950 px-3 py-2 text-[11px] font-medium normal-case leading-relaxed tracking-normal text-white/90 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {children}
    </span>
  </span>
)

export const NumberField = ({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 0.1,
  hint,
  tip,
  error,
  disabled,
  className,
  inputClassName,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  unit: string
  min?: number
  max?: number
  step?: number
  hint?: ReactNode
  tip?: string
  error?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
}) => {
  const id = useId()
  const [text, setText] = useState(String(value))

  useEffect(() => {
    if (Number.parseFloat(text) !== value) {
      setText(Number.isFinite(value) ? String(value) : '')
    }
    // El texto solo se sincroniza cuando el valor externo cambia de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {tip && (
          <InfoTip label={`Más información sobre ${label}`}>{tip}</InfoTip>
        )}
      </label>
      <div
        className={clsx(
          'input-shell',
          error && 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/10',
          disabled && 'opacity-50',
        )}
      >
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            const next = event.target.value
            setText(next)
            const parsed = Number.parseFloat(next)
            if (Number.isFinite(parsed)) onChange(parsed)
          }}
          onBlur={() => {
            if (!Number.isFinite(Number.parseFloat(text))) setText(String(value))
          }}
          className={clsx('input-base', inputClassName)}
        />
        <span className="shrink-0 border-l border-ink-900/10 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-600">
          {unit}
        </span>
      </div>
      {(hint || error) && (
        <p
          className={clsx(
            'mt-1.5 text-[11px] leading-relaxed',
            error ? 'font-medium text-red-600' : 'text-ink-600',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export const SelectField = ({
  label,
  value,
  onChange,
  children,
  hint,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  hint?: ReactNode
  className?: string
}) => {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="select-base"
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-600"
        />
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600">{hint}</p>}
    </div>
  )
}

export const SectionHeading = ({
  number,
  eyebrow,
  title,
  description,
  right,
}: {
  number: string
  eyebrow: string
  title: string
  description?: ReactNode
  right?: ReactNode
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex items-start gap-3">
      <span className="section-number">{number}</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-ink-950">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-ink-600">
            {description}
          </p>
        )}
      </div>
    </div>
    {right}
  </div>
)

export const Divider = ({ className }: { className?: string }) => (
  <div className={clsx('h-px w-full bg-ink-900/[0.07]', className)} />
)
