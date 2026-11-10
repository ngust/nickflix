/* NickFlix v4.3 - per-profile watch log + affinity. Builds on the v3 learning (learn.js):
   every play is logged in PD.wl (this profile only) and its category also feeds learnAdd("cat"/"cc").
   Affinity = sum over log entries of  recency(half-life 14 d) x log2(1+minutes) x (finished ? 1.6 : 1),
   while a short abandon (live < 1 min, VOD < 4 min and < 10 %) counts -0.6 x recency.
   Cold start (no log) = no change to the default order. Nothing is shared between profiles. */
"use strict";
var WH_CAP = 150, WH_MERGE = 30 * 60000, WH_HL = 14 * 86400000;
var RE_TCRIME = /TRUE CRIME|\bCRIME\b|INVESTIGATION|\bID\b|FORENSIC|MURDER|KILLER|COURT ?TV|OXYGEN|\bA ?& ?E\b|REAL CRIME|DETECTIVE|SERIAL|HOMICIDE|\bCOPS\b|\bFBI\b|DATELINE|\b48 HOURS\b/;
var WH_GEN_SUB = { "Documentary": "Documentary", "Kids & Family": "Kids", "Animation & Anime": "Kids", "Comedy": "Entertainment", "Drama": "Entertainment", "Romance": "Entertainment",
  "Reality": "Lifestyle", "Thriller & Crime": "Entertainment", "Action & Adventure": "Movies", "Sci-Fi & Fantasy": "Movies", "Horror": "Movies", "War & History": "Documentary", "Western": "Movies" };
function whKind(t) { return t === "live" ? "live" : t === "movies" ? "movie" : "show"; }
function whBox() { if (!PD.wl) PD.wl = []; return PD.wl; }
/* category + country of one item */
function whInfo(it) {
  var cats = [], cc = "", u = String(it.n || "").toUpperCase();
  if (it.t === "live") {
    var c = catById["live:" + it.c]; cc = c ? c.code : "";
    var sub = "";
    try { if ((cc === "UK" || cc === "US") && typeof tvcBuild === "function") { tvcBuild(cc); var o = tvcOf(it); if (o) sub = o.sub; } } catch (e) {}
    if (!sub && c) try { sub = chanSub({ n: it.n, up: u, c: it.c, id: it.id }, c); } catch (e2) {}
    if (sub) cats.push(sub);
    if (RE_TCRIME.test(u)) cats.push("True Crime");
  } else {
    var vc = catById[it.t + ":" + it.c]; cc = vc && vc.code && vc.code !== "MULTI" ? vc.code : "";
    cats = itemGenres(it).slice(0, 4);
    var txt = u + " " + String(it.genre || "").toUpperCase() + " " + (vc ? vc.up : "");
    if (RE_TCRIME.test(txt) && (/DOCU|TRUE CRIME|INVESTIGAT/.test(txt) || cats.indexOf("Documentary") >= 0)) cats.push("True Crime");
    cats.push(it.t === "movies" ? "Movies" : "Shows");
  }
  return { cats: cats, cc: cc };
}
/* one log entry per sitting (same item within 30 min is merged) */
function whTick(it, sec) {
  if (!PD || !it) return;
  var wl = whBox(), k = itemKey(it), now = Date.now(), top = wl[0];
  if (top && top.k === k && now - top.ts < WH_MERGE) { top.min = Math.round((top.min + sec / 60) * 100) / 100; top.ts = now; }
  else {
    var inf = whInfo(it), e = { k: k, t: whKind(it.t), n: String(it.n || ""), cats: inf.cats, cc: inf.cc, min: Math.round(sec / 60 * 100) / 100, fr: null, ts: now, st: now, it: snap(it) };
    if (it.t === "series" && P && P.ep) e.ep = { s: P.ep.s, e: P.ep.e };
    wl.unshift(e); if (wl.length > WH_CAP) wl.length = WH_CAP;
    inf.cats.forEach(function (x) { learnAdd("cat", x, 0.01); });
  }
  var e0 = wl[0]; e0.cats.forEach(function (x) { learnAdd("cat", x, sec / 60); });
}
function whProgress(it, ms, dur, done) {
  if (!PD || !it || it.t === "live") return; var k = itemKey(it), wl = whBox();
  for (var i = 0; i < wl.length && i < 10; i++) if (wl[i].k === k) { if (done) wl[i].fr = 1; else if (dur > 0) wl[i].fr = Math.round(Math.min(1, ms / dur) * 1000) / 1000; return; }
}
/* hooks into the existing player bookkeeping */
var _addWatchTimeV3 = addWatchTime;
addWatchTime = function (it, sec) { _addWatchTimeV3(it, sec); try { whTick(it, sec); } catch (e) {} };
var _setPosV3 = setPos;
setPos = function (it, ms, dur, ep) { _setPosV3(it, ms, dur, ep); try { if (!(ep && ep.next)) whProgress(it, ms, dur, false); else whProgress(it, 1, 1, true); } catch (e) {} };
var _clearPosV3 = clearPos;
clearPos = function (it) { _clearPosV3(it); try { if (P && P.open && P.item && itemKey(P.item) === itemKey(it)) whProgress(it, 1, 1, true); } catch (e) {} };

