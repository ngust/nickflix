import time, json, subprocess, sys, os
from playwright.sync_api import sync_playwright
FAKE = r'''
window.AVLOG=[]; window.RATES="1000000|3000000|6000000"; window.LIVEWIN="0|120000";
(function(){
  var st="NONE", L=null, t=0, timer=null, url="";
  function log(x){AVLOG.push(x);}
  window.webapis={avplay:{
    open:function(u){url=u;st="IDLE";t=0;log("open "+u.replace(/^https?:\/\/[^\/]+/,"").replace(/^\/(live|movie|series)\/[^\/]+\/[^\/]+\//,"$1/")+" @"+u.split("/")[2]);},
    close:function(){log("close");st="NONE";clearInterval(timer);},
    stop:function(){if(st!=="NONE")st="IDLE";clearInterval(timer);},
    setListener:function(l){L=l;}, setDisplayRect:function(){}, setDisplayMethod:function(){},
    setBufferingParam:function(a,b,c){log("buf "+a.replace("PLAYER_BUFFER_FOR_","")+" "+c);}, setTimeoutForBuffering:function(s){log("bto "+s);},
    setStreamingProperty:function(k,v){log("prop "+k+" "+v);},
    getStreamingProperty:function(k){return k==="AVAILABLE_BITRATE"?RATES:k==="GET_LIVE_DURATION"?LIVEWIN:"";},
    prepareAsync:function(ok,err){var u=url;setTimeout(function(){ if(u!==url||st!=="IDLE")return; st="READY";ok();},200);},
    play:function(){st="PLAYING";log("play");clearInterval(timer);timer=setInterval(function(){if(st==="PLAYING")t+=500;},500);},
    pause:function(){st="PAUSED";log("pause");}, getState:function(){return st;}, getCurrentTime:function(){return t;}, getDuration:function(){return 7200000;},
    seekTo:function(ms,ok){t=ms;ok&&ok();}, jumpForward:function(){}, jumpBackward:function(){},
    _L:function(){return L;}
  }};
})();
'''
R = {}
def main():
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg = b.new_page(viewport={'width':1920,'height':1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE)
    ev = lambda s, *a: pg.evaluate(s, *a)
    def boot(ls):
        pg.goto('http://localhost:8099/index.html')
        ev('''(ls)=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0}],last:"p1",seq:1}));for(var k in ls)localStorage.setItem(k,ls[k]);}''', ls)
        pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    # --- A: default + migration
    boot({}); R["A_default"] = ev('()=>pbCfg().buf')
    boot({"nf_play": json.dumps({"buf": "large", "fmt": "auto"})}); R["A_migrate_large"] = ev('()=>[pbCfg().buf, JSON.parse(localStorage.nf_play).v]')
    boot({"nf_play": json.dumps({"buf": "max", "fmt": "auto"})}); R["A_keep_max"] = ev('()=>pbCfg().buf')
    boot({})
    ev('''()=>{window.IT=[];for(var i=0;i<4;i++)IT.push({t:"live",id:1000+i,n:"UK: SKY SPORTS F1 FHD",c:"1"});IT[1].n="UK: SKY SPORTS F1 HD";
          CH.all=[{id:1000,n:"UK: SKY SPORTS F1 FHD"},{id:1001,n:"UK: SKY SPORTS F1 HD"},{id:1002,n:"UK: SKY SPORTS F1 SD"}];AVLOG.length=0;}''')
    # --- B: open live with Extra-stable
    ev('()=>playItem(IT[0],IT,0)'); time.sleep(4)
    R["B_open"] = ev('()=>AVLOG.slice()')
    R["B_osd_hint_during_fill"] = None
    # --- C: stutter -> refill pause
    ev('()=>{AVLOG.length=0;var L=webapis.avplay._L();L.onbufferingstart();L.onbufferingcomplete();}'); time.sleep(0.5)
    ev('()=>{var L=webapis.avplay._L();L.onbufferingstart();L.onbufferingcomplete();}'); time.sleep(1.2)
    R["C_after_2_stalls"] = ev('()=>({state:webapis.avplay.getState(),badge:(document.getElementById("nf-rc")||{}).textContent,log:AVLOG.slice()})')
    pg.screenshot(path='/workspace/nickflix/shots/v410_refill_mock.png')
    time.sleep(11)
    R["C_after_refill"] = ev('()=>({state:webapis.avplay.getState(),badge:document.getElementById("nf-rc").style.display})')
    # --- D: 3rd stall within 5 min -> bitrate step-down + reopen
    ev('()=>{AVLOG.length=0;var L=webapis.avplay._L();L.onbufferingstart();L.onbufferingcomplete();}'); time.sleep(5)
    R["D_stepdown"] = ev('()=>({log:AVLOG.slice(),cap:PB.sess.cap,toast:document.getElementById("toast").textContent})')
    # --- E: next escalation (after 3-min throttle) without bitrates -> sibling HD channel
    ev('()=>{AVLOG.length=0;RATES="";PB.sess.rates=null;PB.sess.lastEsc=0;var L=webapis.avplay._L();for(var i=0;i<3;i++){L.onbufferingstart();PB.sess.st.push(Date.now());}L.onbufferingcomplete();}'); time.sleep(5)
    R["E_sibling"] = ev('()=>({log:AVLOG.slice(),item:P.item.n,toast:document.getElementById("toast").textContent})')
    # --- F: reconnect after error comes back at LOWEST bitrate
    ev('()=>{AVLOG.length=0;webapis.avplay._L().onerror("PLAYER_ERROR_CONNECTION_FAILED")}'); time.sleep(5)
    R["F_reconnect"] = ev('()=>AVLOG.slice()')
    ev('()=>closePlayer()'); time.sleep(1)
    # --- G: proxy on but not running -> direct; then proxy running -> rewritten URLs
    ev('()=>{localStorage.setItem("nf_proxy",JSON.stringify({on:true,url:"http://127.0.0.1:9912"}));PX.ok=null;pxCheck();}'); time.sleep(3)
    ev('()=>{AVLOG.length=0;playItem(IT[2],IT,2)}'); time.sleep(4)
    R["G_proxy_down"] = ev('()=>({ok:PX.ok,log:AVLOG.slice(0,2),urls:P.urls.length})')
    ev('()=>closePlayer()')
    px = subprocess.Popen([sys.executable, "/workspace/nickflix/proxy/nfproxy.py"], env=dict(os.environ, NF_PORT="9912"), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    try:
        time.sleep(1.5); ev('()=>{PX.ok=null;pxCheck();}'); time.sleep(2)
        ev('()=>{AVLOG.length=0;playItem(IT[2],IT,2)}'); time.sleep(4)
        R["G_proxy_up"] = ev('()=>({ok:PX.ok,log:AVLOG.slice(0,2),urls:P.urls})'.replace("urls:P.urls","urls:P.urls.map(function(u){return u.replace(/\\/live\\/[^\\/]+\\/[^\\/]+\\//,'/live/*/*/')})"))
        ev('()=>closePlayer()'); time.sleep(1)
        # --- H: Settings page render
        ev('()=>{openSettings();}'); time.sleep(1.5)
        ev('()=>{var i=document.getElementById("settings-inner");}')
        R["H_settings"] = ev('''()=>Array.from(document.querySelectorAll("#settings-inner .chip, #settings-inner .s-note, #settings-inner .s-sec")).map(function(e){return e.textContent}).filter(function(t){return /Buffer|proxy|Proxy|format|step|Playback|4\\.10|Last 24/.test(t)})''')
        ev('''()=>{var el=Array.from(document.querySelectorAll("#settings-inner .s-sec")).filter(function(e){return /Playback/.test(e.textContent)})[0]; if(el){var y=el.offsetTop; document.getElementById("settings-inner").style.transform="translateY("+(-y+120)+"px)";}}''')
        time.sleep(0.5); pg.screenshot(path='/workspace/nickflix/shots/v410_settings_mock.png')
    finally:
        px.terminate()
    R["errors"] = errs
    b.close()
main()
print(json.dumps(R, indent=1))
