FROM node:24.19.0-bookworm

# Electron 44 (Chromium) runtime + Xvfb for headful runs, plus the toolchain
# node-gyp needs for the native modules in vendor/.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl rsync jq procps \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 \
    libnss3 libpangocairo-1.0-0 libsecret-1-0 libx11-xcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 libxss1 libxtst6 \
    xdg-utils \
    xvfb x11-utils x11vnc novnc websockify dbus dbus-x11 \
    fonts-liberation fonts-dejavu fonts-noto-color-emoji \
    libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

# A display is always on, so `electron` can open a window under Playwright
# without every caller remembering to start one. The liveness check goes
# through the X socket, not `pgrep`: after a container restart a defunct Xvfb
# zombie still matches `pgrep -x Xvfb` and hides the fact that nobody is
# listening.
RUN printf '%s\n' \
    '#!/bin/sh' \
    '[ -S /tmp/.X11-unix/X99 ] && exit 0' \
    'rm -f /tmp/.X99-lock' \
    'Xvfb :99 -screen 0 1600x1000x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &' \
    'for _ in $(seq 50); do [ -S /tmp/.X11-unix/X99 ] && exit 0; sleep 0.2; done' \
    'echo "Xvfb failed to start" >&2; exit 1' \
    > /usr/local/bin/start-x && chmod +x /usr/local/bin/start-x

# Mirror the X display into the browser: x11vnc listens on loopback only, and
# websockify serves the bundled noVNC client on 6080 (published to
# 127.0.0.1:6080 by lab.sh). Open http://localhost:6080/vnc.html to watch the
# GUI running inside the container.
RUN cat > /usr/local/bin/start-vnc <<'EOS' && chmod +x /usr/local/bin/start-vnc
#!/bin/sh
/usr/local/bin/start-x
pgrep -x x11vnc >/dev/null || \
  x11vnc -display :99 -rfbport 5900 -localhost -forever -shared -nopw \
    -bg -o /tmp/x11vnc.log
pgrep -f '[w]ebsockify' >/dev/null || \
  nohup websockify --web=/usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 \
    >/tmp/novnc.log 2>&1 &
for _ in $(seq 50); do
  curl -sf -o /dev/null http://127.0.0.1:6080/vnc.html && exit 0
  sleep 0.2
done
echo 'noVNC failed to start (see /tmp/x11vnc.log /tmp/novnc.log)' >&2
exit 1
EOS

WORKDIR /work

# Git fixture copies pick up 755 modes from the Windows bind mount, which makes
# test repos look dirty; force core.fileMode=false for every git invocation.
# core.autocrlf=true keeps the checkout byte-identical to the CRLF blobs in the
# Windows bind mount, so git status stays clean without rewriting files.
ENV DISPLAY=:99 \
    ELECTRON_DISABLE_SECURITY_WARNINGS=1 \
    GIT_CONFIG_COUNT=2 \
    GIT_CONFIG_KEY_0=core.fileMode \
    GIT_CONFIG_VALUE_0=false \
    GIT_CONFIG_KEY_1=core.autocrlf \
    GIT_CONFIG_VALUE_1=true

CMD ["bash", "-lc", "/usr/local/bin/start-vnc; tail -f /dev/null"]
