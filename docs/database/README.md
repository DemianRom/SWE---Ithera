# Base de datos y Supabase - Traveling

Traveling usa un proyecto de Supabase en la nube para base de datos (Postgres), autenticacion
y archivos (Storage). El esquema y la configuracion de Auth viven en este repo, en `supabase/`,
y se aplican con la Supabase CLI.

## Estructura

```text
supabase/
|-- config.toml                    # Configuracion del proyecto (Auth, SMTP, plantillas, local)
|-- migrations/
|   |-- 20261123120000_traveling_baseline.sql   # Esquema base
|   `-- 20261123204821_grant_service_role.sql   # Privilegios explicitos de tablas
`-- templates/                     # Plantillas de correo de Auth (codigo OTP)
```

La CLI esta fijada como dependencia de desarrollo en el `package.json` de la raiz
(`supabase@2.122.1`); usa siempre `npx supabase ...` desde la raiz del repo.

## Clientes backend

Archivo: `backend/src/infrastructure/db/supabase.client.ts`

| Cliente | Llave | Uso |
| --- | --- | --- |
| `supabaseAuth` | `SUPABASE_ANON_KEY` (publishable key) | Flujos normales de autenticacion. |
| `supabaseAdmin` | `SUPABASE_SECRET_KEY` (secret key) | Todas las operaciones de datos y Storage. |
| `supabase` | Alias de `supabaseAdmin` | Compatibilidad con servicios existentes. |

## Seguridad (RLS)

- Solo `service_role` (secret key) tiene privilegios sobre las tablas; `anon` y `authenticated`
  no tienen ninguno. Ademas, RLS esta activo en todas las tablas y **no hay politicas**. Con la
  publishable key no se puede leer ni escribir nada; el smoke test lo verifica.
- Ojo: en proyectos nuevos de Supabase las tablas creadas por migraciones **no** reciben
  privilegios automaticos (en la pila local si). Los `alter default privileges` de
  `20261123204821_grant_service_role.sql` cubren las tablas futuras creadas como `postgres`.
- El backend usa la secret key (ignora RLS), por eso **cada endpoint debe validar permisos**
  (miembro del viaje, admin, autor) antes de consultar o modificar datos.
- El frontend solo usa Supabase para autenticarse; nunca consulta tablas directo.
- No exponer `SUPABASE_SECRET_KEY` al frontend.

## Tablas

| Area | Tablas |
| --- | --- |
| Usuarios | `usuarios`, `usuario_preferencias_notificacion` |
| Viajes e integrantes | `grupos_viaje`, `grupo_miembros`, `grupo_invitaciones`, `grupo_solicitudes_union`, `admin_delegation_requests` |
| Itinerario | `itinerarios`, `actividades` |
| Finanzas | `expenses`, `expense_splits`, `settlement_payments`, `settlement_payment_documents` |
| Archivos y enlaces | `trip_documents`, `trip_context_links` |
| Comunicacion | `notificaciones`, `chat_mensajes` |

Buckets de Storage: `trip-documents` (10 MiB), `profile-avatars` (5 MiB), `public-assets`.

Borrar un viaje (`grupos_viaje`) elimina en cascada todo lo que cuelga de el. Los archivos del
bucket no se borran solos.

## Flujo de trabajo

Primera vez en una maquina (requiere acceso al proyecto en Supabase):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # pide la contrasena de la base de datos
```

Crear una migracion nueva:

```bash
npx supabase migration new descripcion_corta    # crea supabase/migrations/<timestamp>_descripcion_corta.sql
```

Probarla en local antes de subirla (levanta Postgres, Auth, REST y Storage en Docker):

```bash
SMTP_USER=local@example.com SMTP_PASS=x GOOGLE_CLIENT_SECRET=x npx supabase start \
  -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npx supabase db reset          # recrea la base local aplicando todas las migraciones
npx supabase stop --no-backup  # al terminar
```

`npx supabase status -o env` muestra las URLs y llaves locales para correr el backend y el smoke
test contra la pila local.

Aplicar al proyecto en la nube:

```bash
npx supabase db push           # aplica las migraciones pendientes
```

Cambios de Auth (URLs, SMTP, plantillas, proveedores OAuth) se editan en `supabase/config.toml`
y se aplican con `config push`. Los secretos se leen del entorno: `SMTP_USER` y `SMTP_PASS`
(los mismos de `backend/.env`) y `GOOGLE_CLIENT_SECRET` (en `supabase/.env`, que git ignora).

```bash
export SMTP_USER=... SMTP_PASS=... GOOGLE_CLIENT_SECRET=...
npx supabase config diff     # revisar qué cambiaría
npx supabase config push
```

Inicio de sesión con Google: el cliente OAuth vive en Google Cloud y su URI de redirección
autorizada es `https://<project-ref>.supabase.co/auth/v1/callback`. En el frontend los botones
se muestran solo si `VITE_OAUTH_PROVIDERS` los incluye (p. ej. `google`).

`deploy.sh` no toca la base de datos: las migraciones se aplican a mano con la CLI.

## Smoke test

`backend/scripts/smoke.mjs` crea tres usuarios de prueba, recorre los flujos principales (viaje,
integrantes, gastos, pagos, comprobantes, notificaciones, chat, enlace publico, RLS) y borra todo
al final.

```bash
cd backend
SMOKE_API_URL=https://traveling.tonyquezada.com/api npm run smoke   # usa SUPABASE_* de backend/.env
```

Los pasos marcados como "falla esperada hasta la fase N" dependen de codigo que todavia usa
tablas del Equipo 1 (ver [../plan-traveling.md](../plan-traveling.md)).

## Reglas para nuevas migraciones

- Una migracion por cambio, creada con `npx supabase migration new`.
- No editar migraciones ya aplicadas en la nube; crear una nueva.
- Incluir constraints cuando el dato tenga estados cerrados.
- Toda tabla nueva lleva `enable row level security` (los privilegios para `service_role` llegan
  solos por los default privileges).
- Actualizar servicios backend y tipos frontend si cambia el contrato.
- Actualizar [../api/endpoints.md](../api/endpoints.md) si cambia un payload visible.
- Probar en local (`db reset` + smoke test) antes de `db push`.
