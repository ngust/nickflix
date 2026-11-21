#!/usr/bin/env python3
"""NickFlix home buffering proxy (nfproxy) - stdlib only, Python 3.7+.

The TV talks only to this proxy on the LAN; this proxy is the ONLY client that talks to the IPTV provider
(1-connection accounts). Stream paths keep the Xtream layout, so the TV just swaps the host:

    TV  ->  http://<nas>:8765/live/<user>/<pass>/<id>.ts      (also .m3u8 is accepted; always answered as TS)
    TV  ->  http://<nas>:8765/movie/<user>/<pass>/<id>.<ext>  (Range supported)
    TV  ->  http://<nas>:8765/series/<user>/<pass>/<id>.<ext>
    proxy -> NF_UPSTREAM + same path                          (credentials stay in the TV's request; nothing stored here)

Live:  one upstream reader fills a RAM ring buffer (default 96 MB, ~60-90 s of HD). A TV connecting gets a burst of
       the last NF_LEAD seconds, so its own buffer fills at once and it plays NF_LEAD s behind live. If the provider
       drops, the reader reconnects with backoff (TS, falling back to the HLS playlist after repeated failures) while
       the TV keeps playing out of the ring - it only stalls if the outage is longer than the cushion.
       A TV reconnect to the same channel re-uses the running upstream (no new provider connection).
VOD:   resilient read-ahead: one upstream download runs ahead of the TV (NF_VOD_AHEAD MB); upstream drops are
       resumed with a Range request at the exact byte, invisible to the TV.
Single upstream: switching channel / starting a movie closes the old upstream first and waits NF_GAP seconds.
Idle:  upstream closes NF_IDLE seconds after the last TV client leaves.

GET /health -> ok        GET /status -> JSON (no credentials)

4.12 profile backup (NickFlix keeps its own copy on the TV; this is the off-TV backup):
    GET  /backup/profiles               -> latest backup JSON (404 if none)
    GET  /backup/profiles?file=<name>   -> one older rotated copy
    GET  /backup/profiles/list          -> metadata of all kept copies
    PUT|POST /backup/profiles[?force=1] -> store {"keys": {nf_*: "<raw localStorage string>"}, ...}
Files: NF_BACKUP_DIR (default <this dir>/backups/profiles): latest.json + profiles-YYYYmmdd-HHMMSS-mmm.json,
newest NF_BACKUP_KEEP (12) kept plus always the fullest one. A "default" state (one profile, no history) is never
stored over a real backup (409 default_over_real); a copy with fewer profiles and < 1/4 of the data is refused
(409 downgrade) unless ?force=1.
"""
import asyncio, bisect, hashlib, json, os, re, ssl, sys, time, urllib.parse

def env(k, d): return (os.environ.get(k, d) or d).split(" #")[0].strip() or d   # tolerate inline comments from env files
CFG = {
    "listen": env("NF_LISTEN", "0.0.0.0"), "port": int(env("NF_PORT", "8765")),
    "upstream": env("NF_UPSTREAM", "").rstrip("/"),          # e.g. http://provider.example:8080  (set in nfproxy.env, never committed)
    "lead": float(env("NF_LEAD", "20")),                     # seconds behind live handed to the TV as an initial burst
    "ring_mb": float(env("NF_RING_MB", "96")),
    "vod_ahead_mb": float(env("NF_VOD_AHEAD_MB", "160")),
    "gap": float(env("NF_GAP", "1.5")), "idle": float(env("NF_IDLE", "10")),
    "prefer": env("NF_PREFER", "ts"),                        # upstream format first: ts | hls
    "hls_variant": env("NF_HLS_VARIANT", "highest"),         # highest | lowest (when the provider playlist has several)
    "client_stall": float(env("NF_CLIENT_STALL", "75")),     # give up on a TV client if no data for this long
    "ua": env("NF_UA", ""), "log": env("NF_LOG", "info"),
    "backup_dir": env("NF_BACKUP_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups", "profiles")),
    "backup_keep": int(env("NF_BACKUP_KEEP", "12")), "backup_max": int(env("NF_BACKUP_MAX_MB", "8")) * 1048576,
}
CHUNK = 64 * 1024
TS = 188
def now(): return time.monotonic()
def redact(p): return re.sub(r"^/(live|movie|series)/[^/]+/[^/]+/", r"/\1/*/*/", p)
def log(*a):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)
STATS = {"started": time.time(), "upstream_opens": 0, "upstream_drops": 0, "client_conns": 0, "hls_fallbacks": 0, "vod_resumes": 0, "last_error": ""}

