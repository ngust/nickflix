/* ================= NickFlix 4.10 — stable playback for a distant, droppy provider =================
   4.7 base (kept): bigger AVPlay buffers, live auto-reconnect with backoff, HLS/TS fallback + per-channel memory,
   clean stop + gap before reconnect (1-connection accounts), debounced zapping, prepare timeout, VOD resume,
   background fetches paused while playing, on-device diagnostics (nf_pdiag).
   4.10:
   - new default buffer profile "Extra-stable": waits for 16 s of video before starting (live plays ~16-20 s behind
     the live edge), refills 15 s after an underrun; "Maximum" is now even deeper (30 s). Old Normal/Large kept.
     Users still on the old default (Large / Normal) are moved to Extra-stable once.
   - buffering timeout / prepare timeout scale with the buffer so a slow fill is not cut short.
   - stutter guard: if stalls come close together, pause on purpose and refill a bigger cushion, then resume.
   - escalation when stalls keep happening: lower bitrate cap (if the provider stream offers several),
     else a lower-quality copy of the channel (SD/HD sibling), else the other format (HLS<->TS),
     else a deeper buffer for the session. Quality may go back up after 15 calm minutes (next reconnect).
   - reconnects come back at the lowest bitrate first so the buffer fills faster; longer gap between
     close and reopen so the 1-connection slot is released.
   - format stats (watch time vs stalls per HLS/TS) learned on this TV; Auto prefers the clearly stabler one. */
var PB = {
  BUF: {
    normal: { live: [5, 10], vod: [8, 15], to: 12, gap: 1200, refill: 0, lag: "a few seconds" },
    large: { live: [8, 15], vod: [12, 25], to: 20, gap: 1500, refill: 6, lag: "about 10 s" },
    stable: { live: [16, 15], vod: [20, 30], to: 30, gap: 2500, refill: 10, lag: "about 15\u201320 s" },
    max: { live: [30, 25], vod: [40, 45], to: 45, gap: 3000, refill: 15, lag: "about 30 s" }
  },
  ORDER: ["stable", "max", "normal", "large"], DEF: "stable",
  gen: 0, tries: 0, lastClose: 0, lastT: -1, lastMove: 0, bufAt: 0, wdT: null, rcT: null, zapT: null, prepT: null, rfT: null, okFmt: {}, maxTries: 8, GAP: 1200,
  sess: null, fs: null, fsDirty: 0, graceUntil: 0, bufCounted: false
};
/* buffering right after start or after a seek (resume, jumps, scrubbing) is expected - not a stall */
function pbGrace(ms) { PB.graceUntil = Math.max(PB.graceUntil, Date.now() + (ms || 12000)); }
function pbCfg() {
  var c = lsGet("nf_play", null) || {};
  var buf = PB.BUF[c.buf] ? c.buf : PB.DEF;
  return { buf: buf, fmt: /^(auto|hls|ts)$/.test(c.fmt) ? c.fmt : "auto" };
}
function pbSave(c) { c.v = 410; lsSet("nf_play", c); }
/* one-time move from the old default (Large) / Normal to the new Extra-stable default; Maximum stays Maximum */
(function () { try { var c = lsGet("nf_play", null); if (c && c.v !== 410) { if (c.buf !== "max") c.buf = PB.DEF; pbSave(c); } } catch (e) {} })();
try { PB.okFmt = lsGet("nf_okfmt", null) || {}; } catch (e) { PB.okFmt = {}; }
try { PB.fs = lsGet("nf_fmtstat", null) || null; } catch (e) { PB.fs = null; }
if (!PB.fs || !PB.fs.hls || !PB.fs.ts) PB.fs = { hls: { s: 0, b: 0 }, ts: { s: 0, b: 0 } };
function pbNewSess() { return { st: [], rc: [], cap: null, rates: null, boost: 1, esc: 0, lastEsc: 0, fmtFlip: false, sib: false, refills: 0, lastStall: 0, hlsWin: 0 }; }
PB.sess = pbNewSess();
/* buffer seconds for this open: profile x session boost (boost only after repeated trouble) */
function pbBufFor(live) {
  var B = PB.BUF[pbCfg().buf], a = live ? B.live : B.vod, k = PB.sess ? PB.sess.boost : 1;
  return { play: Math.max(4, Math.round(a[0] * k)), resume: Math.max(4, Math.round(a[1] * k)), to: Math.round(B.to * Math.max(1, k)), gap: B.gap, refill: B.refill };
}

/* ---------- diagnostics ring buffer ---------- */
function pdiag(ev, extra) {
  try {
    var L = lsGet("nf_pdiag", null) || [];
    L.push({ t: Date.now(), e: ev, ch: P.item ? String(P.item.n || "").slice(0, 40) : "", x: extra || "" });
    if (L.length > 120) L = L.slice(-120);
    lsSet("nf_pdiag", L);
  } catch (e) {}
}
function pdiagSummary(hours) {
  var L = lsGet("nf_pdiag", null) || [], since = Date.now() - (hours || 24) * 3600000, s = { stall: 0, rc: 0, err: 0, end: 0, fail: 0, refill: 0, down: 0 };
  L.forEach(function (x) { if (x.t < since) return; if (x.e === "refill") s.refill++; else if (x.e === "step-down") s.down++; else if (x.e === "stall") s.stall++; else if (x.e === "reconnect") s.rc++; else if (x.e === "error") s.err++; else if (x.e === "ended-live") s.end++; else if (x.e === "gaveup") s.fail++; });
  return s;
}

