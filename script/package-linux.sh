#!/bin/bash
# Собирает .deb и AppImage из готового portable-бандла.
#
# Бандл делает gdlab/assemble-linux-bundle.sh (или @electron/packager на CI):
# runtime Electron + resources/app из out/. Здесь к нему добавляются метаданные
# установки: путь /opt, команда github-l10n, .desktop-файл и иконка.
#
#   script/package-linux.sh dist/desktop-linux-x64 [output-dir] [appimagetool]
#
# appimagetool нужен только для AppImage; без него собирается один .deb.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE="${1:-$ROOT/dist/desktop-linux-x64}"
OUT="${2:-$ROOT/dist}"
APPIMAGETOOL="${3:-$(command -v appimagetool || true)}"

PACKAGE="github-desktop-l10n"
COMMAND="github-l10n"
DISPLAY_NAME="GitHub Desktop L10n"
ICON="$ROOT/app/static/linux/icon-logo.png"
VERSION="$(node -p "require('$ROOT/app/package.json').version")"
# Debian sorts a tilde before the release, so a beta never looks newer than the
# final build with the same base version.
DEB_VERSION="${VERSION/-/\~}"
ARCH="amd64"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -x "$BUNDLE/desktop" ] || {
  echo "нет готового бандла: $BUNDLE/desktop" >&2
  exit 1
}
[ -f "$ICON" ] || {
  echo "нет иконки: $ICON" >&2
  exit 1
}
BUNDLE="$(cd "$BUNDLE" && pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

install -d "$WORK/deb/DEBIAN" \
  "$WORK/deb/opt/$PACKAGE" \
  "$WORK/deb/usr/bin" \
  "$WORK/deb/usr/share/applications" \
  "$WORK/deb/usr/share/icons/hicolor/512x512/apps" \
  "$WORK/deb/usr/share/doc/$PACKAGE"

cp -a "$BUNDLE/." "$WORK/deb/opt/$PACKAGE/"
# Squirrel's Windows installer is irrelevant here, but Electron's own sandbox
# helper still needs its setuid bit when the app is started as a normal user.
chmod 4755 "$WORK/deb/opt/$PACKAGE/chrome-sandbox" 2>/dev/null || true
ln -s "/opt/$PACKAGE/desktop" "$WORK/deb/usr/bin/$COMMAND"
install -m 0644 "$ICON" \
  "$WORK/deb/usr/share/icons/hicolor/512x512/apps/$PACKAGE.png"

cat > "$WORK/deb/usr/share/applications/$PACKAGE.desktop" <<EOF
[Desktop Entry]
Name=$DISPLAY_NAME
Comment=GitHub Desktop with a localized interface
Exec=$COMMAND %U
Terminal=false
Type=Application
Icon=$PACKAGE
StartupWMClass=desktop
Categories=Development;
EOF

cat > "$WORK/deb/usr/share/doc/$PACKAGE/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: GitHub Desktop
Source: https://github.com/bahooo22/github_desktop

Files: *
Copyright: GitHub, Inc. and contributors
License: MIT
EOF

INSTALLED_SIZE="$(du -sk "$WORK/deb/opt/$PACKAGE" | cut -f1)"
cat > "$WORK/deb/DEBIAN/control" <<EOF
Package: $PACKAGE
Version: $DEB_VERSION
Section: vcs
Priority: optional
Architecture: $ARCH
Maintainer: BaHooo <160755864+bahooo22@users.noreply.github.com>
Installed-Size: $INSTALLED_SIZE
Depends: libgtk-3-0 | libgtk-3-0t64, libnss3, libasound2 | libasound2t64, libgbm1, libxss1, libxtst6, libatspi2.0-0 | libatspi2.0-0t64, libnotify4, libsecret-1-0, libcups2 | libcups2t64, libatk1.0-0 | libatk1.0-0t64, libglib2.0-0 | libglib2.0-0t64, libdrm2, libxkbcommon0, libx11-xcb1, libxcb-dri3-0, xdg-utils
Homepage: https://github.com/bahooo22/github_desktop
Description: GitHub Desktop with a localized interface
 GitHub Desktop fork with Russian, Ukrainian, Latin, Esperanto,
 Klingon and Quenya interface catalogs and a built-in translation editor.
EOF

DEB="$OUT/${PACKAGE}.deb"
dpkg-deb --root-owner-group --build "$WORK/deb" "$DEB" >/dev/null
test -s "$DEB"
echo "DEB: $DEB"

if [ -z "$APPIMAGETOOL" ]; then
  echo "appimagetool не найден — AppImage пропущен" >&2
  exit 0
fi

APPDIR="$WORK/AppDir"
install -d "$APPDIR/usr/bin" "$APPDIR/usr/lib/$PACKAGE"
cp -a "$BUNDLE/." "$APPDIR/usr/lib/$PACKAGE/"
ln -s "../lib/$PACKAGE/desktop" "$APPDIR/usr/bin/$COMMAND"
install -m 0644 "$ICON" "$APPDIR/$PACKAGE.png"

cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/lib/github-desktop-l10n/desktop" "$@"
EOF
chmod +x "$APPDIR/AppRun"

cat > "$APPDIR/$PACKAGE.desktop" <<EOF
[Desktop Entry]
Name=$DISPLAY_NAME
Comment=GitHub Desktop with a localized interface
Exec=$COMMAND %U
Terminal=false
Type=Application
Icon=$PACKAGE
StartupWMClass=desktop
Categories=Development;
EOF

APPIMAGE="$OUT/GitHubDesktopL10n-x86_64.AppImage"
# appimagetool writes the .zsync next to its working directory, not next to the
# AppImage it was given; running it from OUT keeps both artifacts together.
(
  cd "$OUT"
  ARCH=x86_64 "$APPIMAGETOOL" --no-appstream \
    -u "gh-releases-zsync|bahooo22|github_desktop|latest-linux-x64|GitHubDesktopL10n-x86_64.AppImage.zsync" \
    "$APPDIR" "$APPIMAGE" >/dev/null
)
test -s "$APPIMAGE"
test -s "$APPIMAGE.zsync"
grep -aq "Filename: GitHubDesktopL10n-x86_64.AppImage" "$APPIMAGE.zsync"
echo "APPIMAGE: $APPIMAGE"
echo "ZSYNC: $APPIMAGE.zsync"
