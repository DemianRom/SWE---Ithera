import { useEffect, useState } from 'react'
import { budgetService, type BudgetSummaryReport } from '../../services/budget'

const formatMXN = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value)

interface Props {
  groupId: string | null
  token: string | null
  /** Cambia cuando el tablero se actualiza, para volver a pedir el resumen. */
  refreshKey: unknown
  disabled?: boolean
}

function BalanceLabel({ balance }: { balance: number }) {
  if (Math.abs(balance) < 0.01) {
    return <span className="font-semibold text-[#526C79]">Al corriente</span>
  }
  return balance > 0 ? (
    <span className="font-semibold text-[#047857]">Le deben {formatMXN(balance)}</span>
  ) : (
    <span className="font-semibold text-[#B91C1C]">Debe {formatMXN(Math.abs(balance))}</span>
  )
}

export function BudgetSummaryPanel({ groupId, token, refreshKey, disabled = false }: Props) {
  const [summary, setSummary] = useState<BudgetSummaryReport | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId || !token) return
    let active = true
    budgetService
      .getSummary(groupId, token)
      .then((data) => {
        if (!active) return
        setSummary(data)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.')
      })
    return () => {
      active = false
    }
  }, [groupId, token, refreshKey])

  const download = async (kind: 'pdf' | 'csv') => {
    if (!groupId || !token) return
    setDownloading(kind)
    setDownloadError(null)
    try {
      if (kind === 'pdf') await budgetService.downloadSummaryPdf(groupId, token)
      else await budgetService.downloadExpensesCsv(groupId, token)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'No se pudo descargar el archivo.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[#CBDDE3] border-t-4 border-t-[#16B9D0] bg-white p-5 shadow-[0_10px_30px_rgba(13,64,84,0.07)]" aria-labelledby="budget-summary-title">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="budget-summary-title" className="font-heading text-base font-semibold text-[#073B52]">
            Resumen por integrante
          </h2>
          <p className="mt-0.5 font-body text-xs text-[#526C79]">
            Lo que pagó cada quien, lo que le toca y su saldo (incluye pagos ya confirmados).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || downloading !== null || !summary}
            onClick={() => void download('pdf')}
            className="rounded-xl border border-[#91DEF0] bg-[#E8F4FA] px-3 py-2 font-body text-xs font-semibold text-[#0878CF] transition-colors hover:bg-[#D6F2F7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading === 'pdf' ? 'Generando…' : 'Descargar resumen (PDF)'}
          </button>
          <button
            type="button"
            disabled={disabled || downloading !== null || !summary}
            onClick={() => void download('csv')}
            className="rounded-xl border border-[#CBDDE3] bg-white px-3 py-2 font-body text-xs font-semibold text-[#073B52] transition-colors hover:bg-[#F4F9FA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading === 'csv' ? 'Exportando…' : 'Exportar gastos (CSV)'}
          </button>
        </div>
      </div>

      {downloadError && (
        <p role="alert" className="mb-3 rounded-lg border border-[#FBC7C7] bg-[#FFF5F5] px-3 py-2 font-body text-xs text-[#C03535]">
          {downloadError}
        </p>
      )}

      {loadError ? (
        <p className="font-body text-sm text-[#526C79]">{loadError}</p>
      ) : !summary ? (
        <p className="font-body text-sm text-[#526C79]">Cargando resumen…</p>
      ) : summary.byMember.length === 0 ? (
        <p className="font-body text-sm text-[#526C79]">Aún no hay integrantes con gastos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] font-body text-sm text-[#073B52]">
            <thead>
              <tr className="border-b border-[#CBDDE3] text-left text-xs uppercase tracking-wide text-[#526C79]">
                <th scope="col" className="py-2 pr-3 font-semibold">Integrante</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Pagó</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Le toca</th>
                <th scope="col" className="py-2 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {summary.byMember.map((member) => (
                <tr key={member.usuarioId} className="border-b border-[#E8F4FA] last:border-0">
                  <td className="py-2 pr-3 font-semibold">{member.nombre}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatMXN(member.paid)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatMXN(member.share)}</td>
                  <td className="py-2 text-right tabular-nums">
                    <BalanceLabel balance={member.balance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
