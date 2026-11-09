/* NickFlix - Tizen TV IPTV client (no modules, ES5-style for safety) */
(function () {
"use strict";
function $(id) { return document.getElementById(id); }
function ce(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

/* ================= settings ================= */
var SKEY = "nickflix_settings_v1";
var DEF = { server: "http://your-provider.example.com:80", username: "YOUR_USERNAME", password: "YOUR_PASSWORD" };
var DEFAULT_LANGS = { EN: 1, US: 1, CA: 1, UK: 1, MULTI: 1 };
var settings = loadSettings();
function loadSettings() {
  var s = {};
  try { s = JSON.parse(localStorage.getItem(SKEY) || "{}") || {}; } catch (e) { s = {}; }
  if (!s.server) {
    try { var o = JSON.parse(localStorage.getItem("ibootv_settings") || "{}"); if (o && o.server) { s.server = o.server; s.username = o.username; s.password = o.password; } } catch (e2) {}
  }
  s.server = s.server || DEF.server;
  s.username = typeof s.username === "string" && s.username ? s.username : DEF.username;
  s.password = typeof s.password === "string" && s.password ? s.password : DEF.password;
  s.langs = s.langs || {}; s.genresOff = s.genresOff || {}; s.sourcesOff = s.sourcesOff || {};
  s.view = ["live", "movies", "series"].indexOf(s.view) >= 0 ? s.view : "movies";
  return s;
}
function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} }
function langOn(code) { return settings.langs[code] !== undefined ? !!settings.langs[code] : !!DEFAULT_LANGS[code]; }

/* ================= provider API ================= */
var T = {
  live:   { api: "live",   catA: "get_live_categories",   itemA: "get_live_streams", label: "TV",     card: "l", pitch: 354, rowH: 372, vis: 5 },
  movies: { api: "vod",    catA: "get_vod_categories",    itemA: "get_vod_streams",  label: "Movies", card: "p", pitch: 264, rowH: 505, vis: 7 },
  series: { api: "series", catA: "get_series_categories", itemA: "get_series",       label: "Shows",  card: "p", pitch: 264, rowH: 505, vis: 7 }
};
function apiURL(action, extra) {
  return settings.server.replace(/\/+$/, "") + "/player_api.php?username=" + encodeURIComponent(settings.username) +
    "&password=" + encodeURIComponent(settings.password) + "&action=" + action + (extra ? "&" + extra : "");
}
function getJSON(url, timeout) {
  return new Promise(function (res, rej) {
    var x = new XMLHttpRequest();
    x.open("GET", url, true); x.timeout = timeout || 30000;
    x.onload = function () { if (x.status >= 200 && x.status < 300) { try { res(JSON.parse(x.responseText)); } catch (e) { rej(e); } } else rej(new Error("HTTP " + x.status)); };
    x.onerror = function () { rej(new Error("network")); };
    x.ontimeout = function () { rej(new Error("timeout")); };
    x.send();
  });
}
function api(action, extra, timeout) { return getJSON(apiURL(action, extra), timeout); }

/* ================= name / category parsing ================= */
var LANG_NAMES = { EN: "English", US: "USA", CA: "Canada", UK: "United Kingdom", MULTI: "Multi-language", FR: "French", AR: "Arabic", BE: "Belgium",
  SE: "Swedish", DK: "Danish", NO: "Norwegian", FI: "Finnish", IC: "Iceland", AF: "Africa", EU: "Europe", ES: "Spanish", DE: "German",
  NOW: "German (Sky/WOW)", CH: "Swiss / China", AT: "Austria", SW: "Switzerland", PT: "Portuguese", IT: "Italian", NL: "Dutch", PL: "Polish",
  MA: "Malta / Malaysia", TR: "Turkish", RO: "Romanian", HU: "Hungarian", GR: "Greek", CY: "Cyprus", CZ: "Czech", AZ: "Azerbaijan",
  AM: "Armenian", ISL: "Israel (Hebrew)", ISR: "Hebrew", SL: "Hebrew (SL)", RU: "Russian", BG: "Bulgarian", UA: "Ukrainian", LV: "Latvian",
  EST: "Estonian", LT: "Lithuanian", EX: "Ex-Yugoslavia", SLO: "Slovak", AL: "Albanian", LAT: "Latin America", ME: "Montenegro",
  IR: "Persian", KD: "Kurdish", KU: "Kurdish (Sorani)", AS: "South Asia", SN: "Singapore", PH: "Filipino", TH: "Thai", VT: "Vietnamese",
  VE: "Vietnamese (VE)", SR: "Sri Lanka", IN: "Indian", KO: "Korean", KR: "Korean (KR)", JP: "Japanese", TW: "Taiwanese", CN: "Chinese",
  AU: "Australia", AUS: "Australia (AUS)", NZ: "New Zealand", PK: "Pakistani", BR: "Brazilian", SC: "Nordic", NORDEC: "Nordic kids",
  PPV: "PPV events", "4K": "4K / UHD", ADULT: "Adult (18+)" };
function catCode(raw) {
  var s = String(raw || "");
  if (/^\s*(XXX|\|?\+18)/i.test(s)) return "ADULT";
  var m = s.match(/^\s*[|\u2503]?\s*([A-Za-z0-9+\-]{2,7})\s*[|\u2503]/);
  if (!m) return "MULTI";
  var c = m[1].toUpperCase();
  if (c === "EX-YU") c = "EX";
  if (c === "+18") c = "ADULT";
  if (c === "4K") c = "4K";
  return c;
}
var ACR = { TV: 1, HD: 1, UHD: 1, FHD: 1, SD: 1, HBO: 1, NBA: 1, NFL: 1, NHL: 1, MLB: 1, UFC: 1, WWE: 1, PPV: 1, BBC: 1, CNN: 1, US: 1, UK: 1, USA: 1,
  DAZN: 1, ESPN: 1, TNT: 1, RMC: 1, MBC: 1, OSN: 1, TOD: 1, DSTV: 1, VIP: 1, EPL: 1, UEFA: 1, IMDB: 1, IMAX: 1, NCAAF: 1, NCAAB: 1, BTN: 1, F1: 1,
  ZDF: 1, ARD: 1, NPO: 1, RTL: 1, MTV: 1, TV2: 1, TV4: 1, SEC: 1, AFL: 1, NRL: 1, ECB: 1, PDC: 1, EFL: 1, SPFL: 1, VF: 1, VO: 1, VOST: 1, BET: 1, AHL: 1, OHL: 1, CBC: 1, CFL: 1, WNBA: 1, MLS: 1, ATP: 1, BKT: 1, CAM: 1 };
function niceWord(w) {
  if (!w) return w;
  var u = w.toUpperCase();
  if (ACR[u.replace(/[^A-Z0-9]/g, "")] || /\d/.test(w) || /\+$/.test(w) && w.length <= 4) return u;
  if (w !== u) return w; // already mixed case
  return u.charAt(0) + u.slice(1).toLowerCase();
}
function cleanCat(raw) {
  var s = String(raw || "");
  s = s.replace(/^\s*[|\u2503]?\s*[A-Za-z0-9+\-]{2,7}\s*[|\u2503]\s*/, "").replace(/^XXX\s*\|/i, "");
  s = s.replace(/[\u272A\u1D41\u1D34\u1D30\u2503]/g, " ").replace(/\bORIGENALS?\b/gi, "Originals").replace(/\bORIGINAL\b/gi, "").replace(/\bMULTI\b/gi, "");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) s = String(raw);
  return s.split(" ").map(niceWord).join(" ");
}
function cleanName(raw) {
  var s = String(raw || "").trim();
  if ((s.match(/[A-Za-z0-9]\.[A-Za-z0-9]/g) || []).length >= 2 || (s.indexOf(" ") < 0 && /\w\.\w/.test(s))) s = s.replace(/([A-Za-z0-9])\.(?=[A-Za-z0-9])/g, "$1 ");
  s = s.replace(/^[|\u2503\s]*(?:[A-Z]{2,3}(?:-[A-Z0-9]{1,3})?|\+18|4K)\s*(?:[|\u2503:]|\s-\s|-\s)\s*/, "");
  return s.replace(/\s+/g, " ").trim() || String(raw || "");
}
var SOURCES = [
  ["Netflix", /NETFLIX|NETFLX/], ["Apple TV+", /APPLE|APPEL/], ["Disney+", /DISNEY|DISNY/], ["Prime Video", /AMAZON|\bPRIME\b/],
  ["HBO / Max", /HBO|\bMAX\b/], ["Hulu", /HULU/], ["Paramount+", /PARAMOUNT/], ["Peacock", /PEACOCK/], ["DAZN", /DAZN/],
  ["Sky / NOW", /\bSKY\b|\bNOW\b/], ["Viaplay", /VIAPLAY/], ["Canal+", /CANAL/], ["Discovery+", /DISCOVERY/], ["Showmax", /SHOWMAX/],
  ["OSN", /\bOSN\b/], ["Shahid", /SHAHID/], ["Starz", /STARZ/], ["BritBox", /BRITBOX/], ["Crave", /CRAVE/], ["ESPN", /ESPN/],
  ["Pluto TV", /PLUTO/], ["Sling", /SLING/], ["DStv", /DSTV/], ["Marvel", /MARVEL/], ["DreamWorks", /DREAMWORKS/], ["Videoland", /VIDEOLAND/],
  ["TOD / beIN", /\bTOD\b|BEIN/], ["Rakuten", /RAKUTEN/], ["Google Play", /GOOGLE PLAY/], ["Joyn", /JOYN/], ["RTL+", /RTL\+/], ["SkyShowtime", /SHOWTIME/]
];
var GENRES = [
  ["Action & Adventure", /ACTION|ACCION|AZIONE|AKSIYON|AKCJA|MARTIAUX|KUNG FU|WALKI|AVENTUR|ABENTEUER|ADVENTURE|PRZYGOD|MACERA/],
  ["Comedy", /COMED|COMMEDIA|KOMEDI|SITCOM|HUMOR|STAND UP|KABARET/],
  ["Drama", /DRAMA|DRAME|DRAMAT|\bDRAM\b/],
  ["Horror", /HORR|HOROR|KORKU/],
  ["Thriller & Crime", /THRILLER|CRIME|CRIMEN|KRIMI|GANGSTER|MAFIA|MYSTERY|SU\u00c7|KRYMINAL/],
  ["Sci-Fi & Fantasy", /SCI|SCIENCE|FANTAS|CIENCIA|BILIM KURGU/],
  ["Animation & Anime", /ANIM|CARTOON|MANGA|CRTANI|BAJKI|DREAMWORKS|HANIME/],
  ["Kids & Family", /KID|KINDER|ENFANT|JEUNESSE|NI\u00d1OS|NINOS|INFANTIL|NFANTILES|BARN|DETSA|COPII|DZIECI|CRIAN|BAMBINI|FAMIL|COCUK|DJECIJA|FEMIJE|PLAY KIDZ/],
  ["Documentary", /DOCU|DOKU|BELGESEL|DECOUVERTE|DISCOVERY/],
  ["Romance", /ROMAN|MILOSC|WITHLOVE/],
  ["Western", /WESTERN/],
  ["War & History", /\bWAR\b|GUERRE|KRIEG|WOJENNE|HISTOR|STORIA|BIBLICAL|ANTICO/],
  ["Music", /MUSI|MUZI|CONCERT|KONZERT|SPOTIFY|RADIO|QAWWALI/],
  ["Sports", /SPORT|PPV|\bNBA\b|\bNFL\b|\bNHL\b|\bMLB\b|\bUFC\b|\bWWE\b|BOXING|LIGA|LEAGUE|FOOTBALL|FUSSBALL|TENNIS|\bF1\b|CRICKET|RUGBY|DAZN|BEIN|ESPN|EVENT|REPLAY|BUNDESLIGA|CALCIO|NCAA|DEPORTES|ESPORTES|FIGHT|RACING|GARROS/],
  ["News", /NEWS|INFOS|HABER|NACHRICHT|ALJAZEERA/],
  ["Holiday", /CHRISTMAS|NOEL|WEIHNACHT|KERST|SWI\u0104TECZNE|RAMADAN/],
  ["Reality & TV shows", /REALITY|REALITE|TV SHOW|TELEVISIONE|PROGRAM/],
  ["Movies", /CINEMA|MOVIE|FILM|KINO|SINEMA|BOX OFFICE|PELICULA|FILME|BIOSCOOP|CINE/],
  ["Entertainment", /ENTERTAIN|ENTERTEN|DIVERTISMENT|ARGETIM|RAZVLECH/]
];
function detect(list, up) { var out = []; for (var i = 0; i < list.length; i++) if (list[i][1].test(up)) out.push(list[i][0]); return out; }

