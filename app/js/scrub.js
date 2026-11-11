/* ================= NickFlix 4.7 — Netflix-style scrubbing (VOD + NAS) =================
   LEFT/RIGHT (and REW/FF) move a scrub marker while the video keeps playing; one seek on
   release / OK / ~1 s idle. Holding accelerates 10 s -> 30 s -> 60 s -> 2 min -> 5 min steps.
   A tap jumps 10 s (taps add up: 10, 20, 30 …) with a ripple. BACK cancels. Live (no duration) is untouched. */
var SC = { on: false, pos: 0, dur: 0, dir: 0, holdStart: 0, lastKey: 0, lastStep: 0, taps: 0, commitT: null, ripT: null, el: null };
/* media keys need the tv.inputdevice privilege (config.xml) and explicit registration */
(function () {
  var keys = ["MediaFastForward", "MediaRewind", "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop"];
  try { if (window.tizen && tizen.tvinputdevice) { if (tizen.tvinputdevice.registerKeyBatch) tizen.tvinputdevice.registerKeyBatch(keys, function () {}, function () { keys.forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e1) {} }); }); else keys.forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e2) {} }); } } catch (e) {}
})();

function scTimes() { var c = curTimes(); return { t: c.t || 0, d: c.d || 0 }; }
function scCan() { if (!P.open || !P.vod) return false; var d = scTimes().d; return d > 60000 && isFinite(d); }
function scFmt(ms) { ms = Math.max(0, Math.round(ms / 1000)); var h = Math.floor(ms / 3600), m = Math.floor(ms % 3600 / 60), s = ms % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s; }
function scUI() {
  if (SC.el) return SC.el;
  var st = document.createElement("style");
  st.textContent = "#nf-scrub{position:fixed;left:0;bottom:0;width:1920px;height:380px;z-index:99990;background:linear-gradient(0deg,rgba(0,0,0,.92),rgba(0,0,0,0));display:none;font-family:sans-serif;color:#fff}" +
    "#nf-scrub .sc-title{position:absolute;left:90px;bottom:262px;font:800 40px/1.2 sans-serif;max-width:1200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    "#nf-scrub .sc-bar{position:absolute;left:90px;right:330px;bottom:110px;height:10px;border-radius:5px;background:rgba(255,255,255,.28)}" +
    "#nf-scrub .sc-play{position:absolute;left:0;top:0;bottom:0;background:rgba(255,255,255,.55);border-radius:5px}" +
    "#nf-scrub .sc-fill{position:absolute;left:0;top:0;bottom:0;background:#e50914;border-radius:5px}" +
    "#nf-scrub .sc-knob{position:absolute;top:-13px;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:#e50914;box-shadow:0 0 0 4px rgba(255,255,255,.25)}" +
    "#nf-scrub .sc-big{position:absolute;bottom:42px;transform:translateX(-50%);padding:10px 22px;border-radius:12px;background:rgba(20,20,20,.92);border:2px solid rgba(255,255,255,.35);font:800 54px/1 sans-serif;white-space:nowrap}" +
    "#nf-scrub .sc-big small{display:block;font:600 24px/1.4 sans-serif;color:#ffcf3a;text-align:center}" +
    "#nf-scrub .sc-big{bottom:140px}" +
    "#nf-scrub .sc-rem{position:absolute;right:90px;bottom:96px;font:700 34px/1 sans-serif}" +
    "#nf-scrub .sc-el{position:absolute;left:90px;bottom:50px;font:600 28px/1 sans-serif;color:#ddd}" +
    "#nf-scrub .sc-hint{position:absolute;right:90px;bottom:50px;font:500 24px/1 sans-serif;color:#bbb}" +
    "#nf-rip{position:fixed;top:440px;width:200px;height:200px;margin-left:-100px;border-radius:50%;background:rgba(255,255,255,.18);z-index:99991;display:none;text-align:center;color:#fff;font:800 56px/200px sans-serif;transition:opacity .45s,transform .45s}" +
    "#nf-rip span{font-size:70px;vertical-align:middle}";
  document.head.appendChild(st);
  var el = document.createElement("div"); el.id = "nf-scrub";
  el.innerHTML = '<div class="sc-title"></div><div class="sc-bar"><div class="sc-play"></div><div class="sc-fill"></div><div class="sc-knob"></div></div><div class="sc-big"></div><div class="sc-rem"></div><div class="sc-el"></div><div class="sc-hint">OK  jump here     BACK  cancel</div>';
  document.body.appendChild(el);
  var r = document.createElement("div"); r.id = "nf-rip"; document.body.appendChild(r);
  SC.el = el; return el;
}
function scDraw() {
  var el = scUI(), now = scTimes(), d = SC.dur || now.d || 1, f = Math.max(0, Math.min(1, SC.pos / d)), pf = Math.max(0, Math.min(1, now.t / d));
  var q = function (c) { return el.getElementsByClassName(c)[0]; };
  q("sc-title").textContent = P.title || "";
  q("sc-fill").style.width = (f * 100) + "%"; q("sc-play").style.width = (pf * 100) + "%"; q("sc-knob").style.left = (f * 100) + "%";
  var delta = SC.pos - now.t, big = q("sc-big");
  big.innerHTML = scFmt(SC.pos) + "<small>" + (delta >= 0 ? "+" : "\u2212") + scFmt(Math.abs(delta)) + "</small>";
  big.style.left = Math.max(180, Math.min(1500, 90 + f * (1920 - 90 - 330))) + "px";
  q("sc-rem").textContent = "\u2212" + scFmt(d - SC.pos);
  q("sc-el").textContent = scFmt(SC.pos) + " / " + scFmt(d);
  el.style.display = "block";
  try { $("osd").classList.add("hide"); } catch (e) {}
}
function scRipple(dir, secs) {
  scUI(); var r = $("nf-rip"); clearTimeout(SC.ripT);
  r.style.left = (dir > 0 ? 1440 : 480) + "px";
  r.innerHTML = dir > 0 ? secs + ' <span>\u21BB</span>' : '<span>\u21BA</span> ' + secs;
  r.style.display = "block"; r.style.opacity = "1"; r.style.transform = "scale(1)";
  SC.ripT = setTimeout(function () { r.style.opacity = "0"; r.style.transform = "scale(1.25)"; SC.ripT = setTimeout(function () { r.style.display = "none"; }, 450); }, 550);
}
function scStepFor(heldMs) { return heldMs < 2000 ? 10000 : heldMs < 5000 ? 30000 : heldMs < 9000 ? 60000 : heldMs < 15000 ? 120000 : 300000; }
function scKey(dir, isRepeat) {
  var now = Date.now(), t = scTimes();
  if (!SC.on) { SC.on = true; SC.pos = t.t; SC.dur = t.d; SC.taps = 0; SC.dir = 0; SC.holdStart = now; }
  if (SC.dir && SC.dir !== dir) SC.holdStart = now;
  var held = isRepeat || (SC.dir === dir && now - SC.lastKey < 260);
  if (!held) { SC.holdStart = now; if (SC.dir !== dir) SC.taps = 0; }
  SC.dir = dir; SC.lastKey = now;
  var step;
  if (held) { if (now - SC.lastStep < 240) { scArm(); return; } step = scStepFor(now - SC.holdStart); }
  else { step = 10000; SC.taps++; scRipple(dir, SC.taps * 10); }
  SC.lastStep = now;
  SC.pos = Math.max(0, Math.min(SC.dur - 3000, SC.pos + dir * step));
  scDraw(); scArm();
}
function scArm(ms) { clearTimeout(SC.commitT); SC.commitT = setTimeout(scCommit, ms || 1000); }
function scCommit() {
  clearTimeout(SC.commitT); if (!SC.on) return;
  var pos = SC.pos; SC.on = false; SC.taps = 0; SC.dir = 0;
  if (SC.el) SC.el.style.display = "none";
  if (!P.open) return;
  try {
    if (P.useAV) webapis.avplay.seekTo(Math.round(pos), function () {}, function () {});
    else $("video").currentTime = pos / 1000;
  } catch (e) {}
  try { PB.lastMove = Date.now(); PB.lastT = -1; } catch (e2) {}
  P.resume = pos;
  osd(scFmt(pos) + " / " + scFmt(SC.dur), null, false);
}
function scCancel() { clearTimeout(SC.commitT); SC.on = false; SC.taps = 0; SC.dir = 0; if (SC.el) SC.el.style.display = "none"; osd("", null, false); }

