# Plan de migración: Ithera → Traveling (Equipo 2)

> Estado: **Fase 5 en curso** (fases 1 a 4 aplicadas en producción, pendientes de merge) · Última actualización: 2026-11-23

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
| 2 | Esquema base en Supabase | L | Lista |
| 3 | Poda de módulos del Equipo 1 y fuera de alcance | L | Lista |
| 4 | Itinerario básico | M | Lista |
| 5 | Funciones de finanzas del Equipo 2 | L | En curso |
| 6 | Renombre, documentación y CI | M | En curso |

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

Rama: `feature/traveling-schema` (sale de `ci/self-hosting`).

Las 37 migraciones del repo asumían el estado de la base de Ithera (algunas migraban datos
legados). En lugar de repetirlas se creó una línea base nueva.

- [x] Inventario desde el código: por cada `.from('tabla')`, columnas usadas en
      `select/insert/update/eq/order`, embeds de PostgREST (que exigen FKs), entidades del
      backend y constraints de las migraciones viejas.
- [x] Supabase CLI fijada en el repo (`supabase@2.122.1` como devDependency de la raíz) y
      `supabase/` con `config.toml`, `templates/` y `migrations/20261123120000_traveling_baseline.sql`:
  - Base común: `usuarios`, `grupos_viaje`, `grupo_miembros`, `grupo_invitaciones`,
    `grupo_solicitudes_union`, `admin_delegation_requests`, `itinerarios`, `actividades`.
  - Finanzas: `expenses`, `expense_splits`, `settlement_payments`,
    `settlement_payment_documents`, `trip_documents`, `trip_context_links`.
  - Soporte: `notificaciones`, `usuario_preferencias_notificacion`, `chat_mensajes`.
  - **No se crean:** `propuestas`, `voto`, `comentario`, `vuelos`, `hospedajes`, `subgroup*`,
    `subgroup_chat_mensajes`, `historial_busquedas`, `expense_documents`; ni
    `actividades.propuesta_id`.
  - **Columnas temporales:** `grupos_viaje` conserva `destino_*` (Google) y `punto_partida_*`
    porque el código actual las escribe al crear/editar un viaje; se eliminan en la fase 3.
  - Buckets: `trip-documents` (10 MiB), `profile-avatars` (5 MiB), `public-assets`.
  - RLS activado en todas las tablas y sin políticas.
- [x] Auth como código en `config.toml`: Site URL y redirects, contraseña de 8 caracteres con
      mayúscula/minúscula/número (igual que el frontend), confirmación por OTP de 6 dígitos,
      SMTP de Gmail (credenciales por `env()`), plantillas con `{{ .Token }}`, 30 correos/hora.
- [x] Borradas las migraciones viejas de `backend/src/infrastructure/db/migrations/`
      (quedan en el historial de git). `docs/database/README.md` reescrito con el flujo nuevo.
- [x] `backend/scripts/smoke.mjs` (`npm run smoke`): 3 usuarios de prueba, viaje, unión
      pública y privada con aprobación, gastos (equitativo y personalizado), saldos, comprobante,
      pago con validación, recibo PDF, notificaciones, chat, enlace público, verificación de RLS y
      limpieza de todo lo creado.
- [x] Validado en un Supabase local (`supabase start` + migración): **29/29 pasos sin errores
      inesperados**. Fallas esperadas: crear/consultar actividad (fase 4), ligar comprobante a
      gasto (fase 3: el servicio carga entidades de subgrupos) y notificación de pagos (fase 5:
      Ithera nunca las guardaba, solo emitía el evento de socket).
- [x] **[Tú]** `npx supabase login` y `npx supabase link --project-ref mgbobudfoxfaxzwougys`
      (desde la raíz del repo; pide la contraseña de la base de datos).
- [x] **[OK]** `npx supabase db push` y `npx supabase config push` al proyecto en la nube.
      Antes de empujar la config se alinearon con la nube los valores que no se querían cambiar
      (MFA TOTP, pooler, `storage.vector`); el proyecto traía OTP de 8 dígitos y quedó en 6.
- [x] Migración `20261123204821_grant_service_role.sql`: en proyectos nuevos de Supabase las tablas
      de una migración no reciben privilegios automáticos (ni para `service_role`), a diferencia de
      la pila local. Se otorgan solo a `service_role` y se revocan a `anon`/`authenticated`.
- [x] Smoke test contra producción (`https://traveling.tonyquezada.com/api`): **29/29 sin errores
      inesperados**, y la base quedó vacía después de la limpieza.
- [ ] **[Tú]** Registrarte con un correo real y confirmar que llega el código OTP.

**Lista cuando:** el smoke test pasa contra producción sin errores inesperados y el registro
con OTP funciona.

## Fase 3 — Poda

