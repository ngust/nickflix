/* NickFlix v4.6 - My Media: Nicholas's NAS (Buffalo LinkStation, Twonky 7 on :9050) as Netflix-style rows.
   - The library is re-read from Twonky's JSON feed on launch and whenever the tab opens (cheap: ~1.7k entries),
     so anything Twonky's own rescan picks up appears in "Recently added" without touching the NAS.
   - Titles are cleaned from the file names and matched on the TV itself against Cinemeta (keyless, TMDB/IMDb data:
     poster, backdrop, year, rating, plot, genres). Matches are cached in localStorage; a box-made seed ships in nas_seed.js.
   - Videos only. Only /Movies is used for the main rows; NG-Backup and course/odd files go to "Home videos & other files"
     (no thumbnails, no watch history). Explicit file names are never listed.
   - Played with AVPlay through the normal player (resume, per-profile history, learning). Read-only on the NAS. */
"use strict";
var NAS_BASE = (function () { try { return localStorage.getItem("nf_nas_base") || "http://192.168.1.50:9050"; } catch (e) { return "http://192.168.1.50:9050"; } })();
var NAS_ALL = "0$3$27", NAS_CM = "https://v3-cinemeta.strem.io";
var NAS = { raw: null, lib: null, ts: 0, loading: null, meta: {}, seen: {}, err: "", hidden: 0, q: [], qa: 0, qdone: null, changed: false };
var NAS_XXX = /\bxxx\b|porn|brazzers|digital ?playground|naughty ?america|bang ?bros|reality ?kings|onlyfans|\bnsfw\b|blacked|tushy|sex ?tape|hentai|\bmilf\b/i;
var NAS_OTHER = /udemy|coursera|skillshare|\bcourse\b|lesson|tutorial|waipu/i;
var NAS_SORTS = [["genre", "\u2630 Genres"], ["added", "\u2605 Recently added"], ["az", "A\u2013Z"], ["year", "Year"], ["rating", "Rating"]];
T.nas = { api: "", label: "My Media", card: "p", pitch: 264, rowH: 505, vis: 7 };
function isNas(it) { return !!it && String(it.id || "").indexOf("nas~") === 0; }
function isNasHome(it) { return !!it && String(it.id || "").indexOf("nash~") === 0; }