window.addEventListener("keydown", function (e) {
  if (!P.open || typeof keyName !== "function") return;
  var k = keyName(e);
  if (SC.on && (k === "back" || k === "enter" || k === "play" || k === "pause" || k === "playpause" || k === "stop")) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (k === "back" || k === "stop") scCancel(); else scCommit();
    return;
  }
  if (k !== "left" && k !== "right" && k !== "ff" && k !== "rw") return;
  if (!scCan()) return;                       // live channels / unknown duration: old behaviour
  e.preventDefault(); e.stopImmediatePropagation();
  scKey(k === "right" || k === "ff" ? 1 : -1, !!e.repeat);
}, true);
window.addEventListener("keyup", function (e) {
  if (!SC.on || typeof keyName !== "function") return;
  var k = keyName(e);
  if (k !== "left" && k !== "right" && k !== "ff" && k !== "rw") return;
  if (Date.now() - SC.holdStart > 450) scArm(250);   // released after a hold -> jump right away
}, true);
var _closePlayerSc = closePlayer;
closePlayer = function () { if (SC.on) scCancel(); _closePlayerSc(); };
var _hintText46 = hintText;
hintText = function () { return P.vod ? "OK  pause / play      \u25C0 \u25B6  scrub (hold to go faster)      BACK  exit" : _hintText46(); };
