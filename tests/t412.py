#!/usr/bin/env python3
"""NickFlix 4.12 test: profile backup (TV file via a fake tizen.filesystem + NAS via proxy/nfproxy.py).
    python3 tools/build.py --config <config with proxyUrls ["http://127.0.0.1:9939","http://127.0.0.1:9932"]> --out /tmp/nf412
    NF_APP=/tmp/nf412/app python3 tools/mock.py &  NF_PORT=9932 NF_BACKUP_DIR=/tmp/bk2 python3 proxy/nfproxy.py &
    python3 tests/t412.py
"""
import time, json, os, sys, urllib.request as U
SHOTS = os.environ.get('NF_SHOTS', '/tmp/nf_shots'); os.makedirs(SHOTS, exist_ok=True)
PX = os.environ.get('NF_PX', 'http://127.0.0.1:9932')
from playwright.sync_api import sync_playwright
FAKEFS = r'''
(function(){
  function db(){ try { return JSON.parse(localStorage.getItem("__fakefs")||"{}"); } catch(e){ return {}; } }
  function put(d){ localStorage.setItem("__fakefs", JSON.stringify(d)); }
  window.tizen = { filesystem: {
    pathExists: function(p){ var d=db(); return p in d || Object.keys(d).some(function(k){return k.indexOf(p+"/")===0;}) || (d.__dirs||[]).indexOf(p)>=0; },
    createDirectory: function(p, mk, ok, err){ if (/^downloads/.test(p) || window.__fsDeny) { setTimeout(function(){err({name:"SecurityError"});},0); return; } var d=db(); d.__dirs=(d.__dirs||[]).concat([p]); put(d); setTimeout(ok,0); },
    openFile: function(p, mode){ if (window.__fsDeny) throw {name:"SecurityError"}; var buf=""; if (mode==="r"){ var d=db(); if(!(p in d)) throw {name:"NotFoundError"}; buf=d[p]; }
      return { readString: function(){ return buf; }, writeString: function(s){ buf+=s; }, close: function(){ if(mode==="w"){ var d=db(); d[p]=buf; put(d);} } }; }
  } };
})();'''
def px(path, data=None, method=None):
    r = U.Request(PX + path, data=data, method=method or ('POST' if data else 'GET'))
    try: x = U.urlopen(r, timeout=5); return x.status, json.loads(x.read() or b'null')
    except U.HTTPError as e: return e.code, json.loads(e.read() or b'null')
RICH = {"nf_profiles": json.dumps({"list": [{"id": "p1", "name": "Nick", "av": 3}, {"id": "p2_x", "name": "Celia", "av": 40}], "last": "p1", "seq": 2}),
        "nf_p_p1": json.dumps({"st": {}, "hist": [{"k": "movies:1", "it": {"t": "movies", "id": 1, "n": "A"}, "ts": 1}], "pos": {}, "list": [], "stats": {"sec": 100}}),
        "nf_p_p2_x": json.dumps({"st": {}, "hist": [], "pos": {}, "list": [{"k": "movies:2", "it": {"t": "movies", "id": 2, "n": "B"}, "ts": 2}], "stats": {"sec": 0}}),
        "nf_intro": "0", "nf_mini": "0"}
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKEFS)
    ev = pg.evaluate
    # T1: wiped TV (no profiles), NAS has a real backup -> auto-restore + reload
    st, j = px('/backup/profiles', json.dumps({"keys": RICH}).encode()); res['seed_nas'] = st
    pg.goto('http://localhost:8099/index.html'); ev('()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0")}'); pg.reload(); time.sleep(16)
    res['T1_restored_profiles'] = ev('()=>profiles.list.map(function(p){return p.name}).join(",")')
    res['T1_where'] = ev('()=>bkMeta().restoredWhere')
    # T2: Back up now -> TV file + NAS
    ok = ev('()=>new Promise(function(r){bkUpload(true,function(a,b){r([a,b])})})'); time.sleep(0.5)
    res['T2_upload'] = ok; res['T2_file'] = ev('()=>bkMeta().fOk+" "+bkMeta().fPath')
    # T3: default state never overwrites the real NAS copy or the real TV file
    ev('()=>{var f=localStorage.getItem("__fakefs");localStorage.clear();localStorage.setItem("__fakefs",f);localStorage.setItem("nf_bk_meta",JSON.stringify({autoTry:Date.now()}));localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0")}')
    pg.reload(); time.sleep(10)
    res['T3_local'] = ev('()=>profiles.list.length')
    r3 = ev('()=>new Promise(function(r){bkUpload(false,function(a,b){r([a,b])})})'); time.sleep(0.5)
    res['T3_upload_refused'] = r3; res['T3_file_kept'] = ev('()=>{var f=bkFileLoad();return f&&f.profiles}')
    res['T3_nas_latest'] = px('/backup/profiles')[1]['meta']['profiles']
    # T4: TV file newer than NAS -> restored from the file
    ev('()=>{var f=JSON.parse(localStorage.getItem("__fakefs"));var k=Object.keys(f).filter(function(x){return /nf_backup.json$/.test(x)})[0];var j=JSON.parse(f[k]);j.ts=Date.now()+60000;var pr=JSON.parse(j.keys.nf_profiles);pr.list.push({id:"p3_y",name:"Guest",av:5});j.keys.nf_profiles=JSON.stringify(pr);f[k]=JSON.stringify(j);localStorage.setItem("__fakefs",JSON.stringify(f));localStorage.setItem("nf_bk_meta","{}")}')
    pg.reload(); time.sleep(16)
    res['T4_profiles'] = ev('()=>profiles.list.map(function(p){return p.name}).join(",")'); res['T4_where'] = ev('()=>bkMeta().restoredWhere')
    # T5: proxy unreachable -> silent failure, app still fine
    ev('()=>{NF_CONFIG.proxyUrls=["http://127.0.0.1:9939"]}')
    r5 = ev('()=>new Promise(function(r){bkUpload(true,function(a,b){r([a,b,bkMeta().err])})})'); res['T5_down'] = r5
    ev('()=>{NF_CONFIG.proxyUrls=["http://127.0.0.1:9939","http://127.0.0.1:9932"]}')
    # T6: Settings > App & intro rows
    pg.keyboard.press('Enter'); time.sleep(4)
    ev('()=>{openSettings(); ST.cat="app"; renderSettings();}'); time.sleep(2.5)
    pg.screenshot(path=SHOTS + '/t412_settings_app.png')
    res['T6_rows'] = ev('()=>Array.prototype.map.call(document.querySelectorAll(".s2-row"),function(r){return r.textContent.slice(0,140)}).filter(function(t){return /Back up|Restore/.test(t)})')
    res['errors'] = errs
    b.close()
print(json.dumps(res, indent=1))
