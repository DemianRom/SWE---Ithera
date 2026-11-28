import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { chatService, type ChatMessage } from '../../services/chat'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  name: string
  color: string
  avatarUrl?: string | null
}

interface ChatAck {
  ok: boolean
  message?: ChatMessage
  error?: string
}

export interface ChatDrawerProps {
  open: boolean
  onClose: () => void
  groupId: string | null
  groupName: string
  socket: Socket | null
  isSocketConnected: boolean
  accessToken: string | null
  currentUserId: string | null
  currentUserName: string
  participants: Participant[]
  isReadOnly?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function getDateKey(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toDateString()
}

function formatDateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Hoy'
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
  return date.toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeWidth="2" fill="currentColor" />
    </svg>
  )
}

function IconChatEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Avatar({
  name,
  color,
  avatarUrl,
  size = 'md',
}: {
  name: string
  color: string
  avatarUrl?: string | null
  size?: 'sm' | 'md'
}) {
  const cls = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs'
  return (
    <div
      className={`${cls} overflow-hidden rounded-full flex items-center justify-center text-white font-body font-bold shrink-0`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        (name[0] ?? '?').toUpperCase()
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatDrawer({
  open,
  onClose,
  groupId,
  groupName,
  socket,
  isSocketConnected,
  accessToken,
  currentUserId,
  currentUserName,
  participants,
  isReadOnly = false,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null)
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  const hasOtherDialog = useCallback(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], dialog[open]'))
      .some((dialog) => dialog !== drawerRef.current && !dialog.contains(drawerRef.current) &&
        !dialog.closest('[inert], [aria-hidden="true"]') && dialog.getClientRects().length > 0), [])

  // Derived: true whenever the loaded data doesn't match the current group yet
  const isLoading = groupId != null && loadedGroupId !== groupId

  const groupInitials = groupName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const onlineCount = participants.filter((p) => onlineUserIds.includes(p.id)).length

  // Carga / recarga de mensajes. Se ejecuta no solo al cambiar de grupo, sino
  // también cada vez que se abre el drawer, para traer los mensajes que el
  // usuario se perdió mientras el chat estaba cerrado o estuvo ausente.
  const reloadMessages = useCallback(
    (signal?: { cancelled: boolean }) => {
      if (!groupId || !accessToken) return
      void chatService
        .getMessages(groupId, accessToken, 50)
        .then((res) => {
          if (signal?.cancelled) return
          setMessages(res.messages)
          setChatError(null)
          setLoadedGroupId(groupId)
        })
        .catch((err: unknown) => {
          if (signal?.cancelled) return
          setMessages([])
          setChatError(err instanceof Error ? err.message : 'No se pudo cargar el chat')
          setLoadedGroupId(groupId)
        })
    },
    [groupId, accessToken]
  )

  useEffect(() => {
    if (!open) return
    const signal = { cancelled: false }
    reloadMessages(signal)
    return () => { signal.cancelled = true }
  }, [open, reloadMessages])

  // Socket: join room + all chat/presence listeners
  useEffect(() => {
    if (!socket || !groupId) return

    socket.emit('join_room', { tripId: groupId })

    const handleMessage = (msg: ChatMessage & { clientId?: string | null }) => {
      if (String(msg.groupId) !== groupId) return
      setMessages((prev) => {
        const base = msg.clientId ? prev.filter((m) => m.id !== msg.clientId) : prev
        return base.some((m) => m.id === msg.id) ? base : [...base, msg]
      })
    }

    const handlePresence = (payload: { tripId: string; onlineUserIds: string[] }) => {
      if (String(payload.tripId) !== groupId) return
      setOnlineUserIds(payload.onlineUserIds.map(String))
    }

    const handleError = (payload: { message?: string }) => {
      setChatError(payload.message ?? 'Error de conexión del chat')
    }

    // Al reconectar (p. ej. tras estar ausente), volvemos a entrar a la sala y
    // recargamos el historial para no perder mensajes recibidos sin conexión.
    const handleReconnect = () => {
      socket.emit('join_room', { tripId: groupId })
      reloadMessages()
    }

    socket.on('chat_message', handleMessage)
    socket.on('presence_update', handlePresence)
    socket.on('error_event', handleError)
    socket.on('connect', handleReconnect)

    return () => {
      socket.emit('leave_room', { tripId: groupId })
      socket.off('chat_message', handleMessage)
      socket.off('presence_update', handlePresence)
      socket.off('error_event', handleError)
      socket.off('connect', handleReconnect)
      setOnlineUserIds([])
    }
  }, [socket, groupId, reloadMessages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const drawer = drawerRef.current
    const focusDrawer = () => {
      if (textareaRef.current && !textareaRef.current.disabled) textareaRef.current.focus()
      else drawer?.focus()
    }
    let otherDialogOpen = hasOtherDialog()
    if (!otherDialogOpen) focusDrawer()
    const observer = new MutationObserver(() => {
      const hasDialog = hasOtherDialog()
      if (drawer?.isConnected && !drawer.inert && otherDialogOpen && !hasDialog &&
        (document.activeElement === document.body || document.activeElement === document.documentElement)) {
        focusDrawer()
      }
      otherDialogOpen = hasDialog
    })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'inert', 'aria-hidden', 'open'],
    })
    return () => {
      observer.disconnect()
      if (!hasOtherDialog() && previousFocus?.isConnected &&
        (drawer?.contains(document.activeElement) || document.activeElement === document.body)) {
        previousFocus.focus()
      }
    }
  }, [open, hasOtherDialog])

  const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || hasOtherDialog()) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const drawer = drawerRef.current
    if (!drawer) return
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.closest('[inert], [hidden], [aria-hidden="true"]') && element.getClientRects().length > 0)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) {
      event.preventDefault()
      drawer.focus()
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === drawer)) {
      event.preventDefault()
      first.focus()
    }
    event.stopPropagation()
  }

  const handleSend = useCallback(() => {
    const text = chatInput.trim()
    if (isReadOnly || !text || !groupId || !accessToken) return

    setChatError(null)
    setChatInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const clientId = `local-${Date.now()}`
    const optimistic: ChatMessage = {
      id: clientId,
      groupId,
      userId: currentUserId ?? 'me',
      authorName: currentUserName,
      authorEmail: null,
      authorAvatarUrl: null,
      contenido: text,
      createdAt: new Date().toISOString(),
      clientId,
    }
    setMessages((prev) => [...prev, optimistic])

    if (socket && isSocketConnected) {
      socket.timeout(7000).emit(
        'chat_send_message',
        { groupId, contenido: text, clientId },
        (err: Error | null, res?: ChatAck) => {
          if (err || !res?.ok) {
            setMessages((prev) => prev.filter((m) => m.id !== clientId))
            setChatError(res?.error ?? 'No se pudo enviar el mensaje')
          }
        }
      )
      return
    }

    void chatService.sendMessage(groupId, text, accessToken).catch((err: unknown) => {
      setMessages((prev) => prev.filter((m) => m.id !== clientId))
      setChatError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje')
    })
  }, [chatInput, groupId, accessToken, currentUserId, currentUserName, socket, isSocketConnected, isReadOnly])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isReadOnly) handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`
  }

  // Pre-compute which messages need a date separator (avoids mutable variable inside JSX)
  const messagesWithSeparator = messages.map((msg, i) => ({
    msg,
    showSeparator: i === 0 || getDateKey(msg.createdAt) !== getDateKey(messages[i - 1].createdAt),
  }))

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat del grupo ${groupName}`}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        onKeyDown={handleDrawerKeyDown}
        className={[
          'fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ background: '#F4F9FA' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg, #073B52, #075EAA)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-sm text-white shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            {groupInitials}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm text-white leading-tight truncate">{groupName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSocketConnected ? 'bg-[#91DEF0]' : 'bg-white/40'}`}
              />
              <span className="font-body text-[11px] text-white/70">
                {isReadOnly ? 'Solo lectura' : (isSocketConnected ? 'En tiempo real' : 'Reconectando...')}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Cerrar chat"
          >
            <IconClose />
          </button>
        </div>

        {/* Online participants bar */}
        {participants.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#CBDDE3] bg-white shrink-0">
            <div className="flex -space-x-1.5">
              {participants.slice(0, 6).map((p) => (
                <div key={p.id} className="relative" title={p.name}>
                  <Avatar name={p.name} color={p.color} avatarUrl={p.avatarUrl} size="sm" />
                  {onlineUserIds.includes(p.id) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#075B85] border border-white" />
                  )}
                </div>
              ))}
            </div>
            <span className="font-body text-[11px] text-[#526C79]">
              {onlineCount > 0 ? `${onlineCount} en línea ahora` : 'Sin miembros en línea'}
            </span>
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5 min-h-0">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center py-12">
              <p className="font-body text-sm text-[#526C79]">Cargando mensajes...</p>
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="text-[#0878CF]/30">
                <IconChatEmpty />
              </div>
              <p className="font-heading font-bold text-sm text-[#073B52]">Sé el primero en escribir</p>
              <p className="font-body text-[12px] text-[#526C79] max-w-[180px]">
                {isReadOnly ? 'El historial del chat se conserva en modo lectura.' : 'Usa el chat para coordinar con tu grupo en tiempo real'}
              </p>
            </div>
          )}

          {messagesWithSeparator.map(({ msg: message, showSeparator }) => {
            const isOwn = currentUserId
              ? String(message.userId) === String(currentUserId)
              : message.id.startsWith('local-')
            const author = message.authorName || 'Usuario'
            const pColor = participants.find((p) => p.name === author)?.color ?? '#0878CF'
            const pAvatar = participants.find((p) => p.name === author)?.avatarUrl ?? null

            return (
              <div key={message.id}>
                {showSeparator && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-[#CBDDE3]" />
                    <span className="font-body text-[10px] text-[#526C79] px-2 capitalize">
                      {formatDateLabel(message.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-[#CBDDE3]" />
                  </div>
                )}

                <div className={`flex gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {!isOwn && (
                    <Avatar
                      name={author}
                      color={pColor}
                      avatarUrl={message.authorAvatarUrl ?? pAvatar}
                      size="sm"
                    />
                  )}
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    {!isOwn && (
                      <span className="font-body text-[10px] text-[#526C79] mb-0.5 ml-1">{author}</span>
                    )}
                    <div
                      className={[
                        'font-body text-[13px] px-3 py-2 leading-relaxed',
                        isOwn
                          ? 'text-white rounded-2xl rounded-tr-sm shadow-md'
                          : 'bg-white text-[#183F51] border border-[#CBDDE3] rounded-2xl rounded-tl-sm shadow-sm',
                      ].join(' ')}
                      style={isOwn ? { background: '#075EAA' } : {}}
                    >
                      {message.contenido}
                      <p
                        className={`text-[9px] mt-1 text-right leading-none ${
                          isOwn ? 'text-white/80' : 'text-[#526C79]'
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                  {isOwn && <div className="w-6 shrink-0" />}
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {chatError && (
          <div className="px-4 py-2 bg-[#FAEDE7] border-t border-[#EAC8C0] shrink-0">
            <p className="font-body text-[11px] text-[#8D4034]">{chatError}</p>
          </div>
        )}

        {isReadOnly && (
          <div className="border-t border-[#CBDDE3] bg-[#F4F9FA] px-4 py-3">
            <p className="font-body text-[11px] leading-relaxed text-[#526C79]">
              Este viaje ya finalizó. El chat queda disponible únicamente como historial de consulta.
            </p>
          </div>
        )}

        {/* Input */}
        {!isReadOnly && (
        <div className="px-4 py-3 border-t border-[#CBDDE3] bg-white shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              disabled={!groupId || !accessToken}
              rows={1}
              className="flex-1 resize-none bg-[#F4F9FA] border border-transparent focus:border-[#005AAF] focus:ring-2 focus:ring-[#005AAF] rounded-xl px-3 py-2 font-body text-[13px] text-[#183F51] placeholder-[#526C79] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 leading-relaxed"
              style={{ minHeight: '38px', maxHeight: '96px', overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || !groupId || !accessToken}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 hover:opacity-90 transition-opacity shadow-md disabled:cursor-not-allowed disabled:opacity-50 mb-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005AAF]"
              style={{ background: '#075EAA' }}
              aria-label="Enviar mensaje"
            >
              <IconSend />
            </button>
          </div>
          <p className="font-body text-[10px] text-[#526C79] mt-1">
            Enter para enviar · Shift+Enter nueva línea
          </p>
        </div>
        )}
      </div>
    </>
  )
}
