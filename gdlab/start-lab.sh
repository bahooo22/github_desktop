#!/bin/bash
# Подъём демо-стенда GitHub Desktop внутри контейнера gdlab.
# Идемпотентен: живой компонент не перезапускается, мёртвый поднимается заново.
#   ./start-lab.sh          один проход
#   ./start-lab.sh --status только состояние
#   ./start-lab.sh --watch  постоянный супервизор (перезапускает то, что умерло)
# Порядок: Xvfb :99 -> x11vnc :5900 -> websockify/noVNC :6080 -> приложение.
set -u

X_DISPLAY=:99
APP_BIN=${APP_BIN:-/work/dist/desktop-linux-x64/desktop}
APP_ARGS=${APP_ARGS:---no-sandbox --disable-gpu --disable-software-rasterizer --lang=ru-RU --remote-debugging-port=9222}
LOG_DIR=${LOG_DIR:-/tmp/lab}
NOVNC_PORT=${NOVNC_PORT:-6080}
VNC_PORT=${VNC_PORT:-5900}
CDP_URL=http://127.0.0.1:9222/json/version

mkdir -p "$LOG_DIR"

# Живость меряем по PID-файлу И по cmdline процесса, а не по наличию сокета
# X11: после `docker restart` в /tmp остаются мёртвые /tmp/.X99-lock и
# /tmp/.X11-unix/X99, и проверка по сокету молча выдаёт «всё уже работает»,
# из-за чего x11vnc стартовал на несуществующий дисплей. PID после рестарта
# может достаться чужому процессу, поэтому сверяем имя.
alive() {
  local pf=$1 tok=$2 pid
  [ -f "$pf" ] || return 1
  pid=$(cat "$pf" 2>/dev/null)
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  grep -qa "$tok" "/proc/$pid/cmdline" 2>/dev/null
}

start_x() {
  alive "$LOG_DIR/xvfb.pid" Xvfb && return 0
  rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
  Xvfb $X_DISPLAY -screen 0 1600x1000x24 -nolisten tcp \
    >"$LOG_DIR/xvfb.log" 2>&1 &
  echo $! >"$LOG_DIR/xvfb.pid"
  for _ in $(seq 50); do
    [ -S /tmp/.X11-unix/X99 ] && return 0
    sleep 0.2
  done
  echo "Xvfb не поднялся, см. $LOG_DIR/xvfb.log" >&2
  return 1
}

start_vnc() {
  alive "$LOG_DIR/x11vnc.pid" x11vnc && return 0
  # x11vnc 0.9.16 не знает опции -pid, поэтому PID пишет оболочка.
  nohup x11vnc -display $X_DISPLAY -rfbport $VNC_PORT -localhost -forever \
    -shared -nopw >"$LOG_DIR/x11vnc.log" 2>&1 &
  echo $! >"$LOG_DIR/x11vnc.pid"
  for _ in $(seq 50); do
    (exec 3<>/dev/tcp/127.0.0.1/$VNC_PORT) 2>/dev/null && return 0
    sleep 0.2
  done
  echo "x11vnc не слушает $VNC_PORT, см. $LOG_DIR/x11vnc.log" >&2
  return 1
}

start_novnc() {
  alive "$LOG_DIR/websockify.pid" websockify && return 0
  websockify --web=/usr/share/novnc 0.0.0.0:$NOVNC_PORT 127.0.0.1:$VNC_PORT \
    >"$LOG_DIR/novnc.log" 2>&1 &
  echo $! >"$LOG_DIR/websockify.pid"
  for _ in $(seq 50); do
    curl -sf -o /dev/null "http://127.0.0.1:$NOVNC_PORT/vnc.html" && return 0
    sleep 0.2
  done
  echo "noVNC не отдаёт $NOVNC_PORT, см. $LOG_DIR/novnc.log" >&2
  return 1
}

start_app() {
  alive "$LOG_DIR/desktop.pid" desktop && return 0
  [ -x "$APP_BIN" ] || { echo "нет бинарника $APP_BIN" >&2; return 1; }
  DISPLAY=$X_DISPLAY nohup "$APP_BIN" $APP_ARGS \
    >"$LOG_DIR/desktop.log" 2>&1 &
  echo $! >"$LOG_DIR/desktop.pid"
  return 0
}

kill_component() {
  local pf=$1
  alive "$pf" "${2:-}" || { rm -f "$pf"; return 0; }
  local pid
  pid=$(cat "$pf")
  kill "$pid" 2>/dev/null
  sleep 2
  kill -9 "$pid" 2>/dev/null
  rm -f "$pf"
}

# Приложение может жить процессом и не отвечать на клики (зависший рендерер).
# Проба CDP — доступный снаружи признак отзывчивости.
app_responsive() {
  alive "$LOG_DIR/desktop.pid" desktop || return 1
  curl -sf -m 5 -o /dev/null "$CDP_URL"
}

once() {
  # Компоненты поднимаются независимо: отказ одного не должен глушить остальные.
  local rc=0
  start_x || rc=1
  start_vnc || rc=1
  start_novnc || rc=1
  start_app || rc=1
  return $rc
}

status() {
  printf 'Xvfb        %s\n' "$(alive "$LOG_DIR/xvfb.pid" Xvfb && echo UP || echo DOWN)"
  printf 'x11vnc      %s\n' "$(alive "$LOG_DIR/x11vnc.pid" x11vnc && echo UP || echo DOWN)"
  printf 'websockify  %s\n' "$(alive "$LOG_DIR/websockify.pid" websockify && echo UP || echo DOWN)"
  printf 'desktop     %s\n' "$(alive "$LOG_DIR/desktop.pid" desktop && echo UP || echo DOWN)"
  printf 'vnc.html    %s\n' "$(curl -sf -o /dev/null "http://127.0.0.1:$NOVNC_PORT/vnc.html" && echo OK || echo FAIL)"
  printf 'CDP         %s\n' "$(curl -sf -m 5 -o /dev/null "$CDP_URL" && echo OK || echo FAIL)"
}

case "${1:-}" in
  --watch)
    while true; do
      once || true
      if ! app_responsive; then
        echo "$(date -Is) приложение не отвечает на CDP — перезапускаю" \
          >>"$LOG_DIR/watchdog.log"
        kill_component "$LOG_DIR/desktop.pid" desktop
        start_app || true
      fi
      sleep 10
    done
    ;;
  --status)
    status
    ;;
  --restart-app)
    kill_component "$LOG_DIR/desktop.pid" desktop
    start_app
    ;;
  *)
    once
    status
    ;;
esac
