import { Server as SocketIOServer, Socket } from 'socket.io';
import { supabase } from '../db/supabase.client';
import { SocketUserData } from './socket.server';
import * as ChatService from '../../domain/groups/chat.service';

// ── Tipos de eventos ─────────────────────────────────────────────────────

interface JoinRoomPayload {
  tripId: string;
}

interface LeaveRoomPayload {
  tripId: string;
}

interface ChatSendMessagePayload {
  groupId?: string;
  tripId?: string;
  contenido?: string;
  text?: string;
  clientId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const getUserData = (socket: Socket): SocketUserData => {
  return socket.data as SocketUserData;
};

/**
 * Valida que el usuario pertenezca al grupo/viaje indicado.
 */
const validateMembership = async (userId: string, tripId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('grupo_miembros')
    .select('id')
    .eq('grupo_id', tripId)
    .eq('usuario_id', userId)
    .maybeSingle();

  return !error && !!data;
};

type SocketErrorCode =
  | 'ERR-51-001'
  | 'ERR-51-002'
  | 'ERR-53-001'
  | 'ERR-54-001'
  | 'ERR-58-001'
  | 'ERR-59-001'
  | 'ERR-211-002';

const emitStandardError = (
  socket: Socket,
  code: SocketErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
): void => {
  socket.emit('error_event', {
    ok: false,
    code,
    message,
    severity: code === 'ERR-59-001' ? 'baja' : 'media',
    createdAt: new Date().toISOString(),
    ...extra,
  });
};


// ── Presence en memoria ─────────────────────────────────────────────────
// roomPresence: tripId -> userId -> sockets activos del usuario en esa room
const roomPresence = new Map<string, Map<string, Set<string>>>();
const socketRooms = new Map<string, Set<string>>();

const getOnlineUserIds = (tripId: string): string[] => {
  return Array.from(roomPresence.get(tripId)?.keys() ?? []);
};

const emitPresenceUpdate = (io: SocketIOServer, tripId: string): void => {
  io.to(tripId).emit('presence_update', {
    tripId,
    onlineUserIds: getOnlineUserIds(tripId),
  });
};

const addPresence = (socket: Socket, tripId: string, userId: string): void => {
  const users = roomPresence.get(tripId) ?? new Map<string, Set<string>>();
  const sockets = users.get(userId) ?? new Set<string>();
  sockets.add(socket.id);
  users.set(userId, sockets);
  roomPresence.set(tripId, users);

  const rooms = socketRooms.get(socket.id) ?? new Set<string>();
  rooms.add(tripId);
  socketRooms.set(socket.id, rooms);
};

const removePresence = (socket: Socket, tripId: string, userId: string): void => {
  const users = roomPresence.get(tripId);
  const sockets = users?.get(userId);

  sockets?.delete(socket.id);
  if (sockets && sockets.size === 0) {
    users?.delete(userId);
  }
  if (users && users.size === 0) {
    roomPresence.delete(tripId);
  }

  const rooms = socketRooms.get(socket.id);
  rooms?.delete(tripId);
  if (rooms && rooms.size === 0) {
    socketRooms.delete(socket.id);
  }
};

const removeSocketFromAllPresenceRooms = (socket: Socket, userId: string): string[] => {
  const rooms = Array.from(socketRooms.get(socket.id) ?? []);

  for (const tripId of rooms) {
    removePresence(socket, tripId, userId);
  }

  return rooms;
};

// ── Handler Registration ─────────────────────────────────────────────────

export const registerSocketHandlers = (io: SocketIOServer, socket: Socket): void => {
  const user = getUserData(socket);

  // Unir al usuario a su cuarto personal para recibir notificaciones.
  // Además, lo unimos de forma silenciosa a todos sus grupos para que
  // dashboard_updated llegue aunque el chat no esté abierto.
  socket.join(`user:${user.localUserId}`);
  console.log(`[socket.io] ${user.userName} unido a cuarto personal user:${user.localUserId}`);

  void (async () => {
    try {
      const { data, error } = await supabase
        .from('grupo_miembros')
        .select('grupo_id')
        .eq('usuario_id', user.localUserId);

      if (error) {
        console.warn('[socket.io] No se pudieron cargar grupos del usuario:', error.message);
        return;
      }

      const groupIds = Array.from(
        new Set((data ?? []).map((row) => String(row.grupo_id)).filter(Boolean))
      );

      for (const groupId of groupIds) {
        socket.join(groupId);
        addPresence(socket, groupId, user.localUserId);
      }

      if (groupIds.length > 0) {
        groupIds.forEach((groupId) => emitPresenceUpdate(io, groupId));
        console.log(`[socket.io] ${user.userName} unido a rooms de grupo: ${groupIds.join(', ')}`);
      }

    } catch (err) {
      console.warn('[socket.io] Error al unir usuario a sus rooms de grupo:', err);
    }
  })();

  // ── join_room ────────────────────────────────────────────────────────
  socket.on('join_room', async (payload: JoinRoomPayload) => {
    try {
      const { tripId } = payload;

      if (!tripId) {
        emitStandardError(socket, 'ERR-51-002', 'No fue posible conectarte al viaje. Intenta recargar la página.');
        return;
      }

      // Validar membresía al grupo
      const isMember = await validateMembership(user.localUserId, tripId);
      if (!isMember) {
        emitStandardError(socket, 'ERR-51-002', 'No fue posible conectarte al viaje. Intenta recargar la página.');
        return;
      }

      socket.join(tripId);
      addPresence(socket, tripId, user.localUserId);
      console.log(`[socket.io] ${user.userName} se unió a room: ${tripId}`);

      // Notificar al usuario que se unió exitosamente
      socket.emit('room_joined', { tripId });

      // Actualizar presencia para todos los clientes de la room
      emitPresenceUpdate(io, tripId);

      // Notificar a los demás que un usuario se conectó
      socket.to(tripId).emit('user_joined', {
        userId: user.localUserId,
        userName: user.userName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al unirse a la room';
      console.error(`[socket.io] Error en join_room:`, message);
      emitStandardError(socket, 'ERR-58-001', message);
    }
  });

  // ── leave_room ───────────────────────────────────────────────────────
  socket.on('leave_room', async (payload: LeaveRoomPayload) => {
    try {
      const { tripId } = payload;
      if (!tripId) return;

      removePresence(socket, tripId, user.localUserId);
      // No se ejecuta socket.leave(tripId) porque el mismo socket puede tener
      // otros consumidores activos (dashboard, panel derecho, chat) dentro del
      // mismo viaje. Solo retiramos presencia visual de este consumidor.
      console.log(`[socket.io] ${user.userName} salió de presencia de room: ${tripId}`);

      // Actualizar presencia para los clientes que quedan en la room
      emitPresenceUpdate(io, tripId);

      socket.to(tripId).emit('user_left', {
        userId: user.localUserId,
        userName: user.userName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al salir de la room';
      console.error(`[socket.io] Error en leave_room:`, message);
    }
  });



  // -- chat_send_message ------------------------------------------------
  socket.on('chat_send_message', async (payload: ChatSendMessagePayload, ack?: (response: unknown) => void) => {
    try {
      const groupId = payload?.groupId ?? payload?.tripId;
      const contenido = payload?.contenido ?? payload?.text;

      if (!groupId || typeof contenido !== 'string') {
        const response = { ok: false, error: 'groupId y contenido son requeridos' };
        socket.emit('error_event', { message: response.error });
        ack?.(response);
        return;
      }

      const message = await ChatService.createGroupMessageByLocalUser(
        user.localUserId,
        groupId,
        contenido,
        {
          nombre: user.userName,
          email: null,
          avatar_url: user.avatarUrl ?? null,
        }
      );

      io.to(groupId).emit('chat_message', {
        ...message,
        clientId: payload.clientId ?? null,
      });

      ack?.({ ok: true, message });
      console.log(`[socket.io] Mensaje de chat enviado por ${user.userName} en room ${groupId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar mensaje';
      console.error('[socket.io] Error en chat_send_message:', message);
      emitStandardError(socket, 'ERR-58-001', message);
      ack?.({ ok: false, error: message });
    }
  });

  // ── disconnect ───────────────────────────────────────────────────────
  socket.on('disconnect', async (reason) => {
    try {
      console.log(`[socket.io] Desconectado: ${user.userName} (${user.localUserId}) — razón: ${reason}`);

      // Quitar presencia del socket desconectado y notificar rooms afectadas
      const affectedPresenceRooms = removeSocketFromAllPresenceRooms(socket, user.localUserId);
      for (const tripId of affectedPresenceRooms) {
        emitPresenceUpdate(io, tripId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en disconnect handler';
      console.error(`[socket.io] Error en disconnect:`, message);
    }
  });
};
