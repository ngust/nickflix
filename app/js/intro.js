/* NickFlix 4.8 intro: cinematic logo reveal.
   Timeline (s): 0.0 anamorphic streak ignites | 0.38 "TA" logo slams in from depth (extruded 3D)
   | 0.80 "DUM" punch, flash, shockwave, glow bloom, light sweep | 0.9-2.5 slow push-in while light ribbons
   rise behind the logo | 2.5-3.9 camera dives through the logo into a tunnel of light ribbons | 4.1-4.4 fade.
   All visuals are CSS animations (GPU transform/opacity only). Sound is synthesized at runtime with Web Audio
   (original two-hit "ta-dum" + chord bloom + ribbon whoosh); nothing is sampled. Any key skips. */
"use strict";
var NFI = { on: false, ctx: null, t: [], el: null, LEN: 4.4 };
function introEnabled() { try { return localStorage.getItem("nf_intro") !== "0"; } catch (e) { return true; } }
function introLog(s) { try { console.log("NFINTRO " + s); localStorage.setItem("nf_intro_last", new Date().toISOString() + " " + s); } catch (e) {} }
var NFI_COLS = ["#e50914", "#ff3b1f", "#ff6a1a", "#ffb03a", "#ffd27a", "#ff2d6f", "#c21a7a", "#7a2cff", "#3d7bff", "#ff8a3d"];
function introRand(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function introBuild() {
  var root = document.createElement("div"); root.id = "intro";
  root.innerHTML =
    '<div class="ni-bgglow"></div>' +
    '<div class="ni-world"><div class="ni-tunnel"></div></div>' +
    '<div class="ni-streak"></div>' +
    '<div class="ni-cam"><div class="ni-rig">' +
      '<div class="ni-glowimg"></div><div class="ni-ext"></div>' +
      '<div class="ni-face"><div class="ni-sheen"><i></i></div></div>' +
    '</div></div>' +
    '<div class="ni-ring"></div><div class="ni-flare f1"></div><div class="ni-flare f2"></div>' +
    '<div class="ni-flash"></div><div class="ni-vig"></div>';
  // extrusion: stacked side-colour copies stepping back in Z = solid 3D letters
  var ext = root.querySelector(".ni-ext");
  for (var i = 1; i <= 9; i++) { var d = document.createElement("div"); d.className = "ni-side"; d.style.transform = "translateZ(" + (-i * 5) + "px)"; d.style.opacity = (1 - i * 0.06).toFixed(2); ext.appendChild(d); }
  // light ribbons: vertical glowing strips scattered through depth
  var tun = root.querySelector(".ni-tunnel"), R = introRand(4807);
  for (var k = 0; k < 56; k++) {
    var r = document.createElement("div"); r.className = "ni-rib";
    var side = k % 2 ? 1 : -1, x = side * (40 + Math.pow(R(), 1.3) * 1300), z = -500 - R() * 4600, w = 6 + Math.round(R() * 52);
    var c = NFI_COLS[Math.floor(R() * NFI_COLS.length)];
    r.style.width = w + "px"; r.style.marginLeft = (-w / 2) + "px";
    r.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round((R() - 0.5) * 300) + "px," + Math.round(z) + "px)";
    r.style.background = "linear-gradient(180deg,rgba(0,0,0,0) 0%," + c + " 22%,#fff6e6 50%," + c + " 78%,rgba(0,0,0,0) 100%)";
    r.style.animationDelay = (0.85 + R() * 0.9).toFixed(2) + "s";
    tun.appendChild(r);
  }
  return root;
}
/* ---------- sound: synth graph usable by a live AudioContext or an OfflineAudioContext ---------- */
function introSynth(ctx, out, t0) {
  var sr = ctx.sampleRate;
  var master = ctx.createGain(); master.gain.value = 0.52;
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.25;
  master.connect(comp); comp.connect(out);
  var rev = ctx.createConvolver(), len = Math.floor(sr * 3.2), ir = ctx.createBuffer(2, len, sr), R = introRand(77);
  for (var c = 0; c < 2; c++) { var dch = ir.getChannelData(c); for (var i = 0; i < len; i++) dch[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < sr * 0.012 ? i / (sr * 0.012) : 1); }
  rev.buffer = ir; var revG = ctx.createGain(); revG.gain.value = 0.42; rev.connect(revG); revG.connect(master);
  function noiseBuf(sec) { var n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = R() * 2 - 1; return b; }
  function env(g, at, peak, a, hold, rel) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.setValueAtTime(peak, at + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel); }
  function pan(node, v) { if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = v; node.connect(p); return p; } return node; }
  var shaper = function (amt) { var ws = ctx.createWaveShaper(), cv = new Float32Array(2048); for (var j = 0; j < 2048; j++) { var x = j / 1024 - 1; cv[j] = Math.tanh(amt * x) / Math.tanh(amt); } ws.curve = cv; return ws; };
  var TA = t0 + 0.38, DUM = t0 + 0.80;
  // 0) low rumble swell into the first hit
  var rn = ctx.createBufferSource(); rn.buffer = noiseBuf(0.9);
  var rl = ctx.createBiquadFilter(); rl.type = "lowpass"; rl.Q.value = 3; rl.frequency.setValueAtTime(90, t0); rl.frequency.exponentialRampToValueAtTime(900, TA);
  var rg = ctx.createGain(); rg.gain.setValueAtTime(0.0001, t0); rg.gain.exponentialRampToValueAtTime(0.5, TA - 0.02); rg.gain.exponentialRampToValueAtTime(0.0001, TA + 0.1);
  rn.connect(rl); rl.connect(rg); rg.connect(master); rg.connect(rev); rn.start(t0); rn.stop(TA + 0.2);
  // 1) TA - tight, tuned timpani-like hit (A1 body) with a click
  function hit(at, f0, f1, dropT, peak, decay, drive) {
    var o = ctx.createOscillator(), g = ctx.createGain(), ws = shaper(drive); o.type = "sine";
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dropT);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(ws); ws.connect(g); g.connect(master); g.connect(rev); o.start(at); o.stop(at + decay + 0.05);
  }
  function tone(at, f, type, peak, a, decay, dest) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; env(g, at, peak, a, 0, decay); o.connect(g); g.connect(dest || master); if (!dest) g.connect(rev); o.start(at); o.stop(at + a + decay + 0.05); return o; }
  function click(at, peak, lp) { var n = ctx.createBufferSource(); n.buffer = noiseBuf(0.25); var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; var g = ctx.createGain(); env(g, at, peak, 0.002, 0, 0.12); n.connect(f); f.connect(g); g.connect(master); g.connect(rev); n.start(at); }
  hit(TA, 130, 55, 0.18, 0.75, 0.55, 2.0);
  tone(TA, 110, "triangle", 0.16, 0.004, 0.45); tone(TA, 220, "sine", 0.06, 0.004, 0.3);
  click(TA, 0.35, 3200);
  // 2) DUM - big, deep, longer: sub drop + distorted body + warm chord bloom
  hit(DUM, 150, 30, 0.75, 1.0, 2.6, 2.6);
  tone(DUM, 73.42, "triangle", 0.22, 0.005, 1.6); tone(DUM, 146.83, "sine", 0.08, 0.005, 1.1);
  click(DUM, 0.55, 2400);
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(2200, DUM); lp.frequency.exponentialRampToValueAtTime(260, DUM + 1.2); lp.frequency.exponentialRampToValueAtTime(1800, DUM + 2.6); lp.frequency.exponentialRampToValueAtTime(300, DUM + 3.6);
  var bodyG = ctx.createGain(); bodyG.gain.setValueAtTime(0.0001, DUM); bodyG.gain.exponentialRampToValueAtTime(0.2, DUM + 0.01); bodyG.gain.exponentialRampToValueAtTime(0.09, DUM + 1.0); bodyG.gain.exponentialRampToValueAtTime(0.12, DUM + 2.4); bodyG.gain.exponentialRampToValueAtTime(0.0001, DUM + 3.6);
  lp.connect(bodyG); bodyG.connect(master); bodyG.connect(rev);
  // D major add9 voiced wide: D2 A2 D3 F#3 A3 E4 (detuned saw pairs, panned)
  [73.42, 110, 146.83, 185, 220, 329.63].forEach(function (f, k) {
    [-7, 7].forEach(function (dt, s) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = dt; var p = pan(o, (s ? 0.35 : -0.35) * (k / 5)); p.connect(lp); o.start(DUM); o.stop(DUM + 3.7); });
  });
  // 3) shimmer bells arpeggiating up after the hit
  [587.33, 739.99, 880, 1174.66, 1479.98, 1760].forEach(function (f, k) {
    var at = DUM + 0.22 + k * 0.11, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = "sine"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.76; g2.gain.value = 0.18;
    o2.connect(g2); g2.connect(g); o.connect(g); env(g, at, 0.045, 0.01, 0.04, 1.5);
    pan(g, k % 2 ? 0.5 : -0.5).connect(rev); g.connect(master); o.start(at); o2.start(at); o.stop(at + 1.7); o2.stop(at + 1.7);
  });
  // 4) ribbon dive whoosh: bandpassed noise sweeping up and panning across, then a soft air tail
  var D0 = t0 + 2.45, wn = ctx.createBufferSource(); wn.buffer = noiseBuf(1.8);
  var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1; bp.frequency.setValueAtTime(300, D0); bp.frequency.exponentialRampToValueAtTime(7000, D0 + 1.25);
  var wg = ctx.createGain(); wg.gain.setValueAtTime(0.0001, D0); wg.gain.exponentialRampToValueAtTime(0.42, D0 + 1.0); wg.gain.exponentialRampToValueAtTime(0.0001, D0 + 1.6);
  wn.connect(bp); bp.connect(wg);
  if (ctx.createStereoPanner) { var wp = ctx.createStereoPanner(); wp.pan.setValueAtTime(-0.7, D0); wp.pan.linearRampToValueAtTime(0.7, D0 + 1.5); wg.connect(wp); wp.connect(master); wp.connect(rev); } else { wg.connect(master); wg.connect(rev); }
  wn.start(D0); wn.stop(D0 + 1.7);
  // 5) rising pitch "light" tone under the dive (two detuned sines gliding up an octave)
  [587.33, 880].forEach(function (f, k) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f, D0); o.frequency.exponentialRampToValueAtTime(f * 2, D0 + 1.4); o.detune.value = k ? 5 : -5;
    g.gain.setValueAtTime(0.0001, D0); g.gain.exponentialRampToValueAtTime(0.03, D0 + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, D0 + 1.6);
    o.connect(g); g.connect(rev); g.connect(master); o.start(D0); o.stop(D0 + 1.7);
  });
}
function introSound() {
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { introLog("audio=unsupported"); return; }
  var ctx; try { ctx = new AC(); } catch (e) { introLog("audio=error " + e); return; }
  NFI.ctx = ctx;
  introSynth(ctx, ctx.destination, ctx.currentTime + 0.05);
  var log = function () { introLog("audio=" + ctx.state + " t=" + ctx.currentTime.toFixed(2)); };
  if (ctx.state === "suspended" && ctx.resume) ctx.resume().then(log, log); else log();
  setTimeout(log, 1500);
}
function introStopSound() {
  var ctx = NFI.ctx; if (!ctx) return; NFI.ctx = null;
  setTimeout(function () { try { ctx.close(); } catch (e) {} }, 250);
  try { ctx.suspend && ctx.suspend(); } catch (e) {}
}
function introEnd(skipped) {
  if (!NFI.on) return; NFI.on = false;
  NFI.t.forEach(clearTimeout); NFI.t = [];
  window.removeEventListener("keydown", introKey, true);
  introLog(skipped ? "skipped" : "done");
  if (skipped) introStopSound(); else setTimeout(introStopSound, 1500);
  var el = NFI.el; if (!el) return;
  el.classList.add("ni-out"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
}
function introKey(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); introEnd(true); }
function playIntro(opts) {
  opts = opts || {};
  if (!opts.force && !introEnabled()) { introLog("disabled"); return; }
  NFI.on = true;
  var el = introBuild(); NFI.el = el; document.body.appendChild(el);
  window.addEventListener("keydown", introKey, true);
  if (!opts.silent) { try { introSound(); } catch (e) { introLog("audio=error " + e); } }
  void el.offsetWidth; el.classList.add("ni-go");
  if (!opts.noEnd) NFI.t.push(setTimeout(function () { introEnd(false); }, NFI.LEN * 1000));
}
if (!window.NFI_PREVIEW) playIntro();
