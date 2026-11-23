import { getIO } from './socket.server';

// ── Event Constants ──────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  DASHBOARD_UPDATED: 'dashboard_updated',
  GROUP_MEMBERS_UPDATED: 'group_members_updated',
  GROUP_DELETED: 'group_deleted',
} as const;

// ── Payloads ─────────────────────────────────────────────────────────────

export interface DashboardUpdatedPayload {
  groupId: number;
  tipo: string;
  entidadTipo?: string | null;
  entidadId?: string | number | null;
  metadata?: Record<string, unknown>;
}

export interface GroupDeletedPayload {
  groupId: number;
  actorUsuarioId?: number | null;
  reason?: string;
}

// ── Emitters ─────────────────────────────────────────────────────────────

export const emitDashboardUpdated = (payload: DashboardUpdatedPayload): void => {
  try {
    const io = getIO();
    const roomId = String(payload.groupId);
    io.to(roomId).emit(SOCKET_EVENTS.DASHBOARD_UPDATED, {
      ...payload,
      grupoId: payload.groupId,
      createdAt: new Date().toISOString(),
    });

    if (process.env['NODE_ENV'] !== 'test') {
      console.log(`[socket-gateway] ${SOCKET_EVENTS.DASHBOARD_UPDATED} → room ${roomId}`);
    }
  } catch {
    if (process.env['NODE_ENV'] !== 'test') {
      console.log('[socket-gateway] DASHBOARD_UPDATED (fallback log)', JSON.stringify(payload));
    }
  }
};

export const emitGroupDeleted = (payload: GroupDeletedPayload): void => {
  try {
    const io = getIO();
    const roomId = String(payload.groupId);
    const eventPayload = {
      groupId: payload.groupId,
      grupoId: payload.groupId,
      tipo: 'grupo_eliminado',
      entidadTipo: 'grupo',
      entidadId: payload.groupId,
      actorUsuarioId: payload.actorUsuarioId ?? null,
      reason: payload.reason ?? 'deleted',
      createdAt: new Date().toISOString(),
    };
    io.to(roomId).emit(SOCKET_EVENTS.GROUP_DELETED, eventPayload);
    io.to(roomId).emit(SOCKET_EVENTS.DASHBOARD_UPDATED, eventPayload);

    if (process.env['NODE_ENV'] !== 'test') {
      console.log(`[socket-gateway] ${SOCKET_EVENTS.GROUP_DELETED} → room ${roomId}`);
    }
  } catch {
    if (process.env['NODE_ENV'] !== 'test') {
      console.log('[socket-gateway] GROUP_DELETED (fallback log)', JSON.stringify(payload));
    }
  }
};
