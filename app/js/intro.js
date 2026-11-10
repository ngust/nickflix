/* NickFlix intro: original light-streak / letter-assembly / zoom-through animation with a
   Web Audio sound synthesized at runtime (sub hit + rising shimmer). Any key skips it.
   Runs on top of the app; data loading starts underneath at the same time. */
"use strict";
var NFI = { on: false, ctx: null, t: [], el: null };
function introEnabled() { try { return localStorage.getItem("nf_intro") !== "0"; } catch (e) { return true; } }
function introLog(s) { try { console.log("NFINTRO " + s); localStorage.setItem("nf_intro_last", new Date().toISOString() + " " + s); } catch (e) {} }
var NFI_SLICES = [[0, 121], [121, 171], [171, 277], [277, 383], [383, 469], [469, 557], [557, 604], [604, 727]];
function introBuild() {
  var S = 1.55, root = document.createElement("div"); root.id = "intro";
  root.innerHTML = '<div class="ni-glow"></div><div class="ni-streak"></div><div class="ni-ring"></div>' +
    '<div class="ni-stage"><div class="ni-logo"></div></div><div class="ni-flash"></div>';
  var logo = root.querySelector(".ni-logo"), mid = (NFI_SLICES.length - 1) / 2;
  logo.style.width = 727 + "px"; logo.style.height = 247 + "px"; logo.style.marginLeft = (-727 / 2) + "px"; logo.style.marginTop = (-247 / 2) + "px";
  root.querySelector(".ni-stage").style.transform = "scale(" + S + ")";
  NFI_SLICES.forEach(function (s, i) {
    var d = document.createElement("div"); d.className = "ni-l";
    d.style.left = s[0] + "px"; d.style.width = (s[1] - s[0]) + "px"; d.style.backgroundPosition = (-s[0]) + "px 0";
    var dist = Math.abs(i - mid);
    d.style.animationDelay = (0.22 + dist * 0.09) + "s";
    d.style.setProperty ? d.style.setProperty("--dy", (i % 2 ? 60 : -60) + "px") : 0;
    d.className += i % 2 ? " dn" : " up";
    logo.appendChild(d);
  });
  var sw = document.createElement("div"); sw.className = "ni-swoosh"; logo.appendChild(sw);
  var sh = document.createElement("div"); sh.className = "ni-sheen"; sh.innerHTML = "<i></i>"; logo.appendChild(sh);
  return root;
}
/* ---------- sound ---------- */
function introSound() {
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { introLog("audio=unsupported"); return; }
  var ctx; try { ctx = new AC(); } catch (e) { introLog("audio=error " + e); return; }
  NFI.ctx = ctx;
  var t0 = ctx.currentTime + 0.05, sr = ctx.sampleRate;
  var master = ctx.createGain(); master.gain.value = 0.85;
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  // generated reverb
  var rev = ctx.createConvolver(), len = Math.floor(sr * 2.6), ir = ctx.createBuffer(2, len, sr);
  for (var c = 0; c < 2; c++) { var dch = ir.getChannelData(c); for (var i = 0; i < len; i++) dch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
  rev.buffer = ir; var revG = ctx.createGain(); revG.gain.value = 0.38; rev.connect(revG); revG.connect(master);
  function noiseBuf(sec) { var n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  function env(g, at, peak, a, hold, rel) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.setValueAtTime(peak, at + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel); }
  var HIT = t0 + 1.12;
  // 1) rising whoosh (filtered noise) into the hit
  var wn = ctx.createBufferSource(); wn.buffer = noiseBuf(1.3);
  var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4; bp.frequency.setValueAtTime(250, t0); bp.frequency.exponentialRampToValueAtTime(5200, HIT);
  var wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, t0); wg.gain.exponentialRampToValueAtTime(0.32, HIT - 0.05); wg.gain.exponentialRampToValueAtTime(0.0001, HIT + 0.08);
  wn.connect(bp); bp.connect(wg); wg.connect(master); wg.connect(rev); wn.start(t0); wn.stop(HIT + 0.2);
  // 2) rising tonal riser (detuned triangles, D minor-ish fifth stack)
  [146.8, 220, 293.7, 440].forEach(function (f, k) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.detune.value = (k - 1.5) * 7;
    o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 2, HIT);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, HIT - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, HIT + 0.05);
    o.connect(g); g.connect(master); g.connect(rev); o.start(t0); o.stop(HIT + 0.1);
  });
  // 3) the HIT: pitch-dropping sub kick + body chord + noise crack
  var k1 = ctx.createOscillator(), kg = ctx.createGain(); k1.type = "sine";
  k1.frequency.setValueAtTime(160, HIT); k1.frequency.exponentialRampToValueAtTime(36, HIT + 0.55);
  kg.gain.setValueAtTime(0.0001, HIT); kg.gain.exponentialRampToValueAtTime(1.0, HIT + 0.008); kg.gain.exponentialRampToValueAtTime(0.0001, HIT + 1.7);
  var ws = ctx.createWaveShaper(), curve = new Float32Array(1024); for (var j = 0; j < 1024; j++) { var x = j / 512 - 1; curve[j] = Math.tanh(2.2 * x); } ws.curve = curve;
  k1.connect(ws); ws.connect(kg); kg.connect(master); k1.start(HIT); k1.stop(HIT + 1.8);
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1400, HIT); lp.frequency.exponentialRampToValueAtTime(180, HIT + 2.2);
  var bg = ctx.createGain(); env(bg, HIT, 0.22, 0.01, 0.15, 2.1); lp.connect(bg); bg.connect(master); bg.connect(rev);
  [73.4, 110, 146.8, 174.6].forEach(function (f, k) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = k % 2 ? 6 : -6; o.connect(lp); o.start(HIT); o.stop(HIT + 2.5); });
  var cr = ctx.createBufferSource(); cr.buffer = noiseBuf(0.5); var cf = ctx.createBiquadFilter(); cf.type = "lowpass"; cf.frequency.value = 2500;
  var cg = ctx.createGain(); env(cg, HIT, 0.5, 0.003, 0.0, 0.35); cr.connect(cf); cf.connect(cg); cg.connect(master); cg.connect(rev); cr.start(HIT);
  // 4) rising shimmer after the hit (bell partials arpeggiating upward)
  [587.3, 880, 1174.7, 1760, 2349.3, 2637].forEach(function (f, k) {
    var at = HIT + 0.18 + k * 0.12, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.01;
    var g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(g);
    env(g, at, 0.05, 0.02, 0.05, 1.4); o.connect(g); g.connect(master); g.connect(rev);
    o.start(at); o2.start(at); o.stop(at + 1.6); o2.stop(at + 1.6);
  });
  // 5) airy shimmer pad swelling into the zoom
  var sp = ctx.createBufferSource(); sp.buffer = noiseBuf(2.2); var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(3000, HIT + 0.3); hp.frequency.exponentialRampToValueAtTime(9000, HIT + 2.4);
  var sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, HIT + 0.3); sg.gain.exponentialRampToValueAtTime(0.05, HIT + 1.7); sg.gain.exponentialRampToValueAtTime(0.0001, HIT + 2.5);
  sp.connect(hp); hp.connect(sg); sg.connect(rev); sg.connect(master); sp.start(HIT + 0.3);
  var log = function () { introLog("audio=" + ctx.state + " t=" + ctx.currentTime.toFixed(2)); };
  if (ctx.state === "suspended" && ctx.resume) ctx.resume().then(log, log); else log();
  setTimeout(log, 1500);
}
function introStopSound() {
  var ctx = NFI.ctx; if (!ctx) return; NFI.ctx = null;
  try { var g = ctx.createGain(); } catch (e) {}
  setTimeout(function () { try { ctx.close(); } catch (e) {} }, 250);
  try { ctx.suspend && ctx.suspend(); } catch (e) {}
}
function introEnd(skipped) {
  if (!NFI.on) return; NFI.on = false;
  NFI.t.forEach(clearTimeout); NFI.t = [];
  window.removeEventListener("keydown", introKey, true);
  introLog(skipped ? "skipped" : "done");
  if (skipped) introStopSound(); else setTimeout(introStopSound, 1200);
  var el = NFI.el; if (!el) return;
  el.classList.add("ni-out"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
}
function introKey(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); introEnd(true); }
function playIntro() {
  if (!introEnabled()) { introLog("disabled"); return; }
  NFI.on = true;
  var el = introBuild(); NFI.el = el; document.body.appendChild(el);
  window.addEventListener("keydown", introKey, true);
  try { introSound(); } catch (e) { introLog("audio=error " + e); }
  void el.offsetWidth; el.classList.add("ni-go");
  NFI.t.push(setTimeout(function () { introEnd(false); }, 3750));
}
playIntro();
