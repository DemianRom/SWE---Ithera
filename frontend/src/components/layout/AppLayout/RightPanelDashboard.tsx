import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Socket } from 'socket.io-client'
import type { Group } from '../../../types/groups'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  name: string
  role: 'Organizador' | 'Miembro'
  color: string
  isOnline: boolean
  avatarUrl?: string | null
}

interface MemberFromBackend {
  id: string
  usuario_id?: string
  nombre?: string
  email?: string
  avatar_url?: string | null
  rol: 'admin' | 'viajero' | string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

function ParticipantAvatar({
  name,
  color,
  avatarUrl,
  className,
}: {
  name: string
  color: string
  avatarUrl?: string | null
  className: string
}) {
  return (
    <div
      className={`${className} overflow-hidden rounded-full flex items-center justify-center text-white font-body font-bold shrink-0`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        name[0] ?? '?'
      )}
    </div>
  )
}

function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}


function SectionDivider({
  label,
  color,
  background,
}: {
  label: string
  color: string
  background: string
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-body text-xs font-bold uppercase tracking-widest"
        style={{ color, backgroundColor: background }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="h-px flex-1 rounded-full bg-[#cbdde3]" />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RightPanelDashboard({
  members = [],
  group,
  isLoading = false,
  socket,
  onOpenBudget,
  onOpenGroupPanel,
  onOpenChat,
  chatUnreadCount = 0,
  totalBudget,
  committedBudget,
}: {
  members?: MemberFromBackend[]
  group?: Group | null
  isLoading?: boolean
  socket?: Socket | null
  onOpenBudget?: () => void
  onOpenGroupPanel?: () => void
  onOpenChat?: () => void
  chatUnreadCount?: number
  totalBudget?: number
  committedBudget?: number
}) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [search, setSearch] = useState('')
  const participantTriggerRef = useRef<HTMLDivElement | null>(null)
  const participantButtonRef = useRef<HTMLButtonElement | null>(null)
  const floatingPopoverRef = useRef<HTMLDivElement | null>(null)
  const [popoverAnchorY, setPopoverAnchorY] = useState(0)

  const groupId = group?.id ? String(group.id) : null
  const participants: Participant[] = useMemo(() => {
    const uniqueMembers: MemberFromBackend[] = []
    const seen = new Set<string>()

    for (const member of members) {
      const key = String(member.usuario_id ?? member.id)
      if (seen.has(key)) continue
      seen.add(key)
      uniqueMembers.push(member)
    }

    return uniqueMembers.map((member, index) => {
      const name = member.nombre || member.email || 'Usuario'
      const colors = ['#0878cf', '#16b9d0', '#16b9d0', '#F59E0B']

      return {
        id: String(member.usuario_id ?? member.id),
        name,
        role: member.rol === 'admin' ? 'Organizador' : 'Miembro',
        color: colors[index % colors.length],
        isOnline: onlineUserIds.includes(String(member.usuario_id ?? member.id)),
        avatarUrl: member.avatar_url ?? null,
      }
    })
  }, [members, onlineUserIds])

  const onlineCount = participants.filter((p) => p.isOnline).length

  const filteredParticipants = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return participants
    return participants.filter((p) => p.name.toLowerCase().includes(q))
  }, [participants, search])

  const maxVisibleParticipants = 6
  const visibleParticipants = participants.slice(0, maxVisibleParticipants)
  const hiddenParticipantsCount = Math.max(participants.length - maxVisibleParticipants, 0)

  // Budget derived values
  const budgetData = totalBudget != null && totalBudget > 0
    ? (() => {
        const committed = committedBudget ?? 0
        const available = totalBudget - committed
        const pct = totalBudget > 0 ? Math.min((committed / totalBudget) * 100, 100) : 0
        const isOverBudget = totalBudget > 0 && committed > totalBudget
        return { committed, available, pct, isOverBudget }
      })()
    : null

  // Presence socket listener. The right panel joins the group room so the
  // online state works even when the chat drawer is closed.
  useEffect(() => {
    if (!socket || !groupId) return

    socket.emit('join_room', { tripId: groupId })

    const handlePresenceUpdate = (payload: { tripId: string; onlineUserIds: string[] }) => {
      if (String(payload.tripId) !== groupId) return
      setOnlineUserIds(payload.onlineUserIds.map(String))
    }

    socket.on('presence_update', handlePresenceUpdate)

    return () => {
      socket.emit('leave_room', { tripId: groupId })
      socket.off('presence_update', handlePresenceUpdate)
      setOnlineUserIds([])
    }
  }, [socket, groupId])

  // Close popover on click outside
  useEffect(() => {
    if (!popoverOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !participantTriggerRef.current?.contains(target) &&
        !floatingPopoverRef.current?.contains(target)
      ) {
        setPopoverOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some(
        (dialog) => !dialog.closest('[inert], [hidden], [aria-hidden="true"]') && dialog.getClientRects().length > 0 && getComputedStyle(dialog).visibility === 'visible'
      )) return
      const active = document.activeElement
      const focusInside = participantTriggerRef.current?.contains(active) || floatingPopoverRef.current?.contains(active)
      e.preventDefault()
      setPopoverOpen(false)
      setSearch('')
      if (focusInside) participantButtonRef.current?.focus()
    }
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as Node
      if (!participantTriggerRef.current?.contains(target) && !floatingPopoverRef.current?.contains(target)) {
        setPopoverOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocus)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocus)
    }
  }, [popoverOpen])

  if (isLoading) {
    return (
      <>
        <section className="shrink-0">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mb-2 flex gap-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
            ))}
          </div>
          <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
        </section>

        <section className="shrink-0">
          <div className="mb-2 h-3 w-20 animate-pulse rounded bg-gray-200" />
          <div className="mb-2 h-28 w-full animate-pulse rounded-xl bg-gray-200" />
          <div className="mb-1 h-3 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
        </section>

        <section className="shrink-0">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-gray-200" />
          <div className="flex flex-col gap-1.5 mb-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-200" />
        </section>

        <section className="shrink-0">
          <div className="h-14 w-full animate-pulse rounded-2xl bg-gray-200" />
        </section>
      </>
    )
  }

  return (
    <>
      {/* Chat del grupo — acceso destacado */}
      {onOpenChat && (
        <section className="shrink-0 px-1 pb-1">
          <button
            type="button"
            onClick={onOpenChat}
            className="group relative flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-[#073b52] to-[#0878cf] px-4 py-3.5 text-left text-white shadow-md transition-transform hover:scale-[1.01]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-heading text-sm font-bold leading-tight">Chat del grupo</span>
              <span className="block font-body text-[11px] text-white/75">Coordina con todos en tiempo real</span>
            </span>
            {chatUnreadCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ffbf20] px-1.5 font-body text-xs font-bold text-[#073b52]">
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </span>
            )}
          </button>
        </section>
      )}

      {/* Participants */}
      <section className="shrink-0">
        <SectionDivider label="Participantes" color="#0878cf" background="#e8f4fa" />

        <div className="overflow-hidden rounded-2xl border border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE]">
          {/* Avatars row */}
          <div ref={participantTriggerRef} className="px-4 pt-3 pb-2">
            <button
              type="button"
              ref={participantButtonRef}
              aria-expanded={popoverOpen}
              aria-controls="participant-search"
              onClick={() => {
                if (participantTriggerRef.current) {
                  const rect = participantTriggerRef.current.getBoundingClientRect()
                  setPopoverAnchorY(rect.top)
                }
                setPopoverOpen((o) => !o)
                setSearch('')
              }}
              className="w-full text-left"
            >
              {participants.length > 0 && (
                <div className="mb-2 flex items-center -space-x-2 overflow-hidden">
                  {visibleParticipants.map((participant) => (
                    <ParticipantAvatar
                      key={participant.id}
                      name={participant.name}
                      color={participant.color}
                      avatarUrl={participant.avatarUrl}
                      className="w-9 h-9 border-2 border-white text-sm"
                    />
                  ))}
                  {hiddenParticipantsCount > 0 && (
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#073b52] text-[13px] font-bold text-white"
                      title={`${hiddenParticipantsCount} participante(s) más`}
                    >
                      +{hiddenParticipantsCount}
                    </div>
                  )}
                </div>
              )}
              <p className="font-body text-sm font-semibold text-[#1E40AF] transition-colors hover:text-[#1E3A8A]">
                {participants.length} participante{participants.length !== 1 ? 's' : ''} · <span className="text-[#075b85]">{onlineCount} en línea</span>
              </p>
            </button>
          </div>

          {onOpenGroupPanel && (
            <div className="border-t border-[#BFDBFE] px-4 py-2.5">
              <button
                type="button"
                onClick={onOpenGroupPanel}
                className="w-full font-body text-sm font-semibold text-[#1D4ED8] transition-colors hover:text-[#1E40AF]"
              >
                Invitar o gestionar miembros →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Destino */}
      {group?.destino && (
        <section className="shrink-0">
          <SectionDivider label="Destino" color="#16b9d0" background="#e8f4fa" />

          <div className="overflow-hidden rounded-2xl border border-[#cbdde3] bg-gradient-to-br from-[#f4f9fa] to-[#e3f5f8]">
            <div className="px-3 py-2.5">
              <p className="line-clamp-2 font-body text-sm font-semibold text-[#073b52] leading-snug" title={group.destino}>
                {group.destino}
              </p>
            </div>
            <div className="border-t border-[#cbdde3]">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.destino)}`}
                target="_blank"
                rel="noreferrer"
                className="block py-2 text-center font-body text-xs font-semibold text-[#075b85] transition-colors hover:bg-[#e3f5f8]"
              >
                Abrir en Google Maps
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Mini budget */}
      <section className="shrink-0">
        <SectionDivider label="Presupuesto" color="#16b9d0" background="#e8f4fa" />

        {budgetData === null ? (
          <div className="rounded-2xl border border-[#cbdde3] bg-[#f4f9fa] px-4 py-3">
            <p className="font-body text-sm text-[#6B7280]">Sin presupuesto definido</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#cbdde3] bg-gradient-to-br from-[#f4f9fa] to-[#e8f4fa]">
            {/* Total destacado */}
            <div className="border-b border-[#cbdde3] px-4 py-3">
              <p className="font-body text-xs font-bold uppercase tracking-wide text-[#075b85]">Presupuesto total</p>
              <p className="mt-0.5 font-heading text-2xl font-extrabold text-[#073b52]">
                {formatMXN(totalBudget!)}
              </p>
            </div>

            {/* Comprometido y disponible */}
            <div className="grid grid-cols-2 divide-x divide-[#cbdde3]">
              <div className="px-4 py-3">
                <p className="font-body text-xs font-bold uppercase tracking-wide text-[#B91C1C]">Comprometido</p>
                <p className={`mt-0.5 font-heading text-lg font-bold ${budgetData.isOverBudget ? 'text-[#B91C1C]' : 'text-[#DC2626]'}`}>
                  {formatMXN(budgetData.committed)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="font-body text-xs font-bold uppercase tracking-wide text-[#075b85]">Disponible</p>
                <p className={`mt-0.5 font-heading text-lg font-bold ${budgetData.available < 0 ? 'text-[#B91C1C]' : 'text-[#075b85]'}`}>
                  {formatMXN(budgetData.available)}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="px-4 pb-3">
              <div className="h-2 overflow-hidden rounded-full bg-[#cbdde3]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${budgetData.pct}%`,
                    background: budgetData.isOverBudget
                      ? 'linear-gradient(90deg, #EF4444, #B91C1C)'
                      : 'linear-gradient(90deg, #16b9d0, #075b85)',
                  }}
                />
              </div>
              <p className={`mt-1 font-body text-xs font-semibold text-right ${budgetData.isOverBudget ? 'text-[#DC2626]' : 'text-[#075b85]'}`}>
                {budgetData.isOverBudget ? '⚠ Presupuesto excedido' : `${budgetData.pct.toFixed(0)}% comprometido`}
              </p>
            </div>

            {onOpenBudget && (
              <div className="border-t border-[#cbdde3] px-4 py-2.5">
                <button
                  type="button"
                  onClick={onOpenBudget}
                  className="w-full font-body text-sm font-semibold text-[#075b85] transition-colors hover:text-[#075b85]"
                >
                  Ajustar presupuesto →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Participant search portal — floats to the left of the right panel */}
      {popoverOpen && createPortal(
        <div
          id="participant-search"
          ref={floatingPopoverRef}
          className="fixed z-[200] w-[260px] overflow-hidden rounded-2xl border border-[#cbdde3] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
          style={{ right: 292, top: popoverAnchorY }}
        >
          <div className="border-b border-[#cbdde3] px-4 py-3">
            <p className="font-body text-sm font-bold text-[#073b52]">Participantes del viaje</p>
          </div>
          <div className="flex items-center gap-2 border-b border-[#cbdde3] px-3 py-2.5">
            <IconSearch />
            <input
              type="text"
              aria-label="Buscar participante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar miembro..."
              autoFocus
              className="min-w-0 flex-1 rounded bg-transparent font-body text-sm text-gray700 placeholder-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075EAA]"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {filteredParticipants.length === 0 ? (
              <p className="py-4 text-center font-body text-sm text-gray500">Sin resultados</p>
            ) : (
              filteredParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-[#f4f9fa]"
                >
                  <ParticipantAvatar
                    name={participant.name}
                    color={participant.color}
                    avatarUrl={participant.avatarUrl}
                    className="h-8 w-8 shrink-0 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold leading-none text-gray700">
                      {participant.name}
                    </p>
                    <p className="mt-0.5 font-body text-xs leading-none" style={{ color: participant.color }}>
                      {participant.role}
                    </p>
                  </div>
                  {participant.isOnline && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#91def0]" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}

    </>
  )
}
