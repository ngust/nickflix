#!/usr/bin/env bash
# NickFlix: run the whole Playwright suite against tools/mock.py (4.14). Usage: tests/run_all.sh [outdir]
# Needs python3 + playwright + Chrome (CHROME=/path, default /usr/bin/google-chrome). Logs go to $OUT/<test>.log.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="${1:-/tmp/nf_runall}"; mkdir -p "$OUT"
export NF_SHOTS="${NF_SHOTS:-$OUT/shots}"; mkdir -p "$NF_SHOTS"
cfg412="$OUT/config412.js"
sed 's#extraOrigins: \[\]#extraOrigins: [], proxyUrls: ["http://127.0.0.1:9939","http://127.0.0.1:9932"]#' "$ROOT/tests/config.test.js" > "$cfg412"
python3 "$ROOT/tools/build.py" --config "$ROOT/tests/config.test.js" --out "$OUT/dist" >/dev/null
python3 "$ROOT/tools/build.py" --config "$cfg412" --out "$OUT/dist412" >/dev/null
stopmock() { pkill -f "tools/mock.py" 2>/dev/null; pkill -f "proxy/nfproxy.py" 2>/dev/null; sleep 1; }
startmock() { stopmock; (cd "$ROOT" && env NF_APP="$1" ${2:+NF_FIXTURES=$2} python3 tools/mock.py >"$OUT/mock.log" 2>&1 &); sleep 1.5; }
res=()
run() { local t=$1; echo "== $t"; local d="$ROOT"; [ "$t" = tsc ] && d="$ROOT/tests"   # tsc.py reads tpb.py from its own folder
  (cd "$d" && timeout 600 python3 "$ROOT/tests/$t.py" ${2:-}) >"$OUT/$t.log" 2>&1; local rc=$?
  local v="rc=$rc"; grep -q '^PASS' "$OUT/$t.log" && v="PASS"; grep -q '^FAIL' "$OUT/$t.log" && v="FAIL"; res+=("$t: $v"); echo "   $v"; }
startmock "$OUT/dist/app"
for t in tall tav tcoll tnas tsc tsl tpb t410 t411 t413; do run $t; done
startmock "$OUT/dist412/app"; rm -rf /tmp/bk2; (cd "$ROOT" && NF_PORT=9932 NF_BACKUP_DIR=/tmp/bk2 python3 proxy/nfproxy.py >"$OUT/proxy.log" 2>&1 &); sleep 1.5
run t412
if [ -f "$ROOT/tests/t414.py" ]; then python3 "$ROOT/tests/t414.py" --fixtures /tmp/nf_fx414 --app "$OUT/dist/app" >/dev/null; startmock "$OUT/dist/app" "/tmp/nf_fx414"; run t414; fi
stopmock
printf '%s\n' "${res[@]}" | tee "$OUT/summary.txt"
