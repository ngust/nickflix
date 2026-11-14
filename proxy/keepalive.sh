#!/bin/sh
# nfproxy keep-alive: start the proxy if it is not answering /health. Run from cron every 5 minutes
# (this also brings it back within 5 minutes after a NAS reboot). Safe to run any time; never restarts a healthy proxy.
DIR="$(cd "$(dirname "$0")" && pwd)"
[ "$("$DIR/nfproxy.sh" health)" = "ok" ] && exit 0
echo "$(date '+%Y-%m-%d %H:%M:%S') keepalive: not healthy, starting" >> "$DIR/keepalive.log"
"$DIR/nfproxy.sh" start >> "$DIR/keepalive.log" 2>&1