# ---------------------------------------------------------------- upstream HTTP
class Upstream:
    """One HTTP GET to the provider (follows redirects). Only ever created under GATE."""
    def __init__(self): self.r = self.w = None; self.status = 0; self.headers = {}
    async def open(self, url, rng=None, timeout=15):
        for _ in range(6):
            u = urllib.parse.urlsplit(url)
            port = u.port or (443 if u.scheme == "https" else 80)
            ctx = ssl.create_default_context() if u.scheme == "https" else None
            self.r, self.w = await asyncio.wait_for(asyncio.open_connection(u.hostname, port, ssl=ctx), timeout)
            path = (u.path or "/") + ("?" + u.query if u.query else "")
            h = "GET %s HTTP/1.1\r\nHost: %s\r\nConnection: close\r\nAccept: */*\r\n" % (path, u.netloc)
            if CFG["ua"]: h += "User-Agent: %s\r\n" % CFG["ua"]
            if rng is not None: h += "Range: bytes=%d-\r\n" % rng
            self.w.write((h + "\r\n").encode()); await self.w.drain()
            line = await asyncio.wait_for(self.r.readline(), timeout)
            m = re.match(rb"HTTP/\d\.\d (\d+)", line or b"")
            if not m: raise IOError("bad status line")
            self.status = int(m.group(1)); self.headers = {}
            while True:
                l = await asyncio.wait_for(self.r.readline(), timeout)
                if not l or l in (b"\r\n", b"\n"): break
                k, _, v = l.decode("latin-1").partition(":"); self.headers[k.strip().lower()] = v.strip()
            STATS["upstream_opens"] += 1
            if self.status in (301, 302, 303, 307, 308) and "location" in self.headers:
                url = urllib.parse.urljoin(url, self.headers["location"]); self.close(); continue
            if self.status >= 400: self.close(); raise IOError("HTTP %d" % self.status)
            self.chunked = "chunked" in self.headers.get("transfer-encoding", "").lower()
            return self
        raise IOError("too many redirects")
    async def read(self, n=CHUNK, timeout=20):
        if self.chunked:   # minimal chunked decoding (playlists / some servers)
            l = await asyncio.wait_for(self.r.readline(), timeout)
            size = int(l.strip().split(b";")[0] or b"0", 16)
            if size == 0: return b""
            d = await asyncio.wait_for(self.r.readexactly(size), timeout); await self.r.readline(); return d
        return await asyncio.wait_for(self.r.read(n), timeout)
    async def read_all(self, limit=4 << 20, timeout=20):
        out = b""
        while len(out) < limit:
            d = await self.read(CHUNK, timeout)
            if not d: break
            out += d
        return out
    def close(self):
        try:
            if self.w: self.w.close()
        except Exception: pass
        self.w = self.r = None

GATE = asyncio.Lock() if sys.version_info >= (3, 10) else None   # created in main() for older Pythons

# ---------------------------------------------------------------- live ring buffer
class Ring:
    def __init__(self, cap):
        self.cap = cap; self.chunks = []; self.offs = []; self.start = 0; self.end = 0; self.ev = asyncio.Event()
        self.rate = 0.0; self._rt = now(); self._rb = 0; self.last_data = now()
    def add(self, d):
        self.chunks.append((self.end, d)); self.offs.append(self.end); self.end += len(d); self.last_data = now(); self._rb += len(d)
        t = now()
        if t - self._rt >= 2:
            inst = self._rb / (t - self._rt); self.rate = inst if self.rate == 0 else self.rate * 0.8 + inst * 0.2
            self._rt = t; self._rb = 0
        while self.end - self.start > self.cap and len(self.chunks) > 1:
            o, c = self.chunks.pop(0); self.offs.pop(0); self.start = o + len(c)
        self.ev.set(); self.ev = asyncio.Event()
    def secs(self): return (self.end - self.start) / self.rate if self.rate > 0 else 0
    def get(self, pos):
        if pos < self.start: return None
        if pos >= self.end: return b""
        i = bisect.bisect_right(self.offs, pos) - 1
        o, c = self.chunks[i]
        return c[pos - o:]
    def aligned(self, pos):
        """first TS sync position >= pos (0x47 every 188 bytes, checked 3 times)"""
        k = max(0, bisect.bisect_right(self.offs, pos) - 1)
        for o, c in self.chunks[k:k + 64]:
            if o + len(c) <= pos: continue
            i = max(0, pos - o)
            while i + 2 * TS < len(c):
                if c[i] == 0x47 and c[i + TS] == 0x47 and c[i + 2 * TS] == 0x47: return o + i
                i += 1
        return pos

