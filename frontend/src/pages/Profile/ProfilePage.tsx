import { useState, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '../../components/layout/AppLayout'
import { useAuth } from '../../context/useAuth'
import { apiClient } from '../../services/apiClient'
import { supabase } from '../../lib/supabase'
import { notificationsService } from '../../services/notifications'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

function IconKey() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconEye({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputBase =
  'w-full rounded-xl border border-[#CBDDE3] bg-white px-4 py-2.5 font-body text-sm text-[#073B52] placeholder-gray-400 outline-none transition focus:border-[#0878CF] focus:ring-2 focus:ring-[#0878CF]/20 disabled:bg-[#F4F9FA] disabled:text-gray-400 disabled:cursor-default'

function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
  rightElement,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  disabled?: boolean
  type?: string
  rightElement?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-body text-xs font-semibold text-[#526C79] uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          disabled={disabled}
          className={inputBase + (rightElement ? ' pr-10' : '')}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-[#CBDDE3] last:border-none">
      <div>
        <p className="font-body text-sm font-semibold text-[#073B52]">{label}</p>
        <p className="font-body text-xs text-[#526C79] mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0878CF]/30',
          checked ? 'bg-[#0878CF]' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        >
          {checked && <IconCheck />}
        </span>
      </button>
    </div>
  )
}

type TravelStats = {
  tripsAsAdmin: number
  tripsAsTraveler: number
  totalSpent: number
  countriesVisited: number
  destinations: string[]
  recentTrips: Array<{
    id: number
    nombre: string
    destino: string | null
    estado: string | null
    fecha_inicio: string | null
    fecha_fin: string | null
    rol: string
  }>
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatTripDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Fechas sin definir'
  const formatter = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  const startText = start ? formatter.format(new Date(`${start}T00:00:00`)) : 'Inicio sin definir'
  const endText = end ? formatter.format(new Date(`${end}T00:00:00`)) : 'Fin sin definir'
  return `${startText} - ${endText}`
}

// ── ProfilePage ───────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { localUser, accessToken, refreshMe, deleteAccount } = useAuth()
  const navigate = useNavigate()

  const fullName  = localUser?.nombre ?? 'Usuario'
  const email     = localUser?.email  ?? ''
  const nameParts = fullName.trim().split(/\s+/)

  // ── Delete account state ──────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [travelStats, setTravelStats] = useState<TravelStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [statsExpanded, setStatsExpanded] = useState(false)

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    setStatsLoading(true)
    setStatsError('')

    apiClient
      .get<{ ok: boolean; stats: TravelStats }>('/auth/me/stats', accessToken)
      .then((response) => {
        if (!cancelled) setTravelStats(response.stats)
      })
      .catch((error) => {
        if (!cancelled) {
          setStatsError(error instanceof Error ? error.message : 'No se pudieron cargar tus estadísticas.')
          setTravelStats(null)
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken])

  const handleDeleteAccount = async () => {
    if (!accessToken) return
    try {
      setDeleting(true)
      setDeleteError('')
      await deleteAccount(accessToken)
      navigate('/login', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.')
      setDeleting(false)
    }
  }

  // ── Personal data state ───────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [nombre,  setNombre]  = useState(nameParts[0] ?? '')
  const [apPat,   setApPat]   = useState(nameParts[1] ?? '')
  const [apMat,   setApMat]   = useState(nameParts[2] ?? '')
  const [correo,  setCorreo]  = useState(email)

  const [savedName,  setSavedName]  = useState(nombre)
  const [savedApPat, setSavedApPat] = useState(apPat)
  const [savedApMat, setSavedApMat] = useState(apMat)
  const [savedEmail, setSavedEmail] = useState(correo)

  function handleEdit() { setEditing(true) }

  function handleCancel() {
    setNombre(savedName)
    setApPat(savedApPat)
    setApMat(savedApMat)
    setCorreo(savedEmail)
    setEditing(false)
  }

  async function handleSave() {
    if (!accessToken) return

    const fullName = [nombre, apPat, apMat].filter(Boolean).join(' ').trim()

    await apiClient.patch('/auth/me', { nombre: fullName }, accessToken)
    await refreshMe(accessToken)

    setSavedName(nombre)
    setSavedApPat(apPat)
    setSavedApMat(apMat)
    setSavedEmail(correo)
    setEditing(false)
  }

  // ── Password state ────────────────────────────────────────────────────────
  const [pwOpen,    setPwOpen]    = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew,     setPwNew]     = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPw,    setShowPw]    = useState({ current: false, new: false, confirm: false })
  const [pwError,   setPwError]   = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handlePasswordUpdate() {
    setPwError('')
    setPwSuccess(false)

    if (!accessToken) {
      setPwError('No hay sesión activa.')
      return
    }

    if (!localUser?.email) {
      setPwError('No se pudo obtener el correo del usuario.')
      return
    }

    if (!pwCurrent) {
      setPwError('Ingresa tu contraseña actual.')
      return
    }

    if (pwNew.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (pwNew !== pwConfirm) {
      setPwError('Las contraseñas no coinciden.')
      return
    }

    if (pwCurrent === pwNew) {
      setPwError('La nueva contraseña debe ser diferente a la actual.')
      return
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: localUser.email,
        password: pwCurrent,
      })

      if (signInError) {
        setPwError('La contraseña actual no es correcta.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: pwNew,
      })

      if (updateError) {
        setPwError(updateError.message)
        return
      }

      setPwSuccess(true)
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')

      setTimeout(() => setPwSuccess(false), 3000)
    } catch {
      setPwError('No se pudo actualizar la contraseña.')
    }
  }

  // ── Photo state ───────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoSuccess, setPhotoSuccess] = useState(false)
  const [photoDeleting, setPhotoDeleting] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Solo se permiten imágenes PNG, JPG, JPEG o WEBP.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('La imagen no puede pesar más de 5 MB.')
      return
    }

    setPhotoError('')
    setPhotoSuccess(false)
    setPhotoFile(file)

    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
  }

  async function handleSavePhoto() {
    if (!photoFile) return

    if (!accessToken) {
      setPhotoError('No hay sesión activa.')
      return
    }

    try {
      setPhotoSaving(true)
      setPhotoError('')
      setPhotoSuccess(false)

      const formData = new FormData()
      formData.append('avatar', photoFile)

      await apiClient.upload('/auth/me/avatar', formData, accessToken)

      await refreshMe(accessToken)

      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoSuccess(true)

      if (fileRef.current) {
        fileRef.current.value = ''
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la imagen.'

      setPhotoError(message)
    } finally {
      setPhotoSaving(false)
    }
  }

  async function handleDeletePhoto() {
    if (!accessToken) {
      setPhotoError('No hay sesión activa.')
      return
    }

    if (!localUser?.avatar_url && !photoPreview) return

    try {
      setPhotoDeleting(true)
      setPhotoError('')
      setPhotoSuccess(false)

      await apiClient.delete('/auth/me/avatar', accessToken)
      await refreshMe(accessToken)

      setPhotoFile(null)
      setPhotoPreview(null)
      setPhotoSuccess(true)

      if (fileRef.current) {
        fileRef.current.value = ''
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo eliminar la imagen.'

      setPhotoError(message)
    } finally {
      setPhotoDeleting(false)
    }
  }

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }
  }, [photoPreview])

  // ── Preferences state ─────────────────────────────────────────────────────
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifGroup, setNotifGroup] = useState(true)
  const [notifFinance, setNotifFinance] = useState(true)
  const [notifAlerts, setNotifAlerts] = useState(true)

  useEffect(() => {
    if (accessToken) {
      notificationsService.getPreferences(accessToken)
        .then(res => {
          if (res.ok && res.preferences) {
            setNotifEmail(res.preferences.notificaciones_correo)
            setNotifGroup(res.preferences.notificaciones_grupo)
            setNotifFinance(res.preferences.notificaciones_finanzas ?? true)
            setNotifAlerts(res.preferences.notificaciones_alertas ?? true)
          }
        })
        .catch(console.error)
    }
  }, [accessToken])

  type NotificationPreferenceKey =
    | 'notificaciones_correo'
    | 'notificaciones_grupo'
    | 'notificaciones_finanzas'
    | 'notificaciones_alertas'

  const preferenceSetters: Record<NotificationPreferenceKey, Dispatch<SetStateAction<boolean>>> = {
    notificaciones_correo: setNotifEmail,
    notificaciones_grupo: setNotifGroup,
    notificaciones_finanzas: setNotifFinance,
    notificaciones_alertas: setNotifAlerts,
  }

  const preferenceValues: Record<NotificationPreferenceKey, boolean> = {
    notificaciones_correo: notifEmail,
    notificaciones_grupo: notifGroup,
    notificaciones_finanzas: notifFinance,
    notificaciones_alertas: notifAlerts,
  }

  const handleTogglePref = async (key: NotificationPreferenceKey, val: boolean) => {
    if (!accessToken) return
    const prevValue = preferenceValues[key]
    preferenceSetters[key](val)

    try {
      await notificationsService.updatePreferences({ [key]: val }, accessToken)
    } catch (err) {
      console.error('Failed to update pref', err)
      preferenceSetters[key](prevValue)
    }
  }

  // ── NavUserInfo for AppLayout ─────────────────────────────────────────────
  const displayName = [savedName, savedApPat].filter(Boolean).join(' ') || fullName
  const navUser = {
    name:     displayName,
    role:     'Organizador',
    initials: getInitials(displayName),
    color:    '#0878CF',
  }

  const avatarInitials = getInitials(displayName)

  return (
    <AppLayout user={navUser} showRightPanel={false} showTripSelector={false}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
          <h1 className="font-heading font-bold text-2xl text-[#073B52]">Mi perfil</h1>

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#CBDDE3] shadow-sm p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar / photo */}
            <div className="relative shrink-0">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-heading font-bold text-2xl overflow-hidden"
                style={{ backgroundColor: '#0878CF' }}
              >
                {photoPreview || localUser?.avatar_url
                  ? (
                    <img
                      src={photoPreview || localUser?.avatar_url || ''}
                      alt="Foto de perfil"
                      className="w-full h-full object-cover"
                    />
                  )
                  : avatarInitials
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0878CF] text-white rounded-full flex items-center justify-center hover:bg-[#075EAA] transition-colors shadow"
                aria-label="Cambiar foto de perfil"
              >
                <IconCamera />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="font-heading font-bold text-[#073B52] text-xl leading-tight">
                {displayName || 'Usuario'}
              </h1>
              <p className="font-body text-sm text-[#526C79] mt-0.5">Usuario</p>
              <p className="font-body text-xs text-[#526C79] mt-1">{savedEmail}</p>
            </div>

            {/* Edit button */}
            {!editing && (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 bg-[#0878CF] text-white font-body text-sm font-semibold rounded-xl px-4 py-2 hover:bg-[#075EAA] transition-colors shrink-0"
              >
                <IconEdit />
                Editar perfil
              </button>
            )}
          </div>

          {/* ── Travel statistics ─────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-[#CBDDE3] shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setStatsExpanded((current) => !current)}
              className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left transition-colors hover:bg-[#F4F9FA]"
              aria-expanded={statsExpanded}
              aria-controls="travel-statistics-panel"
            >
              <div>
                <h2 className="font-heading font-bold text-[#073B52] text-base">Mis estadísticas de viaje</h2>
                <p className="mt-0.5 font-body text-xs text-[#526C79]">
                  Resumen acumulado de tus viajes y del gasto registrado.
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F4FA] text-[#0878CF]">
                <IconChevron open={statsExpanded} />
              </span>
            </button>
            {statsExpanded && (
              <div id="travel-statistics-panel" className="border-t border-[#CBDDE3] px-6 py-5">
                {statsLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className="h-24 animate-pulse rounded-2xl bg-[#E8F4FA]" />
                    ))}
                  </div>
                ) : statsError ? (
                  <div className="rounded-2xl border border-[#8D4034]/30 bg-[#FAEDE7] px-4 py-3 font-body text-sm text-[#8D4034]">
                    {statsError}
                  </div>
                ) : !travelStats || (travelStats.tripsAsAdmin + travelStats.tripsAsTraveler === 0) ? (
                  <div className="rounded-2xl border border-dashed border-[#CBDDE3] bg-[#F4F9FA] px-4 py-8 text-center">
                    <p className="font-body text-sm font-semibold text-[#073B52]">Aún no tienes estadísticas.</p>
                    <p className="mt-1 font-body text-xs text-[#526C79]">
                      Crea o únete a tu primer viaje para empezar a construir tu historial.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/my-trips')}
                      className="mt-4 rounded-xl bg-[#0878CF] px-4 py-2 font-body text-sm font-semibold text-white transition hover:bg-[#075EAA]"
                    >
                      Ir a mis viajes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[#CBDDE3] bg-[#F4F9FA] px-4 py-4">
                        <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#526C79]">Como Admin</p>
                        <p className="mt-2 font-heading text-2xl font-extrabold text-[#073B52]">{travelStats.tripsAsAdmin}</p>
                      </div>
                      <div className="rounded-2xl border border-[#CBDDE3] bg-[#F4F9FA] px-4 py-4">
                        <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#526C79]">Como Viajero</p>
                        <p className="mt-2 font-heading text-2xl font-extrabold text-[#073B52]">{travelStats.tripsAsTraveler}</p>
                      </div>
                      <div className="rounded-2xl border border-[#CBDDE3] bg-[#F4F9FA] px-4 py-4">
                        <p className="font-body text-xs font-semibold uppercase tracking-wide text-[#526C79]">Gasto registrado</p>
                        <p className="mt-2 font-heading text-xl font-extrabold text-[#073B52]">{formatMoney(travelStats.totalSpent)}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-2xl border border-[#CBDDE3] px-4 py-4">
                        <p className="font-body text-sm font-semibold text-[#073B52]">Destinos registrados</p>
                        <p className="mt-1 font-body text-xs text-[#526C79]">
                          {travelStats.countriesVisited} destino(s) detectado(s) en tu historial.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {travelStats.destinations.slice(0, 6).map((destination) => (
                            <span key={destination} className="rounded-full bg-[#E8F4FA] px-3 py-1 font-body text-xs font-semibold text-[#0878CF]">
                              {destination}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#CBDDE3] px-4 py-4">
                        <p className="font-body text-sm font-semibold text-[#073B52]">Viajes recientes</p>
                        <div className="mt-3 divide-y divide-[#CBDDE3]">
                          {travelStats.recentTrips.length === 0 ? (
                            <p className="py-3 font-body text-sm text-[#526C79]">Sin viajes recientes.</p>
                          ) : (
                            travelStats.recentTrips.map((trip) => (
                              <div key={`${trip.id}-${trip.rol}`} className="py-3 first:pt-0 last:pb-0">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-body text-sm font-semibold text-[#073B52]">{trip.nombre}</p>
                                  <span className="rounded-full bg-[#E8F4FA] px-2.5 py-1 font-body text-[11px] font-semibold text-[#526C79]">
                                    {trip.rol}
                                  </span>
                                </div>
                                <p className="mt-0.5 font-body text-xs text-[#526C79]">{trip.destino || 'Destino sin definir'}</p>
                                <p className="mt-0.5 font-body text-[11px] text-[#526C79]">{formatTripDateRange(trip.fecha_inicio, trip.fecha_fin)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Personal data ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-[#CBDDE3] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#CBDDE3] flex items-center justify-between">
              <h2 className="font-heading font-bold text-[#073B52] text-base">Datos personales</h2>
              {editing && (
                <span className="font-body text-xs text-[#0878CF] bg-[#0878CF]/10 px-2.5 py-1 rounded-full">
                  Modo edición
                </span>
              )}
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <Field
                label="Nombre"
                value={nombre}
                onChange={editing ? setNombre : undefined}
                disabled={!editing}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Apellido paterno"
                  value={apPat}
                  onChange={editing ? setApPat : undefined}
                  disabled={!editing}
                />
                <Field
                  label="Apellido materno"
                  value={apMat}
                  onChange={editing ? setApMat : undefined}
                  disabled={!editing}
                />
              </div>
              <Field
                label="Correo electrónico"
                value={correo}
                onChange={editing ? setCorreo : undefined}
                disabled={!editing}
                type="email"
              />

              {editing && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleSave}
                    className="flex-1 sm:flex-none bg-[#0878CF] text-white font-body text-sm font-semibold rounded-xl px-6 py-2.5 hover:bg-[#075EAA] transition-colors"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 sm:flex-none border border-[#CBDDE3] text-[#526C79] font-body text-sm font-semibold rounded-xl px-6 py-2.5 hover:bg-[#F4F9FA] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── Change password ───────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-[#CBDDE3] shadow-sm overflow-hidden">
            <button
              onClick={() => setPwOpen((o) => !o)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F4F9FA] transition-colors"
              aria-expanded={pwOpen}
            >
              <div className="flex items-center gap-3">
                <span className="text-[#0878CF]"><IconKey /></span>
                <h2 className="font-heading font-bold text-[#073B52] text-base">Cambiar contraseña</h2>
              </div>
              <span className="text-[#526C79]"><IconChevron open={pwOpen} /></span>
            </button>

            {pwOpen && (
              <div className="px-6 pb-6 flex flex-col gap-4 border-t border-[#CBDDE3] pt-5">
                <Field
                  label="Confirma tu contraseña actual"
                  value={pwCurrent}
                  onChange={setPwCurrent}
                  type={showPw.current ? 'text' : 'password'}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))}
                      className="text-[#526C79] hover:text-[#073B52] transition-colors"
                    >
                      <IconEye show={showPw.current} />
                    </button>
                  }
                />
                <Field
                  label="Nueva contraseña"
                  value={pwNew}
                  onChange={setPwNew}
                  type={showPw.new ? 'text' : 'password'}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => ({ ...s, new: !s.new }))}
                      className="text-[#526C79] hover:text-[#073B52] transition-colors"
                    >
                      <IconEye show={showPw.new} />
                    </button>
                  }
                />
                <Field
                  label="Confirmar nueva contraseña"
                  value={pwConfirm}
                  onChange={setPwConfirm}
                  type={showPw.confirm ? 'text' : 'password'}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                      className="text-[#526C79] hover:text-[#073B52] transition-colors"
                    >
                      <IconEye show={showPw.confirm} />
                    </button>
                  }
                />

                {pwError && (
                  <p className="font-body text-xs text-[#8D4034] bg-[#FAEDE7] border border-[#8D4034]/20 rounded-xl px-4 py-2.5">
                    {pwError}
                  </p>
                )}
                {pwSuccess && (
                  <p className="font-body text-xs text-[#075B85] bg-[#075B85]/10 border border-[#075B85]/20 rounded-xl px-4 py-2.5">
                    Contraseña actualizada correctamente.
                  </p>
                )}

                <button
                  onClick={handlePasswordUpdate}
                  className="w-full sm:w-auto bg-[#0878CF] text-white font-body text-sm font-semibold rounded-xl px-6 py-2.5 hover:bg-[#075EAA] transition-colors"
                >
                  Actualizar contraseña
                </button>
              </div>
            )}
          </section>

          {/* ── Photo upload ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-[#CBDDE3] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#CBDDE3]">
              <h2 className="font-heading font-bold text-[#073B52] text-base">Foto de perfil</h2>
            </div>
            <div className="px-6 py-5 flex flex-col sm:flex-row items-center gap-5">
              {/* Preview */}
              <div
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-[#CBDDE3] flex items-center justify-center overflow-hidden shrink-0 bg-[#F4F9FA]"
              >
                {photoPreview || localUser?.avatar_url
                  ? (
                    <img
                      src={photoPreview || localUser?.avatar_url || ''}
                      alt="Foto de perfil"
                      className="w-full h-full object-cover"
                    />
                  )
                  : avatarInitials
                }
              </div>

              <div className="flex flex-col gap-2 text-center sm:text-left">
                <p className="font-body text-sm text-[#526C79]">
                  JPG, PNG o WEBP. Máximo 5 MB.
                </p>
                <div className="flex gap-2 justify-center sm:justify-start">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 bg-[#0878CF] text-white font-body text-sm font-semibold rounded-xl px-4 py-2 hover:bg-[#075EAA] transition-colors"
                  >
                    <IconCamera />
                    Seleccionar imagen
                  </button>

                  {photoFile && (
                    <button
                      onClick={handleSavePhoto}
                      disabled={photoSaving}
                      className="bg-[#075B85] text-white font-body text-sm font-semibold rounded-xl px-4 py-2 hover:bg-[#064A6C] transition-colors disabled:opacity-60"
                    >
                      {photoSaving ? 'Guardando...' : 'Guardar foto'}
                    </button>
                  )}

                  {photoPreview && (
                    <button
                      onClick={() => {
                        setPhotoFile(null)
                        setPhotoPreview(null)
                        setPhotoError('')
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                      className="border border-[#CBDDE3] text-[#526C79] font-body text-sm font-semibold rounded-xl px-4 py-2 hover:bg-[#F4F9FA] transition-colors"
                    >
                      Cancelar
                    </button>
                  )}

                  {localUser?.avatar_url && !photoPreview && (
                    <button
                      onClick={handleDeletePhoto}
                      disabled={photoDeleting}
                      className="border border-[#8D4034]/30 text-[#8D4034] font-body text-sm font-semibold rounded-xl px-4 py-2 hover:bg-[#FAEDE7] transition-colors disabled:opacity-60"
                    >
                      {photoDeleting ? 'Eliminando...' : 'Eliminar foto'}
                    </button>
                  )}
                </div>
                {photoError && (
                  <p className="font-body text-xs text-[#8D4034] bg-[#FAEDE7] border border-[#8D4034]/20 rounded-xl px-4 py-2.5">
                    {photoError}
                  </p>
                )}

                {photoSuccess && (
                  <p className="font-body text-xs text-[#075B85] bg-[#075B85]/10 border border-[#075B85]/20 rounded-xl px-4 py-2.5">
                    Foto de perfil actualizada correctamente.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Preferences ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-[#CBDDE3] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#CBDDE3] flex items-center gap-3">
              <span className="text-[#0878CF]"><IconBell /></span>
              <h2 className="font-heading font-bold text-[#073B52] text-base">Preferencias</h2>
            </div>
            <div className="px-6 pt-2 pb-2">
              <Toggle
                label="Notificaciones por correo"
                description="Recibe actualizaciones del itinerario en tu correo."
                checked={notifEmail}
                onChange={(val) => handleTogglePref('notificaciones_correo', val)}
              />
              <Toggle
                label="Notificaciones del grupo"
                description="Alertas cuando un miembro realiza cambios en el grupo."
                checked={notifGroup}
                onChange={(val) => handleTogglePref('notificaciones_grupo', val)}
              />
              <Toggle
                label="Finanzas"
                description="Avisos cuando registran gastos, pagos o ajustes de presupuesto."
                checked={notifFinance}
                onChange={(val) => handleTogglePref('notificaciones_finanzas', val)}
              />
              <Toggle
                label="Alertas de presupuesto"
                description="Avisos cuando el viaje llega al 80 % del presupuesto o lo excede."
                checked={notifAlerts}
                onChange={(val) => handleTogglePref('notificaciones_alertas', val)}
              />
            </div>
          </section>

          {/* ── Danger zone ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl border border-[#8D4034]/30 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#8D4034]/20 flex items-center gap-3">
              <h2 className="font-heading font-bold text-[#8D4034] text-base">Zona de peligro</h2>
            </div>
            <div className="px-6 py-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-semibold text-[#073B52]">Eliminar cuenta</p>
                <p className="font-body text-xs text-[#526C79] mt-0.5">
                  Esta acción es permanente e irreversible. Se eliminarán todos tus datos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError('') }}
                className="shrink-0 rounded-xl border border-[#8D4034] px-4 py-2 font-body text-sm font-semibold text-[#8D4034] transition hover:bg-[#FAEDE7]"
              >
                Eliminar cuenta
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* ── Delete confirmation modal ────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <h3 className="font-heading text-xl font-extrabold text-[#073B52] mb-2">
              ¿Eliminar tu cuenta?
            </h3>
            <p className="font-body text-sm text-[#526C79] mb-5">
              Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán todos tus datos, grupos y configuración. Para confirmar, escribe <strong>ELIMINAR</strong> abajo.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Escribe ELIMINAR para confirmar"
              className="w-full rounded-xl border border-[#CBDDE3] px-4 py-3 font-body text-sm outline-none focus:border-[#8D4034] focus:ring-2 focus:ring-[#8D4034]/15 mb-4"
            />
            {deleteError && (
              <p className="font-body text-xs text-[#8D4034] mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-[#CBDDE3] py-2.5 font-body text-sm font-semibold text-[#183F51] transition hover:bg-[#F4F9FA] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'ELIMINAR' || deleting}
                className="flex-1 rounded-xl bg-[#8D4034] py-2.5 font-body text-sm font-semibold text-white transition hover:bg-[#703228] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
