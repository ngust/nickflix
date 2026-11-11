import time, json
from playwright.sync_api import sync_playwright
FAKE = r'''
window.AVLOG=[]; window.FAIL_PREP=0; window.FREEZE=false;
(function(){
  var st="NONE", L=null, t=0, timer=null, url="";
  function log(x){AVLOG.push([Date.now(),x]);}
  window.webapis={avplay:{
    open:function(u){url=u;st="IDLE";t=0;log("open "+u.replace(/^.*\/(live|movie|series)\/[^\/]+\/[^\/]+\//,"$1/"));},
    close:function(){log("close");st="NONE";clearInterval(timer);},
    stop:function(){if(st!=="NONE")st="IDLE";clearInterval(timer);},
    setListener:function(l){L=l;}, setDisplayRect:function(){}, setDisplayMethod:function(){},
    setBufferingParam:function(a,b,c){log("buf "+a+" "+c);}, setTimeoutForBuffering:function(s){log("bto "+s);},
    prepareAsync:function(ok,err){var u=url;setTimeout(function(){ if(u!==url||st!=="IDLE")return; if(FAIL_PREP>0){FAIL_PREP--;err({name:"PLAYER_ERROR_CONNECTION_FAILED"});} else {st="READY";ok();}},300);},
    play:function(){st="PLAYING";clearInterval(timer);timer=setInterval(function(){if(st==="PLAYING"&&!FREEZE)t+=500;},500);},
    pause:function(){st="PAUSED";}, getState:function(){return st;}, getCurrentTime:function(){return t;}, getDuration:function(){return 7200000;},
    seekTo:function(ms,ok){log("seek "+ms);t=ms;ok&&ok();}, jumpForward:function(){}, jumpBackward:function(){},
    _L:function(){return L;}
  }};
})();
'''
def show(pg, label):
    print("==", label)
