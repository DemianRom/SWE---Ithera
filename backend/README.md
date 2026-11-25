# Backend - Traveling

API de Traveling construida con Node.js, TypeScript, Express, Supabase y Socket.IO. Expone la API
REST de cuentas, viajes, itinerario, gastos, saldos, presupuesto y comprobantes, y mantiene la
sincronizacion en tiempo real del chat, las notificaciones y el panel del viaje.

## Responsabilidades

- Exponer endpoints REST bajo `/api` y el healthcheck en `/health`.
- Validar autenticacion (tokens de Supabase) y permisos por viaje.
- Orquestar la logica de negocio por dominio: repartos, saldos, liquidaciones y presupuesto.
- Leer y escribir en Supabase con la llave secreta (las tablas no son accesibles desde el navegador).
- Generar el resumen del viaje en PDF y CSV, y recibos de pago en PDF.
- Enviar correos de invitacion por SMTP.
- Publicar eventos en tiempo real con Socket.IO.

## Stack

| Area | Tecnologia |
| --- | --- |
| Runtime | Node.js 24 |
| Lenguaje | TypeScript |
| HTTP API | Express |
| Base de datos, auth y archivos | Supabase (Postgres, Auth, Storage) |
| Tiempo real | Socket.IO |
| Correo | Nodemailer (SMTP) |
| PDF | Generador propio sin dependencias (`domain/budget/pdf.service.ts`) |
| Testing | Jest, ts-jest y smoke test (`scripts/smoke.mjs`) |
| Desarrollo | ts-node-dev |

## Estructura

```text
backend/
|-- src/
|   |-- index.ts                  # Express, CORS, routers, Socket.IO y arranque
|   |-- config/env.ts             # Variables de entorno requeridas
|   |-- domain/
|   |   |-- auth/                 # Usuarios, perfil, avatar y borrado de cuenta
|   |   |-- budget/               # Gastos, repartos, saldos, pagos, presupuesto, resumen, CSV y PDF
|   |   |-- context-links/        # Enlaces entre gastos, actividades y comprobantes
|   |   |-- documents/            # Comprobantes del viaje (bucket privado)
|   |   |-- groups/               # Viajes, integrantes, roles, invitaciones y chat
|   |   |-- itinerary/            # Itinerario basico y actividades
|   |   `-- notifications/        # Notificaciones, preferencias y alertas
|   |-- infrastructure/
|   |   |-- db/supabase.client.ts # Clientes de Supabase (publicable y secreto)
|   |   |-- email/templates/      # Plantilla HTML de correos
|   |   `-- sockets/              # Servidor, handlers y gateway de Socket.IO
|   |-- middlewares/              # requireAuth, manejo de errores, rate limit (sin montar)
|   |-- routes/                   # Routers Express
|   `-- services/email.service.ts # Envio de correo por SMTP
|-- scripts/smoke.mjs             # Smoke test de punta a punta
|-- tests/                        # Pruebas Jest y auxiliares
`-- Dockerfile                    # Imagen de produccion
```

## Flujo de una peticion

```text
Cliente frontend
  -> Express route en src/routes
  -> requireAuth (si aplica)
  -> Servicio de dominio en src/domain/<modulo>
  -> Cliente Supabase (llave secreta)
  -> Respuesta JSON, archivo (CSV/PDF) o evento Socket.IO
```

Regla practica: las rutas deben ser delgadas. La logica de negocio vive en `src/domain/<modulo>` y
las dependencias externas en `src/infrastructure`.

## Endpoints base

| Base | Modulo |
| --- | --- |
| `/health` | Healthcheck |
| `/api/auth` | Cuentas y perfil |
| `/api/groups` | Viajes, integrantes, invitaciones |
| `/api/groups/:groupId/itinerary` | Itinerario |
| `/api/groups/:groupId/chat` | Chat grupal |
| `/api/groups/:groupId/context-links` | Enlaces contextuales |
| `/api/groups/:groupId/documents` (alias `/vault`) | Comprobantes |
| `/api/budget` | Gastos, saldos, pagos, presupuesto y resumenes |
| `/api/notifications` | Notificaciones |
| `/api/export` | Enlace publico del itinerario |

Detalle completo en [../docs/api/endpoints.md](../docs/api/endpoints.md).

## Variables de entorno

Plantilla: `.env.example`. Las requeridas son `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SECRET_KEY`; en produccion tambien `SHARE_LINK_SECRET`. Las `SMTP_*` y `MAIL_FROM` son
necesarias para enviar invitaciones por correo. Tabla completa en
[../docs/env/README.md](../docs/env/README.md).

## Instalacion y ejecucion

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Servidor local: `http://localhost:3001` (`/health` y `/api`). Para una base local con la Supabase
CLI, ver [../docs/database/README.md](../docs/database/README.md).

## Scripts

| Script | Uso |
| --- | --- |
| `npm run dev` | Desarrollo con recarga. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta `dist/index.js`. |
| `npm test` | Pruebas Jest. |
| `npm run smoke` | Smoke test contra un backend en ejecucion (`SMOKE_API_URL`, `SUPABASE_*`). |

## Convenciones para agregar un modulo

1. Crear carpeta en `src/domain/<modulo>` con `<modulo>.entity.ts` y `<modulo>.service.ts`.
2. Crear router en `src/routes/<modulo>.router.ts` y registrarlo en `src/index.ts`.
3. Validar membresia y rol en el servicio, y respetar viaje cerrado y presupuesto bloqueado.
4. Si cambia el esquema, agregar una migracion en `../supabase/migrations`.
5. Si emite eventos en tiempo real, usar `src/infrastructure/sockets/socket.gateway.ts`.
6. Documentar endpoints nuevos en [../docs/api/endpoints.md](../docs/api/endpoints.md).
7. Agregar pruebas cuando el cambio tenga reglas de negocio o riesgo de regresion.

## Socket.IO

Se inicializa en `src/index.ts` con `initSocketServer(httpServer)` y comparte puerto con la API.
Eventos y salas: [../docs/realtime/README.md](../docs/realtime/README.md). Cualquier cambio de
eventos debe revisarse tambien en `frontend/src/hooks/useSocket.ts` y
`frontend/src/hooks/useGroupRealtimeRefresh.ts`.

## CI

`ci-backend.yml` corre en PRs hacia `main` o `develop` y valida `npm ci`, `npm run lint`,
`npx tsc --noEmit`, `npm run build` y `npm test -- --runInBand`. Mas detalle en
[../docs/workflows/README.md](../docs/workflows/README.md).
