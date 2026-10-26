export const fmt = (
  value: number,
  digits = 1,
  options?: Intl.NumberFormatOptions,
) => {
  const maximumFractionDigits = Math.min(
    2,
    Math.max(0, Math.trunc(options?.maximumFractionDigits ?? digits)),
  )
  const minimumFractionDigits = Math.min(
    maximumFractionDigits,
    Math.max(0, Math.trunc(options?.minimumFractionDigits ?? digits)),
  )
  return new Intl.NumberFormat('es-ES', {
    ...options,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value)
}

export const fmtCompact = (value: number, digits = 1) =>
  new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: Math.min(2, Math.max(0, Math.trunc(digits))),
  }).format(value)

export const limitDecimalInput = (value: string) => {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return value
  const rounded = Number(parsed.toFixed(2))
  const decimalPart = value.split(/[eE]/, 1)[0].split('.')[1]
  return decimalPart && decimalPart.length > 2
    ? String(rounded)
    : parsed === rounded
      ? value
      : String(rounded)
}

export const formatDecimalInput = (value: number) =>
  Number.isFinite(value) ? String(Number(value.toFixed(2))) : ''

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

export const fmtKpa = (kpa: number, digits = 0) =>
  `${fmt(kpa, digits)} kPa`

export const fmtKW = (watts: number) =>
  watts >= 1000 ? `${fmt(watts / 1000, 2)} kW` : `${fmt(watts, 0)} W`
