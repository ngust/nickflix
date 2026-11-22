#!/usr/bin/env python3
"""NickFlix 4.16 test: Indian / Kids filters, quality floor + clean-up, Curated / Categories / Everything, category trim,
per-profile vibe rows, implicit signals + decay, diversity / exploration, Settings rows.
Extends the 4.14 synthetic catalogue (tests/t414.py fixtures) with Indian, kids, junk and low-rated entries:
    python3 tools/build.py --config tests/config.test.js --out /tmp/nf416t
    python3 tests/t414.py --fixtures /tmp/nf_fx414 --app /tmp/nf416t/app
    python3 tests/t416.py --fixtures /tmp/nf_fx416            # writes the extended fixtures
    NF_APP=/tmp/nf416t/app NF_FIXTURES=/tmp/nf_fx416 python3 tools/mock.py &
    python3 tests/t416.py                                       # screenshots -> $NF_SHOTS, v416_*.png
"""
import time, json, os, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.environ.get('NF_SHOTS', '/tmp/nf_shots'); os.makedirs(SHOTS, exist_ok=True)
BASE = os.environ.get('NF_BASE', 'http://localhost:8099')
NOW = int(time.time()); YEAR = time.localtime().tm_year
if '--fixtures' in sys.argv:
    dst = sys.argv[sys.argv.index('--fixtures') + 1]; src = os.environ.get('NF_FX414', '/tmp/nf_fx414')
    os.makedirs(dst, exist_ok=True)
    L = {f: json.load(open(os.path.join(src, f))) for f in os.listdir(src) if f.endswith('.json')}
    ic = L['vod_streams.json'][0]['stream_icon']
    def vcat(cid, name): L['vod_cats.json'].append({'category_id': str(cid), 'category_name': name})
    def scat(cid, name): L['series_cats.json'].append({'category_id': str(cid), 'category_name': name})
    def lcat(cid, name): L['live_cats.json'].append({'category_id': str(cid), 'category_name': name})
    sid = [900000]
    def mv(cid, name, rating, icon=True, tm=''):
        sid[0] += 1; L['vod_streams.json'].append({'name': name, 'stream_id': sid[0], 'stream_icon': ic if icon else '', 'rating': rating, 'added': str(NOW - sid[0] % 50 * 3600), 'tmdb': tm, 'container_extension': 'mp4', 'category_id': str(cid)})
    def sh(cid, name, rating, genre='Drama', plot='A long enough plot about people doing things in a city far away.', year=2019):
        sid[0] += 1; L['series.json'].append({'name': name, 'series_id': sid[0], 'cover': ic, 'plot': plot, 'genre': genre, 'cast': '', 'director': '', 'releaseDate': '%d-01-01' % year, 'rating': rating, 'last_modified': str(NOW), 'tmdb': '', 'category_id': str(cid), 'backdrop_path': []})
    def ch(cid, name):
        sid[0] += 1; L['live_streams.json'].append({'name': name, 'stream_id': sid[0], 'stream_icon': '', 'category_id': str(cid), 'epg_channel_id': ''})
    vcat(150, '|IN| \u272a HINDI'); vcat(151, '|EN| \u272a BOLLYWOOD'); vcat(152, '|EN| \u272a KIDS'); vcat(153, '|EN| \u272a ROMANCE'); vcat(154, '\u272a NORDIC MULTI')
    for i, t in enumerate(['Dangal', 'Lagaan', '3 Idiots', 'PK', 'Sholay', 'Dilwale Dulhania Le Jayenge']): mv(150, '%s (%d)' % (t, 2000 + i), '8.1'); mv(151, 'EN - %s (%d)' % (t, 2000 + i), '8.1')
    for i, t in enumerate(['PAW Patrol: The Movie', 'Frozen II', 'Peppa Pig: The Golden Boots', 'Minions: The Rise of Gru', 'Bluey: The Sign', 'Moana 2']): mv(152, '%s (%d)' % (t, 2015 + i), '7.2')
    for i in range(12): mv(153, 'Romance Story %d (%d)' % (i, 2010 + i), '7.1')
    for i in range(6): mv(154, 'Nordisk Film %d (2020)' % i, '7.5')
    # junk + floor cases in DRAMA (107) / CLASSIC (105)
    mv(107, 'Generic Low Film (2019)', '5.213'); mv(107, 'Unrated Old Film (2009)', '0'); mv(107, 'New Unrated Film (%d)' % YEAR, '0')
    mv(107, 'Lucky Ten Film (2012)', '10'); mv(107, 'Cam Rip Movie (%d) HDCAM' % YEAR, '7.9'); mv(107, 'Dubbed Film [ITA] (2018)', '7.5')
    mv(107, 'No Poster Film (2016)', '7.9', icon=False); mv(107, 'Good Drama Film (2017)', '7.312'); mv(107, 'Dangal Hindi (2016)', '8.3'); mv(101, 'Toy Story 4 - 2019', '7.6')
    mv(105, 'Heat (1995)', '7.9', icon=False, tm='949')
    scat(250, '|IN| \u272a INDIAN DAILY SOAP'); scat(251, '|EN| \u272a CARTOON'); scat(252, '|EN| \u272a DramaBite')
    for i in range(5): sh(250, 'Saath Nibhaana %d' % i, '7')
    sh(251, 'South Park', '8', 'Animation / Comedy', year=1997); sh(251, 'Paw Patrol', '7', 'Animation / Kids'); sh(251, 'Peppa Pig', '6', 'Animation / Kids'); sh(251, 'Bluey', '9', 'Animation / Kids / Family')
    for i in range(4): sh(252, 'Reborn CEO Revenge %d' % i, '0', 'Drama', plot='', year=0)
    sh(200, 'Junk Show Ten', '10', 'Drama', plot='', year=2011); sh(200, 'Weak Show', '4', 'Drama')
    lcat(60, 'UK| ASIAN'); lcat(61, 'AS| TAMIL'); lcat(62, 'CA| KIDS')
    for n in ['UK: ZEE TV HD', 'UK: STAR PLUS', 'UK: SONY SAB', 'UK: SKY ARTS']: ch(60, n)
    for n in ['AS: SUN TV', 'AS: KTV']: ch(61, n)
    for n in ['CA: TREEHOUSE', 'CA: YTV', 'CA: FAMILY JR']: ch(62, n)
    ch(6, 'CA: CARTOON NETWORK'); ch(4, 'CA: TSN 2 HD')
    for f, d in L.items(): json.dump(d, open(os.path.join(dst, f), 'w'))
    print('fixtures ->', dst); sys.exit(0)
