/* NickFlix 4.9 mini intro: ~2.2 s logo sting (same look as the 4.8 intro) shown when a movie, episode
   or My Media file starts. It runs on top while AVPlay prepares underneath, so it never delays playback;
   by the time it fades the stream has usually buffered. Any key skips it (the key is swallowed).
   Live channels: off by default (separate toggle); never on channel up/down or reconnects (those use
   playURL, not startPlayback). Settings > App: "Intro before shows" / "...also before live channels". */
"use strict";
var NFM = { on: false, el: null, t: [], ctx: null, g: null, LEN: 2.25 };
function miniEnabled() { try { return localStorage.getItem("nf_mini") !== "0"; } catch (e) { return true; } }
function miniLiveEnabled() { try { return localStorage.getItem("nf_mini_live") === "1"; } catch (e) { return false; } }
function miniBuild() {
  var root = document.createElement("div"); root.id = "mini";
  root.innerHTML = '<div class="nm-bg"></div><div class="nm-world"><div class="nm-tunnel"></div></div><div class="nm-streak"></div>' +
    '<div class="nm-cam"><div class="nm-rig"><div class="nm-glow"></div><div class="nm-ext"></div><div class="nm-face"><div class="nm-sheen"><i></i></div></div></div></div>' +
    '<div class="nm-ring"></div><div class="nm-flash"></div>';
  var ext = root.querySelector(".nm-ext");
  for (var i = 1; i <= 7; i++) { var d = document.createElement("div"); d.className = "nm-side"; d.style.transform = "translateZ(" + (-i * 5) + "px)"; ext.appendChild(d); }
  var tun = root.querySelector(".nm-tunnel"), R = introRand(9157);
  for (var k = 0; k < 30; k++) {
    var r = document.createElement("div"); r.className = "nm-rib";
    var side = k % 2 ? 1 : -1, x = side * (40 + Math.pow(R(), 1.3) * 1200), z = -400 - R() * 3400, w = 6 + Math.round(R() * 44);
    var c = NFI_COLS[Math.floor(R() * NFI_COLS.length)];
    r.style.width = w + "px"; r.style.marginLeft = (-w / 2) + "px";
    r.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round((R() - 0.5) * 260) + "px," + Math.round(z) + "px)";
    r.style.background = "linear-gradient(180deg,rgba(0,0,0,0) 0%," + c + " 22%,#fff6e6 50%," + c + " 78%,rgba(0,0,0,0) 100%)";
    tun.appendChild(r);
  }
  return root;
}
/* short sound: one "dum" hit + bell shimmer + dive whoosh. One shared AudioContext (TVs cap the count). */
function miniSynth(ctx, out, t0) {
  var sr = ctx.sampleRate, R = introRand(311);
  var master = ctx.createGain(); master.gain.value = 0.42;
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5;
  master.connect(comp); comp.connect(out);
  var rev = ctx.createConvolver(), len = Math.floor(sr * 1.8), ir = ctx.createBuffer(2, len, sr);
  for (var c = 0; c < 2; c++) { var dch = ir.getChannelData(c); for (var i = 0; i < len; i++) dch[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 3); }
  rev.buffer = ir; var rg = ctx.createGain(); rg.gain.value = 0.35; rev.connect(rg); rg.connect(master);
  function nb(sec) { var n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = R() * 2 - 1; return b; }
  function env(g, at, peak, a, hold, rel) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.setValueAtTime(peak, at + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel); }
  var HIT = t0 + 0.32;
  // pre-whoosh
  var w0 = ctx.createBufferSource(); w0.buffer = nb(0.4); var b0 = ctx.createBiquadFilter(); b0.type = "bandpass"; b0.Q.value = 1.2;
  b0.frequency.setValueAtTime(300, t0); b0.frequency.exponentialRampToValueAtTime(3500, HIT);
  var g0 = ctx.createGain(); g0.gain.setValueAtTime(0.0001, t0); g0.gain.exponentialRampToValueAtTime(0.25, HIT - 0.02); g0.gain.exponentialRampToValueAtTime(0.0001, HIT + 0.05);
  w0.connect(b0); b0.connect(g0); g0.connect(master); w0.start(t0); w0.stop(HIT + 0.1);
  // hit
  var k = ctx.createOscillator(), kg = ctx.createGain(); k.type = "sine"; k.frequency.setValueAtTime(140, HIT); k.frequency.exponentialRampToValueAtTime(34, HIT + 0.6);
  kg.gain.setValueAtTime(0.0001, HIT); kg.gain.exponentialRampToValueAtTime(1.0, HIT + 0.006); kg.gain.exponentialRampToValueAtTime(0.0001, HIT + 1.5);
  k.connect(kg); kg.connect(master); kg.connect(rev); k.start(HIT); k.stop(HIT + 1.6);
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1800, HIT); lp.frequency.exponentialRampToValueAtTime(220, HIT + 1.4);
  var bg = ctx.createGain(); env(bg, HIT, 0.16, 0.01, 0.1, 1.4); lp.connect(bg); bg.connect(master); bg.connect(rev);
  [73.42, 110, 146.83, 185, 220].forEach(function (f, i) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = i % 2 ? 6 : -6; o.connect(lp); o.start(HIT); o.stop(HIT + 1.6); });
  var cr = ctx.createBufferSource(); cr.buffer = nb(0.2); var cf = ctx.createBiquadFilter(); cf.type = "lowpass"; cf.frequency.value = 2400;
  var cg = ctx.createGain(); env(cg, HIT, 0.4, 0.002, 0, 0.12); cr.connect(cf); cf.connect(cg); cg.connect(master); cg.connect(rev); cr.start(HIT);
  [880, 1174.66, 1479.98].forEach(function (f, i) { var at = HIT + 0.15 + i * 0.09, o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = f; env(g, at, 0.04, 0.01, 0.03, 0.9); o.connect(g); g.connect(master); g.connect(rev); o.start(at); o.stop(at + 1.0); });
  // dive whoosh
  var D = t0 + 1.15, wn = ctx.createBufferSource(); wn.buffer = nb(1.0); var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(400, D); bp.frequency.exponentialRampToValueAtTime(6500, D + 0.8);
  var wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, D); wg.gain.exponentialRampToValueAtTime(0.3, D + 0.65); wg.gain.exponentialRampToValueAtTime(0.0001, D + 1.0);
  wn.connect(bp); bp.connect(wg); wg.connect(master); wg.connect(rev); wn.start(D); wn.stop(D + 1.0);
  return master;
}
function miniSound() {
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    if (!NFM.ctx) NFM.ctx = new AC();
    var ctx = NFM.ctx; if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    var bus = ctx.createGain(); bus.connect(ctx.destination); NFM.g = bus;
    miniSynth(ctx, bus, ctx.currentTime + 0.04);
  } catch (e) { try { console.log("NFMINI audio error " + e); } catch (e2) {} }
}
function miniStopSound(fast) {
  var g = NFM.g, ctx = NFM.ctx; NFM.g = null; if (!g || !ctx) return;
  try { g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + (fast ? 0.08 : 0.4)); } catch (e) {}
  setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 1500);
}
function miniEnd(skipped) {
  if (!NFM.on) return; NFM.on = false;
  NFM.t.forEach(clearTimeout); NFM.t = [];
  if (skipped) miniStopSound(true);
  var el = NFM.el; NFM.el = null; if (!el) return;
  el.classList.add("nm-out"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}
function playMini(opts) {
  opts = opts || {};
  if (NFM.on) miniEnd(true);
  NFM.on = true;
  var el = miniBuild(); NFM.el = el; document.body.appendChild(el);
  if (!opts.silent) miniSound();
  void el.offsetWidth; el.classList.add("nm-go");
  if (!opts.noEnd) NFM.t.push(setTimeout(function () { miniEnd(false); }, NFM.LEN * 1000));
}
// any key skips; registered before scrub.js / screens.js so it sees the key first
window.addEventListener("keydown", function (e) {
  if (!NFM.on) return;
  e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  miniEnd(true);
}, true);
function miniWanted(urls, vod) {
  if (NFI && NFI.on) return false;                      // app intro still on screen
  var u = String((urls && urls[0]) || ""), live = !vod && /\/live\/|\.m3u8(\?|$)|\.ts(\?|$)/.test(u) && !/\/movie\/|\/series\//.test(u);
  if (live) return miniLiveEnabled() && miniEnabled();
  return miniEnabled();
}
window.addEventListener("load", function () {
  if (typeof startPlayback !== "function") return;
  var _sp = startPlayback;
  startPlayback = function (title, urls, vod, resumeMs) {
    var want = false; try { want = miniWanted(urls, vod); } catch (e) {}
    if (want) { try { playMini(); } catch (e) {} }
    return _sp(title, urls, vod, resumeMs);              // playback starts underneath right away
  };
  if (typeof closePlayer === "function") { var _cp = closePlayer; closePlayer = function () { miniEnd(true); return _cp.apply(this, arguments); }; }
});