class Live:
    def __init__(self, key, path):
        self.key = key; self.path = path; self.ring = Ring(int(CFG["ring_mb"] * 1048576))
        self.clients = 0; self.idle_since = now(); self.task = None; self.mode = CFG["prefer"]; self.fails = 0
        self.up = None; self.closed = False; self.drops = 0; self.opened = time.time()
    def urls(self):
        base = CFG["upstream"] + re.sub(r"\.(ts|m3u8)$", "", self.path)
        return base + ".ts", base + ".m3u8"
    async def run(self):
        backoff = [0.5, 1, 2, 3, 5, 8, 10]
        while not self.closed:
            try:
                if self.mode == "hls": await self.run_hls()
                else: await self.run_ts()
                raise IOError("upstream ended")
            except asyncio.CancelledError:
                raise
            except Exception as e:
                if self.closed: break
                self.fails += 1; self.drops += 1; STATS["upstream_drops"] += 1; STATS["last_error"] = "%s: %s" % (self.mode, e)
                log("live", redact(self.path), self.mode, "drop:", e, "| cushion %.1fs" % self.ring.secs())
                if self.fails % 3 == 0:   # 3 failures in a row on one format -> try the other
                    self.mode = "hls" if self.mode == "ts" else "ts"; STATS["hls_fallbacks"] += self.mode == "hls"
                    log("live switch upstream format ->", self.mode)
                await asyncio.sleep(backoff[min(self.fails - 1, len(backoff) - 1)])
            finally:
                if self.up: self.up.close(); self.up = None
    async def run_ts(self):
        self.up = await Upstream().open(self.urls()[0])
        got = 0
        while not self.closed:
            d = await self.up.read(CHUNK, 20)
            if not d: return
            self.ring.add(d); got += len(d)
            if got > 2 << 20: self.fails = 0
    async def run_hls(self):
        url = self.urls()[1]; seen = set(); first = True
        while not self.closed:
            up = await Upstream().open(url); txt = (await up.read_all()).decode("utf-8", "replace"); up.close()
            if "#EXT-X-STREAM-INF" in txt:   # master playlist -> pick a variant
                vs = re.findall(r"#EXT-X-STREAM-INF:([^\n]*)\n([^\n#][^\n]*)", txt)
                vs = sorted(vs, key=lambda v: int((re.search(r"BANDWIDTH=(\d+)", v[0]) or [0, 0])[1]))
                if not vs: raise IOError("empty master playlist")
                url = urllib.parse.urljoin(url, (vs[-1] if CFG["hls_variant"] == "highest" else vs[0])[1].strip()); continue
            td = float((re.search(r"#EXT-X-TARGETDURATION:(\d+)", txt) or [0, 6])[1])
            segs = [urllib.parse.urljoin(url, l.strip()) for l in txt.splitlines() if l.strip() and not l.startswith("#")]
            if first: segs = segs[-3:]; first = False   # start near the live edge (the ring provides the delay)
            new = [s for s in segs if s not in seen]
            for s in new:
                seen.add(s)
                self.up = await Upstream().open(s)
                while True:
                    d = await self.up.read(CHUNK, 20)
                    if not d: break
                    self.ring.add(d)
                self.up.close(); self.up = None; self.fails = 0
            if len(seen) > 500: seen = set(segs)
            await asyncio.sleep(max(1.0, td / 2 if new else td / 3))
    def close(self):
        self.closed = True
        if self.task: self.task.cancel()
        if self.up: self.up.close()

STATE = {"live": None, "vod": None}

async def stop_all(reason):
    """close whatever upstream is open and wait NF_GAP so a 1-connection provider releases the slot"""
    had = False
    if STATE["live"]: STATE["live"].close(); STATE["live"] = None; had = True
    if STATE["vod"]: STATE["vod"].close(); STATE["vod"] = None; had = True
    if had:
        log("upstream closed:", reason); await asyncio.sleep(CFG["gap"])

