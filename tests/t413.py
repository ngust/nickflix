#!/usr/bin/env python3
"""NickFlix 4.13 test: audio-track selection with a mocked webapis.avplay (French first, English second).
    build app with tests/config.test.js, NF_APP=<app> python3 tools/mock.py &  then  python3 tests/t413.py"""
import time, json
from playwright.sync_api import sync_playwright
FAKE = r'''
window.AVLOG=[]; window.TRACKS=[
 {index:0,type:"VIDEO",extra_info:'{"fourCC":"H264","Width":"1920"}'},
 {index:1,type:"AUDIO",extra_info:'{"language":"fre","channels":"6","fourCC":"AC3"}'},
 {index:2,type:"AUDIO",extra_info:'{"language":"eng","channels":"2","fourCC":"AAC"}'},
 {index:3,type:"TEXT",extra_info:'{"track_lang":"fre"}'}];
(function(){
  var st="NONE",L=null,t=0,timer=null,url="",cur=1;
  function log(x){AVLOG.push(x);}
  window.webapis={avplay:{
    open:function(u){url=u;st="IDLE";t=0;cur=1;log("open");}, close:function(){st="NONE";clearInterval(timer);}, stop:function(){if(st!=="NONE")st="IDLE";},
    setListener:function(l){L=l;}, setDisplayRect:function(){}, setDisplayMethod:function(){}, setBufferingParam:function(){}, setTimeoutForBuffering:function(){},
    setStreamingProperty:function(){}, getStreamingProperty:function(){return "";},
    prepareAsync:function(ok){var u=url;setTimeout(function(){if(u!==url||st!=="IDLE")return;st="READY";ok();},200);},
    play:function(){st="PLAYING";clearInterval(timer);timer=setInterval(function(){if(st==="PLAYING")t+=500;},500);},
    pause:function(){st="PAUSED";}, getState:function(){return st;}, getCurrentTime:function(){return t;}, getDuration:function(){return 7200000;},
    seekTo:function(ms,ok){t=ms;ok&&ok();}, jumpForward:function(){}, jumpBackward:function(){},
    getTotalTrackInfo:function(){return TRACKS;},
    getCurrentStreamInfo:function(){return [{index:0,type:"VIDEO"},{index:cur,type:"AUDIO"}];},
    setSelectTrack:function(ty,i){if(st!=="PLAYING"&&st!=="PAUSED"&&st!=="READY")throw {name:"InvalidStateError"};log("select "+ty+" "+i);if(ty==="AUDIO")cur=i;}
  }};
})();
'''
R = {}; ok = True
def chk(name, cond):
    global ok; R[name] = bool(cond); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE); ev = pg.evaluate
    pg.goto('http://localhost:8099/index.html')
    ev('''()=>{localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0");localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0}],last:"p1",seq:1}));}''')
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(3)
    # 1: movie starts on French -> English chosen automatically
    ev('()=>{AVLOG.length=0;playItem({t:"movies",id:777,n:"The Life Aquatic",ext:"mkv"},null,0)}'); time.sleep(5)
    R['log1'] = ev('()=>AVLOG.slice()')
    chk('auto_english', 'select AUDIO 2' in R['log1'])
    tr = ev('()=>auTracks()'); R['tracks'] = tr
    chk('parsed_names', [t['name'] for t in tr] == ['French', 'English'])
    # 2: UP opens the Audio menu, lists the tracks, current = English
    pg.keyboard.press('ArrowUp'); time.sleep(0.5)
    txt = ev('()=>document.getElementById("nf-audio").innerText'); R['menu'] = txt
    chk('menu_open', ev('()=>AU.open') and 'French' in txt and 'English' in txt)
    pg.screenshot(path='/workspace/nickflix/shots/v413_audio_menu.png')
    # 3: pick French with UP + OK -> switches live, remembered for this title
    pg.keyboard.press('ArrowUp'); pg.keyboard.press('Enter'); time.sleep(0.5)
    R['log2'] = ev('()=>AVLOG.slice(-2)')
    chk('switch_live', ev('()=>AVLOG[AVLOG.length-1]') == 'select AUDIO 1' and not ev('()=>AU.open'))
    chk('remembered', ev('()=>PD.atr["m777"]') == 'fr')
    # 4: menu closed -> player keys still work (BACK closes the player)
    ev('()=>{PD.alang="en";savePD(true);}')
    pg.keyboard.press('Escape'); time.sleep(1)
    chk('back_closes_player', not ev('()=>P.open'))
    # 5: another movie with no remembered choice -> English again; live channel too (YELLOW opens menu)
    ev('()=>{AVLOG.length=0;playItem({t:"live",id:55,n:"UK: CHANNEL",c:"1"},null,0)}'); time.sleep(6)
    chk('live_auto_english', 'select AUDIO 2' in ev('()=>AVLOG.slice()'))
    pg.keyboard.press('ArrowUp'); time.sleep(0.3)
    chk('live_up_not_menu', not ev('()=>AU.open'))
    ev('()=>window.dispatchEvent(new KeyboardEvent("keydown",{keyCode:405,bubbles:true}))'); time.sleep(0.3)
    chk('live_yellow_menu', ev('()=>AU.open'))
    pg.keyboard.press('Escape'); time.sleep(0.3)
    chk('back_closes_menu_only', (not ev('()=>AU.open')) and ev('()=>P.open'))
    ev('()=>closePlayer()'); time.sleep(1)
    # 6: single-track stream -> nothing selected, no error
    ev('()=>{TRACKS=TRACKS.filter(function(t){return t.index!==2});AVLOG.length=0;playItem({t:"movies",id:778,n:"Mono",ext:"mp4"},null,0)}'); time.sleep(5)
    chk('single_track_noop', not any(x.startswith('select') for x in ev('()=>AVLOG.slice()')))
    ev('()=>closePlayer()')
    R['errors'] = errs; chk('no_page_errors', not errs)
    b.close()
print(json.dumps(R, indent=1)); print('PASS' if ok else 'FAIL')
