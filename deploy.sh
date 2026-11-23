#!/usr/bin/env bash
# Despliegue de Traveling en el servidor.
#
# Hace fast-forward de la copia local a origin/main y reconstruye solo los servicios
# cuyos archivos cambiaron desde el último deploy exitoso (guardado en .deployed-sha).
# Si un build falla, el contenedor anterior sigue arriba y el siguiente deploy lo reintenta.
#
#   ./deploy.sh          -> despliega solo si hay algo pendiente
#   ./deploy.sh --force  -> reconstruye ambos servicios aunque no haya cambios
#   ./deploy.sh --ssh    -> modo GitHub Actions: espera al deploy en curso y reporta siempre
#
# GitHub Actions lo ejecuta por SSH con una llave restringida a este script
# (ver docs/deploy/README.md).
set -uo pipefail

main() {
  cd "$(dirname "$(readlink -f "$0")")" || exit 1

  local branch=main force=false from_ssh=false arg
  for arg in "$@"; do
    case "$arg" in
      --force) force=true ;;
      --ssh)   from_ssh=true ;;
    esac
  done

  exec 9>.deploy.lock
  if $from_ssh; then
    # Desde Actions: esperar al deploy en curso para no perder el commit recién empujado.
    flock -w 900 9 || { log "timeout esperando otro deploy"; return 1; }
  else
    flock -n 9 || { log "ya hay un deploy en curso"; return 0; }
  fi

  if [[ "$(git rev-parse --abbrev-ref HEAD)" != "$branch" ]]; then
    log "la copia local no está en '$branch'; no se despliega"
    return 1
  fi

  if ! git fetch -q origin "$branch"; then
    log "git fetch falló"
    return 1
  fi

  local before after
  before=$(git rev-parse HEAD)
  if ! git merge -q --ff-only "origin/$branch"; then
    log "no se pudo hacer fast-forward a origin/$branch (¿cambios locales?)"
    return 1
  fi
  after=$(git rev-parse HEAD)
  [[ "$before" != "$after" ]] && log "${before:0:7} -> ${after:0:7}"

  local deployed changed to_build=()
  deployed=$(cat .deployed-sha 2>/dev/null || true)

  if $force || [[ -z "$deployed" ]]; then
    to_build=(traveling-api traveling-web)
  elif [[ "$deployed" != "$after" ]]; then
    if ! changed=$(git diff --name-only "$deployed" "$after" 2>/dev/null); then
      to_build=(traveling-api traveling-web)
    elif grep -qE '^(compose\.yaml|deploy\.sh)$' <<< "$changed"; then
      to_build=(traveling-api traveling-web)
    else
      grep -q '^backend/' <<< "$changed" && to_build+=(traveling-api)
      grep -q '^frontend/' <<< "$changed" && to_build+=(traveling-web)
    fi
    if grep -q '^supabase/' <<< "$changed"; then
      log "AVISO: cambió supabase/ (migraciones o config); este script no toca la BD: aplícalo con la Supabase CLI"
    fi
  fi

  if [[ ${#to_build[@]} -eq 0 ]]; then
    [[ "$deployed" != "$after" ]] && echo "$after" > .deployed-sha
    $from_ssh && log "nada que desplegar (${after:0:7} ya está desplegado)"
    return 0
  fi

  # Compose construye antes de recrear: si el build falla, sigue la versión anterior.
  log "desplegando ${after:0:7}: ${to_build[*]}"
  if docker compose up -d --build "${to_build[@]}"; then
    echo "$after" > .deployed-sha
    log "deploy OK"
    docker image prune -f --filter label=com.docker.compose.project=traveling >/dev/null
  else
    log "deploy FALLÓ (sigue corriendo la versión anterior)"
    return 1
  fi
}

log() { echo "$(date '+%F %T') $*"; }

# Todo vive en funciones para que bash lea el script completo antes de ejecutarlo:
# el fast-forward puede reescribir este mismo archivo.
main "$@"
exit $?
