#!/usr/bin/env python3
"""NickFlix 4.15 test: "Never show" (hate) rating, no NAS titles on Movies / Shows, prestige collections (daily, taste
weighted), taste seed v2 (documentaries / motorsport / mountain biking / Quebec penalty), new themes.
Uses the 4.14 synthetic catalogue (tests/t414.py fixtures):
    python3 tools/build.py --config tests/config.test.js --out /tmp/nf415
    python3 tests/t414.py --fixtures /tmp/nf_fx414 --app /tmp/nf415/app
    NF_APP=/tmp/nf415/app NF_FIXTURES=/tmp/nf_fx414 python3 tools/mock.py &
    python3 tests/t415.py                       # screenshots -> $NF_SHOTS (default /tmp/nf_shots), v415_*.png
"""
import time, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 't414.py'), encoding='utf-8').read()
ns = {'__name__': 't414fx'}
exec(src.split('# ---------------------------------------------------------------- test')[0].replace("if '--fixtures' in sys.argv:", "if False:"), ns)
SHOTS, BASE, NOW = ns['SHOTS'], ns['BASE'], ns['NOW']
t414 = src.split('# ---------------------------------------------------------------- test')[1]
FAKE = t414.split("FAKE = r'''")[1].split("'''")[0]
from playwright.sync_api import sync_playwright
R = {}; ok = True
def chk(name, cond, info=None):
    global ok; R[name] = bool(cond) if info is None else [bool(cond), info]; ok = ok and bool(cond)
NASIT = {"t": "movies", "id": "nas~themovie", "nas": 1, "k": "themovie", "n": "My NAS Movie", "y": "2001", "ic": ""}
HIST = {"st": {}, "hist": [{"k": "movies:999001", "it": {"t": "movies", "id": 999001, "n": "Old Movie", "c": "107"}, "ts": NOW * 1000 - 86400000},
                          {"k": "movies:nas~themovie", "it": NASIT, "ts": NOW * 1000 - 3600000}],
        "pos": {"movies:nas~themovie": {"t": 600000, "d": 7200000, "ts": NOW * 1000 - 3600000, "it": NASIT}}, "list": [{"k": "movies:nas~themovie", "it": NASIT, "ts": NOW * 1000}],
        "wl": [{"k": "movies:999001", "t": "movie", "n": "Old Movie", "cats": ["Drama", "Movies"], "cc": "", "min": 80, "fr": 1, "ts": NOW * 1000 - 86400000, "st": NOW * 1000 - 90000000, "it": {"t": "movies", "id": 999001, "n": "Old Movie", "c": "107"}}],
        "stats": {"sec": 4800, "titles": {}, "gen": {}, "ch": {}, "chn": {}, "types": {}}}
