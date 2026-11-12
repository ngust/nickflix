#!/bin/sh
# Native QTS start/stop (no Container Station): needs Python 3.7+ (QTS "Python3" QPKG or Entware python3).
#   ./nfproxy.sh start|stop|status|restart
DIR="$(cd "$(dirname "$0")" && pwd)"; PID="$DIR/nfproxy.pid"; LOG="$DIR/nfproxy.log"
PY="${PYTHON:-$(command -v python3 || ls /opt/bin/python3 /usr/local/bin/python3 2>/dev/null | head -1)}"
case "$1" in
  start)
    [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null && { echo "already running"; exit 0; }
    [ -x "$PY" ] || { echo "python3 not found (install the Python3 QPKG or Entware python3, or use Container Station)"; exit 1; }
    set -a; . "$DIR/nfproxy.env"; set +a
    [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 5000000 ] && mv "$LOG" "$LOG.1"
    nohup "$PY" -u "$DIR/nfproxy.py" >> "$LOG" 2>&1 & echo $! > "$PID"; echo "started pid $(cat "$PID")";;
  stop) [ -f "$PID" ] && kill "$(cat "$PID")" 2>/dev/null; rm -f "$PID"; echo stopped;;
  status) [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null && echo "running pid $(cat "$PID")" || echo "not running";;
  restart) "$0" stop; sleep 1; "$0" start;;
  *) echo "usage: $0 start|stop|status|restart"; exit 1;;
esac
