/* ================= NickFlix 4.7 — resilient playback =================
   - bigger AVPlay buffers (setBufferingParam / setTimeoutForBuffering), user-selectable
   - live: auto-reconnect on error / stall / stream-end with backoff, same channel, "Reconnecting…" badge
   - HLS/TS preference (Auto remembers per channel what worked), switch format after repeated failures
   - clean stop + minimum gap before opening a new connection (1-connection accounts), debounced channel zapping
   - prepare timeout, VOD resume-on-error at last position
   - background fetches (EPG queue, NAS refresh/matching) paused while playing
   - small on-device diagnostics log (nf_pdiag) shown in Settings */
var PB = {
  BUF: { normal: { live: [5, 10], vod: [8, 15], to: 10 }, large: { live: [8, 15], vod: [12, 25], to: 15 }, max: { live: [12, 25], vod: [20, 40], to: 20 } },
  gen: 0, tries: 0, lastClose: 0, lastT: -1, lastMove: 0, bufAt: 0, wdT: null, rcT: null, zapT: null, prepT: null, okFmt: {}, maxTries: 8, GAP: 1200
};
function pbCfg() { var c = lsGet("nf_play", null) || {}; return { buf: PB.BUF[c.buf] ? c.buf : "large", fmt: /^(auto|hls|ts)$/.test(c.fmt) ? c.fmt : "auto" }; }
function pbSave(c) { lsSet("nf_play", c); }
try { PB.okFmt = lsGet("nf_okfmt", null) || {}; } catch (e) { PB.okFmt = {}; }

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
  var L = lsGet("nf_pdiag", null) || [], since = Date.now() - (hours || 24) * 3600000, s = { stall: 0, rc: 0, err: 0, end: 0, fail: 0 };
  L.forEach(function (x) { if (x.t < since) return; if (x.e === "stall") s.stall++; else if (x.e === "reconnect") s.rc++; else if (x.e === "error") s.err++; else if (x.e === "ended-live") s.end++; else if (x.e === "gaveup") s.fail++; });
  return s;
}

/* ---------- small reconnect badge ---------- */
function pbBadge(txt) {
  var b = $("nf-rc");
  if (!b) { b = document.createElement("div"); b.id = "nf-rc"; b.style.cssText = "position:fixed;top:40px;right:60px;z-index:99999;padding:12px 22px;border-radius:30px;background:rgba(0,0,0,.72);color:#fff;font:600 26px/1.2 sans-serif;display:none"; document.body.appendChild(b); }
  if (txt) { b.textContent = txt; b.style.display = "block"; } else b.style.display = "none";
}

/* ---------- URL choice ---------- */
liveURLs = function (it) {
  var h = base() + "/live/" + cred() + "/" + it.id + ".m3u8", t = base() + "/live/" + cred() + "/" + it.id + ".ts", c = pbCfg();
  if (c.fmt === "ts") return [t, h];
  if (c.fmt === "hls") return [h, t];
  return PB.okFmt[it.id] === "ts" ? [t, h] : [h, t];
};
function pbFmtOf(url) { return /\.m3u8(\?|$)/.test(url) ? "hls" : /\.ts(\?|$)/.test(url) ? "ts" : "file"; }

/* ---------- clean stop ---------- */
var _stopMedia46 = stopMedia;
stopMedia = function () {
  clearTimeout(PB.prepT); clearInterval(PB.wdT); PB.wdT = null;
  var had = false; try { had = P.useAV && avOK() && webapis.avplay.getState() !== "NONE"; } catch (e) {}
  _stopMedia46();
  if (had) PB.lastClose = Date.now();
};