/* ---------- small reconnect badge ---------- */
function pbBadge(txt) {
  var b = $("nf-rc");
  if (!b) { b = document.createElement("div"); b.id = "nf-rc"; b.style.cssText = "position:fixed;top:40px;right:60px;z-index:99999;padding:12px 22px;border-radius:30px;background:rgba(0,0,0,.72);color:#fff;font:600 26px/1.2 sans-serif;display:none"; document.body.appendChild(b); }
  if (txt) { b.textContent = txt; b.style.display = "block"; } else b.style.display = "none";
}

/* ---------- 4.10: home buffering proxy (nfproxy on the NAS) ----------
   When ON, every IPTV stream (live / movie / series) goes to the proxy instead of the provider; the proxy is
   the only thing that talks to the provider (1-connection account). Addresses come from NF_CONFIG.proxyUrls
   (config.js, not in git). If the proxy does not answer /health, NickFlix plays direct and says so. */
var PX = { ok: null, at: 0, url: "" };
function pxUrls() { try { return ((window.NF_CONFIG && NF_CONFIG.proxyUrls) || []).filter(function (u) { return /^https?:\/\//.test(u); }); } catch (e) { return []; } }
function pxCfg() { var c = lsGet("nf_proxy", null) || {}, L = pxUrls(); return { on: !!c.on && L.length > 0, url: L.indexOf(c.url) >= 0 ? c.url : (L[0] || "") }; }
function pxSave(c) { lsSet("nf_proxy", { on: !!c.on, url: c.url }); }
function pxCheck(cb) {
  var c = pxCfg(); if (!c.url) { PX.ok = null; if (cb) cb(null); return; }
  var done = false, url = c.url.replace(/\/$/, "");
  function fin(v) { if (done) return; done = true; PX.ok = v; PX.at = Date.now(); PX.url = url; if (cb) cb(v); }
  setTimeout(function () { fin(false); }, 2500);
  try { fetch(url + "/health", { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (t) { fin(String(t).trim() === "ok"); }, function () { fin(false); }); } catch (e) { fin(false); }
}
function pxRerender(key) { try { if (OV.top() === ST && ST.page === "home") { var li = ST.ln ? ST.ln.li : 0, ci = ST.ln ? ST.ln.ci : 0; renderSettings(key); if (!key && ST.ln) { ST.ln.li = li; ST.ln.ci = ci; lnFocus(ST.ln); } } } catch (e) {} }
function pxActive() { var c = pxCfg(); return c.on && !(PX.ok === false && PX.url === c.url.replace(/\/$/, "")); }
function pxRewrite(url) {
  if (!pxActive()) return url;
  var b = base(); if (url.indexOf(b + "/") !== 0) return url;
  var p = url.slice(b.length); if (!/^\/(live|movie|series)\//.test(p)) return url;
  if (/^\/live\//.test(p)) p = p.replace(/\.m3u8(\?|$)/, ".ts$1");   // the proxy always serves live as MPEG-TS
  return pxCfg().url.replace(/\/$/, "") + p;
}
/* health: shortly after start, then every minute while nothing is playing (LAN only, never the provider) */
setTimeout(function () { if (pxCfg().on) pxCheck(); }, 3000);
setInterval(function () { if (!P.open && pxCfg().on) pxCheck(); }, 60000);

/* ---------- URL choice ---------- */
liveURLs = function (it) {
  var h = base() + "/live/" + cred() + "/" + it.id + ".m3u8", t = base() + "/live/" + cred() + "/" + it.id + ".ts", c = pbCfg();
  if (pxActive()) return [t];   // proxy picks HLS/TS upstream by itself and always hands the TV a TS stream
  if (c.fmt === "ts") return [t, h];
  if (c.fmt === "hls") return [h, t];
  var best = pbStablerFmt();
  if (best) return best === "ts" ? [t, h] : [h, t];   // one format clearly rides out this provider better
  return PB.okFmt[it.id] === "ts" ? [t, h] : [h, t];
};
/* learned on this TV: stalls+drops per hour of live watching, per format. "Clearly stabler" = both have
   >= 45 min of data and one has under half the trouble rate of the other. */
function pbFmtRate(f) { var x = PB.fs[f]; return (x.b + 1) / Math.max(0.25, x.s / 3600); }
function pbStablerFmt() {
  var H = PB.fs.hls, T = PB.fs.ts; if (H.s < 2700 || T.s < 2700) return null;
  var rh = pbFmtRate("hls"), rt = pbFmtRate("ts");
  return rt < rh * 0.5 ? "ts" : rh < rt * 0.5 ? "hls" : null;
}
function pbFmtNote(f, kind) {
  if (f !== "hls" && f !== "ts") return;
  if (kind === "s") PB.fs[f].s += 2; else PB.fs[f].b++;
  if (PB.fs.hls.s + PB.fs.ts.s > 72000) { ["hls", "ts"].forEach(function (k) { PB.fs[k].s = Math.round(PB.fs[k].s / 2); PB.fs[k].b = Math.round(PB.fs[k].b / 2); }); }   // keep it recent (~20 h)
  if (kind !== "s" || ++PB.fsDirty >= 15) { PB.fsDirty = 0; lsSet("nf_fmtstat", PB.fs); }
}
function pbFmtOf(url) { return /\.m3u8(\?|$)/.test(url) ? "hls" : /\.ts(\?|$)/.test(url) ? "ts" : "file"; }

/* ---------- clean stop ---------- */
var _stopMedia46 = stopMedia;
stopMedia = function () {
  clearTimeout(PB.prepT); clearInterval(PB.wdT); PB.wdT = null; pbRefillEnd(true);
  var had = false; try { had = P.useAV && avOK() && webapis.avplay.getState() !== "NONE"; } catch (e) {}
  _stopMedia46();
  if (had) PB.lastClose = Date.now();
};

/* ---------- open with buffering params; waits for the previous connection to be released ---------- */
playURL = function (url) {
  url = pxRewrite(url);
  var gen = ++PB.gen;
  stopMedia();
  var wait = Math.max(0, Math.max(PB.GAP, pbBufFor(!P.vod).gap) - (Date.now() - PB.lastClose));
  if (!P.started) osd(PB.tries ? null : "Loading\u2026", hintText(), true);
  if (wait > 0 && avOK()) { setTimeout(function () { if (gen === PB.gen && P.open) pbOpen(url, gen); }, wait); return; }
  pbOpen(url, gen);
};
function pbOpen(url, gen) {
  var resume = P.resume, live = !P.vod, BF = pbBufFor(live);
  P.curURL = url; PB.lastT = -1; PB.lastMove = Date.now(); PB.bufAt = 0;
  if (!avOK()) {   // browser / emulator fallback: keep the 4.6 HTML5 path, add stall handling
    P.useAV = false; var v = $("video"); v.classList.remove("off");
    v.onplaying = function () { if (gen !== PB.gen) return; if (!P.started) pbGrace(12000); P.started = true; PB.tries = 0; if (!PB.rfT) pbBadge(""); osd("", null, false); };
    v.onloadedmetadata = function () { if (resume > 0) { try { v.currentTime = resume / 1000; } catch (e5) {} resume = 0; } };
    v.onwaiting = function () { if (gen !== PB.gen) return; PB.bufAt = PB.bufAt || Date.now(); if (P.started && Date.now() > PB.graceUntil && !PB.bufCounted) { PB.bufCounted = true; pbStall(gen); } osd("Buffering\u2026", null, true); };
    v.oncanplaythrough = function () { if (gen !== PB.gen || !PB.bufAt) return; PB.bufAt = 0; var c = PB.bufCounted; PB.bufCounted = false; if (c) pbStallEnd(gen); };
    v.onerror = function () { if (gen === PB.gen) pbTrouble("error", "video error"); };
    v.onended = function () { if (gen !== PB.gen) return; if (live) pbTrouble("ended-live"); else onEnded(); };
    v.src = url; var pr; try { pr = v.play(); } catch (e2) {} if (pr && pr.catch) pr.catch(function () {});
    pbWatch(gen); return;
  }
  P.useAV = true; $("video").classList.add("off");
  var av = webapis.avplay;
  try {
    av.open(url);
    av.setListener({
      onbufferingstart: function () { if (gen !== PB.gen) return; PB.bufAt = Date.now(); PB.bufCounted = false; if (P.started) { if (Date.now() > PB.graceUntil) { PB.bufCounted = true; pdiag("stall"); pbStall(gen); } osd("Refilling buffer\u2026", null, true); } },
      onbufferingprogress: function (p) { if (gen !== PB.gen) return; if (P.started) osd("Refilling buffer " + p + "%", null, true); else if (!PB.tries) osd("Building buffer " + p + "%", live ? "Starting " + PB.BUF[pbCfg().buf].lag + " behind live for smoother playback" : null, true); },
      onbufferingcomplete: function () { if (gen !== PB.gen) return; var was = PB.bufAt && P.started && PB.bufCounted; if (was) pdiag("stall-end", Math.round((Date.now() - PB.bufAt) / 1000) + "s"); PB.bufAt = 0; PB.bufCounted = false; PB.lastMove = Date.now(); osd("", null, false); if (was) pbStallEnd(gen); },
      onstreamcompleted: function () { if (gen !== PB.gen) return; if (live) pbTrouble("ended-live"); else onEnded(); },
      oncurrentplaytime: function () {},
      onerror: function (e) { if (gen === PB.gen) pbTrouble("error", String(e)); },
      onerrormsg: function (e, m) { if (gen === PB.gen) pdiag("errmsg", String(e) + " " + String(m || "").replace(/\/live\/[^\/]+\/[^\/]+\//g, "/live/*/*/").slice(0, 160)); },
      onevent: function (t, d) { if (gen === PB.gen && /HTTP_ERROR|BITRATE/.test(String(t))) pdiag("ev", String(t) + " " + String(d || "").slice(0, 60)); }
    });
    try { av.setBufferingParam("PLAYER_BUFFER_FOR_PLAY", "PLAYER_BUFFER_SIZE_IN_SECOND", BF.play); } catch (b1) {}
    try { av.setBufferingParam("PLAYER_BUFFER_FOR_RESUME", "PLAYER_BUFFER_SIZE_IN_SECOND", BF.resume); } catch (b2) {}
    try { av.setTimeoutForBuffering(BF.to); } catch (b3) {}   // must exceed the fill time, or AVPlay starts with a half-full buffer
    var ai = pbAdaptive(url); if (ai) { try { av.setStreamingProperty("ADAPTIVE_INFO", ai); pdiag("adaptive", ai); } catch (b4) {} }
    av.setDisplayRect(0, 0, 1920, 1080);
    try { av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e0) {}
    PB.prepT = setTimeout(function () { if (gen === PB.gen && !P.started) pbTrouble("error", "prepare timeout"); }, Math.max(25, BF.to + 20) * 1000);
    av.prepareAsync(function () {
      if (gen !== PB.gen) return; clearTimeout(PB.prepT);
      try {
        av.play(); P.started = true; PB.lastMove = Date.now(); pbGrace(resume > 0 ? 15000 : 12000);
        if (live) { var f = pbFmtOf(url); if (PB.okFmt[P.item.id] !== f) { PB.okFmt[P.item.id] = f; lsSet("nf_okfmt", PB.okFmt); } }
        if (PB.tries) { pdiag("recovered", "after " + PB.tries); osd("Reconnected", null, false); } else if (resume > 0) {} else osd("", null, false);
        PB.tries = 0; pbBadge(""); pbProbe(av, url);
        if (resume > 0) { try { av.seekTo(resume, function () { osd("Resumed at " + fmtTime(resume), null, false); }, function () {}); } catch (e3) {} }
      } catch (e1) { pbTrouble("error", String(e1)); }
    }, function (err) { if (gen === PB.gen) { clearTimeout(PB.prepT); pbTrouble("error", err && err.name ? err.name : String(err)); } });
    pbWatch(gen);
  } catch (e) { pbTrouble("error", e && e.name ? e.name : String(e)); }
}

/* ---------- stall watchdog: playback clock frozen too long => reconnect ---------- */
function pbWatch(gen) {
  clearInterval(PB.wdT);
  PB.wdT = setInterval(function () {
    if (gen !== PB.gen || !P.open) { clearInterval(PB.wdT); return; }
    if (!P.started) return;
    var st = "", t = 0;
    try { if (P.useAV) { st = webapis.avplay.getState(); t = webapis.avplay.getCurrentTime(); } else { var v = $("video"); st = v.paused ? "PAUSED" : "PLAYING"; t = v.currentTime * 1000; } } catch (e) { return; }
    if (st === "PAUSED") { PB.lastMove = Date.now(); return; }
    if (t !== PB.lastT) {
      PB.lastT = t; PB.lastMove = Date.now();
      if (!P.vod) pbFmtNote(pbFmtOf(P.curURL || ""), "s");
      pbMaybeStepUp();
      return;
    }
    var limit = Math.max(P.vod ? 30 : 15, pbBufFor(!P.vod).to + 8) * 1000;   // frozen this long while "playing" or buffering
    if (Date.now() - PB.lastMove > limit) { pdiag("frozen", Math.round((Date.now() - PB.lastMove) / 1000) + "s"); pbTrouble("frozen"); }
  }, 2000);
}

/* ---------- trouble => reconnect with backoff on the same channel ---------- */
function pbTrouble(kind, why) {
  if (!P.open) return;
  var gen = ++PB.gen;   // invalidate callbacks of the failing session
  pdiag(kind, why || "");
  if (!P.vod && P.started) pbFmtNote(pbFmtOf(P.curURL || ""), "b");
  if (P.started) { PB.sess.rc.push(Date.now()); pbEscalate(true); }
  var at = 0; try { if (P.vod && P.useAV) at = webapis.avplay.getCurrentTime() || 0; else if (P.vod) at = $("video").currentTime * 1000; } catch (e) {}
  if (P.vod && at > 0) P.resume = Math.max(0, at - 2000);   // a little overlap so nothing is skipped
  stopMedia();
  // never-started + hard format errors: go straight to the alternate URL (old 4.6 behaviour)
  if (!P.started && /NOT_SUPPORTED|INVALID_URI|NO_SUCH_FILE/.test(why || "") && P.ui < P.urls.length - 1) { P.ui++; playURL(P.urls[P.ui]); return; }
  PB.tries++;
  if (PB.tries === 2 && pxActive() && /^https?:\/\//.test(P.curURL || "") && P.curURL.indexOf(pxCfg().url.replace(/\/$/, "")) === 0) {
    pxCheck(function (ok) { if (ok === false && P.open) { pdiag("proxy-down", ""); toastSafe("Home proxy not answering \u2013 playing direct"); if (!P.vod) { P.urls = liveURLs(P.item); P.ui = 0; } } });
  }
  var max = P.vod ? 4 : PB.maxTries;
  if (PB.tries > max) {
    pdiag("gaveup", kind); pbBadge(""); PB.tries = 0;
    osd("Lost the stream (" + (why || kind) + ")", "OK  try again      BACK  exit" + (P.list ? "      \u25B2 \u25BC  another channel" : ""), true);
    P.dead = true; return;
  }
  // after 3 failed tries on live, flip HLS <-> TS
  if (!P.vod && PB.tries === 4 && P.urls.length > 1) { P.ui = (P.ui + 1) % P.urls.length; pdiag("switch-fmt", pbFmtOf(P.urls[P.ui])); }
  var delay = [0, 1000, 2000, 4000, 6000, 8000, 10000, 12000, 15000][Math.min(PB.tries, 8)];
  P.started = P.vod ? P.started : false;
  pbBadge("Reconnecting\u2026" + (PB.tries > 1 ? " (" + PB.tries + ")" : ""));
  osd(null, hintText(), false);
  clearTimeout(PB.rcT);
  PB.rcT = setTimeout(function () { if (gen === PB.gen && P.open) { pdiag("reconnect", PB.tries + " " + pbFmtOf(P.urls[P.ui])); playURL(P.urls[P.ui]); } }, delay);
}
playFailed = function (why) { pbTrouble("error", why); };

/* ---------- 4.10: adaptive bitrate hints ---------- */
function pbAdaptive(url) {
  if (pbFmtOf(url) !== "hls") return "";
  var S = PB.sess, parts = [];
  if (S.cap) parts.push("BITRATES=0~" + S.cap);
  if (S.cap || PB.tries > 0 || S.st.length) parts.push("STARTBITRATE=LOWEST");   // after trouble: come back light, fill fast, climb later
  return parts.join("|");
}
function pbProbe(av, url) {   // what the provider offers for this stream (bitrates, live window); diagnostics + escalation input
  var S = PB.sess;
  try {
    var r = String(av.getStreamingProperty("AVAILABLE_BITRATE") || "");
    var a = r.split(/[|,\s]+/).map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x > 0; }).sort(function (x, y) { return x - y; });
    if (a.length) { S.rates = a; pdiag("bitrates", a.join(",")); }
  } catch (e) {}
  try {
    if (!P.vod) { var w = String(av.getStreamingProperty("GET_LIVE_DURATION") || "").split("|"); var d = (parseInt(w[1], 10) - parseInt(w[0], 10)) / 1000; if (d > 0) S.hlsWin = d; }
  } catch (e2) {}
}

/* ---------- 4.10: stutter guard (pause + refill a bigger cushion) ---------- */
function pbStall(gen) {
  var S = PB.sess, now = Date.now();
  S.st.push(now); S.st = S.st.filter(function (t) { return now - t < 600000; });
  S.lastStall = now;
  if (!P.vod) pbFmtNote(pbFmtOf(P.curURL || ""), "b");
}
function pbStallEnd(gen) {
  var S = PB.sess, now = Date.now();
  var recent = S.st.filter(function (t) { return now - t < 120000; }).length;
  if (pbEscalate(false)) return;
  // a second stall within 2 minutes = stutter: build a bigger cushion on purpose instead of playing on a thin buffer
  if (recent >= 2) pbRefill(gen, Math.min(30, pbBufFor(!P.vod).refill * (recent >= 3 ? 1.5 : 1)));
}
function pbRefillOK() {
  if (P.vod) return true;
  var f = pbFmtOf(P.curURL || "");
  if (f === "ts") return true;
  // HLS live: only if the provider's live window is long enough that we will not fall off the back of it
  return PB.sess.hlsWin >= 60;
}
function pbRefill(gen, sec) {
  sec = Math.round(sec || 0);
  if (sec < 3 || PB.rfT || !pbRefillOK()) return;
  var paused = false;
  try { if (P.useAV) { webapis.avplay.pause(); paused = webapis.avplay.getState() === "PAUSED"; } else { $("video").pause(); paused = true; } } catch (e) {}
  if (!paused) return;
  PB.sess.refills++; pdiag("refill", sec + "s");
  var left = sec;
  pbBadge("Building a bigger buffer\u2026 " + left + "s");
  PB.rfT = setInterval(function () {
    if (gen !== PB.gen || !P.open) { pbRefillEnd(true); return; }
    left--;
    if (left > 0) { pbBadge("Building a bigger buffer\u2026 " + left + "s"); return; }
    pbRefillEnd(false);
  }, 1000);
}
function pbRefillEnd(cancelOnly) {
  if (!PB.rfT) return;
  clearInterval(PB.rfT); PB.rfT = null; pbBadge("");
  if (cancelOnly) return;
  PB.lastMove = Date.now();
  try { if (P.useAV) webapis.avplay.play(); else { var pr = $("video").play(); if (pr && pr.catch) pr.catch(function () {}); } } catch (e) {}
}

/* ---------- 4.10: escalation when trouble keeps coming back ---------- */
function pbLowerSibling(it) {
  if (!it || !window.CH || !CH.all || !CH.all.length) return null;   // only if the channel index is already loaded (no fetch while playing)
  function q(n) { n = String(n).toUpperCase(); return /UHD|\b4K\b|\u1D41\u1D34\u1D30|\b2160P?\b/.test(n) ? 3 : /FHD|\b1080P?\b|\u1DA0\u1D34\u1D30/.test(n) ? 2 : /\bSD\b|\(S\)|\b480P?\b|\b576P?\b/.test(n) ? 0 : 1; }
  function key(n) { return String(n).toUpperCase().replace(/[\u1D00-\u1DBF\u02B0-\u02FF]+/g, "").replace(/\b(FHD|UHD|HD|SD|4K|HEVC|H\.?265|RAW|BACKUP|1080P?|720P?|2160P?|576P?|480P?|50 ?FPS|60 ?FPS)\b/g, "").replace(/\(S\)/g, "").replace(/[^A-Z0-9]/g, ""); }
  var k = key(it.n), mine = q(it.n), best = null, bq = -1;
  if (!k || mine === 0) return null;
  CH.all.forEach(function (c) {
    if (c.id == it.id || c.adult || key(c.n) !== k) return;
    var cq = q(c.n); if (cq < mine && cq > bq) { best = c; bq = cq; }
  });
  return best;
}
function pbTroubled() {
  var S = PB.sess, now = Date.now();
  var st5 = S.st.filter(function (t) { return now - t < 300000; }).length, rc10 = S.rc.filter(function (t) { return now - t < 600000; }).length;
  return st5 >= 3 || rc10 >= 2 || (st5 >= 2 && rc10 >= 1);
}
/* returns true if it changed the stream. inTrouble: called from pbTrouble (it reconnects itself; just adjust). */
function pbEscalate(inTrouble) {
  var S = PB.sess, now = Date.now();
  if (!P.open || !pbTroubled() || now - S.lastEsc < 180000) return false;
  S.lastEsc = now; S.esc++;
  var url = P.curURL || "", f = pbFmtOf(url);
  // 1) lower bitrate cap, when the provider stream offers more than one
  if (S.rates && S.rates.length > 1 && f === "hls") {
    var cur = S.cap || S.rates[S.rates.length - 1], lower = S.rates.filter(function (r) { return r < cur; });
    if (lower.length) { S.cap = lower[lower.length - 1]; return pbStep(inTrouble, "Lower quality for smoother playback", "bitrate<=" + S.cap); }
  }
  // 2) a lower-quality copy of the same channel from the provider (FHD -> HD -> SD)
  if (!P.vod && !S.sib) {
    var sib = pbLowerSibling(P.item);
    if (sib) {
      S.sib = true; P.item = sib; P.urls = liveURLs(sib); P.ui = 0;
      try { $("osd-title").textContent = sib.n; P.title = sib.n; } catch (e) {}
      return pbStep(inTrouble, "Switched to " + sib.n + " for smoother playback", "sibling " + sib.id);
    }
  }
  // 3) the other format (HLS <-> TS), once per session
  if (!P.vod && !S.fmtFlip && P.urls.length > 1 && pbCfg().fmt === "auto") {
    S.fmtFlip = true; P.ui = (P.ui + 1) % P.urls.length;
    return pbStep(inTrouble, "Trying " + (pbFmtOf(P.urls[P.ui]) === "ts" ? "MPEG-TS" : "HLS") + " for smoother playback", "fmt " + pbFmtOf(P.urls[P.ui]));
  }
  // 4) deeper buffer for the rest of this session (applies from the next (re)connect, no forced interruption)
  if (S.boost < 1.75) { S.boost = Math.min(1.75, S.boost + 0.5); pdiag("step-down", "boost x" + S.boost); if (!inTrouble) toastSafe("Using an extra-deep buffer for this channel"); }
  return false;
}
function toastSafe(t) { try { toast(t, 5000); } catch (e) { pbBadge(t); setTimeout(function () { if (!PB.rfT) pbBadge(""); }, 4000); } }
function pbStep(inTrouble, msg, diag) {
  pdiag("step-down", diag);
  toastSafe(msg);
  if (inTrouble) return true;
  pbReopen("step-down");
  return true;
}
/* controlled reopen (same as a reconnect, but on purpose) */
function pbReopen(why) {
  if (!P.open) return;
  var at = 0; try { if (P.vod && P.useAV) at = webapis.avplay.getCurrentTime() || 0; else if (P.vod) at = $("video").currentTime * 1000; } catch (e) {}
  ++PB.gen; clearTimeout(PB.rcT);
  if (P.vod && at > 0) P.resume = Math.max(0, at - 2000);
  stopMedia();
  if (!P.vod) P.started = false;
  pbBadge("Switching\u2026");
  pdiag("reopen", why);
  playURL(P.urls[P.ui]);
}
/* quality may go back up after 15 calm minutes - only applied at the next natural reconnect / reopen */
function pbMaybeStepUp() {
  var S = PB.sess; if (!S.cap || !S.rates) return;
  if (Date.now() - Math.max(S.lastStall, S.lastEsc) < 900000) return;
  var higher = S.rates.filter(function (r) { return r > S.cap; });
  S.cap = higher.length > 1 ? higher[0] : null; S.lastEsc = Date.now();
  pdiag("step-up", S.cap ? "bitrate<=" + S.cap : "uncapped");
}

/* ---------- start / zap / close ---------- */
var _startPlayback46 = startPlayback;
startPlayback = function (title, urls, vod, resumeMs) { PB.tries = 0; P.dead = false; PB.sess = pbNewSess(); pbRefillEnd(true); clearTimeout(PB.rcT); clearTimeout(PB.zapT); pbBadge(""); _startPlayback46(title, urls, vod, resumeMs); };
zap = function (d) {
  if (!P.list) { osd(null, hintText(), false); return; }
  var n = P.idx + d; if (n < 0 || n >= P.list.length) return;
  P.idx = n; var it = P.list[n]; P.item = it;
  $("osd-title").textContent = it.n; P.title = it.n; $("osd-epg").textContent = "";
  ++PB.gen; clearTimeout(PB.rcT); stopMedia(); pbBadge(""); PB.tries = 0; P.dead = false; P.started = false; PB.sess = pbNewSess();   // close the old connection right away
  osd("\u25B2 \u25BC  " + it.n, hintText(), true);
  clearTimeout(PB.zapT);
  PB.zapT = setTimeout(function () {   // only connect once the user stops flicking through channels
    if (!P.open || P.item !== it) return;
    addHistory(it);
    P.urls = liveURLs(it); P.ui = 0;
    playURL(P.urls[0]); osdEpg(it);
  }, 700);
  var row = V.rows[V.r]; if (row && row.items === P.list) { row.col = n; row.off = Math.max(0, Math.min(n - 1, row.items.length - row.K.vis + 1)); }
};
var _seek410 = seek;
seek = function (ms) { pbGrace(12000); if (PB.rfT) pbRefillEnd(true); return _seek410(ms); };
var _togglePause46 = togglePause;
togglePause = function () {
  if (P.dead) { P.dead = false; PB.tries = 0; P.ui = 0; pbBadge("Reconnecting\u2026"); playURL(P.urls[0]); return; }
  if (PB.rfT) { pbRefillEnd(false); osd("", hintText(), false); return; }   // OK during a refill = play now
  _togglePause46();
};
var _closePlayer46 = closePlayer;
closePlayer = function () {
  ++PB.gen; clearTimeout(PB.rcT); clearTimeout(PB.zapT); clearInterval(PB.wdT); pbRefillEnd(true); pbBadge(""); P.dead = false; lsSet("nf_fmtstat", PB.fs);
  _closePlayer46();
  setTimeout(pbResumeBackground, 1500);
};

/* ---------- pause background fetches while playing ---------- */
var _epgPump46 = epgPump;
epgPump = function () {
  if (!P.open) return _epgPump46();
  // while playing, only fetch the guide for the channel on screen
  var cur = P.item && P.item.id, keep = [], mine = [];
  EPG.q.forEach(function (j) { (j.id === cur ? mine : keep).push(j); });
  if (!mine.length) return;
  EPG.q = mine; _epgPump46(); EPG.q = EPG.q.concat(keep);
};
if (typeof nasPump === "function") {
  var _nasPump46 = nasPump;
  nasPump = function () { if (P.open) return; _nasPump46(); };
  var _nasRefresh46 = nasRefresh;
  nasRefresh = function (force) { if (P.open) return Promise.resolve(false); return _nasRefresh46(force); };
}
function pbResumeBackground() { if (P.open) return; try { epgPump(); } catch (e) {} try { if (typeof nasPump === "function") nasPump(); } catch (e2) {} }

/* ---------- Settings: Playback section ---------- */
var _stHome46 = stHome;
stHome = function (inner, ln) {
  _stHome46(inner, ln);
  var notes = inner.getElementsByClassName("s-note"), last = notes[notes.length - 1];
  if (last) last.parentNode.removeChild(last);
  inner.appendChild(ce("div", "s-sec", "Playback (this TV)"));
  var c = pbCfg();
  var BL = {
    stable: "Extra-stable (default) \u2013 plays a little behind live, rides out provider hiccups",
    max: "Maximum \u2013 furthest behind live, slowest start, for the worst nights",
    normal: "Normal \u2013 fastest start, closest to live, most stalls",
    large: "Large \u2013 older setting, about 10 s behind live"
  };
  var BD = {
    stable: "Live TV waits for 16 s of video before it starts, so you watch about 15\u201320 s behind live (a score app may be a bit ahead). If the provider drops out, the cushion keeps the picture going; if it runs dry, NickFlix pauses and refills instead of stuttering. Movies/shows: 20 s to start.",
    max: "Live TV waits for 30 s of video (about 30 s behind live, start can take up to ~30 s on MPEG-TS). Use this if Extra-stable still stalls. Movies/shows: 40 s to start.",
    normal: "Live TV starts after 5 s of video, close to live. Expect more stalls with a far-away provider. Movies/shows: 8 s.",
    large: "Live TV starts after 8 s of video, about 10 s behind live. Movies/shows: 12 s."
  };
  var FL = { auto: "Auto \u2013 learns which of HLS / TS is steadier", hls: "HLS (.m3u8) first", ts: "MPEG-TS (.ts) first" };
  var l1 = ce("div", "s-line"), b1 = chip("Buffer: " + BL[c.buf], BD[c.buf], true, null, "wide act");
  b1._key = "pb:buf"; b1._act = function () { var o = PB.ORDER, cc = pbCfg(); cc.buf = o[(o.indexOf(cc.buf) + 1) % o.length]; pbSave(cc); renderSettings("pb:buf"); toast("Buffer: " + BL[cc.buf].split(" \u2013 ")[0]); };
  l1.appendChild(b1); inner.appendChild(l1); lnAdd(ln, l1, [b1]);
  var bestF = pbStablerFmt();
  var l2 = ce("div", "s-line"), b2 = chip("Live stream format: " + FL[c.fmt], (bestF ? "On this TV " + (bestF === "ts" ? "MPEG-TS" : "HLS") + " has been clearly steadier, so Auto uses it first. " : "") + "Auto also switches format by itself if a channel keeps dropping.", true, null, "wide act");
  b2._key = "pb:fmt"; b2._act = function () { var o = ["auto", "hls", "ts"], cc = pbCfg(); cc.fmt = o[(o.indexOf(cc.fmt) + 1) % 3]; pbSave(cc); renderSettings("pb:fmt"); toast("Live format: " + cc.fmt.toUpperCase()); };
  l2.appendChild(b2); inner.appendChild(l2); lnAdd(ln, l2, [b2]);
  var pc = pxCfg(), pl = pxUrls();
  var pst = !pc.on ? "" : PX.ok === true ? "  \u2713 reachable" : PX.ok === false ? "  \u2717 not reachable \u2013 playing direct" : "  (checking\u2026)";
  var l3 = ce("div", "s-line"), b3 = chip("Home buffering proxy: " + (!pl.length ? "not set up" : pc.on ? "On" + pst : "Off"),
    !pl.length ? "Add proxyUrls to config.js once nfproxy is installed on the NAS." :
    pc.on ? "All live TV, movies and shows stream through " + pc.url.replace(/^https?:\/\//, "") + ". The NAS keeps a 20 s+ cushion and reconnects to the provider by itself, so most provider drops never reach the TV. The NAS is then the only thing talking to the provider." :
    "Off \u2013 the TV connects to the provider directly. Turn on once nfproxy is running on the NAS (" + pc.url.replace(/^https?:\/\//, "") + ").", true, null, "wide act");
  b3._key = "pb:px"; b3._act = function () { var cc = pxCfg(); if (!pxUrls().length) { toast("Proxy not set up in config.js"); return; } cc.on = !cc.on; pxSave(cc); PX.ok = null; renderSettings("pb:px"); toast("Home proxy: " + (cc.on ? "On" : "Off")); if (cc.on) pxCheck(function () { pxRerender("pb:px"); }); };
  l3.appendChild(b3); var it3 = [b3];
  if (pl.length > 1) {
    var b4 = chip("Proxy address: " + pc.url.replace(/^https?:\/\//, ""), "Switch between the NAS addresses", true, null, "act");
    b4._key = "pb:pxu"; b4._act = function () { var cc = pxCfg(), L = pxUrls(); cc.url = L[(L.indexOf(cc.url) + 1) % L.length]; pxSave(cc); PX.ok = null; renderSettings("pb:pxu"); if (cc.on) pxCheck(function () { pxRerender("pb:pxu"); }); };
    l3.appendChild(b4); it3.push(b4);
  }
  inner.appendChild(l3); lnAdd(ln, l3, it3);
  if (pc.on && PX.ok === null) pxCheck(function () { pxRerender(null); });
  inner.appendChild(ce("div", "s-note", "If stalls keep happening on a channel, NickFlix steps down by itself for the rest of that viewing: a lower bitrate if the provider offers one, then a lower-quality copy of the channel (e.g. HD instead of FHD), then the other stream format, then an even deeper buffer. It shows a short message when it does. Connection drops still reconnect automatically."));
  var s = pdiagSummary(24);
  inner.appendChild(ce("div", "s-note", "Last 24 h on this TV: " + s.stall + " stalls, " + s.refill + " buffer refills, " + s.rc + " auto-reconnects, " + s.down + " quality step-downs, " + s.end + " provider drops, " + s.fail + " gave up"));
  inner.appendChild(ce("div", "s-note", "NickFlix 4.10"));
};
