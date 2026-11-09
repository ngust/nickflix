/* NickFlix v2 - profiles, per-profile data, filters */
"use strict";
var AVATARS = 16;
var DEFAULT_LANGS = { EN: 1, US: 1, CA: 1, UK: 1, MULTI: 1 };
var LIVE_DEFAULT_ON = { CA: 1, US: 1, UK: 1, EN: 1, MULTI: 1, PPV: 1 };
var LIVE_DEFAULT_CTYPES = { US: ["Sports", "PPV & Events", "News"] };

var profiles = lsGet("nf_profiles", null);
if (!profiles || !profiles.list || !profiles.list.length) {
  profiles = { list: [{ id: "p1", name: "Nick", av: 0 }], last: "p1", seq: 1 };
  // migrate v1 filters into the first profile
  var v1 = lsGet("nickflix_settings_v1", null);
  if (v1) lsSet("nf_p_p1", { st: { v: { langs: v1.langs || {}, genresOff: v1.genresOff || {}, sourcesOff: v1.sourcesOff || {} } } });
  lsSet("nf_profiles", profiles);
}
function saveProfiles() { lsSet("nf_profiles", profiles); }
function profileById(id) { for (var i = 0; i < profiles.list.length; i++) if (profiles.list[i].id === id) return profiles.list[i]; return null; }

var PF = null;   // active profile meta
var PD = null;   // active profile data
function blankData() { return { st: {}, hist: [], pos: {}, list: [], stats: { sec: 0, titles: {}, gen: {}, ch: {}, chn: {}, types: {} } }; }
function loadProfile(id) {
  PF = profileById(id) || profiles.list[0];
  profiles.last = PF.id; saveProfiles();
  var d = lsGet("nf_p_" + PF.id, null) || blankData();
  var b = blankData();
  for (var k in b) if (d[k] === undefined) d[k] = b[k];
  for (var k2 in b.stats) if (d.stats[k2] === undefined) d.stats[k2] = b.stats[k2];
  var st = d.st;
  st.v = st.v || {}; st.v.langs = st.v.langs || {}; st.v.genresOff = st.v.genresOff || {}; st.v.sourcesOff = st.v.sourcesOff || {};
  st.mode = st.mode || { movies: "curated", series: "curated" };
  st.live = st.live || {}; st.live.countries = st.live.countries || {}; st.live.typesOff = st.live.typesOff || {};
  if (!st.live.ctypes) st.live.ctypes = JSON.parse(JSON.stringify(LIVE_DEFAULT_CTYPES));
  st.view = ["live", "movies", "series", "mylist"].indexOf(st.view) >= 0 ? st.view : "movies";
  PD = d;
}
var saveT = null;
function savePD(now) {
  if (!PF) return;
  clearTimeout(saveT);
  var f = function () {
    if (PD.hist.length > 80) PD.hist.length = 80;
    var ok = lsSet("nf_p_" + PF.id, PD);
    if (!ok) { PD.hist.length = Math.min(PD.hist.length, 30); lsSet("nf_p_" + PF.id, PD); }
  };
  if (now) f(); else saveT = setTimeout(f, 800);
}
function createProfile(name, av) {
  profiles.seq = (profiles.seq || profiles.list.length) + 1;
  var p = { id: "p" + profiles.seq + "_" + Date.now().toString(36), name: name || "Profile", av: av || 0 };
  profiles.list.push(p); saveProfiles(); return p;
}
function deleteProfile(id) {
  if (profiles.list.length <= 1) return false;
  profiles.list = profiles.list.filter(function (p) { return p.id !== id; });
  try { localStorage.removeItem("nf_p_" + id); } catch (e) {}
  if (profiles.last === id) profiles.last = profiles.list[0].id;
  saveProfiles(); return true;
}
function avatarSrc(i) { return "img/av/" + ((+i || 0) % AVATARS) + ".png"; }

