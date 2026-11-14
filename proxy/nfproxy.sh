#!/bin/sh
# Native QTS start/stop (no Container Station). Python: system python3, Entware, or the portable runtime in ./runtime.
#   ./nfproxy.sh start|stop|status|restart|health
DIR="$(cd "$(dirname "$0")" && pwd)"; PID="$DIR/nfproxy.pid"; LOG="$DIR/nfproxy.log"
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  for c in "$DIR/runtime/bin/python3.12" "$DIR/runtime/bin/python3" "$(command -v python3 2>/dev/null)" /opt/bin/python3 /usr/local/bin/python3; do
    [ -n "$c" ] && [ -x "$c" ] && { PY="$c"; break; }
  done
fi
health() { "$PY" -c 'import urllib.request,sys
try: print(urllib.request.urlopen("http://127.0.0.1:%s/health" % sys.argv[1], timeout=3).read().decode())
except Exception: print("none")' "${NF_PORT:-8765}" 2>/dev/null; }
running() { [ -f "$PID" ] && kill -0 "$(tr -dc '0-9' < "$PID")" 2>/dev/null; }
case "$1" in
  start)
    if running && [ "$(health)" = "ok" ]; then echo "already running pid $(cat "$PID")"; exit 0; fi
    running && { kill "$(tr -dc '0-9' < "$PID")" 2>/dev/null; sleep 1; }
    [ -x "$PY" ] || { echo "python3 not found"; exit 1; }
    [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 5000000 ] && mv "$LOG" "$LOG.1"
    cd "$DIR" && "$PY" "$DIR/nflaunch.py" && sleep 2 && echo "health $(health)";;
  stop) running && kill "$(tr -dc '0-9' < "$PID")" 2>/dev/null; rm -f "$PID"; echo stopped;;
  status) running && echo "running pid $(cat "$PID") health $(health)" || echo "not running";;
  health) health;;
  restart) "$0" stop; sleep 1; "$0" start;;
  *) echo "usage: $0 start|stop|status|restart|health"; exit 1;;
esac