/* ================= data ================= */
var cats = { live: [], movies: [], series: [] };
var cache = {};       // key type:catId -> slim item array
var inflight = {};
function procCats(type, arr) {
  var out = [];
  (Array.isArray(arr) ? arr : []).forEach(function (c) {
    if (!c || c.category_id == null) return;
    var raw = String(c.category_name || ""), up = raw.toUpperCase();
    var g = detect(GENRES, up);
    var s = detect(SOURCES, up);
    out.push({ id: String(c.category_id), type: type, raw: raw, code: catCode(raw), title: cleanCat(raw),
      genres: g.length ? g : ["General"], sources: s.length ? s : ["Other"] });
  });
  return out;
}
function catVisible(c) {
  if (!langOn(c.code)) return false;
  var i, ok = false;
  for (i = 0; i < c.genres.length; i++) if (!settings.genresOff[c.genres[i]]) { ok = true; break; }
  if (!ok) return false;
  ok = false;
  for (i = 0; i < c.sources.length; i++) if (!settings.sourcesOff[c.sources[i]]) { ok = true; break; }
  return ok;
}
function yearOf(s) { var m = String(s || "").match(/\((\d{4})\)/) || String(s || "").match(/\b(19\d\d|20\d\d)\b/); return m ? m[1] : ""; }
function slim(type, it) {
  if (type === "live") return { t: type, id: it.stream_id, n: cleanName(it.name), ic: it.stream_icon || "", ad: it.is_adult == 1 };
  if (type === "movies") return { t: type, id: it.stream_id, n: cleanName(it.name).replace(/\s*\(\s*-?\d{4}\s*\)\s*/, " ").replace(/\s+/g, " ").trim(),
    y: yearOf(it.name), ic: it.stream_icon || "", ext: it.container_extension || "mp4", r: it.rating, ad: it.is_adult == 1 };
  var bd = Array.isArray(it.backdrop_path) ? it.backdrop_path[0] : (typeof it.backdrop_path === "string" ? it.backdrop_path : "");
  return { t: type, id: it.series_id, n: cleanName(it.name).replace(/\s*\(\s*\d{4}\s*\)\s*/, " ").replace(/\s+/g, " ").trim(),
    y: String(it.releaseDate || it.release_date || "").slice(0, 4) || yearOf(it.name), ic: it.cover || "", plot: it.plot || "", genre: it.genre || "",
    r: it.rating, bd: bd || "", cast: it.cast || "" };
}
function loadCat(c) {
  var key = c.type + ":" + c.id;
  if (cache[key]) return Promise.resolve(cache[key]);
  if (inflight[key]) return inflight[key];
  var p = api(T[c.type].itemA, "category_id=" + encodeURIComponent(c.id), 45000).then(function (arr) {
    var out = [], adultOk = langOn("ADULT");
    (Array.isArray(arr) ? arr : []).forEach(function (it) { if (it && it.name) { var s = slim(c.type, it); if (!s.ad || adultOk) out.push(s); } });
    cache[key] = out; delete inflight[key]; return out;
  }, function (e) { delete inflight[key]; throw e; });
  inflight[key] = p;
  return p;
}

