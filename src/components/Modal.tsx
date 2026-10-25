import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

export const Modal = ({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) => {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'relative max-h-[92vh] w-full overflow-hidden rounded-t-[26px] bg-white shadow-float sm:rounded-[26px]',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-900/[0.07] px-5 py-4 sm:px-6">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 className="mt-1 font-display text-[21px] font-semibold tracking-[-0.03em] text-ink-950">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-600 transition-colors hover:bg-ink-900/5 hover:text-ink-950"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-900/[0.07] bg-frost-50 px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
