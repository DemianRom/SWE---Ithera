import { useState } from 'react'
import { BUDGET_CATEGORIES, type BudgetCategory } from '../../services/budget'

const LABELS: Record<BudgetCategory, string> = {
  transporte: 'Transporte',
  hospedaje: 'Hospedaje',
  actividad: 'Actividades',
  comida: 'Comida',
  otro: 'Otros',
}

// Estado del medidor: el color acompaña al texto, nunca va solo.
const METER = {
  track: '#DCE8FB',
  ok: '#1E6FD9',
  warning: '#B45309',
  over: '#DC2626',
}

const formatMXN = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value)

interface Props {
  spent: Record<BudgetCategory, number>
  planned: Record<BudgetCategory, number | null>
  canEdit: boolean
  onSave: (values: Record<BudgetCategory, number | null>) => Promise<void>
}

function MeterRow({ category, spent, planned }: { category: BudgetCategory; spent: number; planned: number | null }) {
  if (planned === null) {
    return (
      <li className="flex items-center justify-between gap-3 py-2">
        <span className="font-body text-sm font-semibold text-[#3D4A5C]">{LABELS[category]}</span>
        <span className="text-right font-body text-sm text-[#3D4A5C]">
          <span className="font-semibold">{formatMXN(spent)}</span>
          <span className="ml-1 text-xs text-[#7A8799]">· sin límite</span>
        </span>
      </li>
    )
  }

  const ratio = planned > 0 ? spent / planned : 0
  const percent = Math.round(ratio * 100)
  const color = ratio > 1 ? METER.over : ratio >= 0.8 ? METER.warning : METER.ok
  const status =
    ratio > 1 ? `Excedido por ${formatMXN(spent - planned)}` : ratio >= 0.8 ? `Al ${percent} %, cerca del límite` : `Al ${percent} %`

  return (
    <li className="py-2" title={`${LABELS[category]}: ${formatMXN(spent)} de ${formatMXN(planned)} planeado (${percent} %)`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-body text-sm font-semibold text-[#3D4A5C]">{LABELS[category]}</span>
        <span className="text-right font-body text-sm text-[#3D4A5C]">
          <span className="font-semibold">{formatMXN(spent)}</span>
          <span className="text-xs text-[#7A8799]"> de {formatMXN(planned)}</span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: METER.track }}
        role="meter"
        aria-label={`${LABELS[category]}: ${status}`}
        aria-valuemin={0}
        aria-valuemax={planned}
        aria-valuenow={Math.min(spent, planned)}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1 font-body text-xs font-semibold" style={{ color: ratio >= 0.8 ? color : '#64748B' }}>
        {ratio > 1 ? '⚠ ' : ''}
        {status}
      </p>
    </li>
  )
}

export function CategoryBudgetPanel({ spent, planned, canEdit, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<BudgetCategory, string>>(
    () => Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, ''])) as Record<BudgetCategory, string>,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setValues(
      Object.fromEntries(
        BUDGET_CATEGORIES.map((category) => [category, planned[category] !== null ? String(planned[category]) : '']),
      ) as Record<BudgetCategory, string>,
    )
    setError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    const parsed = {} as Record<BudgetCategory, number | null>
    for (const category of BUDGET_CATEGORIES) {
      const raw = values[category].trim().replace(',', '.')
      if (raw === '') {
        parsed[category] = null
        continue
      }
      const amount = Number(raw)
      if (!Number.isFinite(amount) || amount < 0 || !/^\d+(\.\d{1,2})?$/.test(raw)) {
        setError(`${LABELS[category]}: escribe un monto positivo con máximo dos decimales.`)
        return
      }
      parsed[category] = amount === 0 ? null : amount
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(parsed)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el presupuesto por categoría.')
    } finally {
      setSaving(false)
    }
  }

  const hasAnyPlanned = BUDGET_CATEGORIES.some((category) => planned[category] !== null)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-heading text-sm font-bold text-[#3D4A5C]">Planeado vs. gastado</h3>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg px-2 py-1 font-body text-xs font-semibold text-[#1E6FD9] transition-colors hover:bg-[#EEF4FF]"
          >
            {hasAnyPlanned ? 'Editar límites' : 'Definir por categoría'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <p className="font-body text-xs text-[#64748B]">Deja vacío para no poner límite a esa categoría.</p>
          {BUDGET_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center justify-between gap-3">
              <span className="font-body text-sm text-[#3D4A5C]">{LABELS[category]}</span>
              <span className="relative w-36">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-[#7A8799]">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={values[category]}
                  onChange={(event) => setValues((prev) => ({ ...prev, [category]: event.target.value }))}
                  placeholder="Sin límite"
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F4F6F8] py-2 pl-6 pr-2 font-body text-sm text-[#3D4A5C] outline-none focus:border-[#1E6FD9]"
                />
              </span>
            </label>
          ))}
          {error && (
            <p role="alert" className="rounded-lg border border-[#FBC7C7] bg-[#FFF5F5] px-3 py-2 font-body text-xs text-[#C03535]">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="flex-1 rounded-lg border border-[#E2E8F0] py-2 font-body text-sm font-semibold text-[#7A8799] hover:text-[#3D4A5C] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex-1 rounded-lg bg-[#1E6FD9] py-2 font-body text-sm font-semibold text-white hover:bg-[#2C8BE6] disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-[#EEF2F7]">
          {BUDGET_CATEGORIES.map((category) => (
            <MeterRow key={category} category={category} spent={spent[category] ?? 0} planned={planned[category]} />
          ))}
        </ul>
      )}
    </div>
  )
}