/* ================= small UI helpers ================= */
var toastT = null;
function toast(msg, ms) { var t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("hidden"); }, ms || 2500); }
var curF = null;
function setF(el) { if (curF === el) return; if (curF) curF.classList.remove("f"); curF = el; if (el) el.classList.add("f"); }
function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function initials(n) {
  var w = String(n || "?").replace(/[^A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF ]/g, " ").trim().split(/\s+/);
  var s = (w[0] ? w[0].charAt(0) : "?") + (w[1] ? w[1].charAt(0) : (w[0] && w[0].length > 1 ? w[0].charAt(1) : ""));
  return s.toUpperCase();
}
function placeholder(name) { var d = ce("div", "ph g" + (hash(name) % 8), initials(name)); return d; }
function artEl(item) {
  var a = ce("div", "art");
  if (item.ic && /^https?:/i.test(item.ic)) {
    var img = document.createElement("img"); img.loading = "lazy"; img.alt = "";
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(placeholder(item.n), img); };
    img.src = item.ic; a.appendChild(img);
  } else a.appendChild(placeholder(item.n));
  return a;
}
function cardEl(item, cls, i, pitch) {
  var c = ce("div", "card " + cls);
  c.style.left = (i * pitch) + "px";
  c.appendChild(artEl(item));
  c.appendChild(ce("div", "name", item.n));
  return c;
}
function stars(r) { var n = parseFloat(r); return n > 0 ? "\u2605 " + (n > 10 ? n / 10 : n).toFixed(1) : ""; }
function metaHTML(parts) {
  var m = ce("div", "meta");
  parts.forEach(function (p) { if (!p) return; var s = ce("span", p.cls || "", p.t); m.appendChild(s); m.appendChild(document.createTextNode("   ")); });
  return m;
}

/* ================= main view (hero + rows) ================= */
var V = { view: settings.view, rows: [], r: 0, zone: "nav", navIdx: 0, heroIdx: 0, hero: null, heroOn: false, gen: 0 };
var tabs = Array.prototype.slice.call(document.querySelectorAll("#tabs .tab"));
var TAB_VIEWS = tabs.map(function (t) { return t.getAttribute("data-view"); });

