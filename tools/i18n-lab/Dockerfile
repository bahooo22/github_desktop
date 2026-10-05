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
    xvfb x11-utils x11vnc dbus dbus-x11 \
    fonts-liberation fonts-dejavu fonts-noto-color-emoji \
    libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

# A display is always on, so `electron` can open a window under Playwright
# without every caller remembering to start one.
RUN printf '%s\n' \
    '#!/bin/sh' \
    'pgrep -x Xvfb >/dev/null && exit 0' \
    'Xvfb :99 -screen 0 1600x1000x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &' \
    'for _ in $(seq 50); do [ -S /tmp/.X11-unix/X99 ] && exit 0; sleep 0.2; done' \
    'echo "Xvfb failed to start" >&2; exit 1' \
    > /usr/local/bin/start-x && chmod +x /usr/local/bin/start-x

WORKDIR /work

# Git fixture copies pick up 755 modes from the Windows bind mount, which makes
# test repos look dirty; force core.fileMode=false for every git invocation.
ENV DISPLAY=:99 \
    ELECTRON_DISABLE_SECURITY_WARNINGS=1 \
    GIT_CONFIG_COUNT=1 \
    GIT_CONFIG_KEY_0=core.fileMode \
    GIT_CONFIG_VALUE_0=false

CMD ["bash", "-lc", "/usr/local/bin/start-x; tail -f /dev/null"]
