"""Local mock of an Xtream-codes style IPTV API + Twonky NAS feed, for testing NickFlix in desktop Chrome.

Serves the built app (dist/) on http://127.0.0.1:8099.  Build it first with a test config:
    python tools/build.py --config tests/config.test.js --out dist
    python tools/mock.py
Optional real-looking catalogue dumps can be dropped in $NF_FIXTURES (default tests/fixtures/):
    live_cats.json vod_cats.json series_cats.json live_streams.json vod_streams.json series.json nas_videos.json
Without them everything is synthesised.  /tmp/nas_down makes the NAS return 503, /tmp/nas_extra.json adds NAS files.
"""
import json, http.server, urllib.parse, os, random, time, urllib.request, base64
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.environ.get('NF_APP', os.path.join(ROOT, 'dist', 'app'))
FX = os.environ.get('NF_FIXTURES', os.path.join(ROOT, 'tests', 'fixtures'))
TEST_MP4 = os.environ.get('NF_TEST_MP4', os.path.join(FX, 'test.mp4'))
def fx(name, default):
    p = os.path.join(FX, name)
    return json.load(open(p)) if os.path.exists(p) else default
NOW = int(time.time())
CATS = {
  'get_live_categories': fx('live_cats.json', [{'category_id': str(i), 'category_name': n} for i, n in enumerate(['CA| NEWS', 'CA| SPORTS', 'US| ENTERTAINMENT', 'US| MOVIES', 'UK| GENERAL', 'US| KIDS', 'NHL GAMES', 'DOCUMENTARY'], 1)]),
  'get_vod_categories': fx('vod_cats.json', [{'category_id': str(100 + i), 'category_name': n} for i, n in enumerate(['EN - ACTION', 'EN - COMEDY', 'EN - DRAMA', 'EN - DOCUMENTARY', 'EN - HORROR', 'EN - NEW RELEASES'])]),
  'get_series_categories': fx('series_cats.json', [{'category_id': str(200 + i), 'category_name': n} for i, n in enumerate(['EN - DRAMA SERIES', 'EN - COMEDY SERIES', 'EN - DOCUSERIES', 'EN - REALITY'])]),
}
def by_cat(lst):
    d = {}
    for x in lst: d.setdefault(str(x['category_id']), []).append(x)
    return d
LS = fx('live_streams.json', None); BYC = by_cat(LS) if LS else {}
VB = by_cat(fx('vod_streams.json', [])); SB = by_cat(fx('series.json', []))
NASV = fx('nas_videos.json', [{'title': t, 'filename': '/mnt/array1/Movies/%s/%s.mkv' % (t, t), 'link': 'http://localhost:8099/nas/disk/%d.mkv' % i,
         'duration': '1:45:00', 'contentsize': '3000000000', 'resolution': '1920x1080', 'modificationTime': str(NOW - i * 86400)}
        for i, t in enumerate(['Night.Of.The.Living.Dead.1968.1080p', 'Nosferatu.1922.1080p', 'His.Girl.Friday.1940.720p', 'Charade.1963.1080p', 'Plan.9.From.Outer.Space.1957.1080p'])])
