export const LogoMark = ({ size = 34 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
  >
    <rect width="64" height="64" rx="15" fill="#40d7bd" />
    <path
      d="M17 21h20a9 9 0 0 1 0 18H25a7 7 0 0 0 0 14h23"
      stroke="#071a22"
      strokeWidth="5.5"
      strokeLinecap="round"
    />
    <circle cx="17" cy="21" r="3.5" fill="#f58b2e" />
    <circle cx="48" cy="53" r="3.5" fill="#f58b2e" />
  </svg>
)

export const Logo = ({
  name,
  compact = false,
  light = false,
}: {
  name: string
  compact?: boolean
  light?: boolean
}) => (
  <div className="flex items-center gap-2.5">
    <LogoMark size={compact ? 30 : 36} />
    <div className="leading-none">
      <div
        className={`font-display text-[18px] font-semibold tracking-[-0.035em] ${
          light ? 'text-white' : 'text-ink-950'
        }`}
      >
        {name}
      </div>
      {!compact && (
        <div
          className={`mt-1 text-[9px] font-bold uppercase tracking-[0.2em] ${
            light ? 'text-white/60' : 'text-ink-600'
          }`}
        >
          Capillary intelligence
        </div>
      )}
    </div>
  </div>
)
