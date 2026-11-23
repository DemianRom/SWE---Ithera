# Plan de migración: Ithera → Traveling (Equipo 2)

> Estado: **Fase 1 en curso** · Última actualización: 2026-11-23

## Contexto

Ithera se dividió en dos proyectos que comparten una base común. Este repositorio
(`DemianRom/SWE---Ithera`, fork de `ITHERAADS/ITHERA`) se convierte en **Traveling**,
la versión del Equipo 2: **cuentas compartidas del viaje**.

- **Base común (se conserva):** cuentas, creación de viajes, integrantes, permisos e
  itinerario básico con actividades, horarios y ubicaciones.
- **Alcance del Equipo 2:**
  - Registrar gastos e identificar quién pagó.
  - Repartir gastos entre los integrantes involucrados.
  - Definir un presupuesto y comparar lo planeado con lo gastado.
  - Consultar saldos y registrar pagos entre compañeros.
  - Guardar comprobantes y generar resúmenes de gastos.
- Los gastos no necesitan estar ligados a una actividad. Basta con crear un viaje y
  agregar integrantes; el itinerario es contexto opcional.
- **Fuera de alcance:** todo lo del Equipo 1 (búsqueda de vuelos/hospedajes/lugares,
  comparación, propuestas, votos y comentarios), agendas individuales (subgrupos) y
  planificación de traslados (rutas, clima, punto de partida).

## Decisiones

| Tema | Decisión |
| --- | --- |
| Base de datos y auth | Proyecto **Supabase nuevo en la nube**, independiente del de Ithera. |
| Esquema | **Reconstruido desde el código** (el esquema base solo existía en el Supabase de Ithera). |
| Hosting | `compose.yaml` propio en este repo, conectado al Caddy del servidor por la red externa `docker_proxy`. |
| Dominio | Uno solo: `traveling.tonyquezada.com`. Frontend en `/`, backend en `/api`, `/socket.io` y `/health`. Sin CORS. |
| DNS | Un CNAME `traveling` → `tonyquezada.com` en Cloudflare (proxied, como los demás subdominios). No requiere cambios en ddclient. |
| Correo | SMTP de Gmail con contraseña de aplicación, tanto para Supabase Auth (OTP) como para el backend (invitaciones). Se reemplaza Resend por SMTP (nodemailer). |
| Despliegue | Automático: GitHub Actions ejecuta `deploy.sh` por SSH (llave restringida) en cada push a `main`; el script hace fast-forward y `docker compose up -d --build` de lo que cambió. |
| Funciones sin dueño | **Se quedan:** notificaciones (solo finanzas y base común), chat grupal y enlace público del itinerario. **Se va:** Google Maps (ubicaciones en texto libre). |
| Repositorio | `origin` = fork del Equipo 2. `upstream` = `ITHERAADS/ITHERA` (solo lectura, para cherry-picks de la base común; el Equipo 1 integra en `upstream/develop`). |

## Supuestos

- Se arranca sin datos: no se migra nada de Ithera.
- Solo MXN (sin multimoneda).
- Login con correo + contraseña + OTP. Los botones de Google/Facebook quedan ocultos
  hasta que alguien configure OAuth en el Supabase nuevo.

## Convenciones

- Ramas: `develop` sale de `main`; una rama por fase (`ci/…`, `feature/…`, `refactor/…`,
  `docs/…`) con PR hacia `develop`. `develop → main` al cerrar las fases 1, 4, 5 y 6.
  `deploy.sh` solo publica `main`.
- Commits sin coautores automáticos.
- El repo es público: este documento y los `.env.example` no llevan secretos.
- Marcas en las tareas:
  - **[Tú]** requiere a una persona del equipo (cuentas, dashboards, secretos, permisos, revisión de PR).
  - **[OK]** lo hace Claude, pero pide confirmación antes porque publica algo o toca
    infraestructura compartida (push, Caddy, cron, BD remota).
  - Sin marca: trabajo de código/documentación que hace Claude.

## Resumen de fases

| Fase | Qué | Esfuerzo | Estado |
| --- | --- | --- | --- |
| 0 | Preparación: repo, DNS, Supabase, correo | S | Lista |
| 1 | Hosting en el servidor | M | En curso |
| 2 | Esquema base en Supabase | L | Pendiente |
| 3 | Poda de módulos del Equipo 1 y fuera de alcance | L | Pendiente |
| 4 | Itinerario básico | M | Pendiente |
| 5 | Funciones de finanzas del Equipo 2 | L | Pendiente |
| 6 | Renombre, documentación y CI | M | Pendiente |

