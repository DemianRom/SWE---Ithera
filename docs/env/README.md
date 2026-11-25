# Variables de entorno - Traveling

Esta guia centraliza las variables del backend, el frontend, Docker Compose, la Supabase CLI y
GitHub Actions.

## Reglas

- No subir archivos `.env` (estan en `.gitignore`).
- Las variables `VITE_*` son publicas: terminan dentro del bundle del navegador.
- La `SUPABASE_SECRET_KEY` solo vive en el backend.
- Los secretos de CI/CD se guardan en GitHub (Settings -> Secrets and variables -> Actions).
- Toda variable nueva se documenta aqui y en el `.env.example` que corresponda.

## Backend (`backend/.env`)

Plantilla: `backend/.env.example`. En produccion el archivo vive en el servidor
(`~/traveling/backend/.env`) y Docker Compose lo pasa al contenedor `traveling-api`.

| Variable | Requerida | Descripcion |
| --- | --- | --- |
| `SUPABASE_URL` | Si | URL del proyecto de Supabase. |
| `SUPABASE_ANON_KEY` | Si | Llave publicable (`sb_publishable_...`); se usa para validar sesiones. |
| `SUPABASE_SECRET_KEY` | Si | Llave secreta (`sb_secret_...`); acceso completo a la base y a Storage. |
| `PORT` | No | Puerto HTTP y de Socket.IO. Default `3001`. |
| `NODE_ENV` | No | `development` o `production`. |
| `FRONTEND_URL` | No | Origen permitido por CORS y base de los enlaces en correos. Default `http://localhost:5173`. |
| `SHARE_LINK_SECRET` | En produccion | Firma los enlaces publicos del itinerario (`openssl rand -hex 32`). |
| `SMTP_HOST` | Para correo | Servidor SMTP, por ejemplo `smtp.gmail.com`. |
| `SMTP_PORT` | No | Default `587`. |
| `SMTP_USER` | Para correo | Cuenta SMTP. |
| `SMTP_PASS` | Para correo | Contrasena de aplicacion. |
| `MAIL_FROM` | Para correo | `Nombre <cuenta@dominio>`; en Gmail debe ser la misma cuenta que `SMTP_USER`. |

Sin las variables `SMTP_*` el backend arranca, pero los correos de invitacion fallan.

## Frontend (`frontend/.env`)

Plantilla: `frontend/.env.example`. Solo para desarrollo con `npm run dev`.

| Variable | Requerida | Descripcion |
| --- | --- | --- |
| `VITE_API_URL` | Si | Base de la API, por ejemplo `http://localhost:3001/api`. |
| `VITE_SUPABASE_URL` | Si | URL del proyecto de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Si | Llave publicable de Supabase. |
| `VITE_OAUTH_PROVIDERS` | No | Proveedores sociales habilitados, separados por coma (por ejemplo `google`). Vacio = solo correo. |

## Docker Compose (`.env` en la raiz)

Plantilla: `.env.example`. Compose pasa estos valores como build args al construir
`traveling-web`; `VITE_API_URL` queda fijo en `/api` porque Caddy enruta por ruta en el mismo
dominio.

| Variable | Descripcion |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Llave publicable. |
| `VITE_OAUTH_PROVIDERS` | Igual que en el frontend. |

## Supabase CLI (`supabase/config.toml`)

`npx supabase config push` lee estos secretos del entorno; no se guardan en el repo.

| Variable | Descripcion |
| --- | --- |
| `SMTP_USER`, `SMTP_PASS` | SMTP de los correos de Auth (codigos OTP y recuperacion). |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth de Google. Se guarda en `supabase/.env` (ignorado por git). |

## GitHub Actions

Secrets usados por `.github/workflows/deploy.yml`:

| Secret | Descripcion |
| --- | --- |
| `DEPLOY_KEY` | Llave privada SSH restringida a ejecutar `deploy.sh` en el servidor. |
| `DEPLOY_TARGET` | Destino SSH, por ejemplo `ssh://usuario@host:puerto`. |
| `DEPLOY_KNOWN_HOSTS` | Huella del servidor para `known_hosts`. |

Los workflows de CI (`ci-backend.yml`, `ci-frontend.yml`) no usan secretos.

## Cambios de variables

1. Agregar la variable al `.env.example` correspondiente sin valores reales.
2. Documentarla en esta guia.
3. Si afecta produccion, agregarla en el servidor (o en GitHub si la usa un workflow).
4. Avisar en el PR si requiere accion manual.
