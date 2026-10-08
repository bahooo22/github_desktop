#!/bin/bash
# Релизная сборка форка одной командой.
#
# Использование: gdlab/release.sh [linux-portable|win-portable]
#
#   linux-portable (по умолчанию) — собирается здесь, в контейнере:
#     yarn build:prod (DESKTOP_SKIP_PACKAGE=1) → gdlab/assemble-linux-bundle.sh
#     → Release/desktop-linux-x64-portable.tar.gz
#
#   win-portable — ЗАПРЕЩЕНА: из Linux-дерева получается нерабочий бандл.
#     В out/ лежат нативные модули и бинарники, собранные под linux
#     (keytar.node, fs_admin.node, desktop-notifications.node,
#     desktop-trampoline/*, git/), а packager их не подменяет — он берёт то, что
#     уже лежит в node_modules целевой платформы. На Windows renderer падает на
#     require() нативного модуля, и приложение показывает пустое белое окно с
#     живым меню. Windows-релиз собирается только на windows-раннере:
#     gh workflow run release-fork-windows.yml -f arch=x64
set -euo pipefail

TARGET="${1:-linux-portable}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT/Release"

log() { printf '[release] %s\n' "$*"; }

if [ "$TARGET" = win-portable ]; then
  log "win-portable из Linux невозможна (см. комментарий в начале этого скрипта)."
  log "Запусти CI: gh workflow run release-fork-windows.yml -f arch=x64"
  exit 2
fi

[ "$TARGET" = linux-portable ] || { log "неизвестная цель: $TARGET"; exit 1; }
[ -d "$ROOT/node_modules" ] || { log "нет node_modules — запусти yarn install"; exit 1; }

log "yarn build:prod…"
# DeprecationWarning DEP0169/DEP0040 печатает вендоренный yarn (.yarnrc →
# vendor/yarn-1.21.1.js), а не наш код: build:prod вызывает copyDependencies,
# та — `yarn install` в out/. Коды гасятся повтором флага; запись через запятую
# node принимает, но игнорирует. Обоснование — комментарий к шагу установки в
# .github/workflows/release-fork-windows.yml.
export NODE_OPTIONS="--disable-warning=DEP0169 --disable-warning=DEP0040"
(cd "$ROOT" && RELEASE_CHANNEL=production DESKTOP_SKIP_PACKAGE=1 yarn build:prod)

log "сборка portable-бандла…"
bash "$ROOT/gdlab/assemble-linux-bundle.sh" "$ROOT"

mkdir -p "$RELEASE_DIR"
ARCHIVE="$RELEASE_DIR/desktop-linux-x64-portable.tar.gz"
log "архив → $ARCHIVE"
tar czf "$ARCHIVE" -C "$ROOT/dist" desktop-linux-x64

log "ГОТОВО: $ARCHIVE"
