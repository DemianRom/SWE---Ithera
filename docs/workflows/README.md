# Workflows - Ithera

Este documento explica los workflows de GitHub Actions del repositorio. Sirve para saber que se ejecuta, cuando se ejecuta, que secrets requiere y como actuar si algo falla.

## Resumen

| Workflow | Archivo | Trigger | Objetivo |
| --- | --- | --- | --- |
| CI Backend | `.github/workflows/ci-backend.yml` | Pull request hacia `main` o `develop` | Validar backend con lint, type check, build y tests. |
| CI Frontend | `.github/workflows/ci-frontend.yml` | Pull request hacia `main` o `develop` | Validar frontend con lint, type check y build. |
| Deploy | `.github/workflows/deploy.yml` | Push a `main` o ejecucion manual | Desplegar backend y frontend en el servidor propio via SSH. |

## CI Backend

Archivo:

```text
.github/workflows/ci-backend.yml
```

Se ejecuta en pull requests hacia:

- `main`
- `develop`

Se dispara si cambian:

- `.github/workflows/**`
- `backend/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/**`

Pasos principales:

1. Checkout del repositorio.
2. Setup de Node.js 24.
3. Cache npm usando `backend/package-lock.json`.
4. `npm ci`.
5. `npm run lint`.
6. `npx tsc --noEmit`.
7. `npm run build`.
8. `npm test -- --runInBand`.

Variables de ambiente configuradas para CI:

```text
NODE_ENV=test
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SECRET_KEY=test-service-role-key
FRONTEND_URL=http://localhost:5173
PORT=3001
```

Notas:

- El lint de backend actualmente es placeholder en `backend/package.json`.
- Los tests corren con Jest y `--passWithNoTests`.
- Si se agrega una dependencia, actualizar `backend/package-lock.json`.

## CI Frontend

Archivo:

```text
.github/workflows/ci-frontend.yml
```

Se ejecuta en pull requests hacia:

- `main`
- `develop`

Se dispara si cambian:

- `.github/workflows/**`
- `frontend/**`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/**`

Pasos principales:

1. Checkout del repositorio.
2. Setup de Node.js 24.
3. Cache npm usando `frontend/package-lock.json`.
4. `npm ci`.
5. `npm run lint`.
6. `npx tsc --noEmit`.
7. `npm run build`.

Notas:

- `npm run build` ejecuta `tsc -b && vite build`.
- Errores de build suelen venir de tipos, imports rotos o variables mal usadas.
- Si se agrega una dependencia, actualizar `frontend/package-lock.json`.

## Deploy

Archivo:

```text
.github/workflows/deploy.yml
```

Se ejecuta cuando:

- Hay push a `main`.
- Alguien lo ejecuta manualmente con `workflow_dispatch`.

Pasos principales:

1. Validar que existan los secrets.
2. Escribir la llave privada y comprobar su huella publica contra la esperada.
3. Conectarse por SSH al servidor. La llave esta restringida en `authorized_keys` a ejecutar
   `deploy.sh --ssh`, que hace fast-forward a `origin/main` y reconstruye con `docker compose`
   solo los servicios que cambiaron.

Secrets requeridos:

| Secret | Uso |
| --- | --- |
| `DEPLOY_KEY` | Llave privada SSH exclusiva del deploy. |
| `DEPLOY_TARGET` | Destino SSH en formato `ssh://usuario@host:puerto`. |
| `DEPLOY_KNOWN_HOSTS` | Linea de `known_hosts` del servidor, para fijar su huella. |

Detalles del servidor, variables y como desplegar a mano: [../deploy/README.md](../deploy/README.md).

## Que hacer si falla un workflow

| Falla | Accion recomendada |
| --- | --- |
| `npm ci` | Revisar que `package-lock.json` corresponda a `package.json`. Ejecutar `npm install` en el paquete afectado y commitear lockfile. |
| `npm run lint` | Correr el lint local en `backend` o `frontend` y corregir errores reportados. |
| `npx tsc --noEmit` | Revisar archivo y linea del error de TypeScript. |
| `npm run build` | Verificar imports, tipos, variables de entorno y errores de Vite. |
| `npm test` | Reproducir local con `npm test -- --runInBand`. |
| Deploy: falta un secret o la huella no coincide | Revisar `DEPLOY_KEY`, `DEPLOY_TARGET` y `DEPLOY_KNOWN_HOSTS`. |
| Deploy: `deploy FALLÓ` | El build fallo en el servidor y sigue la version anterior; revisar el log del job y `docker compose logs`. |

## Reglas para modificar workflows

- Cambiar un workflow requiere PR y revision.
- Documentar el cambio en este archivo.
- No imprimir secrets en logs.
- Usar Node.js 24 para mantener consistencia con los Dockerfiles.
- Si se agrega un check requerido, actualizar reglas de branch protection y `CONTRIBUTING.md`.
- Si se agrega un nuevo secret, documentar nombre, uso y ambiente.

## Relacion con GitFlow

- Los PRs normales apuntan a `develop`.
- `ci-backend.yml` y `ci-frontend.yml` deben pasar antes de mergear.
- Produccion se despliega desde `main`: `develop` se integra a `main` al cerrar cada entrega.