def run():
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=__import__('os').environ.get('CHROME','/usr/bin/google-chrome')); pg=b.new_page(viewport={'width':1920,'height':1080})
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    reqs=[]; pg.on('request',lambda r: reqs.append((time.time(), r.url)))
    pg.add_init_script(FAKE)
    pg.goto('http://localhost:8099/index.html')
    pg.evaluate('''()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0}],last:"p1",seq:1}));}''')
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(5)
    ev=lambda s: pg.evaluate(s)
    ev('''()=>{window.CH=[];for(var i=0;i<10;i++)CH.push({t:"live",id:1000+i,n:"US: Channel 1-"+i,c:"1"});AVLOG.length=0;}''')
    # T1 start live
    ev('()=>playItem(CH[0],CH,0)'); time.sleep(3)
    print("T1 log:", [x[1] for x in ev('()=>AVLOG')])
    print("T1 state:", ev('()=>[P.open,P.started,webapis.avplay.getState()]'))
    # background EPG while playing: queue other channel guides
    n0=len(reqs); ev('()=>{for(var i=1;i<8;i++)getEpg(2000+i);}'); time.sleep(2)
    epg_other=[u for t,u in reqs[n0:] if 'get_short_epg' in u and 'stream_id=200' in u]
    print("T8 EPG fetched for other channels while playing:", len(epg_other))
    # T2 error mid-play -> reconnect same channel
    ev('()=>{AVLOG.length=0;webapis.avplay._L().onerror("PLAYER_ERROR_CONNECTION_FAILED")}'); time.sleep(0.3)
    print("T2 badge:", ev('()=>{var b=document.getElementById("nf-rc");return b&&b.style.display!=="none"?b.textContent:null}'), "player open:", ev('()=>P.open'))
    pg.screenshot(path='screenshots/test-v47_reconnect.png')
    time.sleep(3)
    L=ev('()=>AVLOG'); print("T2 log:", [x[1] for x in L])
    cl=[x[0] for x in L if x[1]=='close']; op=[x[0] for x in L if x[1].startswith('open')]
    if cl and op: print("T2 gap close->open ms:", op[0]-cl[-1] if op[0]>cl[0] else op[0]-cl[0])
    print("T2 after:", ev('()=>[P.open,P.started,PB.tries,document.getElementById("nf-rc").style.display]'))
    # T3 provider ends live stream -> reconnect, not close
    ev('()=>{AVLOG.length=0;webapis.avplay._L().onstreamcompleted()}'); time.sleep(3)
    print("T3 open:", ev('()=>P.open'), [x[1] for x in ev('()=>AVLOG')])
    # T4 repeated failures -> format switch -> give up -> OK retries
    ev('()=>{AVLOG.length=0;FAIL_PREP=100;webapis.avplay._L().onerror("PLAYER_ERROR_CONNECTION_FAILED")}')
    t0=time.time()
    while time.time()-t0<90 and not ev('()=>!!P.dead'): time.sleep(1)
    opens=[x[1] for x in ev('()=>AVLOG') if x[1].startswith('open')]
    print("T4 gave up after %.0fs, opens:"%(time.time()-t0), opens)
    print("T4 osd:", ev('()=>document.getElementById("osd-status").textContent'))
    pg.screenshot(path='screenshots/test-v47_gaveup.png')
    ev('()=>{FAIL_PREP=0;AVLOG.length=0}'); pg.keyboard.press('Enter'); time.sleep(3)
    print("T4 retry via OK:", ev('()=>[P.open,P.started,P.dead]'), [x[1] for x in ev('()=>AVLOG')])
    # T5 frozen clock -> watchdog reconnect
    ev('()=>{AVLOG.length=0;FREEZE=true}'); t0=time.time()
    while time.time()-t0<40 and not any(x[1].startswith('open') for x in ev('()=>AVLOG')): time.sleep(1)
    print("T5 watchdog reopened after %.0fs"%(time.time()-t0)); ev('()=>{FREEZE=false}'); time.sleep(2)
    # T6 rapid zapping -> one connection
    ev('()=>{AVLOG.length=0}')
    for i in range(5): pg.keyboard.press('ArrowDown'); time.sleep(0.15)
    time.sleep(3)
    print("T6 zap log:", [x[1] for x in ev('()=>AVLOG')], "item:", ev('()=>P.item.n'))
    # T7 VOD error -> resume at last position
    pg.keyboard.press('Escape'); time.sleep(1); ev('()=>closePlayer()'); time.sleep(1)
    ev('()=>{AVLOG.length=0;playItem({t:"movies",id:5001,n:"EN - Movie",ext:"mkv"},null,0,0)}'); time.sleep(6)
    ev('()=>{webapis.avplay._L().onerror("PLAYER_ERROR_CONNECTION_FAILED")}'); time.sleep(4)
    print("T7 vod log:", [x[1] for x in ev('()=>AVLOG')])
    # T10 scrub: tap x3 accumulates 30s, commit after idle
    ev('()=>{AVLOG.length=0}'); t0=ev('()=>webapis.avplay.getCurrentTime()')
    for i in range(3): pg.keyboard.press('ArrowRight'); time.sleep(0.35)
    pg.screenshot(path='screenshots/test-v47_scrub_tap.png')
    print("T10 scrub on:", ev('()=>[SC.on,SC.pos,document.getElementById("nf-rip").innerText]'), "playing:", ev('()=>webapis.avplay.getState()'))
    time.sleep(1.5); print("T10 seeks:", [x[1] for x in ev('()=>AVLOG') if x[1].startswith('seek')], "from", t0)
    # T11 hold right ~4s (repeat keydowns) then release
    ev('()=>{AVLOG.length=0}'); st=ev('()=>webapis.avplay.getCurrentTime()')
    pg.keyboard.down('ArrowRight'); 
    for i in range(40): pg.dispatch_event('body','keydown') if False else pg.evaluate('()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",keyCode:39,repeat:true,bubbles:true}))'); time.sleep(0.1)
    pg.screenshot(path='screenshots/test-v47_scrub_hold.png')
    print("T11 scrub pos after 4s hold: +%ds" % ((ev('()=>SC.pos')-st)/1000))
    pg.keyboard.up('ArrowRight'); time.sleep(0.6)
    print("T11 seeks:", [x[1] for x in ev('()=>AVLOG') if x[1].startswith('seek')])
    # T12 back cancels
    ev('()=>{AVLOG.length=0}'); pg.keyboard.press('ArrowLeft'); time.sleep(0.3); pg.keyboard.press('Escape'); time.sleep(1.5)
    print("T12 after back: player open", ev('()=>P.open'), "seeks", [x[1] for x in ev('()=>AVLOG') if x[1].startswith('seek')], "scrub", ev('()=>SC.on'))
    ev('()=>closePlayer()'); time.sleep(1)
    # T13 live: left/right no scrub
    ev('()=>playItem(CH[0],CH,0)'); time.sleep(3); pg.keyboard.press('ArrowRight'); time.sleep(0.3)
    print("T13 live scrub on:", ev('()=>SC.on'))
    ev('()=>closePlayer()'); time.sleep(2)
    # T9 settings
    ev('()=>openSettings()'); time.sleep(1)
    print("T9 settings has playback:", ev('()=>{var t=document.getElementById("settings-inner").innerText;return t.slice(t.indexOf("Playback"),t.indexOf("Playback")+400)}'))
    pg.evaluate('()=>{var e=document.getElementById("settings-inner");e.scrollTop=e.scrollHeight;var s=[...e.querySelectorAll(".s-sec")].pop();s.scrollIntoView();}')
    pg.screenshot(path='screenshots/test-v47_settings.png')
    print("diag:", ev('()=>pdiagSummary(24)'))
    print("ERRS:", errs); b.close()
run()