# ---------------------------------------------------------------- test
src = open(os.path.join(HERE, 't414.py'), encoding='utf-8').read()
FAKE = src.split("FAKE = r'''")[1].split("'''")[0]
from playwright.sync_api import sync_playwright
R = {}; ok = True
def chk(name, cond, info=None):
    global ok; R[name] = bool(cond) if info is None else [bool(cond), info]; ok = ok and bool(cond)
def wl(k, n, c, fr, mins, days):
    t = 'movies' if k.startswith('movies') else 'series'
    return {"k": k, "t": "movie" if t == 'movies' else "show", "n": n, "cats": ["Drama", "Movies"], "cc": "", "min": mins, "fr": fr, "ts": NOW * 1000 - days * 86400000, "st": NOW * 1000 - days * 86400000, "it": {"t": t, "id": int(k.split(':')[1]), "n": n, "c": c}}
# Nick: 9 movies watched in action / gangster / doc categories (enough history for the category trim)
H = [("movies:100000", "Die Hard", "100"), ("movies:100001", "Heat", "100"), ("movies:100002", "Baby Driver", "100"), ("movies:100003", "Mad Max: Fury Road", "100"),
     ("movies:999101", "Doc A", "104"), ("movies:999102", "Doc B", "104"), ("movies:999103", "Gang A", "102"), ("movies:999104", "Gang B", "102"), ("movies:999105", "Gang C", "102")]
HIST = {"st": {}, "hist": [{"k": k, "it": {"t": "movies", "id": int(k.split(':')[1]), "n": n, "c": c}, "ts": NOW * 1000 - i * 3600000} for i, (k, n, c) in enumerate(H)], "pos": {}, "list": [],
        "wl": [wl(k, n, c, 1, 90, 2) for k, n, c in H], "stats": {"sec": 4800, "titles": {}, "gen": {}, "ch": {}, "chn": {}, "types": {}}}