function buildView(view) {
  V.gen++;
  V.view = view; V.rows = []; V.r = 0; V.hero = null;
  if (view !== "search") { settings.view = view; saveSettings(); }
  tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-view") === view); });
  var rowsEl = $("rows"); rowsEl.textContent = "";
  $("search").classList.add("hidden");
  $("view").classList.remove("hidden");
  var info = T[view];
  V.heroOn = view !== "live";
  $("hero").classList.add("hidden");
  rowsEl.style.paddingTop = V.heroOn ? "0px" : "130px";
  var list = cats[view].filter(catVisible);
  list.forEach(function (c) {
    var el = ce("div", "row"); el.style.height = info.rowH + "px";
    var tt = ce("div", "rtitle", c.title);
    if (c.code !== "MULTI") tt.appendChild(ce("span", "badge", c.code));
    var cnt = ce("span", "cnt", ""); tt.appendChild(cnt);
    el.appendChild(tt);
    var track = ce("div", "track"); el.appendChild(track);
    var msg = ce("div", "rowmsg", "Loading\u2026"); el.appendChild(msg);
    rowsEl.appendChild(el);
    V.rows.push({ cat: c, el: el, track: track, msg: msg, cnt: cnt, items: null, col: 0, off: 0, rendered: {}, lo: 0, hi: -1 });
  });
  var empty = $("empty");
  if (!list.length) {
    empty.innerHTML = "Nothing to show here.<br>Open <b>Settings</b> and turn on more languages, genres or sources.";
    empty.classList.remove("hidden");
  } else empty.classList.add("hidden");
  if (V.heroOn) { $("hero").classList.remove("hidden"); setHeroPlaceholder(); }
  updateScroll();
  ensureRows();
}
function setHeroPlaceholder() {
  $("hero-bg").removeAttribute("src"); $("hero-bg").style.visibility = "hidden";
  $("hero-kicker").textContent = V.view === "movies" ? "Featured movie" : "Featured show";
  $("hero-title").textContent = ""; $("hero-meta").textContent = ""; $("hero-plot").textContent = "";
}
function pickHero(row) {
  if (!V.heroOn || V.hero || !row.items || !row.items.length) return;
  var pool = row.items.slice(0, 12).filter(function (x) { return x.ic; });
  if (!pool.length) pool = row.items.slice(0, 5);
  var it = pool[Math.floor(Math.random() * pool.length)];
  V.hero = it;
  var gen = V.gen;
  $("hero-title").textContent = it.n;
  setHeroMeta(it, it.genre || "", it.plot || "");
  setHeroBg(it.bd || it.ic);
  if (it.t === "movies") {
    api("get_vod_info", "vod_id=" + it.id, 15000).then(function (r) {
      if (gen !== V.gen || V.hero !== it) return;
      var inf = (r && r.info) || {};
      it.plot = inf.plot || inf.description || ""; it.genre = inf.genre || ""; it.cast = inf.cast || inf.actors || "";
      it.dur = inf.duration || ""; it.bd = firstImg(inf.backdrop_path) || it.bd;
      if (!it.y && inf.releasedate) it.y = String(inf.releasedate).slice(0, 4);
      setHeroMeta(it, it.genre, it.plot); if (it.bd) setHeroBg(it.bd);
    }).catch(function () {});
  }
}
function firstImg(v) {
  if (Array.isArray(v)) return v[0] || "";
  if (typeof v === "string") { var m = v.match(/https?:[^'"\],\s]+/); return m ? m[0] : ""; }
  return "";
}
function setHeroBg(src) { var b = $("hero-bg"); if (!src) return; b.style.visibility = "hidden"; b.onload = function () { b.style.visibility = "visible"; }; b.src = src; }
function setHeroMeta(it, genre, plot) {
  var m = $("hero-meta"); m.textContent = "";
  var bits = [];
  if (it.y) bits.push(it.y);
  var st = stars(it.r); if (st) bits.push(st);
  if (it.dur) bits.push(it.dur.replace(/^0?(\d+):(\d\d):\d\d$/, function (a, h, mm) { return (h > 0 ? h + "h " : "") + parseInt(mm, 10) + "m"; }));
  if (genre) bits.push(genre.replace(/\s*\/\s*/g, ", "));
  m.textContent = bits.join("   \u2022   ");
  $("hero-plot").textContent = plot || "";
}

/* fetch queue: nearest rows first, 3 at a time */
var active = 0;
function ensureRows() {
  var gen = V.gen, rows = V.rows, r = V.r;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var near = i >= r - 2 && i <= r + 3;
    if (near && row.items) renderWindow(row);
    else if (!near && row.hi >= row.lo) clearRow(row);
  }
  // fetch
  var order = [];
  for (var k = Math.max(0, r - 1); k <= Math.min(rows.length - 1, r + 5); k++) order.push(k);
  order.sort(function (a, b) { return Math.abs(a - r) - Math.abs(b - r); });
  for (var j = 0; j < order.length && active < 3; j++) {
    var rw = rows[order[j]];
    if (rw.items || rw.loading) continue;
    startLoad(rw, gen);
  }
}
function startLoad(row, gen) {
  row.loading = true; active++;
  loadCat(row.cat).then(function (items) {
    active--; row.loading = false;
    if (gen !== V.gen) { ensureRows(); return; }
    row.items = items;
    if (!items.length) { removeRow(row); }
    else {
      row.msg.style.display = "none";
      row.cnt.textContent = items.length + (items.length === 1 ? " title" : " titles");
      if (V.heroOn && !V.hero) pickHero(row);
      if (V.zone === "rows" && V.rows[V.r] === row) focusRowItem();
    }
    ensureRows();
  }, function () {
    active--; row.loading = false;
    if (gen !== V.gen) { ensureRows(); return; }
    row.items = []; row.msg.textContent = "Couldn't load this row";
    ensureRows();
  });
}
function removeRow(row) {
  var idx = V.rows.indexOf(row); if (idx < 0) return;
  if (row.el.parentNode) row.el.parentNode.removeChild(row.el);
  V.rows.splice(idx, 1);
  if (idx < V.r) V.r--;
  if (V.r >= V.rows.length) V.r = Math.max(0, V.rows.length - 1);
  if (!V.rows.length) {
    $("empty").innerHTML = "Nothing to show here.<br>Open <b>Settings</b> and turn on more languages, genres or sources.";
    $("empty").classList.remove("hidden");
  }
  if (V.zone === "rows") { if (!V.rows.length) { V.zone = V.heroOn ? "hero" : "nav"; } applyFocus(); }
  else updateScroll();
}
function clearRow(row) { row.track.textContent = ""; row.rendered = {}; row.lo = 0; row.hi = -1; }
function renderWindow(row) {
  var info = T[V.view], n = row.items.length;
  var lo = Math.max(0, row.off - 3), hi = Math.min(n - 1, row.off + info.vis + 5);
  var k;
  for (k in row.rendered) { k = +k; if (k < lo || k > hi) { var e = row.rendered[k]; if (e.parentNode) e.parentNode.removeChild(e); delete row.rendered[k]; } }
  var frag = document.createDocumentFragment();
  for (k = lo; k <= hi; k++) if (!row.rendered[k]) { var c = cardEl(row.items[k], info.card, k, info.pitch); row.rendered[k] = c; frag.appendChild(c); }
  row.track.appendChild(frag);
  row.lo = lo; row.hi = hi;
  row.track.style.transform = "translateX(" + (-row.off * info.pitch) + "px)";
}
function updateScroll() {
  var ty = 0, info = T[V.view];
  if (V.zone === "rows" && V.rows.length && info) {
    var top = (V.heroOn ? 700 : 130) + V.r * info.rowH;
    var target = 120;
    ty = Math.min(0, -(top - target));
  }
  $("scroller").style.transform = "translateY(" + ty + "px)";
}
function focusRowItem() {
  var row = V.rows[V.r];
  if (!row) { setF(null); return; }
  if (!row.items || !row.items.length) { setF(null); return; }
  if (row.col >= row.items.length) row.col = row.items.length - 1;
  renderWindow(row);
  setF(row.rendered[row.col] || null);
}
function applyFocus() {
  if (V.zone === "nav") setF(tabs[V.navIdx]);
  else if (V.zone === "hero") setF(V.heroIdx ? $("hero-info") : $("hero-play"));
  else if (V.zone === "rows") { ensureRows(); focusRowItem(); }
  updateScroll();
}
function moveCol(row, d) {
  var info = T[V.view], n = row.items ? row.items.length : 0;
  if (!n) return;
  var c = Math.max(0, Math.min(n - 1, row.col + d));
  if (c === row.col) return;
  row.col = c;
  if (c < row.off + 1) row.off = Math.max(0, c - 1);
  else if (c > row.off + info.vis - 2) row.off = Math.min(Math.max(0, n - info.vis + 1), c - (info.vis - 2));
  if (c < row.off) row.off = c;
  focusRowItem();
}
function changeRow(d) {
  var nr = V.r + d;
  if (nr < 0 || nr >= V.rows.length) return false;
  var cur = V.rows[V.r], vis = cur ? cur.col - cur.off : 0;
  V.r = nr;
  var row = V.rows[nr];
  if (row.col === 0 && row.off === 0) row.col = vis;
  if (row.items && row.col >= row.items.length) row.col = Math.max(0, row.items.length - 1);
  if (row.col > row.off + T[V.view].vis - 2) row.off = Math.max(0, row.col - (T[V.view].vis - 2));
  applyFocus();
  return true;
}
function mainKey(k) {
  if (V.zone === "nav") {
    if (k === "left") { if (V.navIdx > 0) V.navIdx--; applyFocus(); }
    else if (k === "right") { if (V.navIdx < tabs.length - 1) V.navIdx++; applyFocus(); }
    else if (k === "enter") selectTab(TAB_VIEWS[V.navIdx], true);
    else if (k === "down") enterContent();
    else if (k === "back") exitApp();
    return;
  }
  if (V.view === "search") { searchKey(k); return; }
  if (V.zone === "hero") {
    if (k === "left") { V.heroIdx = 0; applyFocus(); }
    else if (k === "right") { V.heroIdx = 1; applyFocus(); }
    else if (k === "up" || k === "back") { V.zone = "nav"; applyFocus(); }
    else if (k === "down") { if (V.rows.length) { V.zone = "rows"; V.r = 0; applyFocus(); } }
    else if (k === "enter" && V.hero) { if (V.heroIdx === 0 && V.hero.t === "movies") playItem(V.hero); else openDetails(V.hero); }
    return;
  }
  if (V.zone === "rows") {
    var row = V.rows[V.r];
    if (k === "left") { if (row) moveCol(row, -1); }
    else if (k === "right") { if (row) moveCol(row, 1); }
    else if (k === "up") { if (!changeRow(-1)) { V.zone = V.heroOn && V.hero ? "hero" : "nav"; applyFocus(); } }
    else if (k === "down") changeRow(1);
    else if (k === "back") { V.zone = "nav"; applyFocus(); }
    else if (k === "enter" && row && row.items && row.items[row.col]) activate(row.items[row.col], row.items, row.col);
  }
}
function enterContent() {
  var v = TAB_VIEWS[V.navIdx];
  if (v !== V.view && v !== "settings") { selectTab(v, false); }
  if (V.view === "search") { V.zone = "search"; S.pane = "kbd"; searchFocus(); return; }
  if (V.heroOn && V.hero) { V.zone = "hero"; V.heroIdx = 0; }
  else if (V.rows.length) { V.zone = "rows"; }
  applyFocus();
}
function selectTab(v, fromOk) {
  if (v === "settings") { openSettings(); return; }
  if (v === "search") { showSearch(); if (fromOk) { V.zone = "search"; S.pane = "kbd"; searchFocus(); } return; }
  if (v !== V.view) buildView(v);
  if (fromOk) enterContent();
}
function activate(item, list, idx) {
  if (item.t === "live") playItem(item, list, idx);
  else openDetails(item);
}

/* ================= details ================= */
var D = { open: false, item: null, lines: [], li: 0, ci: 0, seasons: null, season: null, eps: {} };
function openDetails(item) {
  D.open = true; D.item = item; D.lines = []; D.li = 0; D.ci = 0; D.eps = {}; D.season = null; D.seasons = [];
  $("details").classList.remove("hidden");
  var bg = $("d-bg"); bg.style.visibility = "hidden"; bg.onload = function () { bg.style.visibility = "visible"; };
  if (item.bd || item.ic) bg.src = item.bd || item.ic;
  renderDetails("Loading details\u2026");
  var p = item.t === "movies" ? api("get_vod_info", "vod_id=" + item.id, 15000) : api("get_series_info", "series_id=" + item.id, 20000);
  p.then(function (r) {
    if (!D.open || D.item !== item) return;
    var inf = (r && r.info) || {};
    item.plot = inf.plot || inf.description || item.plot || "";
    item.genre = inf.genre || item.genre || "";
    item.cast = inf.cast || inf.actors || item.cast || "";
    if (inf.duration) item.dur = inf.duration;
    if (!item.y && (inf.releasedate || inf.releaseDate)) item.y = String(inf.releasedate || inf.releaseDate).slice(0, 4);
    var bd = firstImg(inf.backdrop_path); if (bd) { item.bd = bd; bg.src = bd; }
    if (item.t === "series") {
      var eps = r && r.episodes, seasons = [];
      if (eps && !Array.isArray(eps)) { for (var s in eps) if (Array.isArray(eps[s]) && eps[s].length) { seasons.push(s); D.eps[s] = eps[s]; } }
      else if (Array.isArray(eps)) { eps.forEach(function (e) { var s2 = String(e.season || 1); (D.eps[s2] = D.eps[s2] || []).push(e); }); seasons = Object.keys(D.eps); }
      seasons.sort(function (a, b) { return (+a) - (+b); });
      D.seasons = seasons; D.season = seasons[0] || null;
    }
    renderDetails("");
  }).catch(function () { if (D.open && D.item === item) renderDetails(""); });
}
function epTitle(e) {
  var t = String(e.title || ""), m = t.match(/S\d+\s*E\d+\s*-\s*(.+)$/i);
  if (m) t = m[1];
  return t || ("Episode " + (e.episode_num || ""));
}
function renderDetails(status) {
  var item = D.item, body = $("d-body"); body.textContent = ""; D.lines = [];
  var top = ce("div", "d-top");
  var po = ce("div", "d-poster");
  if (item.ic) { var im = document.createElement("img"); im.src = item.ic; im.onerror = function () { po.textContent = ""; var p = placeholder(item.n); po.appendChild(p); }; po.appendChild(im); }
  else po.appendChild(placeholder(item.n));
  top.appendChild(po);
  var inf = ce("div", "d-info");
  inf.appendChild(ce("div", "kicker", item.t === "movies" ? "Movie" : "Series"));
  inf.appendChild(ce("div", "d-title", item.n));
  var bits = [];
  if (item.y) bits.push(item.y);
  var st = stars(item.r); if (st) bits.push(st);
  if (item.dur) bits.push(String(item.dur).replace(/^0?(\d+):(\d\d):\d\d$/, function (a, h, mm) { return (h > 0 ? h + "h " : "") + parseInt(mm, 10) + "m"; }));
  if (item.genre) bits.push(String(item.genre).replace(/\s*\/\s*/g, ", "));
  if (D.seasons && D.seasons.length) bits.push(D.seasons.length + (D.seasons.length === 1 ? " season" : " seasons"));
  inf.appendChild(ce("div", "meta", bits.join("   \u2022   ")));
  inf.appendChild(ce("div", "d-plot", status || item.plot || ""));
  if (item.cast) inf.appendChild(ce("div", "d-cast", "Cast: " + item.cast));
  var bl = ce("div", "d-line");
  var play = ce("div", "btn primary", item.t === "series" ? "\u25B6\u00a0 Play first episode" : "\u25B6\u00a0 Play");
  play._act = function () {
    if (item.t === "movies") playItem(item);
    else if (D.season && D.eps[D.season]) playEpisode(D.eps[D.season], 0);
    else toast("No episodes available yet");
  };
  bl.appendChild(play);
  var back = ce("div", "btn", "\u2190 Back"); back._act = closeDetails; bl.appendChild(back);
  inf.appendChild(bl);
  D.lines.push({ el: bl, items: [play, back] });
  top.appendChild(inf);
  body.appendChild(top);
  if (item.t === "series" && D.seasons.length) {
    var sl = ce("div", "d-line"); sl.style.marginTop = "34px";
    var sitems = [];
    D.seasons.forEach(function (s) {
      var b = ce("div", "season" + (s === D.season ? " sel" : ""), "Season " + s);
      b._act = function () { D.season = s; var li = D.li; renderDetails(""); D.li = li; D.ci = D.seasons.indexOf(s); dFocus(); };
      sl.appendChild(b); sitems.push(b);
    });
    body.appendChild(sl);
    D.lines.push({ el: sl, items: sitems });
    body.appendChild(ce("div", "d-eps-h", "Episodes"));
    (D.eps[D.season] || []).forEach(function (e, i) {
      var b = ce("div", "ep");
      b.appendChild(ce("span", "en", "E" + (e.episode_num || i + 1)));
      b.appendChild(ce("span", "et", epTitle(e)));
      var du = e.info && e.info.duration ? String(e.info.duration).replace(/^0?(\d+):(\d\d):\d\d$/, function (a, h, mm) { return (h > 0 ? h + "h " : "") + parseInt(mm, 10) + "m"; }) : "";
      if (du) b.appendChild(ce("span", "ed", du));
      b._act = function () { playEpisode(D.eps[D.season], i); };
      var ln = ce("div", "d-line"); ln.appendChild(b); body.appendChild(ln);
      D.lines.push({ el: ln, items: [b] });
    });
  }
  if (D.li >= D.lines.length) D.li = 0;
  dFocus();
}
function dFocus() {
  var line = D.lines[D.li]; if (!line) return;
  if (D.ci >= line.items.length) D.ci = line.items.length - 1;
  setF(line.items[D.ci]);
  var y = line.el.offsetTop;
  $("d-body").style.transform = "translateY(" + Math.min(0, -(y - 760)) + "px)";
  if (line.items.length > 6) { // season chips: scroll horizontally if many
    var x = line.items[D.ci].offsetLeft; line.el.style.transform = "translateX(" + Math.min(0, -(x - 900)) + "px)";
  }
}
function closeDetails() { D.open = false; $("details").classList.add("hidden"); $("d-bg").removeAttribute("src"); if (V.zone === "search") searchFocus(); else applyFocus(); }
function detailsKey(k) {
  if (k === "back") { closeDetails(); return; }
  if (k === "up") { if (D.li > 0) { D.li--; if (D.li === 0) D.ci = 0; dFocus(); } }
  else if (k === "down") { if (D.li < D.lines.length - 1) { D.li++; if (D.lines[D.li].items.length === 1) D.ci = 0; else if (D.lines[D.li].items.length > 1 && D.seasons) D.ci = Math.max(0, D.seasons.indexOf(D.season)); dFocus(); } }
  else if (k === "left") { if (D.ci > 0) { D.ci--; dFocus(); } }
  else if (k === "right") { if (D.ci < D.lines[D.li].items.length - 1) { D.ci++; dFocus(); } }
  else if (k === "enter") { var it = D.lines[D.li].items[D.ci]; if (it && it._act) it._act(); }
}

/* ================= player ================= */
var P = { open: false, list: null, idx: 0, item: null, useAV: false, osdT: null, urls: [], ui: 0, title: "", vod: false, lastT: 0 };
function base() { return settings.server.replace(/\/+$/, ""); }
function cred() { return encodeURIComponent(settings.username) + "/" + encodeURIComponent(settings.password); }
function playItem(item, list, idx) {
  if (item.t === "live") {
    P.list = list || null; P.idx = idx || 0;
    startPlayback(item.n, [base() + "/live/" + cred() + "/" + item.id + ".m3u8", base() + "/live/" + cred() + "/" + item.id + ".ts"], false);
  } else startPlayback(item.n, [base() + "/movie/" + cred() + "/" + item.id + "." + (item.ext || "mp4")], true);
  P.item = item;
}
function playEpisode(eps, i) {
  var e = eps[i]; if (!e) return;
  P.list = null; P.eps = eps; P.epi = i;
  startPlayback(D.item.n + "  \u2022  E" + (e.episode_num || i + 1) + " " + epTitle(e), [base() + "/series/" + cred() + "/" + e.id + "." + (e.container_extension || "mp4")], true);
}
function osd(status, hint, stay) {
  if (status != null) $("osd-status").textContent = status;
  if (hint != null) $("osd-hint").textContent = hint;
  var o = $("osd"); o.classList.remove("hide"); clearTimeout(P.osdT);
  if (!stay) P.osdT = setTimeout(function () { o.classList.add("hide"); }, 4500);
}
function hintText() {
  if (!P.vod) return P.list ? "\u25B2 \u25BC  change channel      BACK  exit" : "BACK  exit";
  return "OK  pause / play      \u25C0 \u25B6  back 10s / forward 30s      BACK  exit";
}
function startPlayback(title, urls, vod) {
  P.open = true; P.title = title; P.urls = urls; P.ui = 0; P.vod = vod;
  document.body.classList.add("playing"); document.documentElement.classList.add("playing");
  $("player").classList.remove("hidden");
  $("osd-title").textContent = title;
  setF(null);
  playURL(urls[0]);
}
function avOK() { try { return !!(window.webapis && webapis.avplay); } catch (e) { return false; } }
function playURL(url) {
  stopMedia();
  osd("Loading\u2026", hintText(), true);
  if (avOK()) {
    P.useAV = true; $("video").classList.add("off");
    var av = webapis.avplay;
    try {
      av.open(url);
      av.setDisplayRect(0, 0, 1920, 1080);
      try { av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e0) {}
      av.setListener({
        onbufferingstart: function () { osd("Buffering\u2026", null, true); },
        onbufferingprogress: function (p) { osd("Buffering " + p + "%", null, true); },
        onbufferingcomplete: function () { osd("", null, false); },
        onstreamcompleted: function () { closePlayer(); },
        oncurrentplaytime: function (t) { P.lastT = t; },
        onerror: function (e) { playFailed(String(e)); },
        onevent: function () {}
      });
      av.prepareAsync(function () { try { av.play(); osd("", null, false); } catch (e1) { playFailed(String(e1)); } },
                      function (err) { playFailed(err && err.name ? err.name : String(err)); });
    } catch (e) { playFailed(e && e.name ? e.name : String(e)); }
  } else {
    P.useAV = false; var v = $("video"); v.classList.remove("off");
    v.onplaying = function () { osd("", null, false); };
    v.onwaiting = function () { osd("Buffering\u2026", null, true); };
    v.onerror = function () { playFailed("video error"); };
    v.onended = function () { closePlayer(); };
    v.src = url;
    var pr; try { pr = v.play(); } catch (e2) {}
    if (pr && pr.catch) pr.catch(function () {});
  }
}
function playFailed(why) {
  if (!P.open) return;
  if (P.ui < P.urls.length - 1) { P.ui++; playURL(P.urls[P.ui]); return; }
  osd("Couldn't play this stream (" + why + ")", "BACK  exit" + (P.list ? "      \u25B2 \u25BC  try another channel" : ""), true);
}
function stopMedia() {
  if (P.useAV && avOK()) { try { webapis.avplay.stop(); } catch (e) {} try { webapis.avplay.close(); } catch (e2) {} }
  var v = $("video"); try { v.pause(); } catch (e3) {} if (v.getAttribute("src")) { v.removeAttribute("src"); try { v.load(); } catch (e4) {} }
}
function closePlayer() {
  if (!P.open) return;
  P.open = false; stopMedia();
  $("player").classList.add("hidden");
  document.body.classList.remove("playing"); document.documentElement.classList.remove("playing");
  if (D.open) dFocus(); else if (V.zone === "search") searchFocus(); else applyFocus();
}
function togglePause() {
  if (!P.vod) { osd(null, null, false); return; }
  if (P.useAV) {
    var st = ""; try { st = webapis.avplay.getState(); } catch (e) {}
    if (st === "PLAYING") { try { webapis.avplay.pause(); } catch (e1) {} osd("Paused", null, true); }
    else { try { webapis.avplay.play(); } catch (e2) {} osd("", null, false); }
  } else { var v = $("video"); if (v.paused) { v.play(); osd("", null, false); } else { v.pause(); osd("Paused", null, true); } }
}
function seek(ms) {
  if (!P.vod) return;
  if (P.useAV) { try { if (ms > 0) webapis.avplay.jumpForward(ms); else webapis.avplay.jumpBackward(-ms); } catch (e) {} }
  else { var v = $("video"); try { v.currentTime = Math.max(0, v.currentTime + ms / 1000); } catch (e2) {} }
  osd((ms > 0 ? "\u23E9 +" : "\u23EA ") + Math.round(ms / 1000) + "s", null, false);
}
function zap(d) {
  if (!P.list) { osd(null, null, false); return; }
  var n = P.idx + d; if (n < 0 || n >= P.list.length) return;
  P.idx = n; var it = P.list[n]; P.item = it;
  $("osd-title").textContent = it.n; P.title = it.n;
  P.urls = [base() + "/live/" + cred() + "/" + it.id + ".m3u8", base() + "/live/" + cred() + "/" + it.id + ".ts"]; P.ui = 0;
  playURL(P.urls[0]);
  // keep row focus in sync
  var row = V.rows[V.r]; if (row && row.items === P.list) { row.col = n; row.off = Math.max(0, Math.min(n - 1, row.items.length - T[V.view].vis + 1)); }
}
function playerKey(k) {
  if (k === "back") closePlayer();
  else if (k === "enter") togglePause();
  else if (k === "left") seek(-10000);
  else if (k === "right") seek(30000);
  else if (k === "up") zap(-1);
  else if (k === "down") zap(1);
}
document.addEventListener("visibilitychange", function () { if (document.hidden && P.open) closePlayer(); });

/* ================= settings screen ================= */
var ST = { open: false, lines: [], li: 0, ci: 0, dirty: false };
function langList() {
  var cnt = {};
  ["live", "movies", "series"].forEach(function (t) { cats[t].forEach(function (c) { cnt[c.code] = (cnt[c.code] || 0) + 1; }); });
  var codes = Object.keys(cnt);
  codes.sort(function (a, b) { var da = DEFAULT_LANGS[a] ? 0 : 1, db = DEFAULT_LANGS[b] ? 0 : 1; if (da !== db) return da - db; return (LANG_NAMES[a] || a).localeCompare(LANG_NAMES[b] || b); });
  return codes.map(function (c) { return { key: c, label: LANG_NAMES[c] || c, sub: c + " \u00b7 " + cnt[c] }; });
}
function tagList(field, order) {
  var cnt = {};
  ["live", "movies", "series"].forEach(function (t) { cats[t].forEach(function (c) { c[field].forEach(function (g) { cnt[g] = (cnt[g] || 0) + 1; }); }); });
  var keys = Object.keys(cnt);
  keys.sort(function (a, b) { if (a === "Other" || a === "General") return 1; if (b === "Other" || b === "General") return -1; return order ? order.indexOf(a) - order.indexOf(b) : cnt[b] - cnt[a]; });
  return keys.map(function (k) { return { key: k, label: k, sub: String(cnt[k]) }; });
}
function chip(label, sub, on, act, cls) {
  var c = ce("div", "chip" + (cls ? " " + cls : "") + (on ? " on" : ""));
  if (!cls) { c.appendChild(ce("span", "box", on ? "\u2713" : "")); }
  c.appendChild(ce("span", "cl", label));
  if (sub) c.appendChild(ce("span", "cn", sub));
  c._act = act; return c;
}
function setChip(c, on) { c.classList.toggle("on", on); var b = c.querySelector(".box"); if (b) b.textContent = on ? "\u2713" : ""; }
function openSettings() {
  ST.open = true; ST.dirty = false; ST.li = 0; ST.ci = 0;
  $("settings").classList.remove("hidden");
  renderSettings();
}
function addGrid(inner, list, isOn, toggle) {
  var chips = [];
  for (var i = 0; i < list.length; i += 4) {
    var ln = ce("div", "s-line"), items = [];
    list.slice(i, i + 4).forEach(function (x) {
      var c = chip(x.label, x.sub, isOn(x.key), null);
      c._act = function () { var v = !isOn(x.key); toggle(x.key, v); setChip(c, v); ST.dirty = true; };
      c._key = x.key; ln.appendChild(c); items.push(c); chips.push(c);
    });
    inner.appendChild(ln); ST.lines.push({ el: ln, items: items });
  }
  return chips;
}
function renderSettings() {
  var inner = $("settings-inner"); inner.textContent = ""; ST.lines = [];
  var logo = document.createElement("img"); logo.src = "img/logo.png"; logo.style.height = "70px"; logo.style.marginBottom = "18px"; inner.appendChild(logo);
  inner.appendChild(ce("div", "s-h1", "Settings"));
  inner.appendChild(ce("div", "s-sub", "Changes are saved automatically and applied when you press BACK."));

  function section(title, note, list, isOn, toggle) {
    inner.appendChild(ce("div", "s-sec", title));
    inner.appendChild(ce("div", "s-note", note));
    var al = ce("div", "s-line"), chips;
    var aOn = chip("Turn all on", "", false, function () { list.forEach(function (x) { if (x.key !== "ADULT") toggle(x.key, true); }); chips.forEach(function (c) { if (c._key !== "ADULT") setChip(c, true); }); ST.dirty = true; }, "act");
    var aOff = chip("Turn all off", "", false, function () { list.forEach(function (x) { toggle(x.key, false); }); chips.forEach(function (c) { setChip(c, false); }); ST.dirty = true; }, "act");
    al.appendChild(aOn); al.appendChild(aOff);
    inner.appendChild(al); ST.lines.push({ el: al, items: [aOn, aOff] });
    chips = addGrid(inner, list, isOn, toggle);
  }
  var langs = langList();
  section("Languages & regions", langs.length + " found in your provider's categories. Only checked ones appear in TV, Movies, Shows and Search.", langs,
    function (k) { return langOn(k); }, function (k, v) { settings.langs[k] = v ? 1 : 0; });
  section("Genres", "Rows are grouped by the provider's categories; a row is shown if any of its genres is checked.", tagList("genres", GENRES.map(function (g) { return g[0]; })),
    function (k) { return !settings.genresOff[k]; }, function (k, v) { if (v) delete settings.genresOff[k]; else settings.genresOff[k] = 1; });
  section("Sources & services", "Detected from category names (Netflix, Apple TV+, Disney+, Prime Video, HBO and more). \"Other\" covers everything else.", tagList("sources"),
    function (k) { return !settings.sourcesOff[k]; }, function (k, v) { if (v) delete settings.sourcesOff[k]; else settings.sourcesOff[k] = 1; });

  inner.appendChild(ce("div", "s-sec", "Account"));
  inner.appendChild(ce("div", "s-note", "Your IPTV provider login. Press OK on a field to type."));
  var fields = [["Server", "server", "text"], ["Username", "username", "text"], ["Password", "password", "password"]];
  fields.forEach(function (f) {
    var ln = ce("div", "s-line"); ln.appendChild(ce("div", "s-lab", f[0]));
    var inp = document.createElement("input"); inp.className = "inp"; inp.type = f[2]; inp.value = settings[f[1]]; inp.setAttribute("autocomplete", "off");
    inp._field = f[1];
    inp._act = function () { inp.focus(); };
    ln.appendChild(inp); inner.appendChild(ln); ST.lines.push({ el: ln, items: [inp] });
  });
  var sl = ce("div", "s-line");
  var sv = chip("Save login & reconnect", "", false, function () {
    var ins = inner.querySelectorAll("input.inp");
    for (var i = 0; i < ins.length; i++) settings[ins[i]._field] = ins[i].value.trim() || settings[ins[i]._field];
    saveSettings(); cache = {}; toast("Reconnecting\u2026");
    loadAllCats().then(function () { toast("Connected"); ST.dirty = true; }).catch(function () { toast("Connection failed \u2013 check server, username and password", 4000); });
  }, "act");
  sl.appendChild(sv); inner.appendChild(sl); ST.lines.push({ el: sl, items: [sv] });
  inner.appendChild(ce("div", "s-note", "NickFlix 2.0"));
  stFocus();
}
function stFocus() {
  var line = ST.lines[ST.li]; if (!line) return;
  if (ST.ci >= line.items.length) ST.ci = line.items.length - 1;
  setF(line.items[ST.ci]);
  var y = line.el.offsetTop;
  $("settings-inner").style.transform = "translateY(" + Math.min(0, -(y - 480)) + "px)";
}
function closeSettings() {
  var a = document.activeElement; if (a && a.tagName === "INPUT") a.blur();
  ST.open = false; $("settings").classList.add("hidden"); saveSettings();
  if (ST.dirty) { cache = {}; buildView(V.view === "search" ? settings.view : V.view); if (V.view === "search") showSearch(); }
  V.zone = "nav"; V.navIdx = TAB_VIEWS.indexOf("settings"); applyFocus();
}
function settingsKey(k) {
  if (k === "back") { closeSettings(); return; }
  if (k === "up") { if (ST.li > 0) { ST.li--; stFocus(); } }
  else if (k === "down") { if (ST.li < ST.lines.length - 1) { ST.li++; stFocus(); } }
  else if (k === "left") { if (ST.ci > 0) { ST.ci--; stFocus(); } }
  else if (k === "right") { if (ST.ci < ST.lines[ST.li].items.length - 1) { ST.ci++; stFocus(); } }
  else if (k === "enter") { var c = ST.lines[ST.li].items[ST.ci]; if (c && c._act) c._act(); }
}

/* ================= search ================= */
var KEYS = ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZ1234", "567890"];
var S = { q: "", pane: "kbd", kl: 0, kc: 0, kLines: [], res: [], rl: 0, idx: false, done: 0, total: 0, timer: null, gen: 0 };
function buildKbd() {
  var k = $("kbd"); k.textContent = ""; S.kLines = [];
  KEYS.forEach(function (row) {
    var r = ce("div", "krow"), items = [];
    row.split("").forEach(function (ch) { var b = ce("div", "key", ch); b._ch = ch; r.appendChild(b); items.push(b); });
    k.appendChild(r); S.kLines.push(items);
  });
  var r2 = ce("div", "krow"), it2 = [];
  [["SPACE", " "], ["\u232B DEL", "DEL"], ["CLEAR", "CLR"]].forEach(function (x) { var b = ce("div", "key wide", x[0]); b._ch = x[1]; r2.appendChild(b); it2.push(b); });
  k.appendChild(r2); S.kLines.push(it2);
}
function showSearch() {
  V.view = "search"; V.gen++;
  tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-view") === "search"); });
  $("view").classList.add("hidden"); $("search").classList.remove("hidden");
  if (!S.kLines.length) buildKbd();
  renderQ(); startIndex(); runSearch();
}
function renderQ() {
  var q = $("search-q"); q.textContent = "";
  if (S.q) q.textContent = S.q + "_"; else q.appendChild(ce("span", "ph", "Type to search\u2026"));
}
function searchCats() { var out = []; ["live", "movies", "series"].forEach(function (t) { cats[t].forEach(function (c) { if (catVisible(c)) out.push(c); }); }); return out; }
function startIndex() {
  var list = searchCats(); S.total = list.length; S.done = 0; var g = ++S.gen, i = 0, running = 0;
  function next() {
    if (g !== S.gen) return;
    while (running < 4 && i < list.length) {
      var c = list[i++]; running++;
      loadCat(c).then(fin, fin);
    }
  }
  function fin() { running--; S.done++; if (g !== S.gen) return; status(); if (S.q.length >= 2) schedule(); next(); }
  status(); next();
}
function status() {
  $("search-status").textContent = (S.done < S.total ? "Indexing library\u2026 " + S.done + " / " + S.total + " categories" : "Searching " + S.total + " categories") +
    "\nUse \u25B6 to move to results.";
}
function schedule() { if (S.timer) return; S.timer = setTimeout(function () { S.timer = null; runSearch(); }, 700); }
function runSearch() {
  var box = $("search-results"); box.textContent = ""; S.res = [];
  var q = S.q.toLowerCase();
  if (q.length < 2) { box.appendChild(ce("div", "search-status", q ? "Keep typing\u2026" : "Search TV channels, movies and shows.")); return; }
  var groups = { live: [], movies: [], series: [] }, seen = {};
  searchCats().forEach(function (c) {
    var arr = cache[c.type + ":" + c.id]; if (!arr) return;
    var g = groups[c.type]; if (g.length >= 40) return;
    for (var i = 0; i < arr.length && g.length < 40; i++) {
      var it = arr[i], key = c.type + it.id;
      if (!seen[key] && it.n.toLowerCase().indexOf(q) >= 0) { seen[key] = 1; g.push(it); }
    }
  });
  ["movies", "series", "live"].forEach(function (t) {
    var items = groups[t]; if (!items.length) return;
    var info = T[t], ln = ce("div", "sline" + (t === "live" ? " lv" : ""));
    ln.appendChild(ce("div", "rtitle", info.label + "  (" + items.length + (items.length >= 40 ? "+" : "") + ")"));
    var tr = ce("div", "track"); ln.appendChild(tr);
    var els = items.map(function (it, i) { var c = cardEl(it, info.card, i, info.pitch); tr.appendChild(c); return c; });
    box.appendChild(ln);
    S.res.push({ el: ln, track: tr, items: items, els: els, col: 0, off: 0, info: info });
  });
  if (!S.res.length) box.appendChild(ce("div", "search-status", S.done < S.total ? "No matches yet \u2013 still indexing\u2026" : "No matches for \u201c" + S.q + "\u201d"));
  if (S.pane === "res") { if (!S.res.length) S.pane = "kbd"; if (S.rl >= S.res.length) S.rl = 0; if (V.zone === "search" && !D.open && !P.open) searchFocus(); }
}
function searchFocus() {
  if (S.pane === "kbd") { var line = S.kLines[S.kl]; if (S.kc >= line.length) S.kc = line.length - 1; setF(line[S.kc]); $("search-results").style.transform = ""; return; }
  var r = S.res[S.rl]; if (!r) { S.pane = "kbd"; searchFocus(); return; }
  if (r.col >= r.items.length) r.col = r.items.length - 1;
  setF(r.els[r.col]);
  var vis = r.info.vis - 2;
  if (r.col < r.off + 1) r.off = Math.max(0, r.col - 1); else if (r.col > r.off + vis - 2) r.off = r.col - (vis - 2);
  r.track.style.transform = "translateX(" + (-r.off * r.info.pitch) + "px)";
  $("search-results").style.transform = "translateY(" + Math.min(0, -(r.el.offsetTop - 0)) + "px)";
}
function typeKey(ch) {
  if (ch === "DEL") S.q = S.q.slice(0, -1); else if (ch === "CLR") S.q = ""; else if (S.q.length < 30) S.q += ch;
  renderQ(); clearTimeout(S.timer); S.timer = null; schedule();
}
function searchKey(k) {
  if (V.zone !== "search") { if (k === "down" || k === "enter") { V.zone = "search"; S.pane = "kbd"; searchFocus(); } return; }
  if (S.pane === "kbd") {
    var line = S.kLines[S.kl];
    if (k === "left") { if (S.kc > 0) S.kc--; }
    else if (k === "right") { if (S.kc < line.length - 1) S.kc++; else if (S.res.length) { S.pane = "res"; } }
    else if (k === "up") { if (S.kl > 0) { var f = S.kc / line.length; S.kl--; S.kc = Math.min(S.kLines[S.kl].length - 1, Math.round(f * S.kLines[S.kl].length)); } else { V.zone = "nav"; applyFocus(); return; } }
    else if (k === "down") { if (S.kl < S.kLines.length - 1) { var f2 = S.kc / line.length; S.kl++; S.kc = Math.min(S.kLines[S.kl].length - 1, Math.floor(f2 * S.kLines[S.kl].length)); } }
    else if (k === "enter") { typeKey(line[S.kc]._ch); }
    else if (k === "back") { if (S.q) { S.q = ""; renderQ(); runSearch(); } else { V.zone = "nav"; applyFocus(); return; } }
    searchFocus(); return;
  }
  var r = S.res[S.rl];
  if (k === "left") { if (r.col > 0) r.col--; else S.pane = "kbd"; }
  else if (k === "right") { if (r.col < r.items.length - 1) r.col++; }
  else if (k === "up") { if (S.rl > 0) S.rl--; }
  else if (k === "down") { if (S.rl < S.res.length - 1) S.rl++; }
  else if (k === "back") { S.pane = "kbd"; }
  else if (k === "enter") { activate(r.items[r.col], r.items, r.col); return; }
  searchFocus();
}

/* ================= keys ================= */
function keyName(e) {
  var c = e.keyCode || e.which;
  var map = { 37: "left", 38: "up", 39: "right", 40: "down", 13: "enter", 10009: "back", 27: "back", 8: "back", 415: "play", 19: "pause", 10252: "playpause", 413: "stop", 417: "ff", 412: "rw" };
  if (map[c]) return map[c];
  var km = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Enter: "enter", Escape: "back", GoBack: "back", Back: "back", XF86Back: "back" };
  return km[e.key] || null;
}
function exitApp() { try { tizen.application.getCurrentApplication().exit(); } catch (e) {} }
document.addEventListener("keydown", function (e) {
  var a = document.activeElement;
  if (a && a.tagName === "INPUT") {
    var c = e.keyCode;
    if (c === 65376 || c === 65385 || c === 38 || c === 40 || c === 10009 || c === 27) { // IME done/cancel or leaving the field
      a.blur(); e.preventDefault();
      if (c === 38 || c === 40) settingsKey(c === 38 ? "up" : "down");
      return;
    }
    return; // let the field handle typing / cursor
  }
  var k = keyName(e);
  if (!k) return;
  e.preventDefault();
  if (P.open) {
    if (k === "play" || k === "pause" || k === "playpause") { togglePause(); return; }
    if (k === "stop") { closePlayer(); return; }
    if (k === "ff") { seek(30000); return; }
    if (k === "rw") { seek(-10000); return; }
    playerKey(k); return;
  }
  if (k === "play" || k === "pause" || k === "playpause" || k === "stop" || k === "ff" || k === "rw") return;
  if (!booted) return;
  if (D.open) { detailsKey(k); return; }
  if (ST.open) { settingsKey(k); return; }
  mainKey(k);
}, true);

/* ================= boot ================= */
var booted = false;
function loadAllCats() {
  return Promise.all([api(T.live.catA, "", 30000), api(T.movies.catA, "", 30000), api(T.series.catA, "", 30000)]).then(function (r) {
    cats.live = procCats("live", r[0]); cats.movies = procCats("movies", r[1]); cats.series = procCats("series", r[2]);
    if (!cats.live.length && !cats.movies.length && !cats.series.length) throw new Error("empty");
  });
}
function tick() { var d = new Date(), h = d.getHours(), m = d.getMinutes(); $("clock").textContent = ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " AM" : " PM"); }
tick(); setInterval(tick, 20000);
var t0 = Date.now();
function boot() {
  loadAllCats().then(function () {
    var wait = Math.max(0, 1600 - (Date.now() - t0));
    setTimeout(function () {
      $("splash").classList.add("hidden");
      booted = true;
      V.navIdx = TAB_VIEWS.indexOf(settings.view);
      buildView(settings.view);
      V.zone = "nav"; applyFocus();
      // move into content once something loaded
      var tries = 0, iv = setInterval(function () {
        tries++;
        if (V.zone !== "nav" || ST.open || D.open || P.open || V.view === "search") { clearInterval(iv); return; }
        if ((V.heroOn && V.hero) || (!V.heroOn && V.rows[0] && V.rows[0].items)) { clearInterval(iv); enterContent(); }
        else if (tries > 40) clearInterval(iv);
      }, 250);
    }, wait);
  }).catch(function () {
    $("splash-msg").textContent = "Can't reach your provider. Retrying\u2026";
    setTimeout(boot, 5000);
  });
}
try { window.focus(); } catch (e) {}
boot();
})();
