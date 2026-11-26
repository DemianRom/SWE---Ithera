# Despliegue - Traveling

Traveling corre en un servidor propio con Docker Compose. El `compose.yaml` de la raiz del
repo levanta dos contenedores y el reverse proxy (Caddy) del servidor los publica en
`https://traveling.tonyquezada.com`.

```text
Navegador
  -> Cloudflare (proxy, CNAME traveling -> tonyquezada.com)
  -> Caddy del servidor (TLS)
       /api/*, /socket.io/*, /health  -> traveling-api:3001  (Express + Socket.IO)
       todo lo demas                  -> traveling-web:80    (nginx con el build de Vite)
  -> Supabase en la nube (base de datos, auth y archivos)
```

Caddy y los contenedores se comunican por la red externa de Docker `docker_proxy`; los
contenedores no publican puertos en el host.

## Archivos

| Archivo | Uso |
| --- | --- |
| `compose.yaml` | Servicios `traveling-api` y `traveling-web` (proyecto `traveling`). |
| `backend/Dockerfile` | Build de TypeScript y runtime en `node:24-slim`. |
| `frontend/Dockerfile` | Build de Vite y servidor `nginx:stable-alpine`. |
| `frontend/nginx.conf` | Fallback SPA a `index.html` y cache larga en `/assets`. |
| `deploy.sh` | Fast-forward a `origin/main` y reconstruccion de los servicios que cambiaron. |
| `.github/workflows/deploy.yml` | Ejecuta `deploy.sh` por SSH en cada push a `main`. |

## Variables

| Archivo (no se versiona) | Contenido |
| --- | --- |
| `.env` (raiz) | `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Son publicas: se incrustan en el bundle del frontend al construir. Plantilla: `.env.example`. |
| `backend/.env` | Configuracion y secretos del backend. Plantilla: `backend/.env.example`. En produccion: `NODE_ENV=production`, `PORT=3001`, `FRONTEND_URL=https://traveling.tonyquezada.com`. |

`VITE_API_URL` siempre es `/api` en el servidor (mismo dominio), por eso esta fijo en
`compose.yaml`.

## Servidor

- Copia de produccion: un clon del repo en la rama `main`, separado de cualquier copia de
  desarrollo, con sus propios `.env`.
- Caddy (fuera de este repo) tiene este bloque:

  ```text
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

- La llave de GitHub Actions esta restringida en `~/.ssh/authorized_keys` del servidor:

  ```text
  restrict,command="<ruta-del-clon>/deploy.sh --ssh" ssh-ed25519 AAAA... traveling-deploy (GitHub Actions)
  ```

## Desplegar

Automatico: cada push a `main` dispara `.github/workflows/deploy.yml`. Si solo cambian docs u
otros archivos fuera de `backend/` y `frontend/`, el job termina sin reconstruir nada. Para
relanzarlo sin un commit nuevo: *Actions -> Deploy -> Run workflow* (rama `main`). El commit
desplegado queda en `.deployed-sha` dentro de la copia de produccion.

Las variables `VITE_*` de `.env` se incrustan al construir el frontend: si solo cambia `.env`
(por ejemplo, la llave de Google Maps), hay que reconstruir a mano con `./deploy.sh --force`.

A mano, desde la copia de produccion:

```bash
./deploy.sh            # despliega si hay commits nuevos o un deploy anterior fallo
./deploy.sh --force    # reconstruye ambos servicios
docker compose ps      # estado y healthcheck
docker compose logs -f traveling-api
```

`deploy.sh` guarda en `.deployed-sha` el ultimo commit desplegado con exito. Si un build
falla, el contenedor anterior sigue corriendo y el siguiente deploy lo reintenta.

Los cambios de base de datos (`supabase/`) no se aplican con `deploy.sh`; se aplican con la
Supabase CLI (ver [../database/README.md](../database/README.md)).

## Verificacion

```bash
curl -s https://traveling.tonyquezada.com/health
curl -s -o /dev/null -w '%{http_code}\n' https://traveling.tonyquezada.com/my-trips          # 200 (SPA)
curl -s -o /dev/null -w '%{http_code}\n' 'https://traveling.tonyquezada.com/socket.io/?EIO=4&transport=polling'  # 200
```
