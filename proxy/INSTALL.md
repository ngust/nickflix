# Installing nfproxy on a NAS (QNAP example)

The proxy never connects to the provider by itself - only when a TV/client requests a stream.
Install it on an always-on machine on the same LAN as the TV. Addresses below are examples.

## Container Station / Docker
1. Copy `Dockerfile`, `docker-compose.yml`, `nfproxy.py`, `nfproxy.sh` to e.g. `/share/Container/nfproxy/`.
2. Copy `nfproxy.env.example` to `nfproxy.env` next to them and fill in your provider address
   (provider login is not needed there; it stays on the TV). Never commit `nfproxy.env`.
3. `cd /share/Container/nfproxy && docker compose up -d --build`
4. Check without touching the provider: `curl http://192.168.1.50:8765/health` -> `ok`;
   `curl http://192.168.1.50:8765/status` -> JSON with `"upstream_set": true`.
   Firewall: allow TCP 8765 from the LAN only; do NOT port-forward it.

## Native (no containers)
Same files into e.g. `/share/homes/admin/nfproxy/`, then `./nfproxy.sh start`. Survive reboots with
QTS autorun.sh calling `nfproxy.sh start`.

`start_ui.py` is a small Windows helper that SSHes to the NAS and starts the proxy; set `NF_NAS_HOST`
and `NF_NAS_USER` first. The password is typed into its window, kept in memory only and never printed.

## Switching NickFlix over
1. Put your proxy URL(s) in `proxyUrls` in `config.js`, build and deploy.
2. Settings > Playback > Home buffering proxy -> On (shows "reachable").
3. Watch `/status`: `cushion_s` grows to 20 s+, `drops` counts provider drops the TV did not see.
4. To go back: toggle the setting Off (stop the proxy first if it is mid-stream).

## Rollback
`docker compose down` (or `./nfproxy.sh stop`) and set the NickFlix setting Off.
