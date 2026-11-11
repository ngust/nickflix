import time
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome')); pg=b.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html')
    pg.evaluate('''()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0}],last:"p1",seq:1}));}''')
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(5)
    print(pg.evaluate('()=>{PD.st.mode.movies="all";PD.st.mode.series="all";return [specsFor("movies").map(r=>r.title).slice(0,6),specsFor("series").map(r=>r.title).slice(0,6)]}'))
    print(errs); b.close()