/* ---------- file names ---------- */
var NAS_JUNK = /\b(2160p|1080p|720p|576p|480p|4k|uhd|hdr10\+?|hdr|dv|dovi|10 ?bit|hevc|x26[45]|h 26[45]|h26[45]|avc|bluray|blu ray|brrip|bdrip|web ?dl|webrip|web|amzn|nf|dsnp|hmax|atvp|hulu|dvdrip|dvd|xvid|divx|aac\d?|ac3|eac3|ddp?\d?|dts|truehd|atmos|remux|proper|repack|extended|remastered|uncut|unrated|uncensored|internal|limited|director'?s cut|ext ?cut|imax|hybrid|multi|subs?|mkv|mp4|avi|6ch|2ch)\b.*$/i;
function nasClean(path) {
  var parts = String(path).split("/"), file = parts[parts.length - 1], dir = parts[parts.length - 2] || "";
  var base = file.replace(/\.[a-z0-9]{2,4}$/i, "");
  var src = /^(sample|movie|video|title|vts_\d+|\d+)$/i.test(base) ? dir : base;
  var s = src.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  var se = /\bS(\d{1,2})\s?E(\d{1,3})\b/i.exec(s) || /\b(\d{1,2})x(\d{2})\b/.exec(s);
  var show = null, season = 0, ep = 0, et = "";
  if (se) {
    show = s.slice(0, se.index).replace(/[-\u2013\s]+$/, "").trim(); season = +se[1]; ep = +se[2];
    et = s.slice(se.index + se[0].length).replace(NAS_JUNK, "").replace(/[-\u2013]\s*[A-Za-z0-9]+$/, "").trim();
  }
  var y = null, m = /(?:^|[\s(\[])((?:19[2-9]|20[0-3])\d)(?:[\s)\]]|$)/.exec(s), t = show || s;
  if (!show && m) { y = +m[1]; t = s.slice(0, m.index); if (!t.trim()) t = s; }
  t = t.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(NAS_JUNK, "").replace(/[-\u2013]\s*[A-Za-z0-9]+$/, "").replace(/\s+/g, " ").trim() || s;
  return { t: t, y: y, show: show, s: season, e: ep, et: et, sample: /^sample$/i.test(base) || /\bsample\b/i.test(base) && base.length < 20 };
}
function nasKey(t) { return String(t).toLowerCase().replace(/&/g, "and").replace(/^(the|a|an) /, "").replace(/[^a-z0-9]+/g, ""); }
function nasSecs(d) { var m = /^(\d+):(\d\d):(\d\d)/.exec(String(d || "")); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0; }
function nasRes(r) { var m = /(\d+)x(\d+)/.exec(String(r || "")), w = m ? +m[1] : 0, h = m ? +m[2] : 0; return w >= 3000 || h >= 1600 ? "4K" : w >= 1800 || h >= 1000 ? "1080p" : w >= 1200 || h >= 700 ? "720p" : "SD"; }
function nasVerScore(v) { var r = { "1080p": 40, "4K": 30, "720p": 20, "SD": 10 }[v.q] || 0; if (/\.(mkv|mp4|m4v)$/i.test(v.f)) r += 5; if (/\.(avi|wmv|3gp)$/i.test(v.f)) r -= 5; return r + Math.min(4, v.sz / 4e9); }

/* ---------- library ---------- */
function nasLoadLocal() {
  try { NAS.meta = JSON.parse(localStorage.getItem("nf_nasmeta") || "{}") || {}; } catch (e) { NAS.meta = {}; }
  if (typeof NAS_SEED === "object") for (var k in NAS_SEED) if (!NAS.meta[k] || NAS.meta[k].miss) NAS.meta[k] = NAS_SEED[k];
  try { NAS.seen = JSON.parse(localStorage.getItem("nf_nasseen") || "{}") || {}; } catch (e2) { NAS.seen = {}; }
  try { var l = JSON.parse(localStorage.getItem("nf_naslib") || "null"); if (l && l.items) { NAS.raw = l.items; NAS.ts = 0; nasBuild(); } } catch (e3) {}
}
var _nasSaveT = null;
function nasSaveMeta() { clearTimeout(_nasSaveT); _nasSaveT = setTimeout(function () { try { localStorage.setItem("nf_nasmeta", JSON.stringify(NAS.meta)); } catch (e) {} }, 1500); }
function nasFetch() {
  var out = [], url = NAS_BASE + "/json/feed/" + NAS_ALL;
  function page(s) {
    return getJSON(url + "?start=" + s + "&count=500", 30000).then(function (d) {
      var c = (d && d.containerContents) || [];
      c.forEach(function (x) { if (x.nodeType === "leaf" && x.objType === "V") out.push([x.link, x.filename || "", x.duration || "", +x.contentsize || 0, x.resolution || "", +x.modificationTime || 0, x.mime || ""]); });
      return c.length >= 500 && s < 20000 ? page(s + 500) : out;
    });
  }
  return page(0);
}
/* re-read Twonky (on launch / tab open); resolves true when the set of files changed */
function nasRefresh(force) {
  if (NAS.loading) return NAS.loading;
  if (!force && NAS.lib && Date.now() - NAS.ts < 60000) return Promise.resolve(false);
  NAS.loading = nasFetch().then(function (items) {
    var before = NAS.raw ? NAS.raw.map(function (x) { return x[1]; }).sort().join("|") : "";
    NAS.raw = items; NAS.ts = Date.now(); NAS.err = ""; NAS.loading = null;
    var changed = items.map(function (x) { return x[1]; }).sort().join("|") !== before;
    try { localStorage.setItem("nf_naslib", JSON.stringify({ ts: NAS.ts, items: items })); } catch (e) {}
    nasBuild(); nasMatchAll();
    return changed;
  }, function (e) { NAS.loading = null; NAS.err = String(e && e.message || e); NAS.ts = Date.now() - 45000; return false; });
  return NAS.loading;
}
function nasEnsure() { if (NAS.lib) { nasRefresh(false); return Promise.resolve(NAS.lib); } return nasRefresh(true).then(function () { return NAS.lib || nasBuild(); }); }
function nasBuild() {
  var raw = NAS.raw || [], seen = {}, movies = {}, shows = {}, other = [], firstRun = !Object.keys(NAS.seen).length, hidden = 0, now = Date.now(), seenChanged = false;
  raw.forEach(function (x) {
    var f = x[1]; if (!f || seen[f]) return; seen[f] = 1;
    if (NAS_XXX.test(f)) { hidden++; return; }
    var v = { u: x[0], f: f, d: nasSecs(x[2]), sz: x[3], q: nasRes(x[4]), mt: x[5] * 1000 };
    var inMovies = /\/Movies\//i.test(f);
    if (!inMovies || NAS_OTHER.test(f)) { other.push(v); return; }
    var c = nasClean(f);
    if (c.sample || (v.d && v.d < 240 && !c.show)) return;   // release samples / previews
    var key, g;
    if (c.show) {
      key = "s:" + nasKey(c.show);
      g = shows[key] = shows[key] || { key: key, t: c.show, y: null, eps: {}, mt: 0 };
      var ek = c.s + "x" + c.e, e = g.eps[ek] = g.eps[ek] || { s: c.s, e: c.e, et: c.et, vers: [] };
      if (!e.et && c.et) e.et = c.et; e.vers.push(v);
    } else {
      key = "m:" + nasKey(c.t) + (c.y || "");
      g = movies[key] = movies[key] || { key: key, t: c.t, y: c.y, vers: [], mt: 0 };
      g.vers.push(v);
    }
    g.mt = Math.max(g.mt, v.mt);
  });
  function added(g) { if (!NAS.seen[g.key]) { NAS.seen[g.key] = firstRun ? g.mt || now : now; seenChanged = true; } return NAS.seen[g.key]; }
  var items = [];
  Object.keys(movies).forEach(function (k) { var g = movies[k]; g.vers.sort(function (a, b) { return nasVerScore(b) - nasVerScore(a); }); g.add = added(g); items.push(nasItem(g, "movies")); });
  Object.keys(shows).forEach(function (k) {
    var g = shows[k], eps = [];
    for (var ek in g.eps) { var e = g.eps[ek]; e.vers.sort(function (a, b) { return nasVerScore(b) - nasVerScore(a); }); eps.push(e); }
    eps.sort(function (a, b) { return a.s - b.s || a.e - b.e; }); g.list = eps; g.add = added(g); items.push(nasItem(g, "series"));
  });
  other.sort(function (a, b) { return b.mt - a.mt; });
  if (seenChanged) try { localStorage.setItem("nf_nasseen", JSON.stringify(NAS.seen)); } catch (e) {}
  NAS.hidden = hidden;
  NAS.lib = { items: items, other: other, by: {} };
  items.forEach(function (it) { NAS.lib.by[it.id] = it; });
  return NAS.lib;
}
function nasRule(g) {
  var t = g.t || "";
  if (/\broast\b/i.test(t)) return { n: t.replace(/^the /i, "").replace(/^comedy central roast/i, "Comedy Central Roast").replace(/\b(of)\b/i, "of"), g: ["Comedy"], rule: 1 };
  if (/warren miller/i.test(t)) return { n: t.replace(/\s+-\s+/, ": "), g: ["Documentary", "Sport"], rule: 1 };
  return null;
}
function nasGenreName(g) { return { "Sci-Fi": "Sci-Fi & Fantasy", "Fantasy": "Sci-Fi & Fantasy", "Reality-TV": "Reality", "Sport": "Sport", "Biography": "Biography", "Musical": "Music", "Film-Noir": "Crime", "Talk-Show": "Talk & News", "News": "Talk & News", "Game-Show": "Reality" }[g] || g; }
function nasItem(g, type) {
  var m = NAS.meta[g.key], ok = m && !m.miss, rule = ok ? null : nasRule(g), src = ok ? m : rule || {};
  var gen = [], gs = src.g || [];
  gs.forEach(function (x) { x = nasGenreName(x); if (gen.indexOf(x) < 0) gen.push(x); });
  var nm = src.n || g.t; if (nm === nm.toLowerCase()) nm = nm.replace(/\b([a-z])/g, function (x) { return x.toUpperCase(); }).replace(/\b(Of|The|And|In|A|An|On|With)\b/g, function (x, w, i) { return i ? x.toLowerCase() : x; });
  var it = { t: type, id: "nas~" + g.key, nas: 1, k: g.key, n: nm, y: src.y || g.y || "", r: src.r || "", ic: src.ic || "", bd: src.bd || "", plot: src.p || "",
    genre: gen.join(", "), gl: gen, ft: g.t, fy: g.y || null, cast: src.cast || "", dir: src.dir || "", matched: !!ok, rule: !!rule, add: g.add, ext: "mkv" };
  if (type === "movies") { var v = g.vers[0]; it.vers = g.vers; it.dur = v.d || ""; it.ext = (v.f.match(/\.([a-z0-9]+)$/i) || [0, "mkv"])[1].toLowerCase(); it.sub = g.vers.length > 1 ? g.vers.map(function (x) { return x.q; }).filter(function (q, i, a) { return a.indexOf(q) === i; }).join(" / ") : (v.q === "4K" ? "4K" : ""); }
  else { it.eps = g.list; var ss = {}; g.list.forEach(function (e) { ss[e.s] = 1; }); var ns = Object.keys(ss).length; it.sub = (ns > 1 ? ns + " seasons" : "S" + (g.list[0] ? ("0" + g.list[0].s).slice(-2) : "")) + " \u00B7 " + g.list.length + (g.list.length === 1 ? " episode" : " episodes"); }
  return it;
}

/* ---------- matching (on the TV, cached) ---------- */
function nasQueries(g) {
  var t = g.t, o = [t];
  var a = t.replace(/^(the )?comedy central /i, "Comedy Central "); if (a !== t) o.push(a);
  var b = t.replace(/\s+-\s+.*$/, ""); if (b !== t) o.push(b);
  var c = t.replace(/\b(and)\b/gi, "&"); if (c !== t) o.push(c);
  return o;
}
function nasPick(list, q, y) {
  var k = nasKey(q), best = null, bs = -1;
  (list || []).slice(0, 10).forEach(function (m, i) {
    var mk = nasKey(m.name || ""), my = parseInt(m.releaseInfo || m.year || "", 10) || 0, s = 0;
    if (mk === k) s += 10; else if (k.length > 5 && (mk.indexOf(k) === 0 || k.indexOf(mk) === 0)) s += 4; else return;
    if (y && my) { var dy = Math.abs(my - y); if (dy === 0) s += 5; else if (dy <= 1) s += 3; else if (dy > 2) s -= 8; }
    s -= i * 0.3; if (s > bs) { bs = s; best = m; }
  });
  return bs >= 6 ? best : null;
}
function nasMatchOne(g, type) {
  var qs = nasQueries(g), types = type === "series" ? ["series", "movie"] : (g.y ? ["movie"] : ["movie", "series"]);
  function tryQ(i, j) {
    if (i >= qs.length) return j + 1 < types.length ? tryQ(0, j + 1) : Promise.resolve(null);
    return getJSON(NAS_CM + "/catalog/" + types[j] + "/top/search=" + encodeURIComponent(qs[i]) + ".json", 15000).then(function (d) {
      var m = nasPick(d && d.metas, qs[i], g.y);
      if (!m) return tryQ(i + 1, j);
      return getJSON(NAS_CM + "/meta/" + types[j] + "/" + m.id + ".json", 15000).then(function (r) { return r && r.meta ? r.meta : (m._part = 1, m); }, function () { m._part = 1; return m; });
    }, function () { return tryQ(i + 1, j); });
  }
  return tryQ(0, 0).then(function (m) {
    if (!m) return { miss: Date.now() };
    var gl = m.genres || m.genre || []; if (typeof gl === "string") gl = gl.split(/\s*,\s*/);
    return { id: m.id || "", n: m.name || g.t, y: parseInt(m.releaseInfo || m.year || "", 10) || g.y || "", g: gl.slice(0, 4), r: m.imdbRating || "",
      p: String(m.description || "").slice(0, 700), ic: String(m.poster || "").replace("/poster/small/", "/poster/medium/"), bd: m.background || "",
      cast: (m.cast || []).slice(0, 4).join(", "), dir: (m.director || []).join(", "), rt: m.runtime || "", tm: m.moviedb_id || "", part: m._part ? Date.now() : undefined };
  });
}
function nasMatchAll() {
  if (!NAS.lib) return;
  var week = 3 * 86400000;
  NAS.lib.items.forEach(function (it) {
    var m = NAS.meta[it.k];
    if (m && !m.miss && !(m.part && Date.now() - m.part > 3600000)) return;
    if (m && m.miss && Date.now() - m.miss < week) return;
    if (NAS.q.some(function (x) { return x.it.k === it.k; })) return;
    NAS.q.push({ it: it });
  });
  nasPump();
}
function nasPump() {
  while (NAS.qa < 2 && NAS.q.length) {
    var job = NAS.q.shift(); NAS.qa++;
    (function (it) {
      var g = { key: it.k, t: it.ft || it.n, y: it.fy };
      nasMatchOne(g, it.t).then(function (m) {
        NAS.qa--; NAS.meta[it.k] = m; nasSaveMeta(); if (!m.miss) NAS.changed = true; nasPump();
      }, function () { NAS.qa--; nasPump(); });
    })(job.it);
  }
  if (!NAS.qa && !NAS.q.length && NAS.changed) { NAS.changed = false; nasBuild(); nasRebuildIfIdle(); }
}
function nasRebuildIfIdle() {
  if (V.view !== "nas" || D.open || P.open) return;
  if (typeof ST !== "undefined" && ST && ST.open) return;
  refreshLocalRows();
}

/* ---------- rows ---------- */
function nasSortIdx() { var s = PD.st.nasSort || "genre"; for (var i = 0; i < NAS_SORTS.length; i++) if (NAS_SORTS[i][0] === s) return i; return 0; }
function nasModeCur() { return nasSortIdx(); }
function nasRowSpec(title, fn, opt) { var s = { title: title, load: function () { return nasEnsure().then(function (lib) { return fn(lib); }); } }; if (opt) for (var k in opt) s[k] = opt[k]; return s; }
function nasByRating(a, b) { return (parseFloat(b.r) || 0) - (parseFloat(a.r) || 0) || String(a.n).localeCompare(String(b.n)); }
function nasAZ(n) { return String(n).replace(/^(the|a|an)\s+/i, "").toLowerCase(); }
function nasContinue() {
  return { title: "Continue Watching", local: true, load: function () {
    var arr = [];
    for (var k in PD.pos) {
      var p = PD.pos[k]; if (!p || !p.it || !isNas(p.it)) continue;
      var started = p.t > 5000, done = p.d > 0 && p.t > 0.92 * p.d;
      if ((!started && !(p.ep && p.ep.next)) || done) continue;
      var it = JSON.parse(JSON.stringify(p.it)); it.pr = p.d > 0 ? Math.min(1, p.t / p.d) : 0; it._resume = p; it.ts = p.ts;
      if (p.ep) it.sub = (p.ep.next ? "Next: " : "") + "S" + p.ep.s + ":E" + p.ep.e;
      arr.push(it);
    }
    arr.sort(function (a, b) { return b.ts - a.ts; });
    return Promise.resolve(arr);
  } };
}
function nasGenreList(lib) {
  var gc = {};
  lib.items.forEach(function (it) { (it.gl || []).forEach(function (g) { (gc[g] = gc[g] || []).push(it); }); });
  var aff = {}; try { aff = affinity() || {}; } catch (e) {}
  var fav = (typeof favOf === "function" ? favOf(PF).subs : []) || [];
  return Object.keys(gc).filter(function (g) { return gc[g].length >= 2; }).map(function (g) {
    return { g: g, items: gc[g].slice().sort(nasByRating), s: gc[g].length + (aff[g] || 0) * 3 + (fav.indexOf(g) >= 0 ? 100 : 0) + learnScore("nasg", g) * 2 };
  }).sort(function (a, b) { return b.s - a.s; });
}
function nasOtherRows() {
  var rows = [];
  rows.push(nasRowSpec("\uD83D\uDCC1 Home videos & other files", function (lib) {
    return lib.other.slice(0, 40).map(nasHomeItem);
  }));
  rows.push(nasRowSpec("Other files by folder", function (lib) {
    var f = nasFolders(lib), out = [];
    Object.keys(f).sort(function (a, b) { return f[b].length - f[a].length; }).forEach(function (k) {
      var id = "nasp:f:" + k; XT[id] = { label: "My Media \u203A " + k };
      out.push({ t: "tile", id: id, n: k, sub: f[k].length + (f[k].length === 1 ? " file" : " files"), col: "#3a4a5c" });
    });
    return out;
  }, { kind: "t" }));
  return rows;
}
function nasFolders(lib) {
  var f = {};
  lib.other.forEach(function (v) { var p = v.f.split("/"), i = p.indexOf("array1"), k = p.slice(i + 1, i + 3).join(" \u203A ") || "Other"; if (p.length - i <= 3) k = p[i + 1] || "Other"; (f[k] = f[k] || []).push(v); });
  return f;
}
function nasHomeItem(v) {
  var n = v.f.split("/").pop().replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[._]+/g, " ");
  return { t: "movies", id: "nash~" + v.u, nas: 1, home: 1, n: n, y: v.mt ? new Date(v.mt).getFullYear() : "", dur: v.d || "", sub: v.q === "SD" ? "" : v.q, u: v.u, f: v.f };
}
function nasRows() {
  var rows = [nasContinue()], sort = NAS_SORTS[nasSortIdx()][0], fav = (typeof favOf === "function" ? favOf(PF).subs : []) || [];
  if (!NAS.lib && !NAS.loading) nasRefresh(true);
  if (fav.indexOf("Documentary") >= 0) rows.push(nasRowSpec("\u2B50 Documentaries for " + PF.name, function (lib) { return lib.items.filter(function (it) { return (it.gl || []).indexOf("Documentary") >= 0; }).sort(nasByRating); }));
  if (sort === "genre") {
    rows.push(nasRowSpec("Recently added", function (lib) { return lib.items.slice().sort(function (a, b) { return b.add - a.add; }).slice(0, 30); }, { hero: true }));
    rows.push(nasRowSpec("TV series on your NAS", function (lib) { return lib.items.filter(function (it) { return it.t === "series"; }).sort(function (a, b) { return b.add - a.add; }); }));
    var lib = NAS.lib;
    if (lib) nasGenreList(lib).forEach(function (x) { rows.push(nasRowSpec(x.g, function () { return x.items; }, { gen: x.g })); });
    else rows.push(nasRowSpec("Reading your NAS\u2026", function (l) { return l.items.slice(0, 30); }));
    rows.push(nasRowSpec("A\u2013Z", function (l) { return l.items.slice().sort(function (a, b) { return nasAZ(a.n) < nasAZ(b.n) ? -1 : 1; }); }));
    rows.push(nasRowSpec("Unmatched", function (l) { return l.items.filter(function (it) { return !it.matched; }).sort(function (a, b) { return nasAZ(a.n) < nasAZ(b.n) ? -1 : 1; }); }));
  } else {
    var groups;
    if (sort === "added") groups = [["Added in the last 30 days", function (it) { return Date.now() - it.add < 30 * 86400000; }], ["Added this year", function (it) { return new Date(it.add).getFullYear() === new Date().getFullYear(); }], ["Added last year", function (it) { return new Date(it.add).getFullYear() === new Date().getFullYear() - 1; }], ["Older", function () { return true; }]];
    else if (sort === "az") groups = [["0\u20139 \u00B7 A\u2013D", /^[0-9a-d]/], ["E\u2013H", /^[e-h]/], ["I\u2013L", /^[i-l]/], ["M\u2013P", /^[m-p]/], ["Q\u2013T", /^[q-t]/], ["U\u2013Z", /^[u-z]/], ["Other", /./]].map(function (x) { return [x[0], function (it) { return x[1].test(nasAZ(it.n)); }]; });
    else if (sort === "year") groups = [["2020s", 2020, 2100], ["2010s", 2010, 2019], ["2000s", 2000, 2009], ["1990s", 1990, 1999], ["1980s", 1980, 1989], ["1970s & earlier", 1800, 1979], ["Year unknown", 0, 0]].map(function (x) { return [x[0], function (it) { var y = +it.y || 0; return x[1] ? y >= x[1] && y <= x[2] : !y; }]; });
    else groups = [["Rated 8.0 and up", 8, 11], ["7.0 \u2013 7.9", 7, 8], ["6.0 \u2013 6.9", 6, 7], ["Under 6.0", 0.1, 6], ["Not rated", 0, 0]].map(function (x) { return [x[0], function (it) { var r = parseFloat(it.r) || 0; return x[1] ? r >= x[1] && r < x[2] : !r; }]; });
    rows.push(nasRowSpec("Sorted: " + NAS_SORTS[nasSortIdx()][1].replace(/^\W+\s*/, ""), function (l) { return nasSorted(l.items, sort); }, { hero: true, count: true }));
    groups.forEach(function (gr, gi) {
      rows.push(nasRowSpec(gr[0], function (l) {
        var taken = {}; l.items.forEach(function (it) { for (var j = 0; j < gi; j++) if (groups[j][1](it)) { taken[it.id] = 1; break; } });
        return nasSorted(l.items.filter(function (it) { return !taken[it.id] && gr[1](it); }), sort);
      }, { count: true }));
    });
  }
  return rows.concat(nasOtherRows());
}
function nasSorted(list, sort) {
  var a = list.slice();
  if (sort === "added") a.sort(function (x, y) { return y.add - x.add; });
  else if (sort === "az") a.sort(function (x, y) { return nasAZ(x.n) < nasAZ(y.n) ? -1 : 1; });
  else if (sort === "year") a.sort(function (x, y) { return (+y.y || 0) - (+x.y || 0) || nasByRating(x, y); });
  else a.sort(nasByRating);
  return a;
}
function nasPageSpecs(id) {
  var m = /^nasp:f:(.+)$/.exec(id); if (!m) return [];
  var k = m[1];
  return [nasRowSpec(k, function (lib) { return (nasFolders(lib)[k] || []).map(nasHomeItem); }, { count: true }),
    nasRowSpec("Newest first", function (lib) { return (nasFolders(lib)[k] || []).slice().sort(function (a, b) { return b.mt - a.mt; }).map(nasHomeItem); })];
}

