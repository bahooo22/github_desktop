#!/bin/bash
# Сборка linux/x64 portable без @electron/packager.
#
# Повод: packager в локальном контейнере неработоспособен — вложенный
# @electron/asar объявляет glob@^13, а yarn --frozen-lockfile эту копию не
# материализует. Здесь повторяется ровно то, что делает packager для linux:
# runtime Electron из node_modules/electron/dist + resources/app из out/.
#
# Имя бандля и исполняемого файла — апстримные: getExecutableName() на linux
# возвращает 'desktop' (script/dist-info.ts).
set -euo pipefail

ROOT="${1:-$PWD}"
RUNTIME="${2:-$ROOT/node_modules/electron/dist}"
NAME="desktop"
DEST="$ROOT/dist/$NAME-linux-x64"

[ -f "$RUNTIME/electron" ] || { echo "нет electron-runtimes в $RUNTIME"; exit 1; }
[ -f "$ROOT/out/main.js" ] || { echo "нет собранного out/ в $ROOT — сначала yarn build:prod"; exit 1; }

rm -rf "$DEST"
mkdir -p "$DEST/resources"

echo "=== 1. electron runtime (без default_app и старого resources/app) ==="
for f in "$RUNTIME"/*; do
  cp -r "$f" "$DEST/$(basename "$f")"
done
for f in "$RUNTIME"/resources/*; do
  case "$(basename "$f")" in
    app|default_app.asar) continue ;;
  esac
  cp -r "$f" "$DEST/resources/"
done

echo "=== 2. исполняемый файл ==="
cp "$RUNTIME/electron" "$DEST/$NAME"
chmod +x "$DEST/$NAME"
# chrome-sandbox требует setuid root; в tar-архиве права сохраняются, но на
# чужой машине их всё равно приходится выставлять вручную.
[ -f "$RUNTIME/chrome-sandbox" ] && chmod 4755 "$DEST/chrome-sandbox" 2>/dev/null || true

echo "=== 3. resources/app из собранного out/ ==="
mkdir -p "$DEST/resources/app"
cp -r "$ROOT/out/." "$DEST/resources/app/"

echo "=== 4. проверки бандла ==="
echo "-- версия electron: $(cat "$DEST/version")"
echo "-- размер: $(du -sh "$DEST" | cut -f1), файлов: $(find "$DEST" -type f | wc -l)"
echo "-- нативные модули должны быть ELF:"
file -b "$DEST/resources/app/keytar.node" | cut -c1-30
echo "-- localhost в index.html (ожидаем 0): $(grep -c 'localhost:3000' "$DEST/resources/app/index.html" || true)"
echo "-- фид форка: $(grep -o -m1 'github.com/bahooo22/github_desktop/releases/download/[a-z0-9-]*' "$DEST/resources/app/renderer.js" | head -1)"
echo "ASSEMBLED: $DEST"
