import clsx from 'clsx'

export const UnitToggle = <T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}) => (
  <div
    role="group"
    aria-label={label}
    className={clsx(
      'inline-flex shrink-0 items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.03]',
      className,
    )}
  >
    {options.map((option, index) => {
      const active = option.value === value
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={clsx(
            'px-1.5 py-0.5 font-mono text-xs font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint-400/70',
            index > 0 && 'border-l border-white/10',
            active
              ? 'bg-slate-800 text-white'
              : 'bg-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white',
          )}
        >
          {option.label}
        </button>
      )
    })}
  </div>
)