El hosting va antes que el esquema porque los Dockerfiles no dependen de los cambios
de código, y con la URL lista se puede configurar Supabase Auth y probar cada fase en el
entorno real. Mientras tanto, las pantallas del Equipo 1 fallarán; no importa porque
todavía no hay usuarios.

---

## Fase 0 — Preparación

- [x] Crear la rama `develop` desde `main`.
- [x] Agregar el remoto `upstream` → `ITHERAADS/ITHERA` con push deshabilitado (evita
      empujar cambios al repo del Equipo 1 por error).
- [x] Guardar este plan en `docs/plan-traveling.md`.
- [x] **[OK]** Commit del plan en `develop` y push de `develop` a `origin`.
- [x] **[Tú]** DNS: en Cloudflare, crear un registro **CNAME** `traveling` → `tonyquezada.com`,
      con proxy activado (nube naranja), igual que los otros subdominios.
- [x] **[Tú]** Supabase: crear el proyecto `traveling` (plan Free, región East US).
      Guardar en tu gestor de contraseñas: *Project ref*, *Project URL*, *Publishable key*,
      *Secret key* y la contraseña de la base de datos.
- [x] **[Tú]** Gmail: con la verificación en dos pasos activa, crear una contraseña de
      aplicación llamada "Traveling" y guardarla.
- [x] **[Tú]** Confirmar si tienes permisos de admin en el fork (para agregar secrets del
      deploy por GitHub Actions). Sí hay permisos.

**Lista cuando:** `dig traveling.tonyquezada.com` resuelve, el proyecto de Supabase existe y
tienes la contraseña de aplicación.

Resultado: proyecto Supabase `mgbobudfoxfaxzwougys` (`https://mgbobudfoxfaxzwougys.supabase.co`);
el CNAME resuelve a Cloudflare.

## Fase 1 — Hosting

Rama: `ci/self-hosting`.

Archivos nuevos en el repo:

