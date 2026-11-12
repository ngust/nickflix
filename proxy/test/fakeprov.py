"""Fake Xtream-like provider for nfproxy tests (no real IPTV). Enforces/records 1-connection behaviour.
live TS: ~2 Mbps of 188-byte packets (sync 0x47, 4-byte counter), drops the connection every DROP_EVERY s.
movie:   40 MB deterministic file with Range; drops after 6 MB of each response."""
import asyncio, os, re, sys, time, json
RATE = 250_000                      # bytes/s (~2 Mbps)
DROP_EVERY = float(os.environ.get("DROP_EVERY", "12"))
TS_FAIL = int(os.environ.get("TS_FAIL", "0"))       # make the first N .ts opens fail (404) to force HLS fallback
STAT = {"cur": 0, "max": 0, "opens": 0, "ts404": 0, "kinds": []}
SIZE = 40 * 1048576
T0 = time.time()
def pkt(n): return b"\x47" + (n & 0xFFFFFFFF).to_bytes(4, "big") + bytes(183)
def filebyte(off, n): return bytes(((off + i) * 7) & 255 for i in range(n))
async def handle(r, w):
    line = (await r.readline()).decode(); hdr = {}
    while True:
        l = await r.readline()
        if l in (b"\r\n", b"\n", b""): break
        k, _, v = l.decode().partition(":"); hdr[k.strip().lower()] = v.strip()
    path = line.split()[1]
    if path == "/stat":
        b = json.dumps(STAT).encode(); w.write(b"HTTP/1.1 200 OK\r\nContent-Length: %d\r\n\r\n" % len(b) + b); await w.drain(); w.close(); return
    STAT["cur"] += 1; STAT["opens"] += 1; STAT["max"] = max(STAT["max"], STAT["cur"]); STAT["kinds"].append(path.split("/")[1] + path[-4:])
    try:
        if "seg_" in path:
            s = int(re.search(r"seg_(\d+)", path).group(1)); n0 = int((s * 4 - T0) * RATE / 188)
            data = b"".join(pkt(n0 + i) for i in range(4 * RATE // 188))
            w.write(b"HTTP/1.1 200 OK\r\nContent-Type: video/mp2t\r\nContent-Length: %d\r\n\r\n" % len(data) + data)
        elif path.endswith(".ts") and "/live/" in path:
            if STAT["ts404"] < TS_FAIL:
                STAT["ts404"] += 1; w.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"); await w.drain(); return
            w.write(b"HTTP/1.1 200 OK\r\nContent-Type: video/mp2t\r\n\r\n")
            n = int((time.time() - T0) * RATE / 188); t0 = time.time()
            while time.time() - t0 < DROP_EVERY:
                w.write(b"".join(pkt(n + i) for i in range(133))); n += 133; await w.drain(); await asyncio.sleep(133 * 188 / RATE)
        elif path.endswith(".m3u8"):
            seq = int(time.time() / 4)
            body = "#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:%d\n" % (seq - 4) + "".join("#EXTINF:4,\nseg_%d.ts\n" % s for s in range(seq - 4, seq))
            w.write(("HTTP/1.1 200 OK\r\nContent-Type: application/vnd.apple.mpegurl\r\nContent-Length: %d\r\n\r\n" % len(body)).encode() + body.encode())
        elif "seg_" in path:
            s = int(re.search(r"seg_(\d+)", path).group(1)); n0 = s * 4 * RATE // 188
            data = b"".join(pkt(n0 + i) for i in range(4 * RATE // 188))
            w.write(b"HTTP/1.1 200 OK\r\nContent-Type: video/mp2t\r\nContent-Length: %d\r\n\r\n" % len(data) + data)
        elif "/movie/" in path:
            m = re.match(r"bytes=(\d+)-", hdr.get("range", "")); off = int(m.group(1)) if m else 0
            n = SIZE - off
            w.write((("HTTP/1.1 206 Partial Content\r\nContent-Range: bytes %d-%d/%d\r\n" % (off, SIZE - 1, SIZE)) if m else "HTTP/1.1 200 OK\r\n").encode()
                    + b"Content-Type: video/mp4\r\nContent-Length: %d\r\n\r\n" % n)
            sent = 0
            while sent < n and sent < 6 * 1048576:
                k = min(256 * 1024, n - sent); w.write(filebyte(off + sent, k)); sent += k; await w.drain(); await asyncio.sleep(0.01)
        else:
            w.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
        await w.drain()
    except Exception:
        pass
    finally:
        STAT["cur"] -= 1
        try: w.close()
        except Exception: pass
async def main():
    s = await asyncio.start_server(handle, "127.0.0.1", int(sys.argv[1] if len(sys.argv) > 1 else 9911))
    async with s: await s.serve_forever()
asyncio.run(main())
