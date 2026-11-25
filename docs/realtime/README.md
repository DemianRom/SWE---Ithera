# Realtime y Socket.IO - Traveling

Traveling usa Socket.IO para el chat grupal, la presencia de integrantes, las notificaciones y el
refresco del panel del viaje cuando alguien registra un gasto, un pago o una actividad.

## Archivos principales

Backend:

| Archivo | Uso |
| --- | --- |
| `backend/src/infrastructure/sockets/socket.server.ts` | Inicializa Socket.IO, CORS y autenticacion. |
| `backend/src/infrastructure/sockets/socket.handlers.ts` | Registra eventos recibidos desde cliente (salas, presencia y chat). |
| `backend/src/infrastructure/sockets/socket.gateway.ts` | Emisores usados por servicios backend (`dashboard_updated`, `group_members_updated`, `group_deleted`). |
| `backend/src/domain/notifications/notifications.service.ts` | Crea notificaciones y emite `notification_created` y `dashboard_updated`. |

Frontend:

| Archivo | Uso |
| --- | --- |
| `frontend/src/hooks/useSocket.ts` | Crea el socket compartido, reconexion y cola offline. |
| `frontend/src/hooks/useGroupRealtimeRefresh.ts` | Escucha eventos de grupo y refresca vistas. |
| `frontend/src/hooks/useNotifications.ts` | Escucha `notification_created`. |
| `frontend/src/components/chat/ChatDrawer.tsx` | Chat grupal y presencia. |

## Autenticacion

El cliente envia el token de Supabase en `handshake.auth.token`.

El backend:

1. Valida el token con Supabase Auth.
2. Busca el usuario local en la tabla `usuarios`.
3. Inyecta en `socket.data`: `authUserId`, `localUserId`, `userName` y `avatarUrl`.

## Salas

| Sala | Uso |
| --- | --- |
| `user:<localUserId>` | Notificaciones personales. |
| `<groupId>` | Eventos del viaje (chat, presencia, panel). |

## Eventos cliente -> servidor

| Evento | Payload minimo | Descripcion |
| --- | --- | --- |
| `join_room` | `{ tripId }` | Une al usuario a la sala del viaje (valida membresia) y actualiza presencia. |
| `leave_room` | `{ tripId }` | Saca al usuario de la sala del viaje. |
| `chat_send_message` | `{ groupId, contenido, clientId? }` | Guarda el mensaje y lo emite a la sala. Acepta `ack`. |

## Eventos servidor -> cliente

| Evento | Uso |
| --- | --- |
| `room_joined` | Confirma la union a la sala. |
| `presence_update` | Lista de integrantes en linea del viaje. |
| `user_joined` / `user_left` | Un integrante entro o salio de la sala. |
| `chat_message` | Mensaje nuevo del chat grupal (tambien lo emite `POST /api/groups/:groupId/chat/messages`). |
| `dashboard_updated` | Algo cambio en el viaje (gasto, pago, presupuesto, actividad, archivo); el cliente vuelve a pedir datos. |
| `group_members_updated` | Cambiaron los integrantes o sus roles. |
| `group_deleted` | El viaje fue eliminado; el cliente sale de la vista. |
| `notification_created` | Notificacion nueva para el usuario (sala `user:<id>`). |
| `error_event` | Error de validacion o de permisos en un evento del cliente. |

Los payloads de `dashboard_updated` incluyen `groupId`, `tipo` y, cuando aplica, `entidadTipo`,
`entidadId` y `metadata`.

## Checklist al agregar un evento

1. Documentar el evento en esta guia.
2. Definir el payload minimo.
3. Validar permisos y membresia.
4. Actualizar los hooks del frontend que lo consumen.
5. Agregar prueba o verificacion manual (el smoke test cubre chat y notificaciones).
6. Actualizar [../api/endpoints.md](../api/endpoints.md) si el evento complementa un endpoint.
