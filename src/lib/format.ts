export const fmt = (
  value: number,
  digits = 1,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    ...options,
  }).format(value)

export const fmtCompact = (value: number, digits = 1) =>
  new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: digits,
  }).format(value)

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