ALLITEMS = '()=>V.rows.filter(r=>r.items).map(r=>r.items.map(i=>i.n)).reduce((a,b)=>a.concat(b),[])'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome')); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE); ev = pg.evaluate
    pg.add_init_script('''if(!sessionStorage.getItem("__t415")){sessionStorage.setItem("__t415","1");localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0");
      localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0},{id:"p2",name:"Celia",av:5}],last:"p1",seq:2}));
      localStorage.setItem("nf_p_p1",%s);}''' % json.dumps(json.dumps(HIST)))
    pg.goto(BASE + '/index.html'); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    # ---- 1. seed v2
    sd = ev('()=>({v:PD.tp.v,kw:PD.tp.kw.map(k=>k[0]).join(" "),th:PD.tp.th.motor,pr:PD.tp.pr&&PD.tp.pr.m_doc,doc:PD.tp.gen.Documentary,senna:PD.tp.tm["movies:58496"],n:Object.keys(PD.tp.tl).length})')
    R['seed'] = sd
    chk('seed_v2', sd['v'] == 2 and 'rally' in sd['kw'] and 'mountain bik' in sd['kw'] and sd['th'] >= 1.3 and sd['pr'] >= 1.4 and sd['doc'] >= 92 and sd['senna'] == 2 and sd['n'] == 32, sd)
    q = ev('()=>[tasteBoost({t:"movies",id:91,n:"Un film qu\u00e9b\u00e9cois",c:"101"}), tasteBoost({t:"movies",id:92,n:"Rally Legends",c:"101"}), tasteBoost({t:"movies",id:93,n:"Generic Film",c:"101"})]')
    chk('quebec_penalty_motorsport_boost', q[0] < q[2] - 3 and q[1] > q[2] + 1, q)
    chk('new_themes', ev('()=>["motor","mtb","sportsleg","history"].every(id=>TH_BY[id]&&THEMES.indexOf(TH_BY[id])>=0)'))
    # ---- 2. NAS titles stay out of Movies
    ev('()=>{poolMem={};localStorage.removeItem("nf_pool_movies");localStorage.removeItem("nf_pool_series");V.navIdx=TAB_VIEWS.indexOf("movies");buildView("movies")}'); time.sleep(9)
    names = ev(ALLITEMS); titles = ev('()=>V.rows.map(r=>r.spec.title)'); R['movie_rows'] = titles
    chk('no_nas_on_movies', 'My NAS Movie' not in names and not any('NAS' in t for t in titles), [t for t in titles if 'NAS' in t])
    chk('nas_ok_in_my_media', ev('(it)=>{var v=V.view;V.view="nas";var a=itemOK(it);V.view=v;return a&&!itemOK(it)}', NASIT))
    # ---- 3. prestige rows
    pr = ev('async()=>{var out=[];for(const r of V.rows.filter(r=>r.spec.prestige)){var l=await r.spec.load.call(r.spec);out.push([r.spec.prestige,r.spec.title,l.length,l.slice(0,10).map(i=>i.n)])}return out}')
    R['prestige_movies'] = pr
    chk('prestige_rows_daily_count', len(pr) == 4, [x[0] for x in pr])
    full = ev('''async()=>{var by=await prCatalog("movies"),o={};for(var id in by)o[id]=by[id].l.length;return o}''')
    R['prestige_counts_movies'] = full
    chk('prestige_matches', full.get('m_imdb', 0) >= 20 and full.get('m_doc', 0) >= 8 and full.get('m_bp', 0) >= 2, full)
    chk('prestige_min8', all(n == 0 or n >= 8 for _, _, n, _ in pr) and any(n >= 8 for _, _, n, _ in pr), pr)
    chk('prestige_match_strict', ev('''()=>{var a={t:"movies",n:"Heat",y:"1995"},b={t:"movies",n:"Heat",y:"2013"},c={t:"movies",n:"HEAT - 1995",y:""},d={t:"movies",n:"Se7en",y:"1995"},e={t:"movies",n:"Amelie",y:"2001"};
        return prOf(a).indexOf("m_imdb")>=0 && prOf(b).length===0 && prOf(c).indexOf("m_imdb")>=0 && prOf(d).indexOf("m_imdb")>=0 && prOf(e).indexOf("m_tiff")>=0}'''))
    chk('prestige_quality_boost', ev('()=>prBoost({t:"movies",n:"Goodfellas",y:"1990"})>=2 && prBoost({t:"movies",n:"Rom Com Generic",y:"2024"})===0'))
    i = ev('()=>V.rows.findIndex(r=>r.spec.prestige&&r.items&&r.items.length)')
    if i is None or i < 0: i = ev('()=>V.rows.findIndex(r=>r.spec.prestige)')
    ev('(i)=>{V.zone="rows";V.r=Math.max(0,i);applyFocus()}', i); time.sleep(3)
    pg.screenshot(path=SHOTS + '/v415_movies_prestige.png')
    # daily: stable today, rotates and never repeats yesterday's set
    d1 = ev('()=>JSON.stringify(PD.dp.pr)')
    ev('()=>buildView("movies")'); time.sleep(3)
    chk('prestige_stable_same_day', ev('()=>JSON.stringify(PD.dp.pr)') == d1)
    rot = ev('''()=>{var real=Date.now,out=[PD.dp.pr.movies.join(",")];
       for(var d=1;d<=5;d++){Date.now=function(){return real()+d*86400000;};out.push(prDaily("movies").map(l=>l.id).join(","));}
       Date.now=real;delete PD.dp;return out}''')
    R['prestige_rotation'] = rot
    chk('prestige_rotates_daily', len(set(rot)) >= 4 and all(rot[k] != rot[k + 1] for k in range(len(rot) - 1)), rot)
    ev('()=>buildView("movies")'); time.sleep(6)
    # ---- 4. hate from the details page: gone at once, no rebuild
    it = ev('()=>{var r=V.rows.filter(r=>r.spec.hero)[0];return r.items.filter(i=>!rtGet(i))[0]}')
    R['hated'] = it['n']
    chk('hated_visible_before', it['n'] in ev(ALLITEMS))
    gen0 = ev('()=>V.gen')
    a0 = ev('()=>{var a=affinity();return a}')
    ev('(n)=>{var it=null;V.rows.forEach(r=>(r.items||[]).forEach(x=>{if(!it&&x.n===n)it=x}));openDetails(it)}', it['n']); time.sleep(2.5)
    chk('hate_button_on_details', ev('()=>document.querySelectorAll("#d-body .btn.rate").length') == 4 and ev('()=>[].some.call(document.querySelectorAll("#d-body .btn.rate"),b=>b._rv===-2)'))
    pg.screenshot(path=SHOTS + '/v415_details_hate.png')
    nb = ev('()=>D.ln.lines[0].items.findIndex(b=>b._rv===-2)')
    for _ in range(nb): pg.keyboard.press('ArrowRight'); time.sleep(0.12)
    pg.keyboard.press('Enter'); time.sleep(1)
    chk('hate_saved', ev('(it)=>rtGet(it)===-2', it))
    chk('details_closed', ev('()=>!D.open'))
    names2 = ev(ALLITEMS)
    chk('hated_gone_now', it['n'] not in names2 and ev('(n)=>!V.hero||V.hero.n!==n', it['n']), it['n'])
    chk('no_reload', ev('()=>V.gen') == gen0)
    pg.screenshot(path=SHOTS + '/v415_after_hate.png')
    g = ev('(it)=>{var e=PD.rt[itemKey(it)];return e&&e.g}', it)
    a1 = ev('()=>affinity()')
    R['hate_genres'] = [(x, round(a0.get(x, 0), 2), round(a1.get(x, 0), 2)) for x in (g or [])]
    chk('hate_hits_genres', g and all(a1.get(x, 0) <= a0.get(x, 0) - 5.5 for x in g if x in a0), R['hate_genres'])
    ev('()=>{poolMem={};buildView("movies")}'); time.sleep(7)
    chk('hated_gone_after_rebuild', it['n'] not in ev(ALLITEMS))
    chk('hated_gone_from_prestige', ev('''async(n)=>{for(const l of PR_LISTS.filter(l=>l.type==="movies")){var x=await prItems(l,"movies");if(x.some(i=>i.n===n))return false}return true}''', it['n']))
    chk('hated_blocked_everywhere', ev('(it)=>!itemOK(it)', it))
    # franchise + people penalty
    fr = ev('''()=>{var a={t:"movies",id:5001,n:"Heist Night 2",c:"106"},b0=tasteBoost(a),h=null;cache["movies:106"].forEach(x=>{if(x.n==="Heist Night")h=x});rtSet(h,-2);TSC.v=null;return [b0,tasteBoost(a),htRoot("The Godfather Part II")===htRoot("The Godfather")]}''')
    chk('hate_hits_franchise', fr[1] <= fr[0] - 8 and fr[2], fr)
    # ---- 5. player: Rate panel has Never show, hate closes the player
    ev('()=>{var it=null;cache["movies:103"].forEach(x=>{if(x.n==="Primer")it=x});playItem(it,null,0)}'); time.sleep(4)
    pg.keyboard.press('ArrowDown'); time.sleep(0.4)
    chk('player_panel_4', ev('()=>RP.open && document.querySelectorAll("#nf-rate .ro").length===4 && RATE_VALS[RP.sel]===1'))
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowLeft'); time.sleep(0.3)
    pg.screenshot(path=SHOTS + '/v415_player_hate.png')
    pg.keyboard.press('Enter'); time.sleep(1.2)
    chk('player_hate', ev('()=>{var it=null;cache["movies:103"].forEach(x=>{if(x.n==="Primer")it=x});return rtGet(it)===-2 && !P.open}'))
    chk('player_hated_gone', 'Primer' not in ev(ALLITEMS))
    # ---- 6. backup + Settings undo
    chk('backup_has_hate', ev('()=>{var d=JSON.parse(bkCollect().nf_p_p1);return Object.keys(d.rt).filter(k=>d.rt[k].v===-2).length===3}'))
    ev('()=>{openSettings();ST.cat="content";ST.page=null;ST.zone="pane";renderSettings()}'); time.sleep(1)
    rows = ev('()=>{var o=[];ST.ln.lines.forEach(l=>l.items.forEach(x=>{if(/^ht:/.test(x._key||""))o.push(x.textContent)}));return o}')
    R['settings_hidden'] = rows
    chk('settings_lists_hidden', len(rows) == 3 and any('Primer' in r for r in rows), rows)
    pg.screenshot(path=SHOTS + '/v415_settings_never_show.png')
    ev('()=>{var t=null;ST.ln.lines.forEach(l=>l.items.forEach(x=>{if(/Primer/.test(x.textContent)&&/^ht:/.test(x._key))t=x}));t._act()}'); time.sleep(0.6)
    chk('settings_undo', ev('()=>{var it=null;cache["movies:103"].forEach(x=>{if(x.n==="Primer")it=x});return rtGet(it)===0 && itemOK(it)}'))
    ev('()=>{closeSettings()}'); time.sleep(2)
    # ---- 7. Shows: prestige + no NAS
    ev('()=>{poolMem={};V.navIdx=TAB_VIEWS.indexOf("series");buildView("series")}'); time.sleep(9)
    sp = ev('async()=>{var out=[];for(const r of V.rows.filter(r=>r.spec.prestige)){var l=await r.spec.load.call(r.spec);out.push([r.spec.prestige,l.length,l.slice(0,8).map(i=>i.n)])}return out}')
    fs = ev('''async()=>{var by=await prCatalog("series"),o={};for(var id in by)o[id]=by[id].l.length;return o}''')
    R['prestige_series'] = sp; R['prestige_counts_series'] = fs
    chk('series_prestige', len(sp) == 3 and fs.get('s_imdb', 0) >= 20 and sum(1 for x in sp if x[1] >= 8) >= 2 and all(x[1] == 0 or x[1] >= 8 for x in sp), [sp, fs])   # small lists are swapped for one with enough matches
    chk('series_themes_still', len(ev('()=>V.rows.filter(r=>r.spec.theme)')) >= 2)
    # ---- 8. Celia (British) keeps her rows and gets no Nick seed
    chk('celia_unseeded', ev('()=>{var d=JSON.parse(localStorage.getItem("nf_p_p2")||"{}");return !d.tp}'))
    R['errors'] = errs; chk('no_page_errors', not errs)
    b.close()
print(json.dumps(R, indent=1)); print('PASS' if ok else 'FAIL')
