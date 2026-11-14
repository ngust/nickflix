/* NickFlix 4.11 - "Today's picks" rows and the "Surprise me" slot machine (Live TV, Movies, Shows).
   Today's picks: one row per section that changes at midnight (time zone from Settings, default Creston UTC-7).
   It uses the same taste model as Top picks (learn.js + wh.js) but on purpose looks sideways: genres next to
   what you watch, favourite categories you rarely open, things you never tried, a little randomness seeded by
   date + profile, and nothing you watched, nothing from Top picks / Your top channels and nothing shown on the
   last 3 days. The day's list is cached in the profile, so it stays the same all day.
   Surprise me: a short slot-machine spin that lands on 3 picks drawn at random, weighted by taste
   (Settings > Picks & Surprise me: More like what I watch / Balanced / Wild card). Nothing is shown before you press it. */
"use strict";
var DP_N = 16;
function dpToday() { var d = zDate(Date.now()); return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate(); }
function dpLabel() { var d = zDate(Date.now()); return DOW[d.getUTCDay()] + " " + MON[d.getUTCMonth()] + " " + d.getUTCDate(); }
function dpRng(seed) {   // mulberry32
  var a = (hash(seed) >>> 0) || 1;
  return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function dpBox() {
  var day = dpToday(), dp = PD.dp;
  if (!dp || dp.d !== day) {
    var past = dp && dp.past ? dp.past.slice(0, 2) : [];
    if (dp && dp.s) { var k = {}; for (var sec in dp.s) k[sec] = dp.s[sec].map(function (x) { return itemKey(x.it); }); past.unshift({ d: dp.d, k: k }); }
    PD.dp = dp = { d: day, s: {}, past: past.slice(0, 3) };
  }
  return dp;
}
function dpRecent(sec) { var o = {}; (dpBox().past || []).forEach(function (p) { (p.k[sec] || []).forEach(function (k) { o[k] = 1; }); }); return o; }
function dpSeen() {   // everything this profile already watched / started
  var o = {};
  PD.hist.forEach(function (h) { o[h.k] = 1; });
  (PD.wl || []).forEach(function (e) { o[e.k] = 1; });
  for (var k in PD.pos) o[k] = 1;
  return o;
}
/* ---------- taste features ---------- */
var DP_SUB_GEN = {};   // TV category -> VOD genres (inverse of wh.js WH_GEN_SUB)
(function () { for (var g in WH_GEN_SUB) (DP_SUB_GEN[WH_GEN_SUB[g]] = DP_SUB_GEN[WH_GEN_SUB[g]] || []).push(g); })();
function dpVodModel() {
  var aff = affinity(), gs = Object.keys(aff).filter(function (g) { return aff[g] > 0; }).sort(function (a, b) { return aff[b] - aff[a]; });
  var max = gs.length ? aff[gs[0]] : 0, favG = {};
  favOf(PF).subs.forEach(function (s) { (DP_SUB_GEN[s] || [s]).forEach(function (g) { favG[g] = 1; }); });
  return { aff: aff, max: max, top: gs.slice(0, 2), adj: gs.slice(2, 8), favG: favG };
}
function dpVodFeat(it, M) {
  var g = itemGenres(it), t = 0, adj = 0, fav = 0, known = 0, topOnly = g.length > 0, now = Date.now() / 1000;
  g.forEach(function (x) {
    var a = M.aff[x] || 0; if (a > 0) known = 1;
    t += M.max ? Math.max(0, a) / M.max : 0;
    if (M.adj.indexOf(x) >= 0) adj = 1;
    if (M.top.indexOf(x) < 0) topOnly = false;
    if (M.favG[x] && (!M.max || a < 0.3 * M.max)) fav = 1;
  });
  var r = parseFloat(it.r) || 0; if (r > 10) r = r / 10;
  var q = (ratingOK(it) ? Math.max(0, (r - 5) / 4) : 0.15) + (it.a && now - it.a < 365 * 86400 ? 0.25 : 0);
  return { g: g[0] || "", taste: Math.min(1.5, t), adj: adj, fav: fav, novel: g.length && !known && M.max > 0 ? 1 : 0, topOnly: topOnly && M.max > 0, q: q };
}
function dpVodPool(type) {
  var en = cats[type].filter(catVisibleV); if (!en.length) return Promise.resolve([]);
  return loadPool(type, poolFor(type, en)).then(function (items) { return items.filter(function (it) { return it.ic && itemOK(it); }); });
}
function dpTopPickKeys(type, items) {   // what the regular "Top Picks" row puts first: kept out of today's picks
  var aff = affinity(), now = Date.now() / 1000;
  return items.map(function (it) {
    var g = itemGenres(it), s = 0; g.forEach(function (x) { s += aff[x] || 0; });
    var age = it.a ? Math.max(0, (now - it.a) / 86400) : 400;
    return { k: itemKey(it), s: s * 1.5 + (ratingOK(it) ? it.r : 5) + Math.max(0, 3 - age / 60) + 1 };
  }).sort(function (a, b) { return b.s - a.s; }).slice(0, 30).reduce(function (o, x) { o[x.k] = 1; return o; }, {});
}
/* ---------- live features ---------- */
function dpLivePool() {
  return ensureIndex().then(function () {
    var out = [], seen = {};
    ["US", "UK"].forEach(function (cc) {
      var l = tvcVisible(cc).filter(function (ch) { var o = tvcOf(ch); return o && o.brand && !o.slot && !o.local && o.sub !== "24/7"; });
      tvcDedupe(l).forEach(function (ch) { var k = tvcOf(ch).key; if (!seen[k]) { seen[k] = 1; out.push(ch); } });
    });
    extraChannels().forEach(function (ch) { if (!seen["x" + ch.id]) { seen["x" + ch.id] = 1; out.push(ch); } });
    return out.filter(itemOK);
  });
}
function dpLiveFeat(ch, favS) {
  var o = typeof tvcOf === "function" ? tvcOf(ch) : null, sub = o ? o.sub : "Extra", n = o ? whSubNorm(sub) : 0;
  return { g: sub, taste: Math.max(0, whChanBonus(ch)), adj: n > 0.05 && n < 0.6 ? 1 : 0, fav: favS[sub] && n < 0.3 ? 1 : 0, novel: n <= 0 ? 1 : 0, topOnly: n >= 0.6,
           q: qualityBonus(ch) / 1.7 + (logoFor(ch) ? 0.4 : 0), key: o ? o.key : "x" + ch.id };
}
function dpLiveExclude() {
  var o = {};
  learnTop("ch", 20).forEach(function (x) { o["live:" + x[0]] = 1; });
  try { whTopPicksLive(24).forEach(function (ch) { o["live:" + ch.id] = 1; var t = tvcOf(ch); if (t) o["k:" + t.key] = 1; }); } catch (e) {}
  return o;
}
/* ---------- selection: score, then pick with variety ---------- */
function dpWhy(f) { return f.fav ? "Favourite you've missed" : f.novel ? "Wild card" : f.adj ? "Try something new" : f.taste > 0.05 ? "For your taste" : "Fresh pick"; }
function dpSelect(cands, rnd, n, perG) {
  cands.sort(function (a, b) { return b.s - a.s; });
  var out = [], perGenre = {}, perWhy = {}, keys = {}, capWhy = Math.ceil(n * 0.4);
  var wild = cands.filter(function (c) { return c.f.novel || c.f.taste < 0.15; }).slice(0, 12);
  function free(c) { var ic = c.it.ic || ""; return !keys[c.key] && !(ic && keys["ic:" + ic]); }
  function put(c) { keys[c.key] = 1; if (c.it.ic) keys["ic:" + c.it.ic] = 1; var w = dpWhy(c.f);
    // over the reason cap (fallback fill): label it by its next-best reason so one label can't dominate the row
    if ((perWhy[w] || 0) >= capWhy) { c.why = c.f.adj && w !== "Try something new" ? "Try something new" : c.f.taste > 0.05 && w !== "For your taste" ? "For your taste" : "Fresh pick"; w = c.why; } perGenre[c.f.g] = (perGenre[c.f.g] || 0) + 1; perWhy[w] = (perWhy[w] || 0) + 1; out.push(c); }
  function take(c) { if (!free(c) || (perGenre[c.f.g] || 0) >= perG || (perWhy[dpWhy(c.f)] || 0) >= capWhy) return false; put(c); return true; }
  for (var i = 0; i < cands.length && out.length < n; i++) {
    if ((out.length === 3 || out.length === 8 || out.length === 13) && wild.length) { var w = wild.splice(Math.floor(rnd() * wild.length), 1)[0]; if (take(w)) { i--; continue; } }
    take(cands[i]);
  }
  for (var j = 0; j < cands.length && out.length < n; j++) if (free(cands[j]) && (perGenre[cands[j].f.g] || 0) < perG + 2) put(cands[j]);
  for (var q = 0; q < cands.length && out.length < n; q++) if (free(cands[q])) put(cands[q]);
  // interleave the reasons so the row reads taste / new / favourite / wild ... instead of in blocks
  var by = {}, order = ["For your taste", "Try something new", "Favourite you've missed", "Wild card", "Fresh pick"], mix = [];
  out.forEach(function (c) { var w = c.why || dpWhy(c.f); (by[w] = by[w] || []).push(c); });
  while (mix.length < out.length) order.forEach(function (w) { if (by[w] && by[w].length) mix.push(by[w].shift()); });
  return mix;
}
function dpCompute(sec) {
  var rnd = dpRng(dpToday() + "|" + PF.id + "|" + sec), seen = dpSeen(), recent = dpRecent(sec);
  if (sec === "live") {
    var favS = {}; favOf(PF).subs.forEach(function (s) { favS[s] = 1; });
    return dpLivePool().then(function (pool) {
      var ex = dpLiveExclude(), recentCh = {};
      PD.hist.slice(0, 30).forEach(function (h) { if (h.it.t === "live") recentCh[h.k] = 1; });
      var c = [];
      pool.forEach(function (ch) {
        var k = itemKey(ch); if (ex[k] || recentCh[k] || recent[k]) return;
        var f = dpLiveFeat(ch, favS); if (ex["k:" + f.key]) return;
        c.push({ it: ch, f: f, key: f.key, s: 0.8 * f.taste + 0.9 * f.adj + f.fav + 0.45 * f.novel + 0.6 * f.q + rnd() * 1.1 - (f.topOnly ? 0.4 : 0) });
      });
      return dpSelect(c, rnd, DP_N, 3);
    });
  }
  var M = dpVodModel();
  return dpVodPool(sec).then(function (pool) {
    var top = dpTopPickKeys(sec, pool), c = [];
    pool.forEach(function (it) {
      var k = itemKey(it); if (seen[k] || recent[k] || top[k]) return;
      var f = dpVodFeat(it, M);
      c.push({ it: it, f: f, key: normTitle(it), s: 0.9 * Math.min(1, f.taste) + 0.8 * f.adj + f.fav + 0.5 * f.novel + 0.7 * f.q + rnd() * 0.9 - (f.topOnly ? 0.3 : 0) });
    });
    return dpSelect(c, rnd, DP_N, 2);
  });
}
function dpItems(sec) {
  var box = dpBox();
  if (box.s[sec] && box.s[sec].length) return Promise.resolve(dpOut(box.s[sec]));
  return dpCompute(sec).then(function (list) {
    if (!list.length) return [];
    if (dpToday() === dpBox().d) { dpBox().s[sec] = list.map(function (x) { return { it: snap(x.it), w: x.why || dpWhy(x.f) }; }); savePD(); }
    return dpOut(dpBox().s[sec] || list.map(function (x) { return { it: x.it, w: x.why || dpWhy(x.f) }; }));
  });
}
function dpOut(arr) { return arr.map(function (x) { var it = JSON.parse(JSON.stringify(x.it)); if (it.t !== "live") it.sub = x.w; it._why = x.w; return it; }).filter(itemOK); }
function dpSpec(sec) {
  var live = sec === "live";
  return { title: "\uD83D\uDCC5 Today's picks for " + PF.name, tag: dpLabel(), daily: true, kind: live ? "l" : "p", epg: live, local: live, load: function () { return dpItems(sec); } };
}
/* insert the row: Movies/Shows right after the personal rows (Continue / Recently / My List), TV hub right after the tiles */
var _curatedRows411 = curatedRows;
curatedRows = function (type) { var r = _curatedRows411(type); if ((type !== "movies" && type !== "series") || !dailyOn() || !r.length) return r; var i = 0; while (i < r.length && r[i].local) i++; return r.slice(0, i).concat([dpSpec(type)], r.slice(i)); };
var _allRows411 = allRows;
allRows = function (type) { var r = _allRows411(type); if ((type !== "movies" && type !== "series") || !dailyOn() || r.length < 4) return r; var i = 0; while (i < r.length && r[i].local) i++; return r.slice(0, i).concat([dpSpec(type)], r.slice(i)); };
var _hubSpecs411 = hubSpecs;
hubSpecs = function () {
  var rows = _hubSpecs411(); if (!dailyOn()) return rows;
  var i = 0; while (i < rows.length && rows[i].kind !== "t") i++; while (i < rows.length && rows[i].kind === "t") i++;
  return rows.slice(0, i).concat([dpSpec("live")], rows.slice(i));
};

/* ================= Surprise me: slot machine ================= */
var SL = { id: "slot", ln: null, sec: "movies", state: "idle", res: [], last: {}, timers: [], gen: 0 };
var SL_SEC_T = { live: "Live TV", movies: "Movies", series: "Shows" };
function slCands(sec) {
  var seen = dpSeen();
  if (sec === "live") {
    var favS = {}; favOf(PF).subs.forEach(function (s) { favS[s] = 1; });
    return dpLivePool().then(function (pool) { return pool.map(function (ch) { var f = dpLiveFeat(ch, favS); return { it: ch, f: f, key: f.key }; }); });
  }
  var M = dpVodModel();
  return dpVodPool(sec).then(function (pool) {
    return pool.filter(function (it) { return !seen[itemKey(it)]; }).map(function (it) { var f = dpVodFeat(it, M); return { it: it, f: f, key: normTitle(it) }; });
  });
}
function slDraw(cands, n) {
  var k = { taste: 3.2, bal: 1.6, wild: 0.35 }[slotMix()], pool = cands.filter(function (c) { return !SL.last[c.key]; });
  if (pool.length < n) pool = cands.slice();
  var w = pool.map(function (c) { var t = Math.min(1.5, c.f.taste) + 0.5 * c.f.adj + 0.6 * c.f.fav; return Math.exp(k * t) * (0.4 + c.f.q); });
  var out = [];
  while (out.length < n && pool.length) {
    var sum = 0, i; for (i = 0; i < w.length; i++) sum += w[i];
    var x = Math.random() * sum; for (i = 0; i < w.length - 1 && x > w[i]; i++) x -= w[i];
    var c = pool.splice(i, 1)[0]; w.splice(i, 1); out.push(c);
    for (var j = 0; j < pool.length; j++) if (pool[j].f.g === c.f.g || pool[j].key === c.key) w[j] *= pool[j].key === c.key ? 0 : 0.3;   // variety across the 3 reels
  }
  return out;
}
/* sound: soft ticks while the reels pass, a ding as each stops, a little chime at the end (shared AudioContext) */
function slAudio() {
  if (!slotSoundOn()) return null;
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try {
    var host = typeof NFM !== "undefined" ? NFM : SL;
    if (!host.ctx) host.ctx = new AC();
    var ctx = host.ctx; if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    var bus = ctx.createGain(); bus.gain.value = 0.32; bus.connect(ctx.destination); SL.bus = bus; return ctx;
  } catch (e) { return null; }
}
function slBlip(ctx, at, f, len, vol, type) {
  var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || "square"; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g); g.connect(SL.bus); o.start(at); o.stop(at + len + 0.02);
}
function slSound(durs, steps) {
  var ctx = slAudio(); if (!ctx) return;
  var t0 = ctx.currentTime + 0.05;
  durs.forEach(function (d, r) {
    var last = -1;
    for (var s = 1; s <= 60; s++) {   // ease-out-cubic position -> one tick per poster passing (max ~25 per reel)
      var x = s / 60, p = Math.floor((1 - Math.pow(1 - x, 3)) * steps);
      if (p !== last && p % 2 === 0) { last = p; slBlip(ctx, t0 + x * d, 1500 + r * 180, 0.025, 0.05); } else if (p !== last) last = p;
    }
    slBlip(ctx, t0 + d, 1318.5, 0.35, 0.16, "sine"); slBlip(ctx, t0 + d + 0.02, 1975.5, 0.3, 0.07, "sine");
  });
  var end = t0 + durs[durs.length - 1] + 0.12;
  [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { slBlip(ctx, end + i * 0.075, f, 0.4, 0.12, "triangle"); });
}
function slStopSound() { var b = SL.bus; SL.bus = null; if (!b) return; try { b.gain.value = 0; b.disconnect(); } catch (e) {} }
function openSlot(sec) {
  SL.sec = sec; SL.last = {}; SL.cands = null;
  ovOpen(SL); slRender("load");
  var gen = ++SL.gen;
  slCands(sec).then(function (c) {
    if (gen !== SL.gen || OV.stack.indexOf(SL) < 0) return;
    SL.cands = c;
    if (c.length < 3) { slRender("empty"); return; }
    slSpin();
  }, function () { if (gen === SL.gen) slRender("empty"); });
}
function closeSlot() { SL.gen++; SL.timers.forEach(clearTimeout); SL.timers = []; slStopSound(); SL.state = "idle"; ovClose(SL); restoreFocus(); }
function slCard(it, cls) {
  var c = ce("div", "sl-card " + cls);
  var a = it.t === "live" && typeof chanArt === "function" ? chanArt(it) : imgOr(it.ic, it.n);
  c.appendChild(a); return c;
}
function slRender(state) {
  var box = $("slot-inner"); box.textContent = ""; SL.state = state;
  var cab = ce("div", "sl-cab" + (SL.sec === "live" ? " live" : ""));
  var hd = ce("div", "sl-hd"); hd.appendChild(ce("span", "sl-logo", "\uD83C\uDFB0")); hd.appendChild(ce("span", "sl-t", "Surprise me"));
  hd.appendChild(ce("span", "sl-sec", SL_SEC_T[SL.sec] + "  \u00b7  " + { taste: "More like what I watch", bal: "Balanced", wild: "Wild card" }[slotMix()]));
  cab.appendChild(hd);
  var lights = ce("div", "sl-lights"); for (var i = 0; i < 18; i++) lights.appendChild(ce("i", i % 2 ? "b" : "a")); cab.appendChild(lights);
  var reels = ce("div", "sl-reels"); cab.appendChild(reels);
  SL.reelEls = [];
  for (var r = 0; r < 3; r++) { var w = ce("div", "sl-col"), rb = ce("div", "sl-reel"), st = ce("div", "sl-strip"); rb.appendChild(st); w.appendChild(rb); var nm = ce("div", "sl-name"); w.appendChild(nm); reels.appendChild(w); SL.reelEls.push({ w: w, rb: rb, st: st, nm: nm }); }
  var msg = ce("div", "sl-msg", state === "load" ? "Shuffling the deck\u2026" : state === "empty" ? "Not enough to pick from \u2013 check your filters in Settings." : ""); cab.appendChild(msg); SL.msg = msg;
  var bl = ce("div", "sl-btns"); cab.appendChild(bl); SL.btnLine = bl;
  box.appendChild(cab);
  SL.ln = LN(box, 2000);
  if (state === "empty") { var cl = ce("div", "btn", "Close"); cl._act = closeSlot; bl.appendChild(cl); lnAdd(SL.ln, bl, [cl]); lnFocus(SL.ln); }
  else setF(null);
}
function slSpin() {
  var picks = slDraw(SL.cands, 3); SL.res = picks.map(function (p) { return p.it; });
  SL.last = {}; picks.forEach(function (p) { SL.last[p.key] = 1; });
  slRender("spin");
  var live = SL.sec === "live", H = live ? 230 : 430, N = 22, durs = [1.25, 1.6, 1.95];
  var withPic = SL.cands.filter(function (c) { return live ? true : c.it.ic; });
  SL.reelEls.forEach(function (R, r) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < N - 1; i++) { var f = withPic[Math.floor(Math.random() * withPic.length)].it; var c = slCard(f, ""); c.style.transform = "translateY(" + (i * H) + "px)"; frag.appendChild(c); }
    var fin = slCard(picks[r].it, "fin"); fin.style.transform = "translateY(" + ((N - 1) * H) + "px)"; frag.appendChild(fin);
    R.st.appendChild(frag); R.fin = fin;
    R.st.style.transition = "none"; R.st.style.transform = "translateY(0px)";
  });
  void $("slot-inner").offsetHeight;   // commit the start position before animating
  SL.reelEls.forEach(function (R, r) {
    R.st.style.transition = "transform " + durs[r] + "s cubic-bezier(0.215, 0.61, 0.355, 1)";
    R.st.style.transform = "translateY(" + (-(N - 1) * H) + "px)";
    SL.timers.push(setTimeout(function () { R.rb.classList.add("stop"); }, durs[r] * 1000));
  });
  slSound(durs, N - 1);
  var gen = SL.gen;
  SL.timers.push(setTimeout(function () { if (gen === SL.gen) slResult(); }, durs[2] * 1000 + 250));
}
function slResult() {
  SL.state = "result"; SL.timers = [];
  var ln = SL.ln = LN($("slot-inner"), 2000), items = [], live = SL.sec === "live";
  SL.reelEls.forEach(function (R, r) {
    var it = SL.res[r]; R.nm.textContent = "";
    R.nm.appendChild(ce("div", "sl-nt", it.n));
    var meta = live ? (catById["live:" + it.c] || {}).title || "" : [it.y && String(it.n).indexOf(String(it.y)) < 0 ? it.y : "", it.r ? "\u2605 " + (+it.r > 10 ? +it.r / 10 : +it.r).toFixed(1) : ""].filter(Boolean).join("  \u00b7  ");
    R.nm.appendChild(ce("div", "sl-nm", meta));
    R.rb.classList.add("done"); R.w.classList.add("done");
    R.w._act = function () { var list = SL.res.slice(); closeSlot(); if (live) { P.game = null; playItem(it, list, r); } else openDetails(it); };
    items.push(R.w);
  });
  SL.msg.textContent = live ? "OK on a channel to watch it" : "OK on a pick to open it";
  lnAdd(ln, SL.reelEls[0].w.parentNode, items);
  var again = ce("div", "btn primary", "\uD83C\uDFB0  Spin again"), cl = ce("div", "btn", "Close");
  again._act = function () { slSpin(); }; cl._act = closeSlot;
  SL.btnLine.appendChild(again); SL.btnLine.appendChild(cl); lnAdd(ln, SL.btnLine, [again, cl], { resetCol: true });
  ln.li = 0; ln.ci = 1; lnFocus(ln);
}
SL.key = function (k) {
  if (k === "back") { closeSlot(); return; }
  if (SL.state === "result" || SL.state === "empty") lnKey(SL.ln, k);
};
SL.refocus = function () { if (SL.ln && SL.ln.lines.length) lnFocus(SL.ln); };

