#!/bin/sh
# Устанавливается в контейнере как /usr/local/bin/start-vnc — именно его
# вызывает CMD контейнера ("bash -lc \"/usr/local/bin/start-vnc; tail -f /dev/null\"").
# Сам подъём стека живёт в бинд-монтированном /work/gdlab/start-lab.sh, поэтому
# переживает и `docker restart`, и пересоздание контейнера из старого образа.
set -u
LAB=${LAB:-/work/gdlab/start-lab.sh}
LOG_DIR=${LOG_DIR:-/tmp/lab}
mkdir -p "$LOG_DIR"

if [ ! -f "$LAB" ]; then
  echo "start-vnc: нет $LAB (дерево проекта не примонтировано?)" >&2
  exit 1
fi

# Супервизор в фоне: CMD должен вернуться, чтобы контейнер не считался упавшим.
nohup bash "$LAB" --watch >"$LOG_DIR/watch.log" 2>&1 &
echo "start-vnc: супервизор стенда запущен (pid $!), лог $LOG_DIR/watch.log"
