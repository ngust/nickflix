import time, json, sys
from playwright.sync_api import sync_playwright
who=sys.argv[1] if len(sys.argv)>1 else 'Nick'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'))
    pg=b.new_page(viewport={'width':1920,'height':1080})
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: m.type=='error' and errs.append('C:'+m.text[:150]))
    pg.goto('http://localhost:8099/index.html')
    pg.evaluate('''(w)=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0},{id:"p2",name:"Celia",av:3}],last:w=="Nick"?"p1":"p2",seq:2}));}''',who)
    pg.reload(); time.sleep(6)
    if who!='Nick': pg.keyboard.press('ArrowRight'); time.sleep(.5)
    pg.keyboard.press('Enter'); time.sleep(8)
    print('PF',pg.evaluate('()=>PF.name'))
    print('HUB',pg.evaluate('()=>V.rows.map(r=>r.spec.title+" ["+(r.items?r.items.length:"-")+"]").slice(0,12)'))
    print('TILES',pg.evaluate('()=>hubTiles(0).map(t=>t.n+"="+t.id)'))
    pg.screenshot(path='screenshots/test-s_%s_hub.png'%who)
    for v in ['movies','series']:
        pg.evaluate('(v)=>{V.navIdx=TAB_VIEWS.indexOf(v);buildView(v)}',v); time.sleep(10)
        print(v,pg.evaluate('()=>V.rows.map(r=>r.spec.title+" ["+(r.items?r.items.length:"-")+"]").slice(0,16)'))
        pg.screenshot(path='screenshots/test-s_%s_%s.png'%(who,v))
    pg.evaluate('()=>{V.navIdx=TAB_VIEWS.indexOf("live");buildView("live")}'); time.sleep(6)
    pg.evaluate('()=>openLivePage("sports")'); time.sleep(20)
    print('SPORTS',pg.evaluate('()=>V.rows.map(r=>r.spec.title+" ["+(r.items?r.items.length:"-")+"]")'))
    print('LIVE',pg.evaluate('()=>V.rows.filter(r=>/Live/.test(r.spec.title)).map(r=>(r.items||[]).slice(0,6).map(i=>(i.n||i.name||"")+" | "+(i.sub||i.s||"")))'))
    print('COMING',pg.evaluate('()=>V.rows.filter(r=>/Coming up/.test(r.spec.title)).map(r=>(r.items||[]).slice(0,5).map(i=>(i.n||i.name||"")+" | "+(i.sub||i.s||"")))'))
    pg.screenshot(path='screenshots/test-s_%s_sports.png'%who)
    print('ERR',errs[:8])
    b.close()