/* ---------- open with buffering params; waits for the previous connection to be released ---------- */
playURL = function (url) {
  var gen = ++PB.gen;
  stopMedia();
  var wait = Math.max(0, PB.GAP - (Date.now() - PB.lastClose));
  if (!P.started) osd(PB.tries ? null : "Loading\u2026", hintText(), true);
  if (wait > 0 && avOK()) { setTimeout(function () { if (gen === PB.gen && P.open) pbOpen(url, gen); }, wait); return; }
  pbOpen(url, gen);
};
function pbOpen(url, gen) {
  var resume = P.resume, live = !P.vod, cfg = pbCfg(), B = PB.BUF[cfg.buf];
  P.curURL = url; PB.lastT = -1; PB.lastMove = Date.now(); PB.bufAt = 0;
  if (!avOK()) {   // browser / emulator fallback: keep the 4.6 HTML5 path, add stall handling
    P.useAV = false; var v = $("video"); v.classList.remove("off");
    v.onplaying = function () { if (gen !== PB.gen) return; P.started = true; PB.tries = 0; pbBadge(""); osd("", null, false); };
    v.onloadedmetadata = function () { if (resume > 0) { try { v.currentTime = resume / 1000; } catch (e5) {} resume = 0; } };
    v.onwaiting = function () { if (gen !== PB.gen) return; PB.bufAt = PB.bufAt || Date.now(); osd("Buffering\u2026", null, true); };
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
      onbufferingstart: function () { if (gen !== PB.gen) return; PB.bufAt = Date.now(); if (P.started) { pdiag("stall"); osd("Buffering\u2026", null, true); } },
      onbufferingprogress: function (p) { if (gen !== PB.gen) return; if (P.started || !PB.tries) osd("Buffering " + p + "%", null, true); },
      onbufferingcomplete: function () { if (gen !== PB.gen) return; if (PB.bufAt && P.started) pdiag("stall-end", Math.round((Date.now() - PB.bufAt) / 1000) + "s"); PB.bufAt = 0; PB.lastMove = Date.now(); osd("", null, false); },
      onstreamcompleted: function () { if (gen !== PB.gen) return; if (live) pbTrouble("ended-live"); else onEnded(); },
      oncurrentplaytime: function () {},
      onerror: function (e) { if (gen === PB.gen) pbTrouble("error", String(e)); },
      onerrormsg: function (e, m) { if (gen === PB.gen) pdiag("errmsg", String(e) + " " + String(m || "").replace(/\/live\/[^\/]+\/[^\/]+\//g, "/live/*/*/").slice(0, 160)); },
      onevent: function (t, d) { if (gen === PB.gen && /HTTP_ERROR|BITRATE/.test(String(t))) pdiag("ev", String(t) + " " + String(d || "").slice(0, 60)); }
    });
    try { av.setBufferingParam("PLAYER_BUFFER_FOR_PLAY", "PLAYER_BUFFER_SIZE_IN_SECOND", (live ? B.live : B.vod)[0]); } catch (b1) {}
    try { av.setBufferingParam("PLAYER_BUFFER_FOR_RESUME", "PLAYER_BUFFER_SIZE_IN_SECOND", (live ? B.live : B.vod)[1]); } catch (b2) {}
    try { av.setTimeoutForBuffering(B.to); } catch (b3) {}
    av.setDisplayRect(0, 0, 1920, 1080);
    try { av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e0) {}
    PB.prepT = setTimeout(function () { if (gen === PB.gen && !P.started) pbTrouble("error", "prepare timeout"); }, 25000);
    av.prepareAsync(function () {
      if (gen !== PB.gen) return; clearTimeout(PB.prepT);
      try {
        av.play(); P.started = true; PB.lastMove = Date.now();
        if (live) { var f = pbFmtOf(url); if (PB.okFmt[P.item.id] !== f) { PB.okFmt[P.item.id] = f; lsSet("nf_okfmt", PB.okFmt); } }
        if (PB.tries) { pdiag("recovered", "after " + PB.tries); osd("Reconnected", null, false); } else if (resume > 0) {} else osd("", null, false);
        PB.tries = 0; pbBadge("");
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
    if (t !== PB.lastT) { PB.lastT = t; PB.lastMove = Date.now(); return; }
    var B = PB.BUF[pbCfg().buf], limit = Math.max(P.vod ? 30 : 15, B.to + 8) * 1000;   // frozen this long while "playing" or buffering
    if (Date.now() - PB.lastMove > limit) { pdiag("frozen", Math.round((Date.now() - PB.lastMove) / 1000) + "s"); pbTrouble("frozen"); }
  }, 2000);
}

/* ---------- trouble => reconnect with backoff on the same channel ---------- */
function pbTrouble(kind, why) {
  if (!P.open) return;
  var gen = ++PB.gen;   // invalidate callbacks of the failing session
  pdiag(kind, why || "");
  var at = 0; try { if (P.vod && P.useAV) at = webapis.avplay.getCurrentTime() || 0; else if (P.vod) at = $("video").currentTime * 1000; } catch (e) {}
  if (P.vod && at > 0) P.resume = at;
  stopMedia();
  // never-started + hard format errors: go straight to the alternate URL (old 4.6 behaviour)
  if (!P.started && /NOT_SUPPORTED|INVALID_URI|NO_SUCH_FILE/.test(why || "") && P.ui < P.urls.length - 1) { P.ui++; playURL(P.urls[P.ui]); return; }
  PB.tries++;
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

/* ---------- start / zap / close ---------- */
var _startPlayback46 = startPlayback;
startPlayback = function (title, urls, vod, resumeMs) { PB.tries = 0; P.dead = false; clearTimeout(PB.rcT); clearTimeout(PB.zapT); pbBadge(""); _startPlayback46(title, urls, vod, resumeMs); };
zap = function (d) {
  if (!P.list) { osd(null, hintText(), false); return; }
  var n = P.idx + d; if (n < 0 || n >= P.list.length) return;
  P.idx = n; var it = P.list[n]; P.item = it;
  $("osd-title").textContent = it.n; P.title = it.n; $("osd-epg").textContent = "";
  ++PB.gen; clearTimeout(PB.rcT); stopMedia(); pbBadge(""); PB.tries = 0; P.dead = false; P.started = false;   // close the old connection right away
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
var _togglePause46 = togglePause;
togglePause = function () {
  if (P.dead) { P.dead = false; PB.tries = 0; P.ui = 0; pbBadge("Reconnecting\u2026"); playURL(P.urls[0]); return; }
  _togglePause46();
};
var _closePlayer46 = closePlayer;
closePlayer = function () {
  ++PB.gen; clearTimeout(PB.rcT); clearTimeout(PB.zapT); clearInterval(PB.wdT); pbBadge(""); P.dead = false;
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
  var BL = { normal: "Normal \u2013 fastest start", large: "Large \u2013 fewer stalls (default)", max: "Maximum \u2013 slow start, most stable" };
  var FL = { auto: "Auto \u2013 HLS first, remembers what works", hls: "HLS (.m3u8) first", ts: "MPEG-TS (.ts) first" };
  var l1 = ce("div", "s-line"), b1 = chip("Buffer: " + BL[c.buf], "Live: " + PB.BUF[c.buf].live[0] + "s to start, " + PB.BUF[c.buf].live[1] + "s after a stall  \u00b7  Movies/shows: " + PB.BUF[c.buf].vod[0] + "s / " + PB.BUF[c.buf].vod[1] + "s", true, null, "wide act");
  b1._key = "pb:buf"; b1._act = function () { var o = ["normal", "large", "max"], cc = pbCfg(); cc.buf = o[(o.indexOf(cc.buf) + 1) % 3]; pbSave(cc); renderSettings("pb:buf"); toast("Buffer: " + cc.buf); };
  l1.appendChild(b1); inner.appendChild(l1); lnAdd(ln, l1, [b1]);
  var l2 = ce("div", "s-line"), b2 = chip("Live stream format: " + FL[c.fmt], "If a channel keeps dropping, try MPEG-TS. Auto switches format by itself after 3 failed reconnects.", true, null, "wide act");
  b2._key = "pb:fmt"; b2._act = function () { var o = ["auto", "hls", "ts"], cc = pbCfg(); cc.fmt = o[(o.indexOf(cc.fmt) + 1) % 3]; pbSave(cc); renderSettings("pb:fmt"); toast("Live format: " + cc.fmt.toUpperCase()); };
  l2.appendChild(b2); inner.appendChild(l2); lnAdd(ln, l2, [b2]);
  var s = pdiagSummary(24);
  inner.appendChild(ce("div", "s-note", "Last 24 h on this TV: " + s.stall + " stalls, " + s.rc + " auto-reconnects, " + s.end + " provider drops, " + s.fail + " gave up"));
  inner.appendChild(ce("div", "s-note", "NickFlix 4.7"));
};
