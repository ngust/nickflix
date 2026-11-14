#!/usr/bin/env python3
"""NickFlix 4.11 UI test: Today's picks (stable per day, changes next day), Surprise me slot machine,
Settings redesign, avatar picker. Needs tools/mock.py on localhost:8099 serving a test build:
    python3 tools/build.py --config tests/config.test.js --out /tmp/nf411 && NF_APP=/tmp/nf411/app python3 tools/mock.py
    python3 tests/t411.py [all|daily|settings|avatar]      # screenshots go to $NF_SHOTS (default /tmp/nf_shots)
"""
import time, json, sys, os
SHOTS = os.environ.get('NF_SHOTS', '/tmp/nf_shots'); os.makedirs(SHOTS, exist_ok=True)
from playwright.sync_api import sync_playwright
PROF={"list":[{"id":"p1","name":"Alex","av":0},{"id":"p2","name":"Sam","av":9}],"last":"p1","seq":2}
class H:
    def __init__(s, p):
        s.b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); s.pg=s.b.new_page(viewport={'width':1920,'height':1080})
        s.errs=[]; s.pg.on('pageerror',lambda e: s.errs.append(str(e)))
        s.pg.on('console',lambda m: s.errs.append('console:'+m.text) if m.type=='error' and 'Failed to load resource' not in m.text else None)
    def ev(s,x,*a): return s.pg.evaluate(x,*a)
    def boot(s, ls=None, enter=True, wait=7):
        s.pg.goto('http://localhost:8099/index.html')
        s.ev('''(ls)=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0");localStorage.setItem("nf_profiles",JSON.stringify(%s));for(var k in ls)localStorage.setItem(k,ls[k]);}'''%json.dumps(PROF), ls or {})
        s.pg.reload(); time.sleep(wait)
        if enter: s.pg.keyboard.press('Enter'); time.sleep(4)
    def k(s,*keys,d=0.25):
        for x in keys:
            n=1
            if '*' in x: x,n=x.split('*'); n=int(n)
            for i in range(n): s.pg.keyboard.press({'u':'ArrowUp','d':'ArrowDown','l':'ArrowLeft','r':'ArrowRight','e':'Enter','b':'Escape'}.get(x,x)); time.sleep(d)
    def shot(s,name): s.pg.screenshot(path=SHOTS+'/'+name+'.png'); print('shot',name)
    def foc(s): return s.ev('()=>{var f=document.querySelector(".f");return f?(f.className+" | "+f.textContent.slice(0,60)):null}')

import sys
only = sys.argv[1] if len(sys.argv)>1 else 'all'
SEED='''async()=>{
  const pool = await loadPool("movies", poolFor("movies", cats.movies.filter(catVisibleV)));
  const pick = pool.filter(it=>it.ic && itemGenres(it).length).slice(5,11);
  const now=Date.now();
  pick.forEach((it,i)=>{ const inf=whInfo(it); PD.wl.unshift({k:itemKey(it),t:"movie",n:it.n,cats:inf.cats,cc:inf.cc,min:95,fr:1,ts:now-i*86400000,st:now,it:snap(it)}); PD.hist.unshift({k:itemKey(it),it:snap(it),ts:now-i*86400000}); });
  await ensureIndex();
  const sp = tvcVisible("US").filter(ch=>{const o=tvcOf(ch);return o&&o.sub==="Sports"&&o.brand}).slice(0,3);
  sp.forEach((ch,i)=>{ const inf=whInfo(ch); PD.wl.unshift({k:itemKey(ch),t:"live",n:ch.n,cats:inf.cats,cc:inf.cc,min:120,fr:null,ts:now-i*3600000,st:now,it:snap(ch)}); PD.hist.unshift({k:itemKey(ch),it:snap(ch),ts:now-i*3600000}); learnAdd("ch",String(ch.id),30); });
  delete PD.dp; WHA={}; savePD(true); return [pick.map(x=>x.n), sp.map(x=>x.n)];
}'''
def daily_row(h):
    h.ev('()=>{V.zone="rows";for(var i=0;i<V.rows.length;i++)if(V.rows[i].spec.daily){V.r=i;break}applyFocus()}'); time.sleep(3)
    h.ev('()=>{applyFocus()}'); time.sleep(1)
    return h.ev('()=>{var r=V.rows[V.r];return r.spec.daily?(r.items||[]).slice(0,10).map(x=>x.n+" ["+x._why+"]"):"NO DAILY ROW: "+r.spec.title}')