Rama: `refactor/remove-team1-modules` (sale de `feature/traveling-schema`).

Backend:

- [x] Borrados `domain/` `flights`, `hotels`, `maps`, `proposals` (con `lock.service`),
      `votes-comments`, `checkout`, `search-history`, `subgroup-schedule.service.ts`,
      `subgroup-chat.service.ts`; sus routers; las rutas `/subgroups/*` y `/travel-context`;
      `infrastructure/external-apis/*`, `lock.scheduler.ts` y el placeholder de Redis.
- [x] `generateCollectionReceiptPdf` movido a `domain/budget/pdf.service.ts` antes de borrar `checkout`.
- [x] Sockets: sin bloqueos de propuestas ni salas de subgrupo; quedan salas del viaje, presencia y chat.
- [x] Recortes: destino en texto libre (sin Google Places), sin punto de partida/hotel, sin
      estadística de propuestas, sin gastos por subgrupo, sin `subgroup_activity` en enlaces, sin
      tipos de notificación de propuestas/vuelos/hospedajes.
- [x] `env.ts`/`.env.example` solo con Supabase, SMTP y `SHARE_LINK_SECRET` (obligatorio en
      producción; ya no se firma con la secret key).
- [x] Tests: fuera `proposals.service.test.ts`, `INTEGRITY_TEST_REPORT.md` y `test_sockets.mjs`
      (eran de propuestas y bloqueos); `context-links` sin el caso de subgrupos. 21/21 pasan.
- [x] Dependencias sin uso fuera: `axios`, `socket.io-client` (backend).
- [x] Migración `20261123210400_remove_ithera_leftovers.sql`: quita las columnas temporales de
      `grupos_viaje`, el tipo `subgroup_activity` y las preferencias `votos`, `comentarios`,
      `vuelos`, `hospedajes`.
- [x] De paso: la lista de preferencias permitidas no incluía `notificaciones_alertas` (no se
      podía guardar); corregido.

Frontend:

- [x] Borrados `pages/Search/*`, `Comparison`, `Checkout`; componentes de propuestas, checkout,
      subgrupos, `SubgroupChatDrawer`, `GoogleMiniMap`, `DestinationSearch`,
      `ActivityProposalModal`; servicios de vuelos, hoteles, mapas, propuestas, checkout,
      historial y subgrupos; `useSyncQueue` (cola offline de propuestas) e `idb`; `mock/`.
- [x] `DashboardPage.tsx` de 4,663 a ~2,050 líneas: pestañas Finanzas (por defecto),
      Itinerario y Archivos; sin vista de subgrupos, votación, comentarios, mapas ni el bloqueo
      de "presupuesto requerido". La carga pide cada parte por separado (si falla el itinerario,
      Finanzas y Archivos siguen funcionando).
- [x] Panel derecho: el mapa/clima/punto de partida se cambió por una tarjeta de destino con
      enlace a Google Maps por texto (sin API key); el resumen de presupuesto ya existía.
- [x] Crear viaje y configuración: destino como campo de texto.
- [x] Finanzas y Archivos sin gastos por subgrupo ni actividades de subgrupo.
- [x] Perfil: sin la estadística de propuestas ni las preferencias de votos, vuelos y hospedajes.
- [x] Botones de Google/Facebook solo si están en `VITE_OAUTH_PROVIDERS` (vacío = solo correo).
- [x] `tsc`, lint y build limpios.

Verificación:

- [x] Supabase local con las 3 migraciones + backend nuevo: smoke test **29/29**, y ligar
      comprobante a gasto ya pasa. Sin el error de bloqueos en los logs.

Pendiente:

- [x] **[OK]** Desplegar en producción **antes** de aplicar la migración (el backend anterior
      todavía escribe las columnas que se borran) y luego `npx supabase db push`. Smoke test en
      producción: 29/29; los datos reales se conservan.
- [x] Inicio de sesión con Google: proveedor en `supabase/config.toml` (Client ID público; el
      secreto vive en `supabase/.env`, ignorado por git), `config push` aplicado y
      `VITE_OAUTH_PROVIDERS=google` en producción. Verificado: Supabase redirige a Google con el
      cliente y callback correctos y Google no reporta errores de cliente.
- [ ] **[Tú]** Probar el login con Google de punta a punta en el navegador.
- [ ] **[Tú]** Revisar en el navegador que Finanzas, Archivos, chat, crear viaje y perfil se ven bien.
- [ ] **[Tú]** Revisión y merge del PR por otra persona del equipo.

Mientras llega la fase 4, la pestaña Itinerario muestra el estado vacío y no hay botón para
agregar actividades (el backend del itinerario todavía depende de `propuestas`). La documentación
de API, tiempo real, variables y arquitectura se actualiza en la fase 6.

