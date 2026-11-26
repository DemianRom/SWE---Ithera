# Traveling - Endpoints REST API

Este documento registra los endpoints expuestos por el backend actual. Debe actualizarse en el mismo PR donde se agregue, cambie o elimine un endpoint.

## Convenciones

| Elemento | Valor |
| --- | --- |
| Backend local | `http://localhost:3001` |
| Base API local | `http://localhost:3001/api` |
| Healthcheck | `GET http://localhost:3001/health` |
| Formato principal | JSON |
| Auth protegida | `Authorization: Bearer <token>` |
| Uploads | `multipart/form-data` cuando el endpoint recibe archivos |

Codigos comunes:

| Codigo | Uso |
| --- | --- |
| `200 OK` | Operacion exitosa. |
| `201 Created` | Recurso creado. |
| `400 Bad Request` | Payload, parametros o query invalidos. |
| `401 Unauthorized` | Token ausente o invalido. |
| `403 Forbidden` | Usuario sin permisos suficientes. |
| `404 Not Found` | Recurso inexistente. |
| `409 Conflict` | Conflicto de negocio, por ejemplo correo ya registrado o viaje cerrado. |
| `423 Locked` | El presupuesto del viaje esta bloqueado. |
| `429 Too Many Requests` | Rate limit o bloqueo temporal. |
| `500 Internal Server Error` | Error no controlado. |

## Bases montadas

| Base path | Router | Archivo |
| --- | --- | --- |
| `/api/auth` | Auth | `backend/src/routes/auth.router.ts` |
| `/api/groups` | Grupos/viajes | `backend/src/routes/trips.router.ts` |
| `/api/groups/:groupId/itinerary` | Itinerario | `backend/src/routes/itinerary.router.ts` |
| `/api/groups/:groupId/chat` | Chat grupal | `backend/src/routes/chat.router.ts` |
| `/api/groups/:groupId/context-links` | Enlaces contextuales | `backend/src/routes/context-links.router.ts` |
| `/api/groups/:groupId/documents` | Documentos por grupo | `backend/src/routes/documents.router.ts` |
| `/api/groups/:groupId/vault` | Alias de boveda documental | `backend/src/routes/documents.router.ts` |
| `/api/export` | Enlaces compartibles de itinerario | `backend/src/routes/export.router.ts` |
| `/api/budget` | Presupuesto, gastos, saldos y pagos | `backend/src/routes/budget.router.ts` |
| `/api/notifications` | Notificaciones | `backend/src/routes/notifications.router.ts` |
| `/api/documents` | Alias directo de documentos | `backend/src/routes/documents.router.ts` |

## Auth

Base: `/api/auth`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/email-availability?email=:email` | No | Verifica si un correo esta disponible. |
| `POST` | `/register` | No | Registra usuario con correo, password y nombre completo. |
| `POST` | `/login` | No | Inicia sesion y devuelve sesion/usuario de Supabase. |
| `POST` | `/forgot-password` | No | Solicita correo de recuperacion de contrasena. |
| `POST` | `/sync-user` | Si | Sincroniza usuario autenticado de Supabase con tabla local. |
| `GET` | `/me` | Si | Obtiene perfil local del usuario autenticado. |
| `PATCH` | `/me` | Si | Actualiza nombre del perfil. |
| `PATCH` | `/me/avatar` | Si | Actualiza avatar. Recibe `multipart/form-data` con campo `avatar`. |
| `DELETE` | `/me/avatar` | Si | Elimina avatar del perfil. |
| `DELETE` | `/me` | Si | Elimina cuenta del usuario autenticado. |

## Grupos y viajes

Base: `/api/groups`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/` | Si | Crea un grupo/viaje. |
| `POST` | `/join` | Si | Solicita unirse o se une a un grupo mediante codigo. |
| `GET` | `/my-history` | Si | Lista historial de viajes del usuario. |
| `GET` | `/invite-preview/:code` | No | Obtiene vista previa publica de una invitacion. |
| `GET` | `/:groupId` | Si | Obtiene detalle del grupo. |
| `PATCH` | `/:groupId` | Si | Actualiza datos del grupo. |
| `PATCH` | `/:groupId/close` | Si | Cierra el viaje (solo admin). Un viaje cerrado no acepta gastos, pagos ni cambios de presupuesto. |
| `DELETE` | `/:groupId` | Si | Elimina grupo. |
| `GET` | `/:groupId/invite` | Si | Obtiene informacion de invitacion. |
| `GET` | `/:groupId/invitations` | Si | Lista invitaciones generadas. |
| `POST` | `/:groupId/invitations` | Si | Crea invitaciones por correo. |
| `GET` | `/:groupId/join-requests` | Si | Lista solicitudes de union pendientes. |
| `PATCH` | `/:groupId/join-requests/:requestId` | Si | Aprueba o rechaza una solicitud. Body: `action=approve|reject`. |
| `GET` | `/:groupId/qr` | Si | Genera QR de invitacion. |
| `GET` | `/:groupId/members` | Si | Lista integrantes del grupo. |
| `PATCH` | `/members/:memberId/role` | Si | Actualiza rol de integrante. |
| `DELETE` | `/:groupId/members/:memberId` | Si | Elimina integrante del grupo. |
| `GET` | `/:groupId/admin-delegations` | Si | Lista solicitudes para delegar el rol de admin. |
| `PATCH` | `/:groupId/admin-delegations/:requestId` | Si | Acepta o rechaza una delegacion. Body: `action=accept|reject`. |

## Itinerario

Base: `/api/groups/:groupId/itinerary`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/` | Si | Obtiene el itinerario del viaje con sus actividades. |
| `POST` | `/activities` | Si | Crea actividad: `titulo`, `fecha_inicio`, `fecha_fin?`, `descripcion?`, `ubicacion?` (texto visible) y `place_id?` (Place ID de Google Places; se ignora sin `ubicacion`). |
| `PATCH` | `/activities/:activityId` | Si | Actualiza actividad. Si cambia `ubicacion` sin mandar `place_id`, el lugar ligado se suelta; `place_id: null` lo quita conservando el texto. |
| `DELETE` | `/activities/:activityId` | Si | Elimina actividad grupal. |

## Chat

Base: `/api/groups/:groupId/chat`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/messages?limit=:limit` | Si | Lista mensajes del chat grupal. |
| `POST` | `/messages` | Si | Crea mensaje grupal y emite evento Socket.IO `chat_message`. |

## Enlaces contextuales

Base: `/api/groups/:groupId/context-links`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/` | Si | Lista relaciones contextuales. Acepta `entity_type` y `entity_id`. |
| `GET` | `/options` | Si | Lista opciones relacionables del grupo. |
| `POST` | `/` | Si | Crea relacion contextual. |
| `DELETE` | `/:linkId` | Si | Elimina relacion contextual. |

## Documentos

Bases preferidas:

- `/api/groups/:groupId/documents`
- `/api/groups/:groupId/vault`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/` | Si | Lista documentos del grupo. |
| `POST` | `/` | Si | Sube documento. Recibe `multipart/form-data` con campo `file`. |
| `DELETE` | `/:docId` | Si | Elimina documento. |

Alias directo:

Base: `/api/documents`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/:tripId` | Si | Lista documentos por `tripId`. |
| `POST` | `/:tripId` | Si | Sube documento por `tripId`. |
| `DELETE` | `/:tripId/:docId` | Si | Elimina documento por `tripId`. |

## Export y enlace compartible

Base: `/api/export`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/share-link/:groupId` | Si | Genera URL compartible publica para el itinerario del grupo. |
| `GET` | `/shared/:token` | No | Obtiene el itinerario publico (solo lectura, sin gastos) usando el token firmado. |

## Presupuesto y gastos

Base: `/api/budget/:groupId` (cualquier integrante puede consultar; los cambios de presupuesto
son solo del admin; editar o borrar un gasto, quien lo registró o el admin).

