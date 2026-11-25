export type GroupRole = 'admin' | 'viajero'
export type GroupStatus = 'activo' | 'finalizado' | 'cerrado' | 'archivado'

export interface Group {
  id: string
  nombre: string
  descripcion?: string | null
  destino?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  maximo_miembros?: number | null
  es_publico?: boolean
  codigo_invitacion: string
  creado_por?: string | number | null
  estado: GroupStatus
  created_at?: string
  memberCount?: number
  myRole?: GroupRole
  presupuesto_total?: number | string | null
  modulo_itinerario_bloqueado?: boolean
  modulo_presupuesto_bloqueado?: boolean
}

export interface GroupHistoryItem {
  rol: GroupRole
  grupos_viaje: Group
}

export interface GroupMember {
  id: string
  usuario_id: string
  rol: GroupRole
  nombre: string
  email: string
  avatar_url?: string | null
}

export interface CreateGroupPayload {
  nombre: string
  descripcion?: string
  destino?: string
  fecha_inicio?: string
  fecha_fin?: string
  maximo_miembros?: number
  es_publico?: boolean
  presupuesto_total?: number | null
  modulo_itinerario_bloqueado?: boolean
  modulo_presupuesto_bloqueado?: boolean
}

export interface UpdateGroupPayload {
  nombre?: string
  descripcion?: string
  destino?: string
  fecha_inicio?: string
  fecha_fin?: string
  maximo_miembros?: number
  es_publico?: boolean
  modulo_itinerario_bloqueado?: boolean
  modulo_presupuesto_bloqueado?: boolean
}

export interface CreateInvitationsPayload {
  emails: string[]
}

export interface GroupInviteSettings {
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
}

export interface GroupInvitationResult {
  id?: string
  email: string
  status: 'existing_member' | 'already_invited' | 'created'
  inviteLink?: string
  codigo: string
}

export interface CreateInvitationsResponse {
  ok: boolean
  message: string
  groupId: string
  codigo: string
  invitations: GroupInvitationResult[]
}

export interface InvitePreview {
  groupId: string
  nombre: string
  descripcion?: string | null
  destino?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  estado: GroupStatus
  codigo: string
  memberCount: number
  maximo_miembros?: number | null
  canJoin: boolean
  cannotJoinReason?: 'GROUP_CAPACITY_REACHED' | string | null
  requiresApproval?: boolean
  emailInvitation?: boolean
  invitedEmail?: string | null
}

export interface GroupJoinRequest {
  id: string
  grupo_id: string
  usuario_id: string
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
  mensaje?: string | null
  created_at?: string
  updated_at?: string
  nombre?: string | null
  email?: string | null
  avatar_url?: string | null
}


export interface AdminDelegationRequest {
  id: string
  group_id: string
  from_user_id: string
  to_user_id: string
  status: 'pendiente' | 'aceptada' | 'rechazada' | 'expirada' | 'cancelada'
  expires_at: string
  created_at?: string
  updated_at?: string
  from_nombre?: string | null
  from_email?: string | null
  to_nombre?: string | null
  to_email?: string | null
}

export interface GroupInvitation {
  id: string
  email: string
  codigo_invitacion: string
  estado: 'pendiente' | 'aceptada' | 'revocada' | 'expirada'
  created_at?: string
}
