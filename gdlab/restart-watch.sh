#!/bin/bash
# Перезапуск супервизора стенда без самоубийства pkill: свой PID исключается.
LOG_DIR=${LOG_DIR:-/tmp/lab}
me=$$

find_watch() {
  for p in $(pgrep -f 'gdlab/start-lab.sh --watch'); do
    [ "$p" = "$me" ] && continue
    grep -qa 'start-lab.sh' "/proc/$p/cmdline" 2>/dev/null || continue
    case "$(tr '\0' ' ' </proc/$p/cmdline)" in
      *"bash -lc"*) continue ;;
    esac
    echo "$p"
  done
}

for p in $(find_watch); do
  echo "останавливаю супервизор pid=$p"
  kill "$p" 2>/dev/null
done
sleep 1
cd /work || exit 1
nohup bash gdlab/start-lab.sh --watch >"$LOG_DIR/watch.log" 2>&1 &
sleep 2
echo "новый супервизор:"
for p in $(find_watch); do echo "  pid=$p $(tr '\0' ' ' </proc/$p/cmdline)"; done
bash gdlab/start-lab.sh --status