async def get_live(path):
    key = re.sub(r"\.(ts|m3u8)$", "", path)
    L = STATE["live"]
    if L and L.key == key and not L.closed: return L
    async with GATE:
        L = STATE["live"]
        if L and L.key == key and not L.closed: return L
        await stop_all("switch to live " + redact(key))
        L = Live(key, path); STATE["live"] = L; L.task = asyncio.ensure_future(L.run())
        log("live open", redact(key))
        return L

async def serve_live(path, w):
    L = await get_live(path)
    L.clients += 1; STATS["client_conns"] += 1
    try:
        w.write(b"HTTP/1.1 200 OK\r\nContent-Type: video/mp2t\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n")
        t0 = now()
        while L.ring.end == L.ring.start and now() - t0 < 30 and not L.closed:   # fresh session: wait for first data
            try: await asyncio.wait_for(L.ring.ev.wait(), 1)
            except asyncio.TimeoutError: pass
        R = L.ring
        lead = int(R.rate * CFG["lead"]) if R.rate > 0 else (R.end - R.start)
        pos = R.aligned(max(R.start, R.end - lead))
        log("client live", redact(path), "start %.1fs behind live (cushion %.1fs)" % ((R.end - pos) / R.rate if R.rate else 0, R.secs()))
        quiet = now()
        while not L.closed or pos < R.end:
            d = R.get(pos)
            if d is None:   # fell off the back of the ring (client too slow) -> jump
                pos = R.aligned(R.start); continue
            if d:
                w.write(d); pos += len(d); quiet = now(); await w.drain(); continue
            if now() - quiet > CFG["client_stall"]: log("client live: no data for %ds, closing" % CFG["client_stall"]); break
            ev = R.ev
            try: await asyncio.wait_for(ev.wait(), 2)
            except asyncio.TimeoutError: pass
            if STATE["live"] is not L: break
    except (ConnectionError, asyncio.CancelledError, OSError):
        pass
    finally:
        L.clients -= 1; L.idle_since = now()

# ---------------------------------------------------------------- VOD read-ahead
class Vod:
    def __init__(self, path):
        self.path = path; self.url = CFG["upstream"] + path; self.size = None; self.ctype = "video/mp4"
        self.ws = 0; self.buf = bytearray(); self.want = 0; self.task = None; self.closed = False; self.up = None
        self.ev = asyncio.Event(); self.err = None; self.clients = 0; self.idle_since = now(); self.paused = False
    @property
    def we(self): return self.ws + len(self.buf)
    def notify(self): self.ev.set(); self.ev = asyncio.Event()
    async def start(self, off):
        had = self.up is not None
        if self.task: self.task.cancel()
        if self.up: self.up.close(); self.up = None
        if had: await asyncio.sleep(min(CFG["gap"], float(env("NF_SEEK_GAP", "0.4"))))   # let the provider see the close first (1 connection)
        self.ws = off; self.buf = bytearray(); self.want = off; self.err = None
        self.task = asyncio.ensure_future(self.run())
    async def run(self):
        backoff = [0.5, 1, 2, 4, 6, 8, 10]; fails = 0
        while not self.closed:
            try:
                if self.size is not None and self.we >= self.size: return
                self.up = await Upstream().open(self.url, rng=self.we)
                h = self.up.headers; self.ctype = h.get("content-type", self.ctype)
                m = re.search(r"/(\d+)", h.get("content-range", ""))
                if m: self.size = int(m.group(1))
                elif self.up.status == 200 and "content-length" in h:
                    if self.we != 0: raise IOError("provider ignores Range")
                    self.size = int(h["content-length"])
                while not self.closed:
                    ahead = self.we - self.want
                    if ahead > CFG["vod_ahead_mb"] * 1048576:   # far enough ahead: let TCP backpressure hold the provider
                        await asyncio.sleep(0.25); continue
                    d = await self.up.read(CHUNK, 25)
                    if not d: break
                    self.buf += d; fails = 0
                    keep = self.want - 8 * 1048576   # trim what the TV has already played (keep 8 MB for small seeks back)
                    if keep > self.ws: del self.buf[:keep - self.ws]; self.ws = keep
                    self.notify()
                self.up.close(); self.up = None
                if self.size is not None and self.we >= self.size: self.notify(); return
                raise IOError("upstream ended early")
            except asyncio.CancelledError:
                raise
            except Exception as e:
                if self.closed: return
                fails += 1; STATS["vod_resumes"] += 1; STATS["upstream_drops"] += 1; STATS["last_error"] = "vod: %s" % e
                log("vod", redact(self.path), "drop at %d:" % self.we, e)
                if self.up: self.up.close(); self.up = None
                if fails > 12: self.err = str(e); self.notify(); return
                await asyncio.sleep(backoff[min(fails - 1, len(backoff) - 1)])
    def close(self):
        self.closed = True
        if self.task: self.task.cancel()
        if self.up: self.up.close()
        self.notify()

