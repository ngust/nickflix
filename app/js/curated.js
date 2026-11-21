/* NickFlix v2 - curated (Netflix-style) rows for Movies and Shows */
"use strict";
var THIS_YEAR = new Date().getFullYear();
function settle(p) { return p.then(function (v) { return v; }, function () { return []; }); }
function rowsLocal(type) {
  var out = [];
  // Continue watching
  out.push({ title: "Continue Watching", local: true, load: function () {
    var arr = [];
    for (var k in PD.pos) {
      var p = PD.pos[k]; if (!p || !p.it || p.it.t !== type) continue;
      var started = p.t > 5000, done = p.d > 0 && p.t > 0.92 * p.d;
      if ((!started && !(p.ep && p.ep.next)) || done) continue;
      var it = JSON.parse(JSON.stringify(p.it));
      it.pr = p.d > 0 ? Math.min(1, p.t / p.d) : 0; it._resume = p; it.ts = p.ts;
      if (p.ep) it.sub = (p.ep.next ? "Next: " : "") + "S" + p.ep.s + ":E" + p.ep.e;
      arr.push(it);
    }
    arr.sort(function (a, b) { return b.ts - a.ts; });
    return Promise.resolve(arr);
  } });
  out.push({ title: type === "live" ? "Recently Watched Channels" : "Recently Watched", local: true, load: function () {
    return Promise.resolve(PD.hist.filter(function (h) { return h.it.t === type; }).slice(0, 30).map(function (h) { return JSON.parse(JSON.stringify(h.it)); }));
  } });
  out.push({ title: type === "live" ? "My Channels" : "My List", local: true, load: function () {
    return Promise.resolve(PD.list.filter(function (h) { return h.it.t === type; }).map(function (h) { return JSON.parse(JSON.stringify(h.it)); }));
  } });
  if (type === "live") out.shift(); // no "continue" for live: recent + favourites
  return out;
}
function pickCats(list, re, max) { var o = []; for (var i = 0; i < list.length && o.length < max; i++) if (re.test(list[i].up)) o.push(list[i]); return o; }
function poolFor(type, en) {
  var pc = [], seen = {};
  function add(arr) { arr.forEach(function (c) { if (!seen[c.id] && pc.length < 12) { seen[c.id] = 1; pc.push(c); } }); }
  add(pickCats(en, /NEW|RECENT|2026|2025|NOUVEAU|NEUE|NUEVAS|RECENTI|YENI|VIZYON/, 4));
  add(pickCats(en, /NETFLIX/, 1)); add(pickCats(en, /AMAZON|PRIME/, 1)); add(pickCats(en, /APPLE|APPEL/, 1)); add(pickCats(en, /DISNEY/, 1)); add(pickCats(en, /HBO|\bMAX\b/, 1));
  add(pickCats(en, /4K|IMAX|BOX OFFICE|TOP/, 2));
  add(en.slice(0, 4));
  return pc;
}
var poolMem = {};
function loadPool(type, pc) {
  var sig = type + ":" + pc.map(function (c) { return c.id; }).join(",");
  if (poolMem[sig]) return poolMem[sig];
  var cached = lsGet("nf_pool_" + type, null);
  var p;
  if (cached && cached.sig === sig && Date.now() - cached.ts < 6 * 3600 * 1000 && cached.items && cached.items.length) {
    p = Promise.resolve(cached.items);
  } else {
    p = Promise.all(pc.map(function (c) { return settle(loadCat(c)); })).then(function (lists) {
      var by = {}, out = [], ok = adultOk();
      lists.forEach(function (l) { l.forEach(function (it) {
        if (!itemOK(it)) return;
        var k = normTitle(it), o = by[k];
        if (!o) { by[k] = it; out.push(it); }
        else if (!o.ic && it.ic) { by[k] = it; out[out.indexOf(o)] = it; }
      }); });
      out.sort(function (a, b) { return (b.a || 0) - (a.a || 0); });
      // 4.14: keep the first 4 cast names + director (people affinity, taste.js); still no plot
      var keep = out.slice(0, 900).map(function (it) { var s = {}; for (var k in it) if (k === "cast") { if (it.cast) s.cast = String(it.cast).split(/\s*,\s*/).slice(0, 4).join(", "); } else if (k !== "plot") s[k] = it[k]; return s; });
      lsSet("nf_pool_" + type, { sig: sig, ts: Date.now(), items: keep });
      return out;
    });
  }
  poolMem[sig] = p;
  return p;
}
function catsLoader(list, sorter) {
  return function () {
    return Promise.all(list.map(function (c) { return settle(loadCat(c)); })).then(function (ls) {
      var all = []; ls.forEach(function (l) { all = all.concat(l); });
      if (sorter) all.sort(sorter);
      return all;
    });
  };
}
var byAdded = function (a, b) { return (b.a || 0) - (a.a || 0); };
var byRating = function (a, b) { return (b.r || 0) - (a.r || 0); };
function ratingOK(it) { return it.r > 0 && it.r <= 9.6; }
function curatedRows(type) {
  var en = cats[type].filter(catVisibleV);
  var used = {};
  function dedupe(items, max) {
    var out = [], noPic = [], seen = {}, ok = adultOk();
    for (var i = 0; i < items.length && out.length < max; i++) {
      var it = items[i]; if (!itemOK(it)) continue;
      var k = normTitle(it); if (used[k] || seen[k]) continue; seen[k] = 1;
      if (it.ic) out.push(it); else if (noPic.length < max) noPic.push(it);
    }
    out = out.concat(noPic).slice(0, max);
    out.forEach(function (it) { used[normTitle(it)] = 1; });
    return out;
  }
  // 4.14: tsMix (taste.js) drops "Not for me" titles and shuffles a little each day (date + profile + row title)
  function wrap(fn, max, noMix) { return function () { var salt = this && this.title; return fn().then(function (items) { return dedupe(!noMix && typeof tsMix === "function" ? tsMix(items, salt) : items, max || 30); }); }; }
  var rows = rowsLocal(type);
  if (!en.length) return rows;
  var pc = poolFor(type, en);
  var pool = function () { return loadPool(type, pc); };
  var aff = affinity(), hasHist = PD.hist.some(function (h) { return h.it.t === type; }) || !!PD.tp;   // 4.14: a taste seed counts as history
  var watched = {}; PD.hist.forEach(function (h) { watched[h.k] = 1; });
  var now = Date.now() / 1000;
  rows.push({ title: hasHist ? "Top Picks for " + PF.name : "Popular on NickFlix", hero: true, load: wrap(function () {
    return pool().then(function (items) {
      var sc = items.filter(function (it) { return !watched[itemKey(it)]; }).map(function (it) {
        var g = itemGenres(it), s = 0; g.forEach(function (x) { s += aff[x] || 0; });
        var age = it.a ? Math.max(0, (now - it.a) / 86400) : 400;
        // 4.14: + people / keywords / ratings / seed (taste.js) and a small daily jitter (keeps the top, varies the rest)
        var tb = typeof tasteBoost === "function" ? tasteBoost(it) + 1.6 * tsJit(it, "top") : 0;
        return { it: it, s: s * 1.5 + (ratingOK(it) ? it.r : 5) + Math.max(0, 3 - age / 60) + (it.ic ? 1 : 0) + tb };
      });
      sc.sort(function (a, b) { return b.s - a.s; });
      return sc.map(function (x) { return x.it; });
    });
  }, 30, true) });
  var last = null, an = typeof whAnchor === "function" ? whAnchor(type === "movies" ? "movie" : "show") : null, fin = typeof whFinished === "function" ? whFinished() : {};
  if (an && an.it && an.it.c) last = { k: an.k, it: an.it };
  else for (var i = 0; i < PD.hist.length; i++) if (PD.hist[i].it.t === type && PD.hist[i].it.c) { last = PD.hist[i]; break; }
  if (last && catById[type + ":" + last.it.c]) {
    var lc = catById[type + ":" + last.it.c];
    rows.push({ title: "Because You Watched " + last.it.n, load: wrap(function () {
      return settle(loadCat(lc)).then(function (items) { return items.filter(function (x) { return itemKey(x) !== last.k && !fin[itemKey(x)]; }).sort(byRating); });
    }) });
  }
  rows.push({ title: "Trending Now", load: wrap(function () {
    return pool().then(function (items) {
      var cut = now - 120 * 86400;
      return items.filter(function (it) { return it.a > cut && ratingOK(it); }).sort(function (a, b) { return (b.r + (b.a - cut) / 2592000) - (a.r + (a.a - cut) / 2592000); });
    });
  }) });
  rows.push({ title: "New Releases", load: wrap(function () {
    return pool().then(function (items) {
      return items.filter(function (it) { return +it.y >= THIS_YEAR - 1; }).sort(function (a, b) { return (+b.y - +a.y) || ((b.a || 0) - (a.a || 0)); });
    });
  }) });
  rows.push({ title: "Recently Added", load: wrap(function () { return pool().then(function (items) { return items.slice().sort(byAdded).filter(function (it) { return typeof rtDisliked !== "function" || !rtDisliked(it); }); }); }, 30, true) });
  rows.push({ title: "Top Rated", load: wrap(function () { return pool().then(function (items) { return items.filter(function (it) { return ratingOK(it) && it.r >= 7.3; }).sort(byRating); }); }) });
  var SRC = [["Netflix Originals", /NETFLIX/], ["Prime Video", /AMAZON|PRIME/], ["Apple TV+", /APPLE|APPEL/], ["Disney+", /DISNEY|DISNY/],
    ["HBO / Max", /HBO|\bMAX\b/], ["Paramount+", /PARAMOUNT/], ["Hulu", /HULU/], ["Marvel", /MARVEL/], ["DreamWorks Animation", /DREAMWORKS/]];
  var srcRows = [];
  SRC.forEach(function (s) { var cl = pickCats(en, s[1], 2); if (cl.length) srcRows.push({ title: s[0], load: wrap(catsLoader(cl, byAdded)) }); });
  var big = pickCats(en, /4K|IMAX|BOX OFFICE|DOLBY|BLOCKBUSTER|TOP 100|TOP CINEMA|TOP WATCH/, 3);
  // interleave: 2 source rows, blockbusters, then the rest
  rows = rows.concat(srcRows.slice(0, 2));
  if (big.length) rows.push({ title: type === "movies" ? "Blockbusters & 4K" : "Big Series in 4K", load: wrap(catsLoader(big, byRating)) });
  rows = rows.concat(srcRows.slice(2));
  var GEN = ["Action & Adventure", "Comedy", "Kids & Family", "Thriller & Crime", "Sci-Fi & Fantasy", "Drama", "Horror", "Animation & Anime", "Documentary", "Romance", "War & History", "Western"];
  GEN.sort(function (a, b) { return (aff[b] || 0) - (aff[a] || 0); });
  GEN.forEach(function (g) {
    if (PD.st.v.genresOff[g]) return;
    var cl = en.filter(function (c) { return c.genres.indexOf(g) >= 0; }).slice(0, 2);
    if (type === "series") {
      // shows also carry a per-title genre field: use the pool too
      rows.push({ title: g, load: wrap(function () {
        var words = g.toLowerCase().split(/\s*&\s*|\s+/).filter(function (w) { return w.length > 3; });
        return Promise.all([pool(), catsLoader(cl, byAdded)()]).then(function (r) {
          var fromPool = r[0].filter(function (it) { var gg = String(it.genre || "").toLowerCase(); return words.some(function (w) { return gg.indexOf(w.replace(/-.*/, "")) >= 0; }); });
          return r[1].concat(fromPool);
        });
      }) });
    } else if (cl.length) rows.push({ title: g, load: wrap(catsLoader(cl, function (a, b) { return ((b.a || 0) - (a.a || 0)) + (b.r - a.r) * 2e6; })) });
  });
  rows.push({ title: "Critically Acclaimed", load: wrap(function () {
    return pool().then(function (items) { return items.filter(function (it) { return ratingOK(it) && it.r >= 8 && +it.y && +it.y <= THIS_YEAR - 2; }).sort(byRating); });
  }) });
  return rows;
}
function allRows(type) {
  var rows = rowsLocal(type);
  var list = cats[type].filter(catVisible);
  if (type === "live") list = list.slice().sort(function (a, b) { return (liveRank(a) - liveRank(b)) || (a.order - b.order); });
  list.forEach(function (c) {
    rows.push({ count: true, title: c.title, badge: c.code !== "MULTI" ? c.code : "", tag: type === "live" ? c.ltype : "", load: function () {
      return loadCat(c).then(function (items) { return items.filter(itemOK); });
    } });
  });
  return rows;
}
