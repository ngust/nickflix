#!/usr/bin/env python3
"""Build NickFlix: app/ + your private config -> dist/app and dist/nickflix.zip (unsigned; sign/package with Tizen CLI).

    python tools/build.py                       # uses private/config.js (+ private/nas_seed.js if present)
    python tools/build.py --config tests/config.test.js --out dist   # test build for tools/mock.py
"""
import argparse, os, re, shutil, zipfile, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--config', default=os.path.join(ROOT, 'private', 'config.js'))
ap.add_argument('--private', default=os.path.join(ROOT, 'private'))
ap.add_argument('--out', default=os.path.join(ROOT, 'dist'))
a = ap.parse_args()
if not os.path.exists(a.config):
    raise SystemExit('config not found: %s\nCopy app/js/config.example.js to private/config.js and fill it in.' % a.config)
cfg = open(a.config, encoding='utf-8').read()
def val(k):
    m = re.search(r'\b%s\s*:\s*"([^"]*)"' % k, cfg); return m.group(1) if m else ''
def origin(u):
    m = re.match(r'^(https?)://([^/:]+)(?::(\d+))?', u or '')
    if not m: return ''
    port = m.group(3)
    return '%s://%s%s' % (m.group(1), m.group(2), (':' + port) if port and port not in ('80', '443') else '')
origins = [origin(val('server')), origin(val('nasBase'))]
m = re.search(r'extraOrigins\s*:\s*\[([^\]]*)\]', cfg)
if m: origins += [origin(x) for x in re.findall(r'"([^"]+)"', m.group(1))]
m = re.search(r'proxyUrls\s*:\s*\[([^\]]*)\]', cfg)   # 4.10 home buffering proxy (nfproxy)
if m: origins += [origin(x) for x in re.findall(r'"([^"]+)"', m.group(1))]
origins = [o for i, o in enumerate(origins) if o and o not in origins[:i]]
dst = os.path.join(a.out, 'app')
shutil.rmtree(dst, ignore_errors=True); shutil.copytree(os.path.join(ROOT, 'app'), dst)
shutil.copy(a.config, os.path.join(dst, 'js', 'config.js'))
seed = os.path.join(a.private, 'nas_seed.js')
if os.path.exists(seed) and os.path.abspath(a.config).startswith(os.path.abspath(a.private)): shutil.copy(seed, os.path.join(dst, 'js', 'nas_seed.js'))
for junk in ('config.example.js',): 
    p = os.path.join(dst, 'js', junk)
    if os.path.exists(p): os.remove(p)
cx = os.path.join(dst, 'config.xml'); x = open(cx, encoding='utf-8').read()
ins = ''.join('    <access origin="%s" subdomains="true"/>\n' % o for o in origins)
x = x.replace('    <!-- build.py inserts <access> entries for your provider and NAS here -->\n', ins)
open(cx, 'w', encoding='utf-8').write(x)
zp = os.path.join(a.out, 'nickflix.zip')
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for r, d, f in os.walk(dst):
        for n in f: p = os.path.join(r, n); z.write(p, os.path.relpath(p, dst))
print('built %s (%d access origins added)' % (zp, len(origins)))