with sync_playwright() as p:
    h=H(p); h.boot()
    if only in ('all','daily'):
        print('seed', h.ev(SEED)); h.ev('()=>{poolMem={};buildView("movies")}'); time.sleep(5)
        print('movies daily', daily_row(h)); h.shot('daily_movies')
        st1 = h.ev('()=>JSON.stringify(PD.dp.s.movies.map(x=>x.it.id))')
        h.ev('()=>buildView("movies")'); time.sleep(3); daily_row(h)
        print('stable same day', st1 == h.ev('()=>JSON.stringify(PD.dp.s.movies.map(x=>x.it.id))'))
        # simulate tomorrow
        print('tomorrow differs', h.ev('''async()=>{var a=PD.dp.s.movies.map(x=>x.it.id); var real=Date.now; Date.now=()=>real()+86400000; delete PD.dp.s.movies; PD.dp.d="x"; var b=(await dpItems("movies")).map(x=>x.id); Date.now=real; var same=a.filter(x=>b.indexOf(x)>=0).length; return {overlap:same,of:a.length,pastKept:PD.dp.past.length}}'''))
        h.ev('()=>{delete PD.dp;buildView("series")}'); time.sleep(6); print('series daily', daily_row(h)); h.shot('daily_shows')
        h.ev('()=>{V.page=null;buildView("live")}'); time.sleep(6); print('live daily', daily_row(h)); h.shot('daily_live')
        h.k('u'); 
        r=h.ev('()=>V.r'); 
        for i in range(12):
            if h.ev('()=>V.zone')!='rows': break
            h.k('u')
        print('live up ->', h.ev('()=>V.zone'), h.foc()); h.shot('surprise_btn_live')
        h.k('e', d=0); time.sleep(0.9); h.shot('slot_mid_live'); time.sleep(2.6); h.shot('slot_result_live'); print(h.foc())
        h.k('e'); time.sleep(2); print('playing', h.ev('()=>P.open'), h.ev('()=>P.item&&P.item.n')); h.ev('()=>closePlayer()'); time.sleep(1)
        h.ev('()=>{buildView("series")}'); time.sleep(4)
        h.ev('()=>{V.zone="mode";V.modeIdx=2;applyFocus()}'); h.k('e', d=0); time.sleep(1.1); h.shot('slot_mid_shows'); time.sleep(2.5); h.shot('slot_result_shows'); h.k('b')
    if only in ('all','settings'):
        h.ev('()=>{buildView("movies")}'); time.sleep(3)
        h.ev('()=>openSettings()'); time.sleep(1); h.shot('settings_0_nav')
        names=['profile','content','livetv','picks','sports','playback','app','account']
        for i,n in enumerate(names):
            if i: h.k('d')
            h.k('r'); time.sleep(.4); h.shot('settings_%d_%s'%(i+1,n)); h.k('l')
        # subpages
        h.ev('()=>{ST.cat="tv";ST.zone="nav";renderSettings()}'); h.k('r','d','e'); time.sleep(1); h.shot('settings_sub_extra'); h.k('b'); print('after back', h.foc())
        h.k('u','e'); time.sleep(.5); h.shot('settings_sub_livefilters'); h.k('d*4'); h.shot('settings_sub_livefilters2'); h.k('b','b'); print('nav?', h.ev('()=>ST.zone'), h.foc())
        # picks: turn Surprise off
        h.ev('()=>{ST.cat="picks";renderSettings()}'); h.k('r'); print(h.foc()); h.k('e'); time.sleep(.3); h.shot('settings_surprise_off'); print('surprise', h.ev('()=>PD.st.surprise'))
        h.k('d','e'); print('mix', h.ev('()=>PD.st.slotMix'))
        h.k('b','b'); time.sleep(3); print('closed', h.ev('()=>OV.stack.length'))
        h.ev('()=>{buildView("movies");V.zone="mode";V.modeIdx=0;applyFocus()}'); time.sleep(1)
        print('modebar els', h.ev('()=>V.modeEls.map(e=>e.textContent)')); h.shot('movies_surprise_off')
        h.ev('()=>{V.page=null;buildView("live")}'); time.sleep(3); print('live btn', h.ev('()=>!!document.querySelector(".ph-btn")'), h.ev('()=>V.modeOn')); h.shot('live_surprise_off')
        h.ev('()=>{PD.st.surprise=true;savePD(true)}')
        # reopen settings remembers category + focus
        h.ev('()=>openSettings()'); time.sleep(.5); print('remember cat', h.ev('()=>ST.cat'), h.foc()); h.k('r'); print('remember row', h.foc()); h.k('b','b')
    if only in ('all','avatar'):
        h.ev('()=>{openSettings();ST.cat="profile";ST.zone="nav";renderSettings()}'); h.k('r','e'); time.sleep(1)
        h.k('d*4','r*3'); time.sleep(.5); h.shot('avatar_picker'); print('av at', h.ev('()=>[AP.rows[AP.r].t, AV_NAMES[AP.rows[AP.r].ids[AP.c]]]'))
        h.k('d*12','r*5'); time.sleep(.5); h.shot('avatar_picker2'); print('av at', h.ev('()=>[AP.rows[AP.r].t, AV_NAMES[AP.rows[AP.r].ids[AP.c]]]'))
        h.k('e'); time.sleep(.5); print('saved av', h.ev('()=>[PF.av, profiles.list[0].av, JSON.parse(localStorage.nf_profiles).list[0].av]'), h.foc()); h.shot('settings_after_avatar')
        h.k('d','e'); time.sleep(.5); h.shot('profile_editor'); h.k('b'); print('editor back ->', h.foc(), h.ev('()=>OV.top()&&OV.top().id'))
        h.k('b','b'); print('closed', h.ev('()=>OV.stack.length'))
        h.ev('()=>openWho(true)'); time.sleep(.5); h.shot('who_manage'); h.k('e'); time.sleep(.5); h.shot('who_editor'); h.k('b'); h.k('b'); h.k('b')
        h.ev('()=>openProfilePage()'); time.sleep(1); h.shot('profile_page'); h.k('b')
    print('ERRS', h.errs)
