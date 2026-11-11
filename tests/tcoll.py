import time, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'))
    pg=b.new_page(viewport={'width':1920,'height':1080})
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html')
    pg.evaluate('''()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0},{id:"p2",name:"Celia",av:3}],last:"p1",seq:2}));}''')
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    res={}
    for t in ['movies','series']:
        res['doc_'+t]=pg.evaluate('(t)=>collReport(t,"doc")',t)
        res['uk_'+t]=pg.evaluate('(t)=>collReport(t,"uk")',t)
        res['src_doc_'+t]=pg.evaluate('(t)=>collSources(t,"doc").map(c=>c.title)',t)
        res['src_uk_'+t]=pg.evaluate('(t)=>collSources(t,"uk").map(c=>c.title)',t)
    json.dump(res,open('/tmp/nf_coll_report.json','w'),ensure_ascii=False,indent=1)
    pg.evaluate('()=>{V.navIdx=TAB_VIEWS.indexOf("series");buildView("series")}'); time.sleep(8)
    print(pg.evaluate('()=>V.rows.map(r=>r.spec.title+" ["+(r.items?r.items.length:"-")+"]").slice(0,20)'))
    pg.screenshot(path='screenshots/test-c_nick_series.png')
    print('ERR',errs[:5])
    b.close()
