# Workflows de GitHub Actions - Traveling

Esta carpeta contiene los workflows de CI y el despliegue al servidor. Esta es solo una referencia rapida junto a los archivos `.yml`; la guia completa vive en [../../docs/workflows/README.md](../../docs/workflows/README.md).

## Resumen rapido

| Archivo | Cuando corre | Proposito |
| --- | --- | --- |
| `ci-backend.yml` | PR hacia `main` o `develop` con cambios relevantes | Valida backend: dependencias, lint, type check, build y tests. |
| `ci-frontend.yml` | PR hacia `main` o `develop` con cambios relevantes | Valida frontend: dependencias, lint, type check y build. |
| `deploy.yml` | Push a `main` o ejecucion manual | Despliega backend y frontend en el servidor via SSH (`deploy.sh`). |

## Secrets usados por el deploy

- `DEPLOY_KEY`
- `DEPLOY_TARGET`
- `DEPLOY_KNOWN_HOSTS`

## Regla de mantenimiento

Si cambias triggers, pasos, secrets o comportamiento de algun workflow, actualiza la guia completa en [../../docs/workflows/README.md](../../docs/workflows/README.md).
