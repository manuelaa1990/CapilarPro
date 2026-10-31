import type { jsPDF } from 'jspdf'
import type { CalculationResult } from '../types'
import { fmt, fmtKW } from './format'

type Rgb = [number, number, number]
type PdfRow = [string, string]
type AutoTable = typeof import('jspdf-autotable').default

const INK: Rgb = [8, 28, 36]
const MINT: Rgb = [31, 163, 141]
const MUTED: Rgb = [95, 114, 122]
const LINE: Rgb = [219, 227, 229]
const SOFT: Rgb = [244, 247, 247]
const WHITE: Rgb = [255, 255, 255]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const BOTTOM_LIMIT = PAGE_H - 22

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso))

const workRows = (result: CalculationResult): PdfRow[] => {
  const input = result.input
  return [
    ['Evaporación objetivo', `${fmt(input.targetEvapC, 1)} °C`],
    ['Condensación objetivo', `${fmt(input.targetCondC, 1)} °C`],
    ['Temp. retorno', `${fmt(input.targetReturnGasTempC, 1)} °C`],
    ['Temp. ambiente', `${fmt(input.targetAmbientTempC, 1)} °C`],
    ['Recalentamiento (SH)', `${fmt(input.targetSuperheatK, 1)} K`],
    ['Subenfriamiento (SC)', `${fmt(input.targetSubcoolK, 1)} K`],
    [
      'SLHX',
      input.slhxActivo
        ? `Activo · ${fmt(input.slhxPorcentaje, 0)} % enrollado`
        : 'No activo',
    ],
  ]
}

const compressorRows = (result: CalculationResult): PdfRow[] => {
  const input = result.input
  return [
    ['Refrigerante', `${result.refrigerant.name} · ${result.refrigerant.family}`],
    [
      'Desplazamiento',
      `${fmt(input.displacement, 2)} ${input.displacementUnit}`,
    ],
    ['Capacidad de placa', `${fmt(input.ratedCapacity, 2)} ${input.capacityUnit}`],
    ['Velocidad', `${fmt(input.frequencyHz * 60, 0)} RPM (${input.frequencyHz} Hz)`],
    ['Estándar de ensayo', `${result.standard.name} (${result.standard.shortName})`],
    ['Evaporación de referencia', `${fmt(input.refEvapC, 1)} °C`],
    ['Condensación de referencia', `${fmt(input.refCondC, 1)} °C`],
    [
      'SH / SC de ensayo',
      `${fmt(input.refSuperheatK, 1)} K / ${fmt(input.refSubcoolK, 1)} K`,
    ],
  ]
}

const technicalRows = (result: CalculationResult): PdfRow[] => {
  const { compressor, capillary } = result
  return [
    [
      'Capacidad calculada',
      `${fmtKW(compressor.capacityW)} (ηv ${fmt(compressor.etaVolumetricTarget * 100, 1)} %)`,
    ],
    ['Caudal másico', `${fmt(compressor.massFlowKgS * 1000, 1)} g/s`],
    [
      'Relación de compresión',
      `${fmt(compressor.targetPressureRatio, 2)} (placa ${fmt(compressor.referencePressureRatio, 2)})`,
    ],
    ['Presión de succión', `${fmt(result.targetSaturation.pressureKPa, 0)} kPa`],
    ['Calidad de vapor', `${fmt(capillary.outletQuality * 100, 0)} %`],
    ['Caída de presión', `${fmt(capillary.pressureDropKPa, 0)} kPa`],
  ]
}

const ensureSpace = (doc: jsPDF, y: number, height: number) => {
  if (y + height <= BOTTOM_LIMIT) return y
  doc.addPage()
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 16, PAGE_W - MARGIN, 16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('CapilarPro - Reporte de capilar', MARGIN, 12)
  return 24
}