ALL = '()=>V.rows.filter(r=>r.items).map(r=>r.items.map(i=>i.n)).reduce((a,b)=>a.concat(b),[])'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome')); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE); ev = pg.evaluate
    pg.add_init_script('''if(!sessionStorage.getItem("__t416")){sessionStorage.setItem("__t416","1");localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0");
      localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0},{id:"p2",name:"Celia",av:5}],last:"p1",seq:2}));
      localStorage.setItem("nf_p_p1",%s);}''' % json.dumps(json.dumps(HIST)))
    pg.goto(BASE + '/index.html'); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    # ---- 1. Indian filter (default on)
    ci = ev('''()=>{var o={};["movies","series","live"].forEach(t=>{o[t]=cats[t].filter(c=>c.ind).map(c=>[c.raw,catVisible(c)])});return o}''')
    R['indian_cats'] = ci
    chk('indian_cats_flagged', len(ci['movies']) == 2 and len(ci['series']) == 1 and len(ci['live']) == 1 and not any(v for t in ci for _, v in ci[t]), ci)
    ch = ev('''async()=>{var l=await loadCat(catById["live:60"]);return l.map(x=>[x.n,!!x.ind,itemOK(x)])}''')
    chk('indian_channels', [x[0] for x in ch if not x[2]] == ['ZEE TV HD', 'STAR PLUS', 'SONY SAB'] or sum(1 for x in ch if not x[2]) == 3, ch)
    dt = ev('''async()=>{var l=await loadCat(catById["movies:107"]);var d=l.filter(x=>/Dangal/.test(x.n))[0];return [d.n,!!d.ind,itemOK(d)]}''')
    chk('indian_title_tag', dt[1] and not dt[2], dt)
    chk('indian_default_on', ev('()=>inHidden() && PD.st.hideIN===undefined'))
    # ---- 2. Kids (default off = hidden), adult animation / seed titles stay
    kc = ev('''()=>({m:cats.movies.filter(c=>c.kid).map(c=>[c.raw,catVisible(c)]),s:cats.series.filter(c=>c.kid).map(c=>[c.raw,catVisible(c)]),l:cats.live.filter(c=>c.kid).map(c=>[c.raw,catVisible(c)])})''')
    R['kids_cats'] = kc
    chk('kids_cats_hidden', len(kc['m']) == 1 and len(kc['s']) == 1 and len(kc['l']) == 1 and not any(v for t in kc for _, v in kc[t]), kc)
    kt = ev('''async()=>{var a=await loadCat(catById["movies:101"]),c=await loadCat(catById["series:251"]),l=await loadCat(catById["live:6"]);
       var ts=a.filter(x=>/Toy Story/.test(x.n))[0];return {toy:[ts.n,!!ts.kid,itemOK(ts)],sp:c.map(x=>[x.n,!!x.kid,itemOK(x)]),cn:l.filter(x=>/CARTOON/.test(x.n)).map(x=>[x.n,!!x.kid,itemOK(x)])}}''')
    R['kids_titles'] = kt
    chk('kids_titles_hidden', kt['toy'][0] == 'Toy Story 4' and not kt['toy'][2] and kt['cn'] and not kt['cn'][0][2], kt)
    chk('kids_adult_animation_kept', ev('''()=>{var c=catById["series:251"];c._k=c.kid;c.kid=false;var r=(cache["series:251"]||[]).filter(x=>/South Park/.test(x.n)).map(itemOK);c.kid=c._k;return r}''') == [True])
    ev('()=>{PD.st.kids=true;PD.st.hideIN=false}')
    chk('toggles_show_again', ev('''()=>catVisible(catById["movies:152"]) && catVisible(catById["movies:151"]) && catVisible(catById["live:62"]) && (cache["movies:101"]||[]).filter(x=>/Toy Story/.test(x.n)).every(itemOK)'''))
    ev('()=>{delete PD.st.kids;delete PD.st.hideIN;savePD()}')
    # ---- 3. quality floor + clean-up
    q = ev('''async()=>{var l=await loadCat(catById["movies:107"]);var o={};l.forEach(x=>{if(/Film|Movie/.test(x.n))o[x.n.replace(/ HDCAM$/,"")]=qWhy(x)});return o}''')
    R['floor'] = q
    exp = {'Generic Low Film': 'low', 'Unrated Old Film': 'unrated', 'New Unrated Film': '', 'Lucky Ten Film': 'unrated', 'Cam Rip Movie': 'cam', 'Dubbed Film [ITA]': 'dub', 'No Poster Film': 'noart', 'Good Drama Film': ''}
    chk('floor_reasons', all(q.get(k) == v for k, v in exp.items()), [(k, q.get(k), v) for k, v in exp.items() if q.get(k) != v])
    chk('floor_prestige_love_pass', ev('''()=>{var g={t:"movies",id:5,n:"Goodfellas",y:"1990",r:5.0,rq:3,ic:"x",c:"102"};var l={t:"movies",id:6,n:"Low But Loved",y:"2001",r:4.1,rq:3,ic:"x",c:"107"};var a=qWhy(g)==="",b0=qWhy(l)==="low";rtSet(l,2);var b1=qWhy(l)==="";rtSet(l,2);return a&&b0&&b1}'''))
    chk('floor_adjustable', ev('''()=>{var x={t:"movies",id:7,n:"Mid",y:"2001",r:6.8,rq:3,ic:"x",c:"107"};var a=qWhy(x,6.5)==="",b=qWhy(x,7)==="low",c=qWhy({t:"movies",id:8,n:"Low",y:"2001",r:3,rq:3,ic:"x",c:"107"},0)==="";return a&&b&&c}'''))
    dd = ev('''async()=>{poolMem={};localStorage.removeItem("nf_pool_movies");var pc=poolFor("movies",cats.movies.filter(catVisibleV));pc.push(catById["movies:105"]);pc.push(catById["movies:100"]);var p=await loadPool("movies",pc);return p.filter(x=>x.n==="Heat").map(x=>[x.id,!!x.ic])}''')
    chk('dedupe_keeps_best', len(dd) == 1 and dd[0][1], dd)
    # ---- 4. Curated rows only show titles that pass; Everything shows the rest
    ev('()=>{poolMem={};localStorage.removeItem("nf_pool_movies");PD.st.mode.movies="curated";V.navIdx=TAB_VIEWS.indexOf("movies");buildView("movies")}'); time.sleep(8)
    ev('()=>{V.zone="mode";V.modeIdx=0;applyFocus()}'); time.sleep(1)
    pg.screenshot(path=SHOTS + '/v416_movies_modes.png')
    modes = ev('()=>V.modeEls.map(e=>e.textContent)'); R['modes'] = modes
    chk('three_modes', len(modes) >= 3 and 'Curated' in modes[0] and 'Categories' in modes[1] and 'Everything' in modes[2], modes)
    names = ev(ALL)
    bad = [n for n in ['Generic Low Film', 'Cam Rip Movie', 'Dubbed Film [ITA]', 'Lucky Ten Film', 'Unrated Old Film', 'Dangal', 'Toy Story 4', 'Nordisk Film 0'] if any(x.startswith(n) for x in names)]
    chk('curated_clean', not bad, bad)
    ev('()=>setMode(2)'); time.sleep(6)
    chk('everything_mode', ev('()=>modeOf("movies")==="every"'))
    every = ev('''async()=>{var o=[];for(const r of V.rows){if(!r.spec.count)continue;var l=await r.spec.load();l=l.filter(itemOK);l=qRowFilter(r.spec,l);l.forEach(i=>o.push(i.n))}return o}''')
    rows_every = ev('()=>V.rows.filter(r=>r.spec.count).map(r=>r.spec.title)')
    chk('everything_has_rest', any(x.startswith('Generic Low Film') for x in every) and any(x.startswith('Cam Rip Movie') for x in every) and any('Romance' in t for t in rows_every), [len(every), rows_every])
    # ---- 5. category trim in Categories mode
    ev('()=>setMode(1)'); time.sleep(5)
    rows_cat = ev('()=>V.rows.filter(r=>r.spec.count).map(r=>r.spec.title)'); R['rows_categories'] = rows_cat; R['rows_everything'] = rows_every
    chk('category_trim', not any('Romance' in t for t in rows_cat) and ev('()=>QT.hidden.movies') >= 1 and len(rows_cat) < len(rows_every), [rows_cat, ev('()=>QT.hidden.movies')])
    pg.screenshot(path=SHOTS + '/v416_categories.png')
    ev('()=>{PD.st.qtrim=false}'); chk('trim_toggle', ev('()=>qtFilter("movies",cats.movies.filter(catVisible)).length===cats.movies.filter(catVisible).length')); ev('()=>{delete PD.st.qtrim}')
    chk('trim_needs_history', ev('()=>{var h=PD.hist,w=PD.wl;PD.hist=[];PD.wl=[];var n=cats.movies.filter(catVisible).length,r=qtFilter("movies",cats.movies.filter(catVisible)).length;PD.hist=h;PD.wl=w;return n===r}'))
    ev('()=>{PD.st.mode.movies="curated";savePD();buildView("movies")}'); time.sleep(7)
    # ---- 6. vibe rows: 6 a day, per profile, >= 8 titles, rotate daily
    th = ev('()=>V.rows.filter(r=>r.spec.theme).map(r=>[r.spec.title,r.spec.theme,(r.items||[]).length])'); R['nick_movie_themes'] = th
    nl = ev('async()=>{var o=[];for(const r of V.rows.filter(r=>r.spec.theme)){var l=await r.spec.load();o.push([r.spec.title,l.length])}return o}')
    R['nick_movie_theme_counts'] = nl
    chk('themes_6_min8', len(th) == 6 and all(n == 0 or n >= 8 for _, n in nl) and sum(1 for _, n in nl if n >= 8) >= 3, nl)
    chk('vibes_exist', ev('()=>["gritty","survive","rebels","britmyst","comfort","underdog","bigmach","darkfun","period","ukspyv","brcom"].every(id=>TH_BY[id]&&TH_BY[id].vibe)'))
    rot = ev('''()=>{var real=Date.now,out=[];for(var d=0;d<=4;d++){Date.now=function(){return real()+d*86400000;};delete PD.dp;out.push(thDaily("movies").map(t=>t.id).join(","));}Date.now=real;delete PD.dp;return out}''')
    chk('vibes_rotate', len(set(rot)) >= 4, rot)
    nrank = ev('()=>{delete PD.dp;return thRank("series").map(t=>t.id)}')
    i = ev('()=>V.rows.findIndex(r=>r.spec.theme)'); ev('(i)=>{V.zone="rows";V.r=Math.max(0,i);applyFocus()}', i); time.sleep(2.5)
    pg.screenshot(path=SHOTS + '/v416_vibes_nick.png')
    # ---- 7. algo: implicit signals, abandon, decay, vibe affinity, diversity + exploration
    a0 = ev('()=>{TSC.v=null;return tsModel().gen["Documentary"]||0}')
    bb = ev('''()=>{var it={t:"movies",id:100004,n:"John Wick",c:"100",y:"2014"};TSC.v=null;var b0=tasteBoost(it);
        PD.wl.unshift({k:"movies:100004",t:"movie",n:"John Wick",cats:["Action & Adventure","Movies"],cc:"",min:4,fr:0.03,ts:Date.now()-3*86400000,st:Date.now()-3*86400000,it:{t:"movies",id:100004,n:"John Wick",c:"100"}});
        TSC.v=null;QVB.m=null;var b1=tasteBoost(it);return [b0,b1]}''')
    chk('abandon_mild_negative', bb[1] < bb[0] - 0.5 and bb[1] > bb[0] - 4, bb)
    a1 = ev('''()=>{PD.wl.unshift({k:"movies:999201",t:"movie",n:"Doc Z",cats:["Documentary","Movies"],cc:"",min:95,fr:1,ts:Date.now()-86400000,st:Date.now()-86400000,it:{t:"movies",id:999201,n:"Doc Z",c:"104"}});
        PD.wl.unshift({k:"movies:999201",t:"movie",n:"Doc Z",cats:["Documentary","Movies"],cc:"",min:95,fr:1,ts:Date.now()-3600000,st:Date.now()-3600000,it:{t:"movies",id:999201,n:"Doc Z",c:"104"}});
        TSC.v=null;return tsModel().gen["Documentary"]||0}''')
    chk('finished_rewatch_boost', a1 > a0 + 2.5, [a0, a1])
    dec = ev('''()=>{var it={t:"movies",id:777,n:"Some Romance",c:"153",y:"2010"};rtSet(it,2);TSC.v=null;var g0=tsModel().gen["Romance"]||0;var k=itemKey(it);PD.rt[k].ts=Date.now()-500*86400000;TSC.v=null;var g1=tsModel().gen["Romance"]||0;rtSet(it,2);TSC.v=null;return [g0,g1]}''')
    chk('old_ratings_fade', dec[1] < dec[0] - 1, dec)
    va = ev('''()=>{var it={t:"movies",id:778,n:"GoodFellas",c:"102",y:"1990"};var v0=(qVibeAff().gritty||0);rtSet(it,2);TSC.v=null;var v1=(qVibeAff().gritty||0);rtSet(it,2);TSC.v=null;var h={t:"movies",id:779,n:"Spotlight",c:"107",y:"2015"};rtSet(h,-2);TSC.v=null;var v2=(qVibeAff().gritty||0);rtSet(h,-2);TSC.v=null;return [v0,v1,v2]}''')
    chk('vibe_affinity_learns', va[1] > va[0] + 0.5 and va[2] < va[0] - 0.5, va)
    dv = ev('''()=>{var l=[];for(var i=0;i<40;i++)l.push({t:"movies",id:5000+i,n:"A"+i,c:"100"});for(var j=0;j<20;j++)l.push({t:"movies",id:6000+j,n:"C"+j,c:"101"});for(var k=0;k<20;k++)l.push({t:"movies",id:7000+k,n:"D"+k,c:"104"});
        var o=qShape(l,"t",30).slice(0,30);var g={};o.forEach(x=>{var p=qPrimary(x);g[p]=(g[p]||0)+1});return [g,o.filter(x=>x._explore).length]}''')
    chk('diversity_cap', max(dv[0].values()) <= 12, dv)
    R['explore'] = dv[1]
    # ---- 8. Settings rows
    ev('()=>{openSettings();ST.cat="content";ST.page=null;ST.zone="pane";renderSettings()}'); time.sleep(1)
    keys = ev('()=>{var o=[];ST.ln.lines.forEach(l=>l.items.forEach(x=>o.push(x._key)));return o}'); R['settings_keys'] = keys
    chk('settings_rows', all(k in keys for k in ['tog:qc', 'tog:in', 'tog:kids', 'q:floor', 'q:trim']), keys)
    pg.screenshot(path=SHOTS + '/v416_settings_content.png')
    fl = ev('()=>{var r=null;ST.ln.lines.forEach(l=>l.items.forEach(x=>{if(x._key==="q:floor")r=x}));r._act();var a=qFloor();r._act();r._act();r._act();var b=qFloor();r._act();return [a,b,qFloor()]}')
    chk('floor_cycle', fl == [7, 6, 6.5], fl)
    ev('()=>{PD.st.qf=6.5;var r=null;ST.ln.lines.forEach(l=>l.items.forEach(x=>{if(x._key==="tog:kids")r=x}));r._act()}')
    chk('kids_toggle', ev('()=>kidsOn()===true'))
    ev('()=>{delete PD.st.kids;savePD(true);closeSettings()}'); time.sleep(2)
    # ---- 9. Celia: different vibe order, British vibes lead
    ev('()=>{loadProfile("p2");buildView("series")}'); time.sleep(8)
    crank = ev('()=>{delete PD.dp;return thRank("series").map(t=>t.id)}')
    R['rank_nick_series'] = nrank[:10]; R['rank_celia_series'] = crank[:10]
    uk = ['britmyst', 'period', 'ukspyv', 'brcom']
    def avg(r): return sum(r.index(x) for x in uk) / len(uk)
    chk('celia_british_first', avg(crank) < avg(nrank) and nrank[:6] != crank[:6], [avg(nrank), avg(crank)])
    cth = ev('async()=>{var o=[];for(const r of V.rows.filter(r=>r.spec.theme)){var l=await r.spec.load();o.push([r.spec.title,l.length])}return o}')
    R['celia_series_themes'] = cth
    chk('celia_rows', len(cth) == 6 and sum(1 for _, n in cth if n >= 8) >= 3, cth)
    i = ev('()=>V.rows.findIndex(r=>r.spec.theme)'); ev('(i)=>{V.zone="rows";V.r=Math.max(0,i);applyFocus()}', i); time.sleep(2.5)
    pg.screenshot(path=SHOTS + '/v416_vibes_celia.png')
    R['errors'] = errs; chk('no_page_errors', not errs)
    b.close()
print(json.dumps(R, indent=1)); print('PASS' if ok else 'FAIL')