- [x] `compose.yaml` (`name: traveling`), servicios en la red `proxy` (externa, `docker_proxy`),
      sin puertos publicados:
  - `traveling-api`: `backend/Dockerfile` multi-stage sobre `node:24-slim`, usuario `node`,
    `env_file: ./backend/.env`, healthcheck a `/health`.
  - `traveling-web`: `frontend/Dockerfile` (build de Vite con build args `VITE_API_URL=/api`,
    `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) servido por `nginx:stable-alpine` con
    `frontend/nginx.conf` (fallback SPA sin caché, `/assets` con caché inmutable).
- [x] Build args leídos del `.env` de la raíz; plantilla `.env.example`.
- [x] `.dockerignore` en `backend/` y `frontend/`.
- [x] `deploy.sh`: `flock`, fast-forward de `main`, reconstruye solo lo que cambió desde el último
      deploy exitoso (`.deployed-sha`, así un build fallido se reintenta); `--force`, `--ssh`.
- [x] `.github/workflows/deploy.yml`: en push a `main`, SSH con llave restringida a
      `deploy.sh --ssh`. Destino y huella del host en secrets (el repo es público).
- [x] Borrados los workflows de Vercel, `frontend/vercel.json` y `docs/vercel-frontend-deploy.md`.
- [x] Documentación: `docs/deploy/README.md` (nuevo), `docs/workflows/README.md`,
      `.github/workflows/README.md`, `docs/README.md` y README.

Código:

- [x] `backend/src/index.ts`: `app.set('trust proxy', 1)`; sin comodín `.vercel.app` en CORS
      (también en Socket.IO).
- [x] `backend/src/services/email.service.ts`: Resend → SMTP con nodemailer
      (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
- [x] CI y README: Node 20 → 24.

- [x] Borrado `backend/tests/amadeus.integrity.test.ts`: llamaba a `test.api.amadeus.com`, que ya
      no resuelve, y dejaba el CI en rojo (de todos modos era de la fase 3).

Verificado en local: backend `tsc`, build y 27/27 tests; frontend lint y `tsc`; ambas imágenes
construyen; `/health`, el polling de Socket.IO, el healthcheck, el fallback SPA y la caché de
`/assets` responden bien.

Servidor:

- [x] Clon de producción en `~/traveling` con `.env` de la raíz (valores públicos) y
      `backend/.env` (no secretos + `SHARE_LINK_SECRET` generado).
- [x] **[Tú]** Llenar en `~/traveling/backend/.env`: `SUPABASE_SECRET_KEY`, `SMTP_USER`,
      `SMTP_PASS` y `MAIL_FROM`.
- [x] **[OK]** Agregar el bloque de `traveling.tonyquezada.com` al Caddyfile del servidor y recargar Caddy:

  ```
  traveling.tonyquezada.com {
      encode zstd gzip
      @api path /api/* /socket.io/* /health
      handle @api {
          reverse_proxy traveling-api:3001
      }
      handle {
          reverse_proxy traveling-web:80
      }
  }
  ```

- [x] **[OK]** Primer `docker compose up -d --build` en `~/traveling` (desde la rama `ci/self-hosting`).
- [x] **[OK]** Autorizar la llave de deploy en `~/.ssh/authorized_keys` con
      `restrict,command="/home/tony/traveling/deploy.sh --ssh"`.
- [x] **[Tú]** Secrets en GitHub (*Settings → Secrets and variables → Actions*): `DEPLOY_KEY`,
      `DEPLOY_TARGET`, `DEPLOY_KNOWN_HOSTS`.
- [ ] **[Tú]** PR `ci/self-hosting` → `develop` (revisión de otra persona) y luego `develop` → `main`.
      Al llegar a `main`, la copia de `~/traveling` pasa a la rama `main` y el deploy queda automático.

**Lista cuando:** `https://traveling.tonyquezada.com/health` responde; recargar `/my-trips` no da
404; `/socket.io/?EIO=4&transport=polling` responde 200; un push a `main` se publica solo.

Verificado en producción (2026-11-23): certificado de Let's Encrypt emitido por Caddy; `/health`,
`/`, `/my-trips` y el polling de Socket.IO responden 200; el upgrade a WebSocket responde 101; la
API sin token responde 401; la llave de deploy solo puede ejecutar `deploy.sh`. Falta solo el
primer deploy automático, que ocurre al llegar esta rama a `main`.

## Fase 2 — Esquema base en Supabase

Las 37 migraciones del repo asumen el estado de la base de Ithera (algunas migran datos
legados). En lugar de repetirlas se crea una línea base nueva.

- [ ] Inventario desde el código: por cada `.from('tabla')`, columnas usadas en
      `select/insert/update/eq/order`, más entidades del backend, tipos del frontend y
      constraints de las migraciones viejas.
- [ ] Supabase CLI en el repo (`supabase/config.toml`, `supabase/migrations/`,
      `supabase/templates/`) y una migración `…_traveling_baseline.sql`:
  - Base común: `usuarios`, `grupos_viaje`, `grupo_miembros`, `grupo_invitaciones`,
    `grupo_solicitudes_union`, `admin_delegation_requests`, `itinerarios`, `actividades`.
  - Finanzas: `expenses`, `expense_splits`, `settlement_payments`,
    `settlement_payment_documents`, `trip_documents`, `trip_context_links`.
  - Soporte: `notificaciones`, `usuario_preferencias_notificacion`, `chat_mensajes`.
  - **No se crean:** `propuestas`, `voto`, `comentario`, `vuelos`, `hospedajes`, `subgroup*`,
    `subgroup_chat_mensajes`, `historial_busquedas`, `expense_documents`; ni las columnas
    `actividades.propuesta_id`, `grupos_viaje.punto_partida_*` y los campos de Google del destino.
  - Buckets: `trip-documents`, `profile-avatars`, `public-assets`.
  - RLS activado en todas las tablas y sin políticas: el backend usa la secret key y el
    frontend solo usa Supabase para autenticarse.
- [ ] Configuración de Auth como código en `config.toml`: Site URL
      `https://traveling.tonyquezada.com`; redirects `https://traveling.tonyquezada.com/**` y
      `http://localhost:5173/**`; SMTP de Gmail; plantillas "Confirm signup" y "Magic Link" con
      `{{ .Token }}` (la pantalla OTP pide un código, no un enlace).
- [ ] **[Tú]** `npx supabase login` y `npx supabase link --project-ref <ref>` (pide la contraseña
      de la base de datos).
- [ ] **[OK]** `supabase db push` y `supabase config push` (o el dashboard si algo no se puede empujar).
- [ ] Borrar las migraciones viejas de `backend/src/infrastructure/db/migrations/` (quedan en git).
- [ ] `backend/scripts/smoke.ts` (`npm run smoke`): crea usuarios de prueba con la API de admin y
      recorre sincronizar usuario → crear viaje → unirse por código → actividad → gasto → saldos →
      pago y validación → comprobante → notificaciones → chat → enlace compartido. Se vuelve a
      correr al cerrar cada fase.
- [ ] **[Tú]** Registrarte con un correo real y confirmar que llega el código OTP.

**Lista cuando:** el smoke test pasa en base común y finanzas (el itinerario puede fallar hasta la
fase 4 porque todavía consulta `propuestas`).

## Fase 3 — Poda

Backend, se borra:

- [ ] `domain/`: `flights`, `hotels`, `maps`, `proposals` (con `lock.service`), `votes-comments`,
      `checkout`, `search-history`, `itinerary/subgroup-schedule.service.ts`,
      `groups/subgroup-chat.service.ts`.
- [ ] `routes/`: los routers equivalentes, las rutas `/subgroups/*` de `itinerary.router.ts` y
      `/travel-context` de `trips.router.ts`.
- [ ] `infrastructure/`: `external-apis/*`, `sockets/lock.scheduler.ts`, handlers de locks y de
      salas de subgrupo, placeholder de Redis.
- [ ] **Antes** de borrar `checkout`: mover `generateCollectionReceiptPdf` a `domain/budget/`
      (lo usa `budget.router.ts`).

Backend, se recorta:

- [ ] `groups.service.ts`: Google Places del destino (texto libre) y punto de partida/hotel.
- [ ] `auth.service.ts`: estadística de propuestas aceptadas del perfil.
- [ ] `budget.service.ts`: gastos con alcance de subgrupo.
- [ ] `context-links`: el tipo `subgroup_activity`.
- [ ] `notifications.service.ts`: tipos y acciones de propuestas.
- [ ] `env.ts` y `.env.example`: fuera `AMADEUS_*`, `DUFFEL_*`, `LITEAPI_*`, `GOOGLE_*`,
      `WEATHER_*`, `LOCK_TTL_MINUTES`; entra `SHARE_LINK_SECRET` propio (hoy cae a la secret key).
- [ ] Tests: fuera `proposals.service.test.ts` y `amadeus.integrity.test.ts`; ajustar `budget` y
      `context-links`.

Frontend, se borra:

- [ ] `pages/`: `Search/*`, `Comparison`, `Checkout`.
- [ ] `components/`: `ProposalCard`, `ProposalDetailModal`, `ConfirmProposalModal`, `checkout/*`,
      `subgroups/*`, `chat/SubgroupChatDrawer`, `GoogleMiniMap`, `DestinationSearch`.
- [ ] `services/`: `flights`, `hotels`, `maps`, `proposals`, `checkout`, `search-history`,
      `subgroups`, `subgroup-chat`; `hooks/useSyncQueue.ts` y la dependencia `idb`.
- [ ] Rutas en `App.tsx`; variable `VITE_GOOGLE_MAPS_BROWSER_KEY`.

Frontend, se recorta:

- [ ] `DashboardPage.tsx`: fuera pestañas Vuelos y Hoteles, Comparar, Mapas, la vista de subgrupos
      y el bloqueo `requiresInitialBudget`. Quedan Finanzas (por defecto), Itinerario, Archivos y el
      chat. Sin reescribir; si sigue enorme, extraer componentes.
- [ ] `RightPanelDashboard`: mapa/clima/punto de partida → resumen financiero.
- [ ] `Navbar` (acciones de notificaciones), `ProfilePage`, `CreateGroupPage` (destino en texto libre).
- [ ] Botones de OAuth según `VITE_OAUTH_PROVIDERS`.
- [ ] **[Tú]** Revisión y merge del PR por otra persona del equipo (regla del repo).

**Lista cuando:** `tsc`, lint, build y tests pasan en ambos lados; buscar
`proposal|subgroup|duffel|amadeus|liteapi|googlemaps` solo encuentra lo intencional; en producción
no hay 404 de la API.

## Fase 4 — Itinerario básico

- [ ] Crear actividad inserta directo en `actividades` (confirmada), sin propuesta ni votación.
      Edita/borra el creador o un admin; se respeta `modulo_itinerario_bloqueado`; se conservan las
      validaciones de rango de fechas y traslapes.
- [ ] `getGroupItinerary` sin join a `propuestas` ni conteo de votos.
- [ ] Ubicación en texto libre con enlace "Abrir en Google Maps"
      (`https://www.google.com/maps/search/?api=1&query=…`, sin API key).
- [ ] `ActivityProposalModal` → `ActivityFormModal` (título, inicio/fin, ubicación, descripción);
      `DayView` sin estados de votación.
- [ ] Itinerario como contexto opcional: selector "Actividad relacionada (opcional)" en el
      formulario de gasto (`trip_context_links`) y "Gastado aquí" en cada actividad.
- [ ] Verificar que `/shared/:token` sigue mostrando el itinerario.

**Lista cuando:** se crean, editan y borran actividades sin votación y el smoke test pasa completo.

## Fase 5 — Finanzas del Equipo 2

| Requisito | Hoy | Trabajo |
| --- | --- | --- |
| Registrar gastos y quién pagó | `expenses.paid_by_user_id` | Aceptar gastos con fecha anterior al viaje (hoy `assertExpenseDateWithinTripWindow` los rechaza). |
| Repartir entre involucrados | Equitativo / personalizado por integrante | Validar que la suma del reparto = monto; opcional: reparto por porcentaje. |
| Presupuesto: planeado vs gastado | `presupuesto_total` obligatorio al crear el viaje | Presupuesto opcional y editable después; tabla `budget_categories` (planeado por categoría); gráfica con recharts; avisos al 80 % y 100 %. |
| Saldos y pagos entre compañeros | Saldos, liquidaciones y validación de pagos | Pulir la interfaz; confirmar que un viaje cerrado bloquea gastos nuevos pero deja liquidar. |
| Comprobantes | Documentos ligados a gastos/pagos (`trip_context_links`) | Adjuntar desde el formulario del gasto en un paso; bucket privado con URLs firmadas. |
| Resúmenes | PDF de recibo de cobro | `GET /api/budget/:groupId/summary` (por categoría, por persona y por día) + exportar CSV y PDF. |

- [ ] Notificaciones: gasto nuevo (a los involucrados), pago por validar (al acreedor), pago
      confirmado/rechazado (al deudor), alertas de presupuesto, más las de invitaciones y solicitudes.
- [ ] Cada endpoint nuevo documentado en `docs/api/endpoints.md`.
- [ ] **[Tú]** Validar con el equipo los detalles de interfaz (categorías, gráfica, formato del resumen).

**Lista cuando:** los cinco requisitos se demuestran de punta a punta en producción con tres
usuarios de prueba.

## Fase 6 — Renombre, documentación y CI

- [ ] Ithera/ITHERA → Traveling: textos de UI, `<title>`, `package.json`
      (`traveling-backend`, `traveling-frontend`), mensaje de `/health`, plantilla de correo y PDF
      (hoy cargan el logo del bucket de Ithera), claves `ithera_*` de localStorage/sessionStorage.
- [ ] **[Tú]** Logo del equipo; mientras tanto, un wordmark de texto (reemplaza
      `ithera-transparente.png`, `logo-*` y favicon).
- [ ] Docs: README, `docs/api`, `docs/database` (flujo con Supabase CLI), `docs/env`,
      `docs/workflows` (sin Vercel, con deploy), `docs/realtime` (sin locks), `docs/architecture`.
      `docs/Documentacion_oficial/` → `docs/legacy-ithera/`.
- [ ] **[Tú]** Integrantes del Equipo 2 para `CODEOWNERS` y la tabla del README; opcional, renombrar
      el repo en GitHub (las URLs viejas redirigen).

**Lista cuando:** `grep -ri ithera` solo encuentra `docs/legacy-ithera/` y este plan.

---

## Riesgos

- **Esquema reconstruido con huecos:** una columna faltante aparece como error de PostgREST
  ("column … does not exist"). El smoke test lo detecta y se corrige con una migración nueva.
- **Pausa del plan Free de Supabase** tras 7 días sin actividad: un cron diario a
  `/health?db=1` (consulta ligera a la BD) lo mantiene activo.
- **Cambios del Equipo 1:** después de la poda, traerlos será por cherry-pick puntual desde
  `upstream/develop`, no por merge.
- **Secrets del fork:** si no hay permisos de admin, el deploy funciona solo con cron.
- **Remitente de correo:** con Gmail los correos salen de una cuenta personal. Si se quiere un
  remitente del proyecto, cambiar a Resend con un dominio verificado (solo cambia la config SMTP).
