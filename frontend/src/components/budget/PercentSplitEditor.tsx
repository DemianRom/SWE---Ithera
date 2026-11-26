import type { FC } from 'react'
import { checkPercentSplit, formatPercent } from './splitRules'

interface Props {
  /** Solo los integrantes que participan en el gasto. */
  members: Array<{ id: string; label: string }>
  values: Record<string, string>
  amount: number
  onChange: (memberId: string, value: string) => void
  onFillEqual: () => void
}

const formatMXN = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)

/** Porcentaje por integrante con vista previa del monto que le toca. */
export const PercentSplitEditor: FC<Props> = ({ members, values, amount, onChange, onFillEqual }) => {
  const check = checkPercentSplit(members.map((member) => member.id), values, amount)
  const totalOk = Math.abs(check.totalPercent - 100) < 0.005

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-[#F4F6F8] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs font-medium text-[#7A8799]">Porcentaje por persona</p>
        <button
          type="button"
          onClick={onFillEqual}
          className="font-body text-xs font-semibold text-[#1E6FD9] hover:underline"
        >
          Repartir igual
        </button>
      </div>
      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate font-body text-sm text-[#3D4A5C]" title={member.label}>
            {member.label}
          </span>
          <div className="relative w-28 shrink-0">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              aria-label={`Porcentaje de ${member.label}`}
              value={values[member.id] ?? ''}
              onChange={(event) => onChange(member.id, event.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white py-2 pl-3 pr-7 font-body text-sm text-[#3D4A5C] outline-none transition-colors focus:border-[#1E6FD9]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-body text-sm text-[#7A8799]">%</span>
          </div>
          <span className="min-w-0 flex-1 text-right font-body text-sm text-[#7A8799]">
            {amount > 0 ? formatMXN(check.shares[member.id] ?? 0) : '—'}
          </span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between border-t border-[#E2E8F0] pt-2 font-body text-xs">
        <span className="font-medium text-[#7A8799]">Suma</span>
        <span className={totalOk ? 'font-semibold text-[#047857]' : 'font-semibold text-[#B91C1C]'}>
          {formatPercent(check.totalPercent)} de 100%
        </span>
      </div>
      {check.error && <p className="font-body text-xs text-[#EF4444]">{check.error}</p>}
    </div>
  )
}