const sectionHeading = (doc: jsPDF, y: number, title: string) => {
  doc.setFillColor(...MINT)
  doc.rect(MARGIN, y - 3.2, 2.2, 4.4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(title, MARGIN + 5, y)
  return y + 4.5
}

const renderTable = (
  doc: jsPDF,
  autoTable: AutoTable,
  startY: number,
  rows: PdfRow[],
) => {
  autoTable(doc, {
    startY,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.2,
      textColor: [38, 54, 61],
      lineColor: LINE,
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: INK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.4,
      cellPadding: 1.4,
    },
    alternateRowStyles: { fillColor: [248, 251, 251] },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: 'bold', textColor: [24, 42, 50] },
    },
    head: [['Parámetro', 'Valor']],
    body: rows,
  })
  const table = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
    .lastAutoTable
  return (table?.finalY ?? startY) + 5
}

const recommendationCard = (doc: jsPDF, y: number, result: CalculationResult) => {
  const height = 42
  doc.setFillColor(...SOFT)
  doc.setDrawColor(...MINT)
  doc.setLineWidth(0.9)
  doc.roundedRect(MARGIN, y, CONTENT_W, height, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MINT)
  doc.text('1. RECOMENDACIÓN DE CAPILAR', MARGIN + 6, y + 8)

  const headline = `CAPILAR RECOMENDADO: ${fmt(result.capillary.diameterMm, 2)} mm × ${fmt(result.capillary.lengthM, 2)} m`
  doc.setTextColor(...INK)
  let size = 19
  doc.setFontSize(size)
  while (doc.getTextWidth(headline) > CONTENT_W - 12 && size > 12) {
    size -= 0.5
    doc.setFontSize(size)
  }
  doc.text(headline, MARGIN + 6, y + 19.5)

  let lineY = y + 28.5
  if (result.slhx) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(
      `Enrollar ${fmt(result.slhx.lengthWoundM, 2)} m en la succión`,
      MARGIN + 6,
      lineY,
    )
    lineY += 7.5
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text(
    `Incertidumbre estimada: ± ${fmt(result.uncertainty.totalPct, 0)} %`,
    MARGIN + 6,
    lineY,
  )

  return y + height + 4
}

const paintHeader = (doc: jsPDF, result: CalculationResult) => {
  doc.setFillColor(...INK)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  doc.setFillColor(...MINT)
  doc.rect(0, 30, PAGE_W, 1.2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text('Reporte de Capilar - CapilarPro', MARGIN, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(190, 210, 214)
  doc.text(`Generado el ${formatDate(result.calculatedAt)}`, MARGIN, 21.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MINT)
  doc.text(result.fingerprint, PAGE_W - MARGIN, 14, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(190, 210, 214)
  doc.text(result.standard.name, PAGE_W - MARGIN, 21.5, { align: 'right' })
}

const paintFooter = (doc: jsPDF) => {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, PAGE_H - 17, PAGE_W - MARGIN, PAGE_H - 17)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(
      'Cálculo efímero generado por CapilarPro. No guarda datos en el dispositivo.',
      MARGIN,
      PAGE_H - 12,
    )
    doc.text(`Página ${page} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 12, {
      align: 'right',
    })
  }
}

export const exportCalculationToPdf = async (
  result: CalculationResult,
): Promise<void> => {
  const [{ jsPDF: JsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableModule.default
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  paintHeader(doc, result)

  let y = recommendationCard(doc, 37, result)

  y = ensureSpace(doc, y + 2, 60)
  y = sectionHeading(doc, y + 2, '2. CONDICIONES DE TRABAJO (PUNTO DE DISEÑO)')
  y = renderTable(doc, autoTable, y, workRows(result))

  y = ensureSpace(doc, y + 2, 65)
  y = sectionHeading(doc, y + 2, '3. DATOS DEL COMPRESOR Y ESTÁNDAR DE ENSAYO')
  y = renderTable(doc, autoTable, y, compressorRows(result))

  y = ensureSpace(doc, y + 2, 55)
  y = sectionHeading(doc, y + 2, '4. DATOS TÉCNICOS ADICIONALES')
  renderTable(doc, autoTable, y, technicalRows(result))

  paintFooter(doc)

  await doc.save(`CapilarPro_Reporte_${result.fingerprint}.pdf`)
}
