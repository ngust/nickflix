# nfproxy – NickFlix home buffering proxy

A tiny always-on service for a NAS on the home network. The TV streams from the NAS; the NAS is the **only**
client of the IPTV provider (fits 1-connection accounts) and absorbs provider drops with a big local buffer.

```
TV (NickFlix 4.10, Settings > Playback > Home buffering proxy: On)
  └─ http://<nas>:8765/live|movie|series/<user>/<pass>/<id>.<ext>   (LAN)
       nfproxy  ── one connection ──>  provider (NF_UPSTREAM)
```

## What it does
| | |
|---|---|
| **Live** | One upstream reader fills a RAM ring (default 96 MB ≈ 60–90 s HD). A TV that connects gets the last `NF_LEAD` (20) s as an instant burst, so its own buffer is full at once and it plays ~20 s behind live. Provider drop → reconnect with backoff (0.5…10 s) while the TV keeps playing out of the ring. 3 failures in a row on TS → switch upstream to HLS (segments are fed into the same TS stream), and back. TV reconnects to the same channel re-use the running upstream. |
| **VOD** | Read-ahead download (`NF_VOD_AHEAD_MB`, 160 MB) ahead of the TV; upstream drops resume with `Range` at the exact byte; TV seeks inside the window are served locally, seeks outside restart the single upstream. |
| **1 connection** | Global lock: switching channel / starting a movie closes the old upstream, waits `NF_GAP`, then opens the new one. Idle `NF_IDLE` s after the TV leaves → upstream closed. Nothing is fetched until the TV asks. |
| **Safety** | Only `/live/`, `/movie/`, `/series/` paths to the fixed `NF_UPSTREAM` host are relayed (not an open proxy). Credentials are part of the TV's request path and are never stored or logged (logs show `/live/*/*/<id>`). |
| **Status** | `GET /health` → `ok`; `GET /status` → JSON (cushion seconds, kbps, drops, mode, clients). |

Stdlib-only Python 3.7+, single file. Memory ≈ ring + VOD read-ahead + ~30 MB.

## Install
* **Container Station (preferred):** copy this folder to the NAS (e.g. `/share/Container/nfproxy`), create
  `nfproxy.env` from `nfproxy.env.example`, then `docker compose up -d --build` (or Container Station →
  Applications → Create → paste `docker-compose.yml`).
* **Native:** Python3 QPKG/Entware python3 → `./nfproxy.sh start` (add to QTS autorun for reboot survival).

Then in NickFlix put the address in `config.js` → `proxyUrls: ["http://<nas>:8765"]`, rebuild, and switch
**Settings › Playback › Home buffering proxy** to On. If the proxy stops answering, NickFlix plays direct.

## Test (no real IPTV)
`python3 test/test_proxy.py` – fake provider that drops live every 12 s and VOD every 6 MB, enforces/records
concurrent connections. Expect: continuous live stream, ≤1 provider connection, exact VOD bytes, HLS fallback.