PX = {}
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=APP, **k)
    def log_message(s, *a): pass
    def js(s, d):
        body = d if isinstance(d, bytes) else json.dumps(d).encode()
        s.send_response(200); s.send_header('Content-Type', 'application/json'); s.send_header('Access-Control-Allow-Origin', '*'); s.end_headers(); s.wfile.write(body)
    def send_file(s, f):
        data = open(f, 'rb').read() if os.path.exists(f) else b''
        rng = s.headers.get('Range')
        if rng and data:
            a, _, b = rng.replace('bytes=', '').partition('-'); a = int(a); b = int(b) if b else len(data) - 1
            s.send_response(206); s.send_header('Content-Range', 'bytes %d-%d/%d' % (a, b, len(data))); chunk = data[a:b + 1]
        else: s.send_response(200); chunk = data
        s.send_header('Content-Type', 'video/mp4'); s.send_header('Accept-Ranges', 'bytes'); s.send_header('Content-Length', str(len(chunk))); s.end_headers(); s.wfile.write(chunk)
    def do_GET(s):
        u = urllib.parse.urlparse(s.path)
        if u.path.startswith('/px/'):   # NHL / ESPN passthrough (public APIs)
            nhl = u.path.startswith('/px/nhl')
            url = ('https://api-web.nhle.com/v1' if nhl else 'https://site.api.espn.com/apis/site/v2/sports') + u.path[len('/px/nhl' if nhl else '/px/espn'):] + ('?' + u.query if u.query else '')
            if url not in PX:
                try: PX[url] = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).read()
                except Exception: PX[url] = b'{}'
            return s.js(PX[url])
        if u.path == '/player_api.php':
            q = dict(urllib.parse.parse_qsl(u.query)); a = q.get('action')
            if not a: return s.js({'user_info': {'status': 'Active', 'max_connections': '1', 'active_cons': '0', 'allowed_output_formats': ['m3u8', 'ts']}, 'server_info': {'timezone': 'UTC'}})
            if a in CATS: return s.js(CATS[a])
            cid = int(q.get('category_id', '1') or 1); random.seed(cid); n = 0 if cid % 9 == 0 else random.randint(3, 60)
            if a == 'get_live_streams' and not q.get('category_id'):
                if LS: return s.js(LS)
                return s.js([{'name': 'US: Channel %d-%d' % (c, i), 'stream_id': c * 1000 + i, 'stream_icon': '', 'category_id': str(c)} for c in range(1, 9) for i in range(12)])
            if a == 'get_live_streams' and q.get('category_id') in BYC: d = BYC[q['category_id']]
            elif a == 'get_short_epg':
                t0 = (NOW // 1800) * 1800; sid = q.get('stream_id', '0')
                d = {'epg_listings': [{'title': base64.b64encode(('Programme %s-%d' % (sid[-3:], k)).encode()).decode(), 'start_timestamp': str(t0 + k * 1800), 'stop_timestamp': str(t0 + (k + 1) * 1800)} for k in range(3)]}
            elif a == 'get_live_streams': d = [{'name': 'US: Channel %d-%d' % (cid, i), 'stream_id': cid * 1000 + i, 'stream_icon': '' if i % 3 else 'http://localhost:8099/img/icon.png', 'category_id': str(cid)} for i in range(n)]
            elif a == 'get_vod_streams' and q.get('category_id') in VB: d = VB[q['category_id']]
            elif a == 'get_series' and q.get('category_id') in SB: d = SB[q['category_id']]
            elif a == 'get_vod_streams': d = [{'name': 'EN - Movie %d number %d (%d)' % (cid, i, 2018 + (i * 7 + cid) % 9), 'stream_id': cid * 1000 + i, 'stream_icon': '' if i % 4 == 1 else 'http://localhost:8099/img/icon.png', 'rating': str(round(5 + ((i * 13 + cid) % 45) / 10, 1)), 'added': str(NOW - ((i * 37 + cid * 11) % 300) * 86400), 'tmdb': str(5000 + cid * 100 + i) if i % 5 else '', 'container_extension': 'mkv'} for i in range(n)]
            elif a == 'get_series': d = [{'name': 'EN - Show %d-%d (2023)' % (cid, i), 'series_id': cid * 1000 + i, 'cover': 'http://localhost:8099/img/icon.png', 'plot': 'A plot.', 'genre': 'Drama / Crime', 'releaseDate': '2023-01-01', 'rating': str(round(6 + ((i * 7 + cid) % 35) / 10, 1)), 'last_modified': str(NOW - ((i * 17 + cid) % 200) * 43200), 'tmdb': str(9000 + cid * 100 + i), 'backdrop_path': ['http://localhost:8099/img/logo.png']} for i in range(n)]
            elif a == 'get_vod_info': d = {'info': {'plot': 'Long plot here ' * 10, 'genre': 'Action, Drama', 'cast': 'A, B', 'duration': '01:52:00', 'backdrop_path': ['http://localhost:8099/img/logo.png'], 'releasedate': '2024-03-01', 'tmdb_id': '12345', 'rating': 7.276, 'director': 'Jane Director', 'country': 'USA', 'age': '', 'imdb_id': None}}
            elif a == 'get_series_info': d = {'info': {'plot': 'Series plot'}, 'episodes': {'1': [{'id': '1%d' % i, 'episode_num': i + 1, 'title': 'Show - S01E%02d - Pilot %d' % (i + 1, i), 'container_extension': 'mkv', 'info': {'duration': '00:45:00'}} for i in range(12)], '2': [{'id': '2%d' % i, 'episode_num': i + 1, 'title': 'Ep %d' % i, 'container_extension': 'mp4'} for i in range(5)]}}
            else: d = []
            return s.js(d)
        if u.path.startswith('/nas/json/feed/'):
            q = dict(urllib.parse.parse_qsl(u.query)); st = int(q.get('start', 0)); n = int(q.get('count', 500))
            if os.path.exists('/tmp/nas_down'): s.send_response(503); s.end_headers(); return
            src = NASV + (json.load(open('/tmp/nas_extra.json')) if os.path.exists('/tmp/nas_extra.json') else [])
            body = json.dumps({'containerTitle': 'All Videos', 'containerContents': src[st:st + n]}).encode()
            s.send_response(200); s.send_header('Content-Type', 'text/plain'); s.end_headers(); s.wfile.write(body); return
        if u.path.startswith('/nas/disk/') or u.path.startswith('/movie/') or u.path.startswith('/series/'):
            return s.send_file(TEST_MP4)
        if u.path.startswith('/js/') and u.path.endswith('.js'):   # route sports APIs through the local proxy
            body = open(APP + u.path, 'rb').read().replace(b'https://api-web.nhle.com/v1', b'http://localhost:8099/px/nhl').replace(b'https://site.api.espn.com/apis/site/v2/sports', b'http://localhost:8099/px/espn')
            s.send_response(200); s.send_header('Content-Type', 'application/javascript'); s.end_headers(); s.wfile.write(body); return
        return super().do_GET()
if __name__ == '__main__':
    print('NickFlix mock on http://127.0.0.1:8099  (app: %s)' % APP)
    http.server.ThreadingHTTPServer(('127.0.0.1', 8099), H).serve_forever()
