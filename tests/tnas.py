import time, json, sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome'))
    pg=b.new_page(viewport={'width':1920,'height':1080})
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html')
    pg.evaluate('''()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0},{id:"p2",name:"Celia",av:3}],last:"p1",seq:2}));}''')
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    pg.evaluate('()=>{V.navIdx=TAB_VIEWS.indexOf("nas");selectTab("nas",false)}')
    for i in range(30):
        time.sleep(5)
        st=pg.evaluate('()=>({q:NAS.q.length,qa:NAS.qa,n:NAS.lib?NAS.lib.items.length:-1,err:NAS.err})')
        if st['n']>0 and st['q']==0 and st['qa']==0: break
    print(st)
    time.sleep(4)
    print(pg.evaluate('()=>V.rows.map(r=>r.spec.title+" ["+(r.items?r.items.length:"-")+"]")'))
    pg.screenshot(path='screenshots/test-n_nas_top.png')
    r=pg.evaluate('''()=>{var L=NAS.lib.items;var m=L.filter(x=>x.matched).length;var gc={};L.forEach(it=>(it.gl||[]).forEach(g=>gc[g]=(gc[g]||0)+1));
      return {total:L.length,matched:m,rule:L.filter(x=>x.rule).length,movies:L.filter(x=>x.t=="movies").length,series:L.filter(x=>x.t=="series").length,other:NAS.lib.other.length,hidden:NAS.hidden,genres:gc,
      unmatched:L.filter(x=>!x.matched).map(x=>x.n), series_list:L.filter(x=>x.t=="series").map(x=>x.n+" | "+x.sub), sample:L.filter(x=>x.matched).slice(0,8).map(x=>x.n+" ("+x.y+") "+x.genre+" r"+x.r+" "+(x.sub||""))}}''')
    print(json.dumps(r,indent=1,ensure_ascii=False))
    json.dump(pg.evaluate('()=>NAS.meta'),open('/tmp/nf_nas_meta.json','w'),ensure_ascii=False)
    print('ERR',errs[:6])
    b.close()
