"""End-to-end test: fake provider (drops) -> nfproxy -> simulated TV clients. Checks continuity, lead burst,
single upstream connection, VOD resume correctness, channel switch, idle close, HLS fallback."""
import json, os, socket, subprocess, sys, time, urllib.request
D = os.path.dirname(os.path.abspath(__file__)); P = os.path.dirname(D)
def get(url, t=5): return urllib.request.urlopen(url, timeout=t).read()
def start(env_extra, fp_env):
    fp = subprocess.Popen([sys.executable, D + "/fakeprov.py", "9911"], env=dict(os.environ, **fp_env), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    env = dict(os.environ, NF_UPSTREAM="http://127.0.0.1:9911", NF_PORT="9912", NF_LEAD="8", NF_IDLE="4", NF_GAP="0.5", **env_extra)
    px = subprocess.Popen([sys.executable, P + "/nfproxy.py"], env=env, stdout=open(D + "/proxy.log", "a"), stderr=subprocess.STDOUT)
    time.sleep(1.0); return fp, px
def stop(*ps):
    for p in ps: p.terminate(); p.wait()
def read_live(path, secs, rate_bps=250_000):
    """simulated TV: reads at real-time rate after an initial unlimited burst; returns (bytes, counters, max gap s, burst bytes in 1st s)"""
    s = socket.create_connection(("127.0.0.1", 9912)); s.sendall(("GET %s HTTP/1.1\r\nHost: x\r\n\r\n" % path).encode())
    buf = b""; t0 = time.time(); first = None; lastt = time.time(); gap = 0; burst = 0
    s.settimeout(2)
    while time.time() - t0 < secs:
        try: d = s.recv(65536)
        except socket.timeout: d = None
        if d is None: gap = max(gap, time.time() - lastt); continue
        if not d: break
        if first is None: first = time.time()
        gap = max(gap, time.time() - lastt); lastt = time.time(); buf += d
        if time.time() - first < 1: burst = len(buf)
        # consume at ~real time after the first second (TV playback)
        if time.time() - first > 1:
            ahead = len(buf) - burst - (time.time() - first - 1) * rate_bps
            if ahead > 0: time.sleep(min(0.5, ahead / rate_bps))
    s.close()
    body = buf.split(b"\r\n\r\n", 1)[1]
    i = body.find(b"\x47"); body = body[i:]
    cnt = [int.from_bytes(body[k + 1:k + 5], "big") for k in range(0, len(body) - 188, 188) if body[k] == 0x47]
    return len(body), cnt, gap, burst
res = {}
# ---- T1 live: provider drops every 12 s; TV must see a continuous counter-ordered stream with no long gap
fp, px = start({}, {"DROP_EVERY": "12"})
try:
    # warm-up: first client fills the ring, then leaves; a new client (TV reconnect) gets the burst
    read_live("/live/u/p/101.ts", 10)
    n, cnt, gap, burst = read_live("/live/u/p/101.ts", 40)
    back = sum(1 for a, b in zip(cnt, cnt[1:]) if b <= a)
    jumps = sum(1 for a, b in zip(cnt, cnt[1:]) if b > a + 1)
    st = json.loads(get("http://127.0.0.1:9912/status"))
    fs = json.loads(get("http://127.0.0.1:9911/stat"))
    res["T1"] = dict(bytes=n, packets=len(cnt), backwards=back, jumps=jumps, max_gap_s=round(gap, 2), burst_s=round(burst / 250000, 1),
                     upstream_drops=st["upstream_drops"], provider_max_concurrent=fs["max"], cushion=st.get("live", {}).get("cushion_s"))
    # ---- T2 switch channel: old upstream must close before new opens (max concurrent stays 1)
    n2, cnt2, _, _ = read_live("/live/u/p/202.ts", 6)
    fs = json.loads(get("http://127.0.0.1:9911/stat"))
    res["T2"] = dict(packets=len(cnt2), provider_max_concurrent=fs["max"])
    # ---- T3 idle close
    time.sleep(6); fs = json.loads(get("http://127.0.0.1:9911/stat")); st = json.loads(get("http://127.0.0.1:9912/status"))
    res["T3"] = dict(provider_open_now=fs["cur"], proxy_live=st.get("live"))
    # ---- T4 VOD: provider drops every 6 MB; proxy must deliver the exact 40 MB; then a Range seek
    t = time.time(); data = get("http://127.0.0.1:9912/movie/u/p/7.mp4", 120)
    ok = len(data) == 40 * 1048576 and all(data[i] == (i * 7) & 255 for i in range(0, len(data), 99991))
    req = urllib.request.Request("http://127.0.0.1:9912/movie/u/p/7.mp4", headers={"Range": "bytes=30000000-30000999"})
    r = urllib.request.urlopen(req, timeout=30); part = r.read()
    ok2 = r.status == 206 and len(part) == 1000 and all(part[i] == ((30000000 + i) * 7) & 255 for i in range(1000))
    st = json.loads(get("http://127.0.0.1:9912/status")); fs = json.loads(get("http://127.0.0.1:9911/stat"))
    res["T4"] = dict(full_ok=ok, secs=round(time.time() - t, 1), range_ok=ok2, vod_resumes=st["vod_resumes"], provider_max_concurrent=fs["max"])
finally:
    stop(px, fp)
# ---- T5 HLS fallback: .ts returns 404 three times -> proxy switches upstream to the m3u8, TV still gets TS
fp, px = start({}, {"TS_FAIL": "99", "DROP_EVERY": "30"})
try:
    n, cnt, gap, burst = read_live("/live/u/p/303.m3u8", 25)
    st = json.loads(get("http://127.0.0.1:9912/status")); fs = json.loads(get("http://127.0.0.1:9911/stat"))
    res["T5"] = dict(packets=len(cnt), mode=st.get("live", {}).get("mode"), hls_fallbacks=st["hls_fallbacks"], provider_max_concurrent=fs["max"], backwards=sum(1 for a, b in zip(cnt, cnt[1:]) if b <= a))
finally:
    stop(px, fp)
print(json.dumps(res, indent=1))