/* ---------- the buttons: Movies/Shows in the Curated | All bar, Live TV next to the hub title ---------- */
var _renderModebar411 = renderModebar;
renderModebar = function () {
  _renderModebar411();
  if ((V.view !== "movies" && V.view !== "series") || !surpriseOn()) return;
  var bar = $("modebar"), b = ce("div", "mode surprise", "\uD83C\uDFB0 Surprise me"), hint = bar.getElementsByClassName("mode-hint")[0];
  b._act = function () { openSlot(V.view); };
  if (hint) bar.insertBefore(b, hint); else bar.appendChild(b);
  V.modeEls = (V.modeEls || []).concat([b]);
};
var _setMode411 = setMode;
setMode = function (i) { var e = V.modeEls && V.modeEls[i]; if (e && e._act) { e._act(); return; } _setMode411(i); };
var _buildView411 = buildView;
buildView = function (view) {
  _buildView411(view);
  if (view === "live" && !V.page && surpriseOn()) {
    var hd = $("rows").getElementsByClassName("phead")[0]; if (!hd) return;
    var b = ce("div", "mode surprise ph-btn", "\uD83C\uDFB0 Surprise me"); b._act = function () { openSlot("live"); };
    hd.appendChild(b); V.modeOn = true; V.modeEls = [b]; V.modeIdx = 0;
  }
};
var _enterContent411 = enterContent;
enterContent = function () {
  // Live TV keeps going straight to the rows; the Surprise button is one press UP from the first row
  if (TAB_VIEWS[V.navIdx] === "live" && V.view === "live" && V.modeOn && V.rows.length) { V.zone = "rows"; applyFocus(); return; }
  _enterContent411();
};
