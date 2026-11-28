import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { exportService, type SharedItineraryItem, type SharedGroupInfo } from '../../services/export'

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Fechas sin definir'
  return `${start ?? '-'} a ${end ?? '-'}`
}

export function SharedItineraryPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [group, setGroup] = useState<SharedGroupInfo | null>(null)
  const [items, setItems] = useState<SharedItineraryItem[]>([])
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!token) {
        setError('Token inválido')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await exportService.getSharedItinerary(token)
        if (cancelled) return
        setGroup(response.group)
        setItems(response.itinerary ?? [])
        setExpiresAt(response.tokenMeta?.expiresAt ?? null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el itinerario compartido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const groupedByDay = useMemo(() => {
    const map = new Map<string, SharedItineraryItem[]>()
    items.forEach((item) => {
      const day = item.day ?? 'Sin fecha'
      const list = map.get(day) ?? []
      list.push(item)
      map.set(day, list)
    })
    return Array.from(map.entries())
  }, [items])

  return (
    <main className="min-h-screen bg-[#F4F9FA] px-4 py-8 font-body">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 rounded-2xl bg-[#073B52] px-6 py-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-wide text-white/70">Itinerario compartido</p>
          <h1 className="mt-1 font-heading text-2xl font-bold">{group?.nombre ?? 'Cargando viaje...'}</h1>
          <p className="mt-1 text-sm text-white/85">
            {group?.destino_formatted_address ?? group?.destino ?? 'Destino sin definir'}
          </p>
          <p className="mt-2 text-xs text-white/75">
            {group ? formatRange(group.fecha_inicio, group.fecha_fin) : 'Preparando fechas...'}
          </p>
          {expiresAt ? (
            <p className="mt-1 text-xs text-white/85">Enlace válido hasta: {formatDate(expiresAt)}</p>
          ) : null}
        </header>

        {loading ? <div className="rounded-2xl bg-white p-5 text-sm text-[#183F51]">Cargando itinerario...</div> : null}
        {!loading && error ? <div className="rounded-2xl border border-[#DAB5AA] bg-[#FAEDE7] p-5 text-sm text-[#8D4034]">{error}</div> : null}

        {!loading && !error && groupedByDay.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-[#183F51]">No hay actividades públicas para mostrar.</div>
        ) : null}

        {!loading && !error && groupedByDay.length > 0 ? (
          <section className="space-y-4">
            {groupedByDay.map(([day, dayItems]) => (
              <article key={day} className="rounded-2xl border border-[#CBDDE3] bg-white p-4">
                <h2 className="font-heading text-base font-bold text-[#073B52]">{day}</h2>
                <div className="mt-3 space-y-3">
                  {dayItems.map((item) => (
                    <div key={item.id} className="rounded-xl bg-[#F4F9FA] p-3">
                      <p className="font-semibold text-[#073B52]">{item.title}</p>
                      {item.description ? <p className="mt-1 text-sm text-[#183F51]">{item.description}</p> : null}
                      <p className="mt-1 text-xs text-[#526C79]">
                        {item.location ? `${item.location} · ` : ''}
                        {formatDate(item.startsAt)}
                        {item.endsAt ? ` a ${formatDate(item.endsAt)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  )
}

