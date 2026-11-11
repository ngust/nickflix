import time
from playwright.sync_api import sync_playwright
exec(open('tpb.py').read().split("def show")[0].split("from playwright.sync_api import sync_playwright")[1])
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome')); pg=b.new_page(viewport={'width':1920,'height':1080})
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.add_init_script(FAKE)
    pg.goto('http://localhost:8099/index.html')
    pg.evaluate('''()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0}],last:"p1",seq:1}));}''')
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    pg.evaluate('()=>playItem({t:"movies",id:5001,n:"The Hobbit: An Unexpected Journey",ext:"mkv"},null,0,0)'); time.sleep(4)
    st=pg.evaluate('()=>webapis.avplay.getCurrentTime()')
    for i in range(40): pg.evaluate('()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",keyCode:39,repeat:true}))'); time.sleep(0.1)
    print("4s hold: +%ds"%((pg.evaluate('()=>SC.pos')-st)/1000))
    pg.screenshot(path='screenshots/test-v47_scrub_hold2.png')
    for i in range(80): pg.evaluate('()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",keyCode:39,repeat:true}))'); time.sleep(0.1)
    print("12s hold: +%ds"%((pg.evaluate('()=>SC.pos')-st)/1000))
    pg.evaluate('()=>window.dispatchEvent(new KeyboardEvent("keyup",{key:"ArrowRight",keyCode:39}))'); time.sleep(0.6)
    print("seeks", [x[1] for x in pg.evaluate('()=>AVLOG') if x[1].startswith('seek')], errs); b.close()