**Lista cuando:** `tsc`, lint, build y tests pasan en ambos lados; buscar
`proposal|subgroup|duffel|amadeus|liteapi|googlemaps` solo encuentra lo intencional (itinerario y
`DayView`, fase 4; textos de la landing, fase 6); en producción no hay 404 de la API.

## Fase 4 — Itinerario básico

Rama: `feature/basic-itinerary` (sale de `refactor/remove-team1-modules`).

Backend:

- [x] `itinerary.service.ts` reescrito: cualquier integrante agrega actividades (quedan
      confirmadas, sin propuesta ni votación); edita o borra quien la creó o un admin; se
      respetan el viaje cerrado y `modulo_itinerario_bloqueado`.
- [x] Validaciones conservadas: dentro de las fechas del viaje, intervalos de 30 minutos, nada
      en días pasados y sin traslapes (409). Título, notas y ubicación con límite de longitud.
- [x] Borrar una actividad también quita sus enlaces con gastos y documentos.
- [x] Respuesta del itinerario con quién agregó cada actividad (`createdByName`).
- [x] Migración `20261123215241_simplify_activities.sql`: fuera `latitud`, `longitud`,
      `referencia_externa`, `fuente`, `payload` y el estado `pendiente`.

Frontend:

- [x] `DayView` reescrito (de 2,023 a ~400 líneas): línea de tiempo del día, tarjeta con
      horario, quién la agregó, notas, ubicación con enlace a Google Maps y gastos/documentos
      ligados con **"Gastado aquí"**; editar/borrar según permisos.
- [x] `ActivityFormModal` nuevo: título, día (dentro del viaje y desde hoy), inicio y fin en
      intervalos de 30 minutos (hora de Ciudad de México), ubicación y notas; muestra los errores
      del backend.
- [x] Tablero: botones de agregar en la portada del itinerario, el resumen del día y cada día;
      se ocultan si el viaje está cerrado o el itinerario bloqueado. Sin textos de votación;
      exportar a PDF sin rutas.
- [x] El enlace gasto↔actividad ya existía en el formulario de gastos ("Actividad relacionada").

Verificación:

- [x] Supabase local con las 4 migraciones: smoke test **34/34** (crear, consultar, editar,
      permisos 403, traslape 409, ligar gasto, borrar con limpieza de enlaces). Backend 21/21 tests.
- [x] Frontend: `tsc`, lint y build limpios. No hay navegador en el servidor: falta revisión visual.

Pendiente:

- [x] **[OK]** Desplegar en producción y luego `npx supabase db push`. Smoke test en producción: 34/34.
- [ ] **[Tú]** Revisar en el navegador: agregar, editar y borrar actividades; ligar un gasto a
      una actividad y ver "Gastado aquí"; enlace público del itinerario.

**Lista cuando:** se crean, editan y borran actividades sin votación y el smoke test pasa completo.

## Fase 5 — Finanzas del Equipo 2

Rama: `feature/finance-team2` (sale de `feature/basic-itinerary`).

| Requisito | Antes | Ahora |
| --- | --- | --- |
| Registrar gastos y quién pagó | Fechas de 2 meses antes a 3 días después del viaje | Hasta 12 meses antes y 30 días después (vuelos y hoteles se pagan con anticipación). |
| Repartir entre involucrados | Equitativo / personalizado (la suma ya se validaba) | Sin cambios de reglas; editar o borrar un gasto lo puede quien lo registró o un admin (antes la interfaz solo dejaba al admin). |
| Presupuesto: planeado vs gastado | Total obligatorio; no se podía registrar gastos sin él ni pasarse | Presupuesto **opcional** (al crear y después); **presupuesto por categoría** (`budget_categories`) con medidores planeado/gastado; pasarse se permite y se marca; alertas al 80 % y 100 %. |
| Saldos y pagos | Existía; el viaje cerrado solo se respetaba en la interfaz | El backend bloquea gastos y presupuesto con el viaje cerrado (409) o bloqueado (423) y **sí** permite liquidar. |
| Comprobantes | Bucket público; el comprobante ya se podía adjuntar desde el gasto | Bucket **privado** con URLs firmadas de una hora; `file_url` ya no se guarda. |
| Resúmenes | Recibo de cobro en PDF | `GET /summary` (por categoría, integrante y día), **CSV** (UTF-8 con BOM, protegido contra fórmulas) y **PDF** de una página; panel "Resumen por integrante" con descargas. |

- [x] Notificaciones persistentes: gasto nuevo (a los involucrados), pago por validar (al
      acreedor), pago confirmado/rechazado (al deudor), presupuesto al 80 %/excedido (a todos).
      Pagos van a la preferencia "Finanzas"; alertas a "Alertas" (nuevo interruptor en el perfil).
- [x] Borrar una cuenta con gastos o pagos en viajes compartidos responde 409 con un mensaje
      claro (antes fallaba en silencio). Los enlaces de contexto sobreviven sin autor.
