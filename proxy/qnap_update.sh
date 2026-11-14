# Update nfproxy in place on a QNAP (run over SSH: ssh user@nas "bash -s" < qnap_update.sh, with payload.tgz.b64 = base64 of a tar.gz of nfproxy.py nfproxy.sh nflaunch.py keepalive.sh in the proxy dir).
# Backs up the old files to bak-<time>/, swaps only when no stream is active, rolls back if /health fails, then installs the keep-alive cron line.
set +e
log() { printf 'NF:%s\n' "$1"; }
DIR=/share/General/nfproxy
cd "$DIR" || { log "FAIL no dir"; exit 3; }
log "id=$(id)"
TS=$(date +%Y%m%d-%H%M%S)
PY=$DIR/runtime/bin/python3.12; [ -x "$PY" ] || PY=$DIR/runtime/bin/python3
st=$("$PY" -c 'import urllib.request;print(urllib.request.urlopen("http://127.0.0.1:8765/status",timeout=3).read().decode())' 2>/dev/null)
case "$st" in *'"live"'*|*'"vod"'*) BUSY=1; log "BUSY stream active - files staged, no restart";; *) BUSY=0;; esac
mkdir -p "bak-$TS" && cp -p nfproxy.py nfproxy.sh "bak-$TS/" 2>/dev/null; log "backup_dir=$DIR/bak-$TS"
mkdir -p stage412 && cat payload.tgz.b64 | "$PY" -c 'import base64,sys;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' | tar -xzf - -C stage412 || { log "FAIL extract"; exit 4; }
"$PY" -m py_compile stage412/nfproxy.py stage412/nflaunch.py || { log "FAIL compile"; exit 5; }
if [ "$BUSY" = 0 ]; then
  for f in nfproxy.py nfproxy.sh nflaunch.py keepalive.sh; do cp stage412/$f ./$f; done; chmod 755 nfproxy.sh keepalive.sh nflaunch.py
  mkdir -p backups/profiles
  ./nfproxy.sh stop >/dev/null; sleep 1; ./nfproxy.sh start
  sleep 2; h=$(./nfproxy.sh health); log "health=$h"
  if [ "$h" != "ok" ]; then log "ROLLBACK"; cp -p "bak-$TS/nfproxy.py" ./nfproxy.py; PYTHON=$PY ./nfproxy.sh start; log "health_after_rollback=$(./nfproxy.sh health)"; exit 6; fi
  b=$("$PY" -c 'import urllib.request,json;print(json.loads(urllib.request.urlopen("http://127.0.0.1:8765/status",timeout=3).read()).get("backup"))' 2>/dev/null); log "status_backup=$b"
fi
# ---- autostart: keep-alive every 5 minutes (also restarts within 5 min after a NAS reboot)
LINE="*/5 * * * * $DIR/keepalive.sh >/dev/null 2>&1 # nfproxy-keepalive"
log "groups=$(id -Gn)"
DONE=""
if [ -w /etc/config/crontab ]; then
  grep -q nfproxy-keepalive /etc/config/crontab || { cp -p /etc/config/crontab "$DIR/bak-$TS/etc-config-crontab"; echo "$LINE" >> /etc/config/crontab; }
  crontab /etc/config/crontab && /etc/init.d/crond.sh restart >/dev/null 2>&1; DONE="system /etc/config/crontab"
elif sudo -n true 2>/dev/null; then
  sudo -n sh -c "grep -q nfproxy-keepalive /etc/config/crontab || { cp -p /etc/config/crontab '$DIR/bak-$TS/etc-config-crontab'; echo '$LINE' >> /etc/config/crontab; }; crontab /etc/config/crontab; /etc/init.d/crond.sh restart" >/dev/null 2>&1 && DONE="system /etc/config/crontab via sudo"
fi
if [ -z "$DONE" ]; then
  cur=$(crontab -l 2>/dev/null)
  if echo "$cur" | grep -q nfproxy-keepalive; then DONE="user crontab (already)"; else
    { [ -n "$cur" ] && echo "$cur"; echo "$LINE"; } | crontab - 2>/tmp/nfct.err && DONE="user crontab"; log "user_crontab_err=$(head -c 200 /tmp/nfct.err)"; fi
  [ -n "$DONE" ] && log "user_crontab_now=$(crontab -l 2>/dev/null | grep nfproxy-keepalive)"
  [ -w /opt/etc/init.d ] && log "entware_initd_writable=yes" || log "entware_initd_writable=no"
fi
log "autostart=${DONE:-NONE}"
{ echo "nfproxy autostart, set up $TS by Coder Bot (NickFlix 4.12)"; echo "method: ${DONE:-NONE}"; echo "line: $LINE"; echo "undo: remove the line tagged nfproxy-keepalive (crontab -e, or /etc/config/crontab then 'crontab /etc/config/crontab')"; echo "file backup: $DIR/bak-$TS"; } > AUTOSTART.txt
ls -la backups/profiles 2>/dev/null | head -5 | tr '\n' '|' | sed 's/^/NF:ls=/'; echo
log "SUCCESS"
