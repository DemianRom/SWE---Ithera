import type { FC } from 'react'
import {
  EMPTY_EXPENSE_FILTERS,
  NO_ACTIVITY_FILTER,
  hasActiveExpenseFilters,
  type ExpenseFilterState,
} from './expenseFilterRules'

interface Option {
  id: string
  label: string
}

interface Props {
  value: ExpenseFilterState
  onChange: (next: ExpenseFilterState) => void
  payers: Option[]
  activities: Option[]
  resultCount: number
  totalCount: number
  filteredTotal: number
}

const formatMXN = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value)

const fieldClass =
  'w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 font-body text-sm text-[#3D4A5C] outline-none transition-colors focus:border-[#1E6FD9] focus:bg-white'

/** Barra para buscar y filtrar el historial de gastos del viaje. */
export const ExpenseFilters: FC<Props> = ({
  value,
  onChange,
  payers,
  activities,
  resultCount,
  totalCount,
  filteredTotal,
}) => {
  const set = <K extends keyof ExpenseFilterState>(key: K, next: ExpenseFilterState[K]) =>
    onChange({ ...value, [key]: next })
  const active = hasActiveExpenseFilters(value)

  return (
    <div className="mb-3 rounded-2xl border border-[#E2E8F0] bg-white p-3" role="search" aria-label="Filtrar gastos">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <input
          type="search"
          value={value.query}
          onChange={(event) => set('query', event.target.value)}
          placeholder="Buscar por descripción"
          aria-label="Buscar gasto por descripción"
          className={`${fieldClass} sm:col-span-2 xl:col-span-1`}
        />
        <select
          value={value.payerId}
          onChange={(event) => set('payerId', event.target.value)}
          aria-label="Filtrar por quién pagó"
          className={fieldClass}
        >
          <option value="">Pagó: cualquiera</option>
          {payers.map((payer) => (
            <option key={payer.id} value={payer.id}>{payer.label}</option>
          ))}
        </select>
        <select
          value={value.activity}
          onChange={(event) => set('activity', event.target.value)}
          aria-label="Filtrar por actividad del itinerario"
          className={fieldClass}
        >
          <option value="">Actividad: todas</option>
          <option value={NO_ACTIVITY_FILTER}>Sin actividad ligada</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>{activity.label}</option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-1.5 font-body text-xs font-medium text-[#7A8799]">
          Desde
          <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => set('from', event.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 font-body text-xs text-[#3D4A5C] outline-none focus:border-[#1E6FD9]"
          />
        </label>
        <label className="flex items-center gap-1.5 font-body text-xs font-medium text-[#7A8799]">
          Hasta
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => set('to', event.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 font-body text-xs text-[#3D4A5C] outline-none focus:border-[#1E6FD9]"
          />
        </label>
        <span className="ml-auto font-body text-xs text-[#7A8799]" aria-live="polite">
          {active
            ? `${resultCount} de ${totalCount} gastos · ${formatMXN(filteredTotal)}`
            : `${totalCount} gastos · ${formatMXN(filteredTotal)}`}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_EXPENSE_FILTERS)}
            className="font-body text-xs font-semibold text-[#1E6FD9] hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
