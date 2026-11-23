export type GroupStatus = 'activo' | 'finalizado' | 'cerrado' | 'archivado';
export type MemberRole = 'admin' | 'viajero';
export type InvitationStatus = 'pendiente' | 'aceptada' | 'revocada' | 'expirada';
export type JoinRequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface GrupoViaje {
  id: string;
  nombre: string;
  descripcion?: string | null;
  destino?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  maximo_miembros?: number | null;
  es_publico?: boolean;
  codigo_invitacion: string;
  creado_por: string;
  estado: GroupStatus;
  created_at?: string;
  modulo_itinerario_bloqueado?: boolean;
  modulo_presupuesto_bloqueado?: boolean;
}

export interface GrupoMiembro {
  id: string;
  grupo_id: string;
  usuario_id: string;
  rol: MemberRole | string;
}

export interface CreateGroupPayload {
  nombre: string;
  descripcion?: string;
  destino?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  maximo_miembros?: number;
  es_publico?: boolean;
  presupuesto_total: number;
  modulo_itinerario_bloqueado?: boolean;
  modulo_presupuesto_bloqueado?: boolean;
}

export interface UpdateGroupPayload {
  nombre?: string;
  descripcion?: string;
  destino?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  maximo_miembros?: number;
  es_publico?: boolean;
  modulo_itinerario_bloqueado?: boolean;
  modulo_presupuesto_bloqueado?: boolean;
}

export interface JoinGroupPayload {
  codigo: string;
  invitationToken?: string;
}

export interface CreateGroupInvitationsPayload {
  emails: string[];
}

export interface GroupInvitation {
  id: string;
  grupo_id: string;
  email: string;
  codigo_invitacion: string;
  token: string;
  estado: InvitationStatus;
  created_at?: string;
  updated_at?: string;
}

export interface GroupInvitePreview {
  groupId: string;
  nombre: string;
  descripcion?: string | null;
  destino?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado: GroupStatus;
  codigo: string;
  memberCount: number;
  maximo_miembros?: number | null;
  es_publico: boolean;
  canJoin: boolean;
  cannotJoinReason?: 'GROUP_CAPACITY_REACHED' | string | null;
  requiresApproval?: boolean;
  emailInvitation?: boolean;
  invitedEmail?: string | null;
}

export interface GroupJoinRequest {
  id: string;
  grupo_id: string;
  usuario_id: string;
  estado: JoinRequestStatus;
  mensaje?: string | null;
  created_at?: string;
  updated_at?: string;
  nombre?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}