- [x] Migración `20261125015921_finance_team2.sql`.
- [x] El servicio de presupuesto del frontend usa solo `/api/budget/:groupId` (antes probaba una
      ruta inexistente y reintentaba: dos peticiones por operación).
- [x] `docs/api/endpoints.md`: sección de presupuesto reescrita con los endpoints nuevos.

Verificación:

- [x] Supabase local con las 5 migraciones: smoke test **48/48** tres veces seguidas (incluye
      viaje sin presupuesto, gasto previo al viaje, URL firmada vs pública, notificaciones,
      presupuesto por categoría y permisos, alerta, resumen, CSV con BOM, PDF, viaje cerrado y
      borrado de cuenta bloqueado). Backend 27/27 tests (6 nuevos).
- [x] Frontend: `tsc`, lint y build limpios. Falta revisión visual.

Pendiente:

- [x] **[OK]** Esta vez **primero** `npx supabase db push` y **después** desplegar: el backend
      nuevo necesita `budget_categories` y `file_url` opcional; el anterior funciona con el
      esquema nuevo. Smoke test en producción: 48/48; `trip-documents` quedó privado.
- [ ] **[Tú]** Revisar en el navegador: crear viaje sin presupuesto, definirlo después, límites
      por categoría, alerta al excederlo, resumen y descargas, abrir un comprobante.

**Lista cuando:** los cinco requisitos se demuestran de punta a punta en producción.

## Fase 6 — Renombre, documentación y CI

Rama `chore/rename-traveling` (sobre `feature/finance-team2`).

- [x] Ithera/ITHERA → Traveling: textos de UI, `<title>` (y `lang="es"`), `package.json` y
      lockfiles (`traveling-backend`, `traveling-frontend`), mensaje de `/health` y logs,
      plantilla de correo y PDF (ya no cargan el logo del bucket de Ithera; encabezado de texto),
      claves `traveling_*` de localStorage/sessionStorage, nombre del PNG de invitación.
- [x] Logotipo temporal en SVG (`components/ui/Logo`: ruta entre dos puntos + "Traveling") y
      favicon nuevo. Se borraron `ithera-transparente.png`, `logo-*` y `hero.png` (sin uso).
- [x] Landing, login y registro: textos del Equipo 2 (gastos, repartos, saldos, comprobantes) en
      lugar de propuestas y votos; se quitaron las cifras y testimonios inventados.
- [x] Docs reescritas o al día: README, `CONTRIBUTING.md`, README de backend y frontend,
      `docs/README.md`, `docs/api/endpoints.md` (sin vuelos, hoteles, mapas, propuestas, subgrupos
      ni checkout), `docs/realtime` (sin locks), `docs/env` (sin Vercel ni APIs externas),
      `docs/security`, `docs/testing`, `docs/architecture`, `docs/gitflow`, `docs/issues`,
      requerimientos, casos de uso (módulos M1–M8 de Traveling), diagramas, ADS.
- [x] `docs/Documentacion_oficial/`, `docs/extracted/`, el reporte del sprint 9 y el reporte de
      estrés → `docs/legacy-ithera/`, con un README que explica qué es y da créditos.
- [ ] **[Tú]** Logo del equipo (se cambia en `Logo.tsx` y `public/favicon.svg`).
- [ ] **[Tú]** Integrantes del Equipo 2 para `CODEOWNERS` (hoy conserva los de Ithera) y la
      sección "Equipo" del README; confirmar los datos académicos del encabezado (grupo,
      profesora, número de equipo) que se heredaron de Ithera. Opcional: renombrar el repo en
      GitHub (las URLs viejas redirigen).

Verificación:

- [x] Backend: `tsc`, build y 27/27 tests. Recibo PDF generado desde el build: válido, con
      "TRAVELING" y sin rastro de Ithera; la plantilla de correo ya no apunta a Supabase de Ithera.
- [x] Frontend: `tsc`, lint y build limpios. 0 enlaces rotos en los `.md`.
- [x] `grep -ri ithera` fuera de `docs/legacy-ithera/` y este plan: solo menciones deliberadas
      del origen (sección "Origen" del README, remoto `upstream` `ITHERAADS/ITHERA`, URL del
      repo `SWE---Ithera`) y dos migraciones ya aplicadas, que no se renombran.

Pendiente:

- [ ] **[OK]** Desplegar (solo contenedores, sin migraciones). Efecto: al cambiar la clave
      `ithera_auth` → `traveling_auth`, cada usuario inicia sesión de nuevo una vez.
- [ ] **[Tú]** Revisión visual de landing, login/registro (logotipo nuevo) y un correo de
      invitación.

**Lista cuando:** está en producción y no queda marca de Ithera visible para el usuario.

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
