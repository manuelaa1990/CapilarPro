import { Info } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'

export const SettingsPage = () => (
  <div className="animate-rise">
    <PageHeader eyebrow="Ajustes" title="Sin datos que guardar" />
    <div className="flex max-w-2xl items-start gap-3 border-y border-ink-900/[0.08] py-5 text-[13px] leading-relaxed text-ink-700">
      <Info size={17} className="mt-0.5 shrink-0 text-mint-700" />
      <p>Esta app no guarda ningún dato. Todos los cálculos son efímeros.</p>
    </div>
  </div>
)