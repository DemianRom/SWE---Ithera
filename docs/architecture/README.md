# Arquitectura - Traveling

Esta guia resume la organizacion tecnica actual del proyecto. Para pasos de instalacion y scripts, consulta tambien [../../README.md](../../README.md), [../../backend/README.md](../../backend/README.md) y [../../frontend/README.md](../../frontend/README.md).

## Vista general

```text
Navegador
  -> Caddy (TLS, traveling.tonyquezada.com)
       /api, /socket.io, /health -> traveling-api (Express + Socket.IO, puerto 3001)
       todo lo demas            -> traveling-web (nginx con el build de Vite)

Frontend React/Vite
  -> services/apiClient
  -> Backend Express /api
  -> Domain services
  -> Supabase (Postgres, Storage) con la llave secreta

Frontend -> Supabase Auth (llave publicable): registro, login, OTP y Google

Socket.IO
  -> Backend HTTP server
  -> socket handlers / gateway
  -> Hooks frontend de realtime
```

Frontend -> Google Maps Platform (llave de navegador, opcional): sugerencias de Google Places al
ubicar una actividad y mapa del itinerario. El backend no llama a Google; solo guarda el Place ID.
Detalle en [../maps/README.md](../maps/README.md). Hosting y despliegue:
[../deploy/README.md](../deploy/README.md).

## Principios de organizacion

- El backend separa rutas, dominio e infraestructura.
- El frontend separa paginas, componentes, servicios, hooks, contextos y tipos.
- La documentacion funcional de endpoints vive en `docs/api`.
- Las reglas de colaboracion viven en `CONTRIBUTING.md`.
- Los workflows se explican en `docs/workflows`.

## Backend

La entrada principal es `backend/src/index.ts`.

Capas:

| Capa | Ubicacion | Responsabilidad |
| --- | --- | --- |
| Configuracion | `backend/src/config` | Leer ambiente y preparar configuracion base. |
| Rutas | `backend/src/routes` | Definir endpoints Express y delegar. |
| Middlewares | `backend/src/middlewares` | Auth, errores y protecciones transversales. |
| Dominio | `backend/src/domain` | Reglas de negocio por modulo. |
| Infraestructura | `backend/src/infrastructure` | Cliente de Supabase, sockets y plantillas de correo. |
| Servicios compartidos | `backend/src/services` | Envio de correo por SMTP (`email.service.ts`). |

Regla de dependencia recomendada:

```text
routes -> middlewares -> domain -> infrastructure
```

Evitar que `routes` contenga logica de negocio compleja o que `domain` dependa de detalles visuales del frontend.

## Frontend

La entrada principal es `frontend/src/main.tsx` y las rutas viven en `frontend/src/App.tsx`.

Capas:

| Capa | Ubicacion | Responsabilidad |
| --- | --- | --- |
| Pages | `frontend/src/pages` | Vistas completas asociadas a rutas. |
| Components | `frontend/src/components` | Piezas reutilizables de UI y flujo. |
| UI primitives | `frontend/src/components/ui` | Componentes genericos de bajo nivel. |
| Services | `frontend/src/services` | Consumo de API por modulo. |
| Hooks | `frontend/src/hooks` | Reutilizacion de estado, sockets, red y sincronizacion. |
| Context | `frontend/src/context` | Estado global de auth y del viaje actual. |
| Types | `frontend/src/types` | Tipos compartidos. |
| Lib | `frontend/src/lib` | Cliente de Supabase y proveedores OAuth habilitados. |

Regla recomendada:

```text
pages -> components/hooks/services -> types/lib
```

Las paginas pueden orquestar datos y estado. Los componentes reutilizables deben recibir props claras y evitar acoplarse a rutas cuando no sea necesario.

## Modulos actuales

| Modulo | Backend | Frontend |
| --- | --- | --- |
| Cuentas | `domain/auth`, `routes/auth.router.ts` | `pages/Login`, `pages/Register`, `pages/OTP`, `pages/ForgotPassword`, `pages/ResetPassword`, `pages/Profile`, `components/auth` |
| Viajes e integrantes | `domain/groups`, `routes/trips.router.ts` | `pages/MyTrips`, `pages/CreateGroup`, `pages/JoinGroup`, `pages/GroupPanel`, `pages/GroupSettings`, `components/InviteModal`, `components/GroupConfigModal` |
| Itinerario basico | `domain/itinerary`, `routes/itinerary.router.ts` | Pestana Itinerario de `pages/Itinerary/DashboardPage.tsx`, `components/ui/DayView`, `components/ActivityFormModal` |
| Lugares y mapa (Google) | `place_id` en `actividades` | `lib/googleMaps.ts`, `components/ui/PlaceAutocompleteInput`, `components/ui/TripMap` |
| Enlace publico | `routes/export.router.ts` | `pages/Shared` |
| Gastos, saldos y pagos | `domain/budget`, `routes/budget.router.ts` | Pestana Finanzas: `components/budget` (`BudgetDashboard`, `RegisterExpenseModal`, `MyWalletView`) |
| Presupuesto y resumenes | `domain/budget` (`getBudgetSummary`, CSV, `pdf.service.ts`) | `CategoryBudgetPanel`, `BudgetSummaryPanel` |
| Comprobantes | `domain/documents`, `domain/context-links` | Pestana Archivos: `components/documents/DocumentVaultPanel` |
| Chat | `routes/chat.router.ts`, `infrastructure/sockets` | `components/chat/ChatDrawer` |
| Notificaciones | `domain/notifications`, `routes/notifications.router.ts` | `hooks/useNotifications.ts`, `components/layout/Navbar` |
| Tiempo real | `infrastructure/sockets` | `hooks/useSocket.ts`, `hooks/useGroupRealtimeRefresh.ts` |

La pantalla principal de un viaje es `DashboardPage`, con tres pestanas: Finanzas (por defecto),
Itinerario y Archivos. Los gastos no requieren actividades; una actividad puede mostrar lo
"gastado aqui" cuando un gasto la referencia.

## Reglas para cambios estructurales

- Si se agrega un modulo backend, crear `domain`, `route` y documentar endpoint.
- Si se agrega una pagina frontend, registrarla en `App.tsx` y ubicarla en `pages/<Nombre>`.
- Si se agrega un servicio externo, documentar variable de entorno y adaptador en `infrastructure`.
- Si se cambia el esquema, crear una migracion en `supabase/migrations` (ver [../database/README.md](../database/README.md)).
- Si se agrega un evento Socket.IO, documentar que lo emite y que hook lo consume.
- Si se cambia un workflow, actualizar `docs/workflows/README.md`.