/* ---------- scoring ---------- */
function whAbandon(e) { return e.t === "live" ? e.min < 1 : (e.min < 4 && (e.fr == null || e.fr < 0.1)); }
function whWeight(e) {
  var rec = Math.pow(0.5, (Date.now() - e.ts) / WH_HL);
  if (whAbandon(e)) return -0.6 * rec;
  return rec * Math.log(1 + Math.min(e.min, 180)) / Math.LN2 * (e.fr != null && e.fr >= 0.9 ? 1.6 : 1);
}
var WHA = { pd: null, t: 0, v: null };
function whAff() {
  if (WHA.pd === PD && WHA.v && Date.now() - WHA.t < 4000) return WHA.v;
  var a = { cat: {}, sub: {}, cc: {}, key: {}, n: 0, max: 0 };
  whBox().forEach(function (e) {
    var w = whWeight(e); a.n++;
    a.key[e.k] = (a.key[e.k] || 0) + w;
    e.cats.forEach(function (x) { a.cat[x] = (a.cat[x] || 0) + w; });
    if (e.cc && w > 0) a.cc[e.cc] = (a.cc[e.cc] || 0) + w;
  });
  // map onto the TV category rows (SUBS names)
  for (var x in a.cat) {
    var s = SUBS.some(function (q) { return q[0] === x; }) ? x : x === "True Crime" ? "Documentary" : WH_GEN_SUB[x];
    if (s) a.sub[s] = (a.sub[s] || 0) + a.cat[x] * (x === s ? 1 : 0.7);
  }
  for (var y in a.sub) a.max = Math.max(a.max, a.sub[y]);
  WHA = { pd: PD, t: Date.now(), v: a }; return a;
}
function whHas() { return whBox().some(function (e) { return !whAbandon(e); }); }
function whSubNorm(sub) { var a = whAff(); return a.max > 0 ? (a.sub[sub] || 0) / a.max : 0; }   // -..1
function whChanBonus(ch) {   // affinity of a channel from its category / true-crime / own history
  var a = whAff(); if (!a.n) return 0; var o = typeof tvcOf === "function" ? tvcOf(ch) : null, u = ch.up || String(ch.n).toUpperCase();
  var b = o ? whSubNorm(o.sub) : 0;
  if (RE_TCRIME.test(u) && a.cat["True Crime"] > 0) b += 0.8 * Math.min(1, a.cat["True Crime"] / (a.max || 1));
  var kk = a.key["live:" + ch.id]; if (kk < 0) b -= 0.5;
  return b;
}
/* existing VOD genre affinity (curated Movies/Shows rows) now also uses the log */
var _affinityV3 = affinity;
affinity = function () {
  var a = _affinityV3();
  whBox().forEach(function (e) { if (e.t === "live") return; var w = whWeight(e); e.cats.forEach(function (g) { a[g] = (a[g] || 0) + 3 * w; }); });
  return a;
};
function whFinished() { var f = {}; whBox().forEach(function (e) { if (e.fr != null && e.fr >= 0.9) f[e.k] = 1; }); return f; }
function whAnchor(t) {   // most recent sitting that was not abandoned
  var wl = whBox(); for (var i = 0; i < wl.length; i++) if ((!t || wl[i].t === t) && !whAbandon(wl[i])) return wl[i]; return null;
}