Con el viaje cerrado (`estado` cerrado/archivado/finalizado) los gastos y el presupuesto
responden **409**; con `modulo_presupuesto_bloqueado` responden **423**. Las liquidaciones
(pagos entre integrantes) siguen permitidas para poder cerrar cuentas.

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/:groupId` (alias `/:groupId/dashboard`) | Si | Tablero: resumen, integrantes, gastos, saldos, liquidaciones y pagos. `summary.totalBudget` es `null` si no hay presupuesto; `summary.categoryBudgets` trae lo planeado por categoria. |
| `PATCH` | `/:groupId` | Si (admin) | Presupuesto total: `{ totalBudget: number \| null }`; `null` o `0` lo quita. |
| `PUT` | `/:groupId/categories` | Si (admin) | Presupuesto por categoria: `{ categories: { comida: 800, otro: null } }`; `null` o `0` quita el limite. |
| `POST` | `/:groupId/expenses` | Si | Registra gasto. Fecha permitida: hasta 12 meses antes del viaje y 30 dias despues. Avisa a los involucrados y, si cruza el 80 % o 100 % del presupuesto, a todo el viaje. |
| `PUT` | `/:groupId/expenses/:expenseId` | Si | Actualiza gasto (mismo payload que al registrar). Si el reparto es invalido no cambia nada. |
| `DELETE` | `/:groupId/expenses/:expenseId` | Si | Elimina gasto. |
| `GET` | `/:groupId/balances` | Si | Saldos por integrante. |
| `GET` | `/:groupId/settlements` | Si | Liquidaciones minimas. |
| `POST` | `/:groupId/settlements/payments` | Si | Registra pago (queda `pendiente_validacion`) y avisa al acreedor. Transferencia requiere `proof_document_id`. |
| `PATCH` | `/:groupId/settlements/payments/:paymentId/review` | Si (acreedor) | `{ status: 'confirmado' \| 'rechazado', rejection_reason? }`; avisa al deudor. |
| `PATCH` | `/:groupId/settlements/payments/:paymentId` | Si | Edita un pago pendiente propio. |
| `DELETE` | `/:groupId/settlements/payments/:paymentId` | Si | Borra un pago pendiente propio. |
| `POST` | `/:groupId/settlements/receipt-pdf` | Si | Recibo de cobro en PDF. |
| `GET` | `/:groupId/summary` | Si | Resumen: totales, por categoria (planeado/gastado), por integrante (pago, le toca, saldo) y por dia. |
| `GET` | `/:groupId/export.csv` | Si | Gastos en CSV (UTF-8 con BOM para Excel). |
| `GET` | `/:groupId/summary.pdf` | Si | Resumen de gastos en PDF de una pagina. |

Reparto del gasto (`split_type`):

| Valor | Campo | Regla |
| --- | --- | --- |
| `equitativa` | `member_ids` | Partes iguales entre los integrantes (todos si se omite). |
| `porcentual` | `split_percentages: { usuarioId: porcentaje }` | Mayores que 0, maximo 100, hasta dos decimales y suman 100. El monto se reparte en centavos y los sobrantes van a las fracciones mayores, asi la suma es exacta. La respuesta trae `splitPercentages`. |
| `personalizada` | `split_amounts: { usuarioId: monto }` | Montos exactos que suman el total. |

## Notificaciones

Base: `/api/notifications`

| Metodo | Endpoint | Auth | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/` | Si | Lista notificaciones del usuario. |
| `GET` | `/unread-count` | Si | Obtiene numero de no leidas. |
| `PATCH` | `/:id/read` | Si | Marca notificacion como leida. |
| `PATCH` | `/read-all` | Si | Marca todas como leidas. |
| `GET` | `/preferences` | Si | Obtiene preferencias de notificacion. |
| `PATCH` | `/preferences` | Si | Actualiza preferencias de notificacion. |

## Socket.IO

Socket.IO corre sobre el mismo servidor HTTP del backend.

Los eventos, salas y payloads se documentan en [../realtime/README.md](../realtime/README.md).
Los mas usados junto con la API REST:

| Evento | Direccion | Descripcion |
| --- | --- | --- |
| `chat_message` | servidor a sala | Mensaje nuevo en chat grupal. |
| `dashboard_updated` | servidor a sala | Cambio en gastos, pagos, presupuesto, itinerario o archivos. |
| `notification_created` | servidor a usuario | Notificacion nueva. |

Cuando se agregue o cambie un evento realtime, documentar:

- Nombre del evento.
- Payload.
- Quien lo emite.
- Quien lo consume en frontend.
- Flujo donde se usa.

## Reglas de mantenimiento

- Todo endpoint nuevo debe agregarse aqui antes de mergear.
- Si cambia un path, metodo HTTP, payload o respuesta, actualizar esta tabla.
- Si se elimina un endpoint, quitarlo o marcarlo como deprecado con fecha.
- Si se agrega un modulo nuevo, agregar su base path en "Bases montadas".
- Si el endpoint requiere archivo, indicar campo `multipart/form-data`.