/* ---------- hooks into the app ---------- */
var _specsForV45 = specsFor;
specsFor = function (view) {
  if (view !== "nas") return _specsForV45(view);
  if (V.vpage && V.vpage.view === "nas") return nasPageSpecs(V.vpage.id);
  return nasRows();
};
var _openLivePageV45 = openLivePage;
openLivePage = function (id) {
  if (String(id).indexOf("nasp:") !== 0) return _openLivePageV45(id);
  V.vstack = V.vstack || []; V.vstack.push({ vpage: V.vpage, r: V.r, col: V.rows[V.r] ? V.rows[V.r].col : 0 });
  V.vpage = { view: V.view, id: id }; buildView(V.view); V.zone = "rows"; V.r = 0; applyFocus();
};
var _buildViewV45 = buildView;
buildView = function (view) {
  if (view !== "nas" && V.vpage && V.vpage.view === "nas") { V.vpage = null; V.vstack = []; }
  _buildViewV45(view);
  if (view === "nas") {
    if (!NAS.lib && NAS.err) { var e = $("empty"); e.innerHTML = "Couldn't reach your NAS at " + NAS_BASE.replace(/^https?:\/\//, "") + ".<br>Check that the LinkStation is on, then open My Media again."; }
    var gen = V.gen;
    if (Date.now() - NAS.ts > 60000) nasRefresh(true).then(function (changed) { if (changed && V.gen === gen) nasRebuildIfIdle(); else if (!NAS.lib && V.gen === gen) showEmpty(); });
  }
};
var _showEmptyV45 = showEmpty;
showEmpty = function () {
  if (V.view !== "nas") return _showEmptyV45();
  var e = $("empty"); e.innerHTML = NAS.err ? "Couldn't reach your NAS at " + NAS_BASE.replace(/^https?:\/\//, "") + ".<br>Check that the LinkStation is on, then open My Media again." : "Reading your NAS library\u2026";
  e.classList.remove("hidden");
};
var _renderModebarV45 = renderModebar;
renderModebar = function () {
  if (V.view !== "nas") return _renderModebarV45();
  var bar = $("modebar"), cur = nasSortIdx(); bar.textContent = ""; V.modeEls = [];
  NAS_SORTS.forEach(function (s, i) { var el = ce("div", "mode" + (i === cur ? " sel" : ""), s[1]); bar.appendChild(el); V.modeEls.push(el); });
  var n = NAS.lib ? NAS.lib.items.length : 0;
  bar.appendChild(ce("div", "mode-hint", n ? n + " titles on your NAS \u00B7 new files appear automatically" : "Your NAS library"));
};
var _setModeV45 = setMode;
setMode = function (i) {
  if (V.view !== "nas") return _setModeV45(i);
  var want = (NAS_SORTS[i] || NAS_SORTS[0])[0];
  if ((PD.st.nasSort || "genre") === want) return;
  PD.st.nasSort = want; savePD(); learnAdd("nass", want, 0.5);
  buildView("nas"); V.zone = "mode"; V.modeIdx = i; applyFocus();
};
var _setHeroPlaceholderV45 = setHeroPlaceholder;
setHeroPlaceholder = function () { _setHeroPlaceholderV45(); if (V.view === "nas") $("hero-kicker").textContent = "On your NAS"; };
var _ratingBadgeV45 = ratingBadge;
ratingBadge = function (it) { var w = _ratingBadgeV45(it); if (w && isNas(it)) { var rb = w.querySelector(".rb"); if (rb) rb.textContent = "IMDb"; } return w; };

/* library item for an id (history snapshots drop the extra fields) */
function nasFull(it) { return NAS.lib && NAS.lib.by[it.id] || null; }
function nasVer(it) {
  var f = nasFull(it) || it, vers = f.vers || [], pick = (PD.st.nasVer || {})[f.k];
  for (var i = 0; i < vers.length; i++) if (vers[i].q === pick) return vers[i];
  return vers[0] || null;
}
function nasURLs(u) { var a = [u]; if (u.indexOf("$") >= 0) a.push(u.replace(/\$/g, "%24")); return a; }
function nasEpFind(f, id) { var m = /^(\d+)x(\d+)$/.exec(String(id || "")); if (!m || !f || !f.eps) return null; for (var i = 0; i < f.eps.length; i++) if (f.eps[i].s === +m[1] && f.eps[i].e === +m[2]) return f.eps[i]; return null; }

var _openDetailsV45 = openDetails;
openDetails = function (item) {
  if (!isNas(item) && !isNasHome(item)) return _openDetailsV45(item);
  if (isNasHome(item)) { nasPlayHome(item); return; }
  var f = nasFull(item);
  if (!f) { toast("Reading your NAS\u2026"); nasEnsure().then(function () { if (nasFull(item)) openDetails(item); else toast("That file is no longer on the NAS"); }); return; }
  if ((f.gl || [])[0]) learnAdd("nasg", f.gl[0], 0.2);
  D.open = true; D.item = f; D.eps = {}; D.season = null; D.seasons = []; D.flat = []; D.loaded = true;
  $("details").classList.remove("hidden");
  var bg = $("d-bg"); bg.style.visibility = "hidden"; bg.onload = function () { bg.style.visibility = ""; };
  if (f.bd || f.ic) bg.src = f.bd || f.ic; else bg.removeAttribute("src");
  D.ln = LN($("d-body"), 760);
  if (f.t === "series") {
    var ss = [];
    f.eps.forEach(function (e) { var s = String(e.s); if (!D.eps[s]) { D.eps[s] = []; ss.push(s); } D.eps[s].push({ id: e.s + "x" + e.e, episode_num: e.e, title: e.et ? "S" + e.s + "E" + e.e + " - " + e.et : "Episode " + e.e, container_extension: "mkv", info: { duration_secs: e.vers[0] && e.vers[0].d } }); });
    ss.sort(function (a, b) { return a - b; }); D.seasons = ss;
    ss.forEach(function (s) { D.eps[s].forEach(function (e) { D.flat.push({ s: +s, e: +e.episode_num, id: e.id, ext: "mkv", title: epTitle(e), dur: e.info.duration_secs }); }); });
    var ps = getPos(f); D.season = ps && ps.ep && D.eps[String(ps.ep.s)] ? String(ps.ep.s) : (ss[0] || null);
  }
  renderDetails("");
};
var _renderDetailsV45 = renderDetails;
renderDetails = function (status) {
  _renderDetailsV45(status);
  var it = D.item; if (!isNas(it)) return;
  var k = $("d-body").querySelector(".kicker"); if (k) k.textContent = (it.t === "movies" ? "Movie" : "Series") + " \u00B7 on your NAS" + (it.matched ? "" : " \u00B7 not matched");
  if (it.t === "movies" && it.vers && it.vers.length > 1) {
    var line = D.ln.lines[0]; if (!line) return;
    var cur = nasVer(it), b = ce("div", "btn", "\u21C4 " + cur.q + " (" + it.vers.length + " versions)");
    b._act = function () {
      var i = it.vers.indexOf(nasVer(it)), nx = it.vers[(i + 1) % it.vers.length];
      PD.st.nasVer = PD.st.nasVer || {}; PD.st.nasVer[it.k] = nx.q; savePD(); var li = D.ln.li, ci = D.ln.ci; renderDetails(""); D.ln.li = li; D.ln.ci = ci; lnFocus(D.ln); toast("Will play the " + nx.q + " version");
    };
    var items = line.items, back = items[items.length - 1];
    line.el.insertBefore(b, back); items.splice(items.length - 1, 0, b);
    lnFocus(D.ln);
  }
};
var _playItemV45 = playItem;
playItem = function (item, list, idx, resumeMs) {
  if (isNasHome(item)) { nasPlayHome(item); return; }
  if (!isNas(item)) return _playItemV45(item, list, idx, resumeMs);
  var f = nasFull(item);
  if (!f) { toast("Reading your NAS\u2026"); nasEnsure().then(function () { if (nasFull(item)) playItem(item, list, idx, resumeMs); else toast("That file is no longer on the NAS"); }); return; }
  if (f.t === "series") { openDetails(f); return; }
  var v = nasVer(f); if (!v) { toast("No playable file"); return; }
  P.item = f; P.ep = null; P.flatIdx = -1; P.series = null; P.list = null;
  addHistory(f);
  startPlayback(f.n + (f.vers.length > 1 ? "  \u2022  " + v.q : ""), nasURLs(v.u), true, resumeMs || 0);
  if (D.open) D.played = true;
};
var _playFlatV45 = playFlat;
playFlat = function (i, resumeMs) {
  if (!D.item || !isNas(D.item)) return _playFlatV45(i, resumeMs);
  var e = D.flat[i]; if (!e) return; var ne = nasEpFind(D.item, e.id); if (!ne || !ne.vers[0]) { toast("Episode file missing"); return; }
  P.item = D.item; P.series = D.flat; P.flatIdx = i; P.list = null;
  P.ep = { s: e.s, e: e.e, id: e.id, ext: e.ext, title: e.title };
  addHistory(D.item, { s: e.s, e: e.e }); D.played = true;
  startPlayback(D.item.n + "  \u2022  S" + e.s + ":E" + e.e + (e.title && !/^Episode \d+$/.test(e.title) ? " " + e.title : ""), nasURLs(ne.vers[0].u), true, resumeMs || 0);
};
var _resumeItemV45 = resumeItem;
resumeItem = function (it) {
  if (!isNas(it)) return _resumeItemV45(it);
  var ps = it._resume;
  nasEnsure().then(function () {
    var f = nasFull(it); if (!f) { toast("That file is no longer on the NAS"); return; }
    if (f.t === "movies") { playItem(f, null, 0, ps.t); return; }
    var ne = ps.ep && nasEpFind(f, ps.ep.id);
    if (!ne || ps.ep.next) { openDetails(f); return; }
    P.item = f; P.series = null; P.flatIdx = -1; P.list = null;
    P.ep = { s: ps.ep.s, e: ps.ep.e, id: ps.ep.id, ext: "mkv", title: ps.ep.title || "" };
    addHistory(f, { s: ps.ep.s, e: ps.ep.e });
    startPlayback(f.n + "  \u2022  S" + ps.ep.s + ":E" + ps.ep.e + " " + (ps.ep.title || ""), nasURLs(ne.vers[0].u), true, ps.t);
  });
};
/* home videos / other files: play straight away, no history, no resume, nothing learned */
function nasPlayHome(item) {
  P.item = null; P.ep = null; P.flatIdx = -1; P.series = null; P.list = null;
  startPlayback(item.n, nasURLs(item.u), false, 0);
}
var _addWatchTimeV45 = addWatchTime;
addWatchTime = function (it, sec) { if (!it || isNasHome(it)) return; return _addWatchTimeV45(it, sec); };
/* Nick's Documentary favourite: NAS documentaries also show up on Movies/Shows */
if (typeof collRowsFor === "function") {
  var _collRowsForV45 = collRowsFor;
  collRowsFor = function (type) {
    var rows = _collRowsForV45(type);
    if (!rows.length || (type !== "movies" && type !== "series") || !(favOf(PF).subs || []).length || favOf(PF).subs.indexOf("Documentary") < 0) return rows;
    var spec = { title: "\uD83D\uDDB4 Documentaries on your NAS", load: function () { return nasEnsure().then(function (lib) { return lib.items.filter(function (it) { return (it.gl || []).indexOf("Documentary") >= 0; }).sort(nasByRating); }); } };
    rows.splice(1, 0, spec);
    return rows;
  };
}
nasLoadLocal();
setTimeout(function () { nasRefresh(true); }, 6000);   // re-read the library shortly after launch