/* ---------- hub: tiles by affinity + "Because you watched" + "Top picks" ---------- */
var WH_TILE_SUB = { sports: "Sports", news: "News", "t:Kids": "Kids", "t:Movie channels": "Movies", "t:Documentary": "Documentary", "t:Music": "Music", "t:Entertainment & general": "Entertainment", "t:24/7 channels": "24/7", "t:Local channels": "Local" };
var _hubTilesV3 = hubTiles;
hubTiles = function (evN) {
  var out = _hubTilesV3(evN); if (!whBox().length) return out;
  var a = whAff(), ccMax = 0; for (var c in a.cc) ccMax = Math.max(ccMax, a.cc[c]);
  out.forEach(function (t) {
    var s = WH_TILE_SUB[t.id]; if (s) t.score += 45 * whSubNorm(s);
    var m = /^c:(\w+)$/.exec(t.id); if (m && ccMax) t.score += 30 * (a.cc[m[1]] || 0) / ccMax;
  });
  out.sort(function (x, y) { return y.score - x.score; });
  return out;
};
function whLiveSimilar(anchor, max) {
  var cc = anchor.cc, tc = anchor.cats.indexOf("True Crime") >= 0, sub = anchor.cats[0], pool = [];
  if ((cc === "UK" || cc === "US") && typeof tvcVisible === "function") pool = tvcVisible(cc).filter(function (ch) { var o = tvcOf(ch); return o && !o.slot && o.sub !== "24/7"; });
  else pool = (CH.all || []).filter(function (ch) { var c = chanCat(ch); return c && c.code === cc && chanOK(ch) && itemOK(ch); });
  var ao = null; try { ao = typeof tvcOf === "function" ? tvcOf(anchor.it) : null; } catch (e) {} var akey = ao ? ao.key : "";
  var l = pool.filter(function (ch) {
    if (String(ch.id) === String(anchor.it.id)) return false;
    if (akey && o && o.key === akey) return false;
    var u = ch.up || String(ch.n).toUpperCase(), o = typeof tvcOf === "function" ? tvcOf(ch) : null, s = o ? o.sub : chanSub(ch);
    return (tc && RE_TCRIME.test(u)) || s === sub;
  });
  l = typeof tvcDedupe === "function" && (cc === "UK" || cc === "US") ? tvcDedupe(l) : dedupeBest(l, 400);
  var ak = whAff().key, sorted = typeof tvcSort === "function" && (cc === "UK" || cc === "US") ? tvcSort(l) : l;
  var sc = sorted.map(function (ch, i) { var u = ch.up || String(ch.n).toUpperCase(); return { ch: ch, s: -i + (tc && RE_TCRIME.test(u) ? 60 : 0) + ((ak["live:" + ch.id] || 0) < 0 ? -80 : 0) }; });
  sc.sort(function (x, y) { return y.s - x.s; });
  return sc.slice(0, max || 24).map(function (x) { return x.ch; });
}
function whTopPicksLive(max) {
  var a = whAff(), ccs = Object.keys(a.cc).sort(function (x, y) { return a.cc[y] - a.cc[x]; }).filter(function (c) { return c === "UK" || c === "US"; }).slice(0, 2);
  if (!ccs.length) ccs = ["US"];
  var sc = [];
  ccs.forEach(function (cc, ci) {
    var l = tvcDedupe(tvcVisible(cc).filter(function (ch) { var o = tvcOf(ch); return o && o.brand && !o.slot && !o.local && o.sub !== "24/7"; }));
    tvcSort(l).forEach(function (ch, i) { var b = whChanBonus(ch); sc.push({ ch: ch, s: 6 * b - i / 40 - ci * 0.4 + learnScore("ch", String(ch.id)) / 30 }); });
  });
  sc.sort(function (x, y) { return y.s - x.s; });
  var seen = {}, out = [];
  sc.forEach(function (x) { var k = tvcOf(x.ch).key; if (!seen[k] && out.length < (max || 24) && (a.key["live:" + x.ch.id] || 0) >= 0) { seen[k] = 1; out.push(x.ch); } });
  return out;
}
function whVodSimilar(anchor) {
  var c = catById[(anchor.it.t) + ":" + anchor.it.c]; if (!c) return Promise.resolve([]);
  var fin = whFinished(), g = anchor.cats;
  return settle(loadCat(c)).then(function (items) {
    return items.filter(function (x) { return itemKey(x) !== anchor.k && !fin[itemKey(x)] && itemOK(x); }).map(function (x) {
      var gg = whInfo(x).cats, s = 0; gg.forEach(function (q) { if (g.indexOf(q) >= 0) s += 2; }); return { it: x, s: s + (x.r || 5) / 3 + (x.ic ? 0.5 : 0) };
    }).sort(function (p, q) { return q.s - p.s; }).slice(0, 30).map(function (p) { return p.it; });
  });
}
function whHubRows() {
  if (!PD || !whHas()) return [];
  var rows = [], an = whAnchor(null), nm = PF.name;
  if (an) {
    if (an.t === "live") rows.push({ title: "Because you watched " + an.n.replace(/[\u1D00-\u1DBF\u02B0-\u02FF]+/g, "").trim(), kind: "l", epg: true, local: true, load: function () { return Promise.resolve(whLiveSimilar(an, 24)); } });
    else rows.push({ title: "Because you watched " + an.n, kind: "p", load: function () { return whVodSimilar(an); } });
  }
  rows.push({ title: "Top picks for " + nm, kind: "l", epg: true, local: true, load: function () { return Promise.resolve(whTopPicksLive(24)); } });
  return rows;
}
var _hubSpecsV3 = hubSpecs;
hubSpecs = function () {
  var rows = _hubSpecsV3(), add = whHubRows(); if (!add.length) return rows;
  // right after the "Browse TV" tile block
  var i = 0; while (i < rows.length && rows[i].kind !== "t") i++; while (i < rows.length && rows[i].kind === "t") i++;
  return rows.slice(0, i).concat(add, rows.slice(i));
};