async def serve_vod(path, headers, w):
    m = re.match(r"bytes=(\d*)-(\d*)", headers.get("range", ""))
    off = int(m.group(1)) if m and m.group(1) else 0
    endreq = int(m.group(2)) if m and m.group(2) else None
    async with GATE:
        V = STATE["vod"]
        if not V or V.path != path or V.closed:
            await stop_all("switch to vod " + redact(path))
            V = Vod(path); STATE["vod"] = V; await V.start(off)
        elif not (V.ws <= off <= V.we + 2 * 1048576):
            await V.start(off)   # seek outside the window: restart the single upstream at the new offset
    V.clients += 1; STATS["client_conns"] += 1
    try:
        t0 = now()
        while V.size is None and V.err is None and now() - t0 < 30:
            try: await asyncio.wait_for(V.ev.wait(), 1)
            except asyncio.TimeoutError: pass
        if V.err or V.size is None:
            w.write(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"); return
        last = min(endreq if endreq is not None else V.size - 1, V.size - 1)
        n = last - off + 1
        if m: hdr = "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes %d-%d/%d\r\n" % (off, last, V.size)
        else: hdr = "HTTP/1.1 200 OK\r\n"
        w.write((hdr + "Content-Type: %s\r\nContent-Length: %d\r\nAccept-Ranges: bytes\r\nConnection: close\r\n\r\n" % (V.ctype, n)).encode())
        pos = off; quiet = now()
        while pos <= last and not V.closed:
            V.want = pos
            if V.ws <= pos < V.we:
                d = bytes(V.buf[pos - V.ws: min(V.we, last + 1) - V.ws][:1 << 20])
                w.write(d); pos += len(d); quiet = now(); await w.drain(); continue
            if pos < V.ws or pos > V.we + 2 * 1048576:   # another request moved the window; follow this client
                async with GATE:
                    if STATE["vod"] is V and not (V.ws <= pos <= V.we): await V.start(pos)
            if V.err or now() - quiet > CFG["client_stall"]: break
            ev = V.ev
            try: await asyncio.wait_for(ev.wait(), 2)
            except asyncio.TimeoutError: pass
    except (ConnectionError, asyncio.CancelledError, OSError):
        pass
    finally:
        V.clients -= 1; V.idle_since = now()

# ---------------------------------------------------------------- 4.12 profile backup
BK_KEY = re.compile(r"^nf_[A-Za-z0-9_]{1,80}$")
BK_FILE = re.compile(r"^profiles-\d{8}-\d{6}-\d{3}\.json$")
CORS = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, PUT, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n"
def bk_info(keys):
    """same rule as NickFlix backup.js bkInfo: how much real user data a key set holds"""
    try: pl = (json.loads(keys.get("nf_profiles") or "null") or {}).get("list") or []
    except Exception: pl = []
    content = 0
    for k, v in keys.items():
        if not k.startswith("nf_p_"): continue
        try: d = json.loads(v) or {}
        except Exception: continue
        if not isinstance(d, dict): continue
        st = d.get("stats") or {}
        content += len(d.get("hist") or []) + len(d.get("wl") or []) + len(d.get("list") or []) + len(d.get("pos") or {}) + (1 if isinstance(st, dict) and (st.get("sec") or 0) > 0 else 0) + (len(d.get("rt") or {}) if isinstance(d.get("rt"), dict) else 0)
    names = [str(p.get("name", ""))[:40] for p in pl if isinstance(p, dict)]
    return {"profiles": len(pl), "names": names, "score": content + 5 * max(0, len(pl) - 1), "default": len(pl) <= 1 and content == 0}
def bk_read(name="latest.json"):
    try:
        with open(os.path.join(CFG["backup_dir"], name), "r", encoding="utf-8") as f: return json.load(f)
    except Exception: return None
def bk_write_atomic(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: f.write(data); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)
def bk_files():
    try: return sorted(n for n in os.listdir(CFG["backup_dir"]) if BK_FILE.match(n))
    except Exception: return []
def bk_rotate():
    names = bk_files()
    keep = set(names[-CFG["backup_keep"]:])
    best, bs = None, -1
    for n in names:
        m = (bk_read(n) or {}).get("meta") or {}
        if not m.get("default") and m.get("score", 0) >= bs: best, bs = n, m.get("score", 0)
    if best: keep.add(best)
    for n in names:
        if n not in keep:
            try: os.remove(os.path.join(CFG["backup_dir"], n))
            except Exception: pass
def bk_put(body, force):
    try: data = json.loads(body.decode("utf-8"))
    except Exception: return 400, {"ok": False, "reason": "bad_json"}
    keys = data.get("keys") if isinstance(data, dict) else None
    if not isinstance(keys, dict) or "nf_profiles" not in keys: return 400, {"ok": False, "reason": "no_keys"}
    keys = {k: v for k, v in keys.items() if isinstance(k, str) and BK_KEY.match(k) and isinstance(v, str) and k != "nf_account"}
    info = bk_info(keys)
    h = hashlib.sha256(json.dumps(keys, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:16]
    latest = bk_read(); lm = (latest or {}).get("meta") or {}
    if latest and lm.get("hash") == h: return 200, {"ok": True, "unchanged": True, "meta": lm}
    if latest and not lm.get("default"):
        if info["default"] or data.get("default") is True and lm.get("score", 0) > 0:
            return 409, {"ok": False, "reason": "default_over_real", "latest": lm}
        if not force and info["profiles"] < lm.get("profiles", 0) and info["score"] * 4 < lm.get("score", 0):
            return 409, {"ok": False, "reason": "downgrade", "latest": lm}
    t = time.time()
    name = time.strftime("profiles-%Y%m%d-%H%M%S", time.localtime(t)) + "-%03d.json" % int((t % 1) * 1000)
    meta = dict(info, ts=int(t * 1000), iso=time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(t)), hash=h, file=name,
                app=str(data.get("app", ""))[:10], client_default=bool(data.get("default")), forced=bool(force))
    tf = data.get("tvfile")
    if isinstance(tf, dict):   # the TV's own second copy (shared storage), as the app reported it
        meta["tvfile"] = {k: (str(tf.get(k))[:200] if k in ("path", "err") else tf.get(k)) for k in ("ok", "ts", "path", "err", "api") if k in tf}
    doc = json.dumps({"v": 1, "meta": meta, "keys": keys}, separators=(",", ":"))
    os.makedirs(CFG["backup_dir"], exist_ok=True)
    bk_write_atomic(os.path.join(CFG["backup_dir"], name), doc)
    bk_write_atomic(os.path.join(CFG["backup_dir"], "latest.json"), doc)
    bk_rotate()
    log("backup stored", name, "profiles=%d score=%d default=%s" % (info["profiles"], info["score"], info["default"]))
    return 200, {"ok": True, "meta": meta}
def reply(w, code, obj=None, raw=None):
    body = raw if raw is not None else json.dumps(obj).encode()
    txt = {200: "OK", 204: "No Content", 400: "Bad Request", 404: "Not Found", 409: "Conflict", 413: "Payload Too Large", 500: "Internal Server Error"}.get(code, "OK")
    w.write(("HTTP/1.1 %d %s\r\nContent-Type: application/json\r\n%sCache-Control: no-store\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % (code, txt, CORS, len(body))).encode() + body)
async def serve_backup(meth, target, headers, r, w):
    u = urllib.parse.urlsplit(target); q = urllib.parse.parse_qs(u.query)
    if meth == "OPTIONS": w.write(("HTTP/1.1 204 No Content\r\n%sContent-Length: 0\r\nConnection: close\r\n\r\n" % CORS).encode()); return
    if u.path == "/backup/profiles/list" and meth == "GET":
        return reply(w, 200, {"ok": True, "dir": CFG["backup_dir"], "files": [dict((bk_read(n) or {}).get("meta") or {}, file=n) for n in bk_files()]})
    if u.path != "/backup/profiles": return reply(w, 404, {"ok": False})
    if meth == "GET":
        f = (q.get("file") or ["latest.json"])[0]
        if f != "latest.json" and not BK_FILE.match(f): return reply(w, 404, {"ok": False})
        try:
            with open(os.path.join(CFG["backup_dir"], f), "rb") as fh: return reply(w, 200, raw=fh.read())
        except FileNotFoundError: return reply(w, 404, {"ok": False, "reason": "none"})
    if meth in ("PUT", "POST"):
        n = int(headers.get("content-length") or 0)
        if n <= 0 or n > CFG["backup_max"]: return reply(w, 413 if n > 0 else 400, {"ok": False, "reason": "size"})
        body = await asyncio.wait_for(r.readexactly(n), 30)
        try: code, obj = bk_put(body, (q.get("force") or ["0"])[0] == "1")
        except Exception as e:
            log("backup error:", type(e).__name__, e); code, obj = 500, {"ok": False, "reason": "server"}
        return reply(w, code, obj)
    return reply(w, 404, {"ok": False})

# ---------------------------------------------------------------- HTTP front
async def handle(r, w):
    try:
        line = await asyncio.wait_for(r.readline(), 15)
        parts = line.decode("latin-1").split()
        if len(parts) < 2: return
        meth, target = parts[0], parts[1]
        headers = {}
        while True:
            l = await asyncio.wait_for(r.readline(), 15)
            if not l or l in (b"\r\n", b"\n"): break
            k, _, v = l.decode("latin-1").partition(":"); headers[k.strip().lower()] = v.strip()
        path = urllib.parse.urlsplit(target).path
        if path == "/health":
            body = b"ok"; w.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 2\r\nConnection: close\r\n\r\n" + body); return
        if path == "/status":
            body = json.dumps(status(), indent=1).encode()
            w.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % len(body) + body); return
        if path.startswith("/backup/") or path == "/backup":
            await serve_backup(meth, target, headers, r, w); return
        if meth == "OPTIONS":
            w.write(("HTTP/1.1 204 No Content\r\n%sContent-Length: 0\r\nConnection: close\r\n\r\n" % CORS).encode()); return
        if meth not in ("GET", "HEAD") or not CFG["upstream"] or not re.match(r"^/(live|movie|series)/[^/]+/[^/]+/[\w.-]+$", path):
            w.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); return
        if path.startswith("/live/"): await serve_live(path, w)
        else: await serve_vod(path, headers, w)
    except Exception as e:
        if CFG["log"] == "debug": log("handler error:", e)
    finally:
        try: w.close()
        except Exception: pass

def status():
    L, V = STATE["live"], STATE["vod"]
    s = dict(STATS); s["uptime_s"] = int(time.time() - s.pop("started")); s["upstream_set"] = bool(CFG["upstream"])
    s["config"] = {k: CFG[k] for k in ("lead", "ring_mb", "vod_ahead_mb", "gap", "idle", "prefer", "hls_variant")}
    lm = (bk_read() or {}).get("meta") or {}
    s["backup"] = {"version": "4.12", "copies": len(bk_files()), "latest_ts": lm.get("ts"), "latest_profiles": lm.get("profiles"), "latest_default": lm.get("default")}
    if L: s["live"] = {"stream": redact(L.key), "mode": L.mode, "clients": L.clients, "cushion_s": round(L.ring.secs(), 1), "kbps": int(L.ring.rate * 8 / 1000), "drops": L.drops, "since_data_s": round(now() - L.ring.last_data, 1)}
    if V: s["vod"] = {"file": redact(V.path), "clients": V.clients, "ahead_mb": round((V.we - V.want) / 1048576, 1), "size_mb": round((V.size or 0) / 1048576, 1)}
    return s

async def reaper():
    while True:
        await asyncio.sleep(1)
        for k in ("live", "vod"):
            X = STATE[k]
            if X and X.clients <= 0 and now() - X.idle_since > CFG["idle"]:
                async with GATE:
                    if STATE[k] is X and X.clients <= 0:
                        X.close(); STATE[k] = None; log(k, "idle, upstream closed")

async def main():
    global GATE
    if GATE is None: GATE = asyncio.Lock()
    if not CFG["upstream"]: log("WARNING: NF_UPSTREAM not set - stream requests will 404 (health/status still work)")
    srv = await asyncio.start_server(handle, CFG["listen"], CFG["port"])
    log("nfproxy listening on %s:%d  lead=%ss ring=%sMB vod_ahead=%sMB prefer=%s" % (CFG["listen"], CFG["port"], CFG["lead"], CFG["ring_mb"], CFG["vod_ahead_mb"], CFG["prefer"]))
    asyncio.ensure_future(reaper())
    async with srv: await srv.serve_forever()

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
