import type { ReactNode } from 'react'

export const PageHeader = ({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) => (
  <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-display text-[clamp(28px,3.2vw,43px)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink-950">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-600 sm:text-[14px]">
          {description}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
)
