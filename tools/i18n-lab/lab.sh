#!/usr/bin/env bash
# Idempotent setup + runner for the Linux workbench that builds and verifies
# this repository. All work happens inside the container; the host only
# provides the source bind mount.
set -euo pipefail

NAME=gdlab
IMAGE=gdlab-i18n:1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -W)"
REPO="$(cd "$HERE/../.." && pwd -W)"

# Cross-project helper scripts (the leak scanner and friends) live outside this
# repository. Mounting them read-only gives the container the same measures as the
# host, so a gate run and the commit scan happen in one shell. A machine without that
# directory still starts the lab, it just has to sync the scripts in itself.
GLM_SCRIPTS="${GLM_SCRIPTS:-$(cd "$REPO/../.." && pwd -W)/_work_with_llm/glm/scripts}"
EXTRA_MOUNTS=()
if [ -d "$GLM_SCRIPTS" ]; then
  EXTRA_MOUNTS=(-v "$GLM_SCRIPTS":/opt/glm-scripts:ro)
fi

case "${1:-up}" in
up)
  docker build -t "$IMAGE" "$HERE"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  for v in gdlab_nm_root gdlab_nm_app gdlab_out gdlab_cache; do
    docker volume create "$v" >/dev/null
  done
  docker run -d --name "$NAME" --hostname "$NAME" \
    --shm-size=2g \
    -p 127.0.0.1:6080:6080 \
    -v "$REPO":/work \
    -v gdlab_nm_root:/work/node_modules \
    -v gdlab_nm_app:/work/app/node_modules \
    -v gdlab_out:/work/out \
    -v gdlab_cache:/root/.cache \
    "${EXTRA_MOUNTS[@]}" \
    "$IMAGE"
  docker exec "$NAME" /usr/local/bin/start-x
  ;;
exec)
  shift
  # Git for Windows rewrites a lone `/work` into a host path before docker
  # ever sees it.
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
    docker exec -i -w /work "$NAME" bash -lc "$*"
  ;;
*)
  echo "usage: lab.sh [up|exec <cmd>]" >&2
  exit 2
  ;;
esac