/* ---------- Movies/Shows filters ---------- */
function vLangOn(code) { var l = PD.st.v.langs; return l[code] !== undefined ? !!l[code] : !!DEFAULT_LANGS[code]; }
function catVisibleV(c) {
  if (!vLangOn(c.code)) return false;
  var i, ok = false, st = PD.st.v;
  for (i = 0; i < c.genres.length; i++) if (!st.genresOff[c.genres[i]]) { ok = true; break; }
  if (!ok) return false;
  for (i = 0; i < c.sources.length; i++) if (!st.sourcesOff[c.sources[i]]) return true;
  return false;
}
/* ---------- Live TV filters ---------- */
function liveCountryOn(code) { var c = PD.st.live.countries; return c[code] !== undefined ? !!c[code] : !!LIVE_DEFAULT_ON[code]; }
function liveCountryTypes(code) { return PD.st.live.ctypes[code] || null; }
function catVisibleLive(c) {
  if (!liveCountryOn(c.code)) return false;
  if (PD.st.live.typesOff[c.ltype]) return false;
  var ct = liveCountryTypes(c.code);
  if (ct && ct.indexOf(c.ltype) < 0) return false;
  return true;
}
function catVisible(c) { return c.type === "live" ? catVisibleLive(c) : catVisibleV(c); }
function adultOk() { return vLangOn("ADULT") || liveCountryOn("ADULT"); }
function liveRank(c) {
  var na = c.code === "CA" ? 0 : c.code === "US" ? 1 : 2;
  if (c.ltype === "Sports" && na < 2) return 0 + na * 0.1;
  if (c.ltype === "PPV & Events" && na < 2) return 1 + na * 0.1;
  if (c.ltype === "News") return 2 + na * 0.1 + (c.code === "UK" ? 0.05 : 0);
  if (c.ltype === "Sports") return 3;
  if (c.ltype === "PPV & Events") return 3.5;
  return 4 + (na < 2 ? 0 : 0.5);
}

/* ---------- history / positions / list / stats ---------- */
function snap(it) {
  var o = {}; ["t", "id", "n", "ic", "ext", "y", "r", "tm", "bd", "c", "genre"].forEach(function (k) { if (it[k] !== undefined && it[k] !== "") o[k] = it[k]; });
  return o;
}
function itemGenres(it) {
  var c = catById[it.t + ":" + it.c], g = c ? (c.type === "live" ? [c.ltype] : c.genres.slice()) : [];
  if (it.genre) String(it.genre).split(/\s*[\/,&]\s*/).forEach(function (x) { x = x.trim(); if (x && g.indexOf(x) < 0 && g.length < 4) g.push(x); });
  return g.filter(function (x) { return x !== "General" && x !== "Movies"; });
}
function addHistory(it, ep) {
  var k = itemKey(it);
  PD.hist = PD.hist.filter(function (h) { return h.k !== k; });
  var h = { k: k, it: snap(it), ts: Date.now() };
  if (ep) h.ep = ep;
  PD.hist.unshift(h);
  PD.stats.titles[k] = 1;
  savePD();
}
function inList(it) { var k = itemKey(it); for (var i = 0; i < PD.list.length; i++) if (PD.list[i].k === k) return true; return false; }
function toggleList(it) {
  var k = itemKey(it);
  if (inList(it)) { PD.list = PD.list.filter(function (x) { return x.k !== k; }); savePD(); return false; }
  PD.list.unshift({ k: k, it: snap(it), ts: Date.now() }); savePD(); return true;
}
function setPos(it, ms, dur, ep) {
  var k = itemKey(it);
  PD.pos[k] = { t: Math.round(ms), d: Math.round(dur || 0), ts: Date.now(), it: snap(it), ep: ep || null };
  savePD();
}
function clearPos(it) { delete PD.pos[itemKey(it)]; savePD(); }
function getPos(it) { return PD.pos[itemKey(it)] || null; }
function addWatchTime(it, sec) {
  var s = PD.stats; s.sec += sec;
  s.types[it.t] = (s.types[it.t] || 0) + sec;
  itemGenres(it).forEach(function (g) { s.gen[g] = (s.gen[g] || 0) + sec; });
  if (it.t === "live") { var k = String(it.id); s.ch[k] = (s.ch[k] || 0) + sec; s.chn[k] = it.n; }
  var d = new Date(); var day = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  s.days = s.days || {}; s.days[day] = (s.days[day] || 0) + sec;
  var keys = Object.keys(s.days); if (keys.length > 60) delete s.days[keys[0]];
}
/* genre affinity from history + list (the "viewing algorithm") */
function affinity() {
  var a = {}, now = Date.now();
  PD.hist.forEach(function (h, i) { var w = Math.max(0.2, 1 - i / 40); itemGenres(h.it).forEach(function (g) { a[g] = (a[g] || 0) + 2 * w; }); });
  PD.list.forEach(function (h) { itemGenres(h.it).forEach(function (g) { a[g] = (a[g] || 0) + 1.5; }); });
  var s = PD.stats.gen; for (var g in s) a[g] = (a[g] || 0) + Math.min(5, s[g] / 1800);
  return a;
}
