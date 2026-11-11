/* NickFlix v4 - core: helpers, account, provider API, parsing, cache */
"use strict";
function $(id) { return document.getElementById(id); }
function ce(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

/* ---------- account (global, shared by all profiles) ---------- */
var NFC = (typeof NF_CONFIG === "object" && NF_CONFIG) || {};
var ACC_DEF = { server: NFC.server || "", username: NFC.username || "", password: NFC.password || "" };   // set in js/config.js (see config.example.js)
var account = (function () {
  var a = lsGet("nf_account", null);
  if (!a) {
    var o = lsGet("nickflix_settings_v1", null) || lsGet("ibootv_settings", null) || {};
    a = { server: o.server || ACC_DEF.server, username: o.username || ACC_DEF.username, password: o.password || ACC_DEF.password };
  }
  return a;
})();
function saveAccount() { lsSet("nf_account", account); }

/* ---------- provider API ---------- */
var T = {
  live:   { api: "live",   catA: "get_live_categories",   itemA: "get_live_streams", label: "TV",     card: "l", pitch: 354, rowH: 372, vis: 5 },
  movies: { api: "vod",    catA: "get_vod_categories",    itemA: "get_vod_streams",  label: "Movies", card: "p", pitch: 264, rowH: 505, vis: 7 },
  series: { api: "series", catA: "get_series_categories", itemA: "get_series",       label: "Shows",  card: "p", pitch: 264, rowH: 505, vis: 7 }
};
function apiURL(action, extra) {
  return account.server.replace(/\/+$/, "") + "/player_api.php?username=" + encodeURIComponent(account.username) +
    "&password=" + encodeURIComponent(account.password) + "&action=" + action + (extra ? "&" + extra : "");
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

/* ---------- language / region codes ---------- */
var LANG_NAMES = { EN: "English", US: "USA", CA: "Canada", UK: "United Kingdom", MULTI: "Multi-language", FR: "French", AR: "Arabic", BE: "Belgium",
  SE: "Sweden", DK: "Denmark", NO: "Norway", FI: "Finland", IC: "Iceland", AF: "Africa", EU: "Europe (mixed)", ES: "Spain", DE: "Germany",
  NOW: "Germany (Sky/WOW)", CH: "Switzerland / China", AT: "Austria", SW: "Switzerland", PT: "Portugal", IT: "Italy", NL: "Netherlands", PL: "Poland",
  MA: "Malta / Malaysia", TR: "Turkey", RO: "Romania", HU: "Hungary", GR: "Greece", CY: "Cyprus", CZ: "Czechia", AZ: "Azerbaijan",
  AM: "Armenia", ISL: "Israel", ISR: "Israel (Hebrew)", SL: "Hebrew (SL)", RU: "Russia", BG: "Bulgaria", UA: "Ukraine", LV: "Latvia",
  EST: "Estonia", LT: "Lithuania", EX: "Ex-Yugoslavia", SLO: "Slovakia", AL: "Albania", LAT: "Latin America", ME: "Montenegro",
  IR: "Iran (Persian)", KD: "Kurdistan", KU: "Kurdish (Sorani)", AS: "South Asia", SN: "Singapore", PH: "Philippines", TH: "Thailand", VT: "Vietnam",
  VE: "Vietnam (VE)", SR: "Sri Lanka", IN: "India", KO: "Korea", KR: "Korea (KR)", JP: "Japan", TW: "Taiwan", CN: "China",
  AU: "Australia", AUS: "Australia (AUS)", NZ: "New Zealand", PK: "Pakistan", BR: "Brazil", SC: "Nordic", NORDEC: "Nordic kids",
  PPV: "PPV events (worldwide)", "4K": "4K / UHD", ADULT: "Adult (18+)" };
var REGIONS = [
  ["Canada", ["CA"]], ["USA", ["US"]], ["UK & Ireland", ["UK"]],
  ["International / English", ["EN", "MULTI", "PPV", "EU", "4K"]],
  ["Western Europe", ["FR", "BE", "DE", "NOW", "AT", "SW", "CH", "NL", "IT", "ES", "PT", "MA"]],
  ["Nordic", ["SE", "DK", "NO", "FI", "IC", "SC", "NORDEC"]],
  ["Eastern Europe & Turkey", ["PL", "RO", "HU", "GR", "CY", "CZ", "RU", "BG", "UA", "LV", "EST", "LT", "EX", "SLO", "AL", "ME", "AZ", "AM", "TR"]],
  ["Latin America", ["LAT"]], ["Brazil", ["BR"]],
  ["Middle East & Arabic", ["AR", "IR", "KD", "KU", "ISL", "ISR", "SL"]],
  ["Africa", ["AF"]],
  ["East Asia", ["KO", "KR", "JP", "TW", "CN"]],
  ["South Asia", ["AS", "IN", "PK", "SR"]],
  ["Southeast Asia", ["PH", "TH", "VT", "VE", "SN"]],
  ["Oceania", ["AU", "AUS", "NZ"]]
];
var CODE_REGION = {};
REGIONS.forEach(function (r) { r[1].forEach(function (c) { CODE_REGION[c] = r[0]; }); });
function regionOf(code) { return CODE_REGION[code] || "Other"; }

function catCode(raw) {
  var s = String(raw || "");
  if (/^\s*(XXX|\|?\+18)/i.test(s)) return "ADULT";
  var m = s.match(/^\s*[|\u2503]?\s*([A-Za-z0-9+\-]{2,7})\s*[|\u2503]/);
  if (!m) return "MULTI";
  var c = m[1].toUpperCase();
  if (c === "EX-YU") c = "EX";
  if (c === "+18") c = "ADULT";
  return c;
}
var ACR = { TV: 1, HD: 1, UHD: 1, FHD: 1, SD: 1, HBO: 1, NBA: 1, NFL: 1, NHL: 1, MLB: 1, UFC: 1, WWE: 1, PPV: 1, BBC: 1, CNN: 1, US: 1, UK: 1, USA: 1,
  DAZN: 1, ESPN: 1, TNT: 1, RMC: 1, MBC: 1, OSN: 1, TOD: 1, DSTV: 1, VIP: 1, EPL: 1, UEFA: 1, IMDB: 1, IMAX: 1, NCAAF: 1, NCAAB: 1, BTN: 1, F1: 1,
  ZDF: 1, ARD: 1, NPO: 1, RTL: 1, MTV: 1, TV2: 1, TV4: 1, SEC: 1, AFL: 1, NRL: 1, ECB: 1, PDC: 1, EFL: 1, SPFL: 1, VF: 1, VO: 1, VOST: 1, BET: 1, AHL: 1, OHL: 1, CBC: 1, CFL: 1, WNBA: 1, MLS: 1, ATP: 1, BKT: 1, CAM: 1 };
function niceWord(w) {
  if (!w) return w;
  var u = w.toUpperCase();
  if (ACR[u.replace(/[^A-Z0-9]/g, "")] || /\d/.test(w) || /\+$/.test(w) && w.length <= 4) return u;
  if (w !== u) return w;
  return u.charAt(0) + u.slice(1).toLowerCase();
}
/* ---------- Quebec / French-Canadian and adult detection ---------- */
var QC_CAT_RE = /QU[E\u00c9]BEC|\bQC\b|\bVFQ\b/;
var QC_CH_RE = /QU[E\u00c9]BEC|\bTVA\b|NOOVO|\bRDS\b|\bRDI\b|RADIO[- ]?CANADA|\bICI\b|\bTV5\b|\bUNIS(?: ?TV)?\b|VRAK|\bZ ?T[E\u00c9]L[E\u00c9]\b|CANAL ?D\b|CANAL ?VIE|CANAL ?SAVOIR|S[E\u00c9]RIES ?\+|HISTORIA|\bLCN\b|SUPER ?[E\u00c9]CRAN|ILLICO|\bCASA\b|[E\u00c9]VASION|PRISE 2|ADDIK|MOI ?(?:&|ET) ?CIE|YOOPA|T[E\u00c9]L[E\u00c9]TOON LA|PLAN[E\u00c8]TE ?\+|\bTFO\b|MUSIQUEPLUS|\bARTV\b|EXPLORA|M[E\u00c9]T[E\u00c9]OM[E\u00c9]DIA|CIN[E\u00c9]POP|AMI[- ]T[E\u00c9]L[E\u00c9]|T[E\u00c9]L[E\u00c9]MAGINO|\bMAX TV\b(?=.*\bFR\b)/;
var QC_PREFIX_RE = /\|\s*CA\s*\|\s*FR\s*\||\bCA[- ]FR\b|\bFR[- ]CA\b/;
var ADULT_CAT_RE = /^\s*XXX|\+18|18\+|\bADULTS?\b(?! ?SWIM)|\bXXX\b|PORN|HANIME/;
/* a live channel is "Quebec" when it sits in a Canadian group and is French-language (never TSN shared feeds or game listings) */
function isQCChannel(name, code) {
  var u = String(name || "").toUpperCase();
  if (code !== "CA") return false;
  if (/\bTSN\b|@| VS\.? | V /.test(u)) return false;
  return QC_PREFIX_RE.test(u) || QC_CH_RE.test(u);
}
function isQCTitle(name) { return /\[(?:QC|VFQ)\]|\((?:QC|VFQ)\)|\bVFQ\b/i.test(String(name || "")); }
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
  s = s.replace(/^[|\u2503\s]*(?:[A-Z]{2,3}(?:-[A-Z0-9]{1,3})?|\+18|4K)\s*(?:[|\u2503:]|\s-\s|-\s)\s*/, "");
  if ((s.match(/[A-Za-z0-9]\.[A-Za-z0-9]/g) || []).length >= 2 || (s.indexOf(" ") < 0 && /\w\.\w/.test(s))) s = s.replace(/([A-Za-z0-9])\.(?=[A-Za-z0-9])/g, "$1 ");
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
/* Live channel group types (one per category, first match wins) */
var LIVE_TYPES = [
  ["24/7 channels", /24\/7|24H|24-7/],
  ["PPV & Events", /PPV|EVENT|REPLAY|\bPASS\b|FIGHT|\bUFC\b|BOXING|\bWWE\b|OXING|TRILLER/],
  ["Sports", /SPORT|\bNBA\b|\bNFL\b|\bNHL\b|\bMLB\b|MILB|NCAA|SOCCER|FOOTBALL|FOOTBBALL|FUSSBALL|LIGA|LIGUE|LEAGUE|BUNDESLIGA|CALCIO|TENNIS|GOLF|RUGBY|CRICKET|\bF1\b|DAZN|ESPN|BEIN|\bTSN|SPORTSNET|DEPORTES|ESPORTES|ATHL|RACING|GARROS|HOCK|BALONCESTO|MOTO GP|\bFLO|\bAFL\b|\bNRL\b|WNBA|\bMLS\b|SEC NETWORK|BTN|FANDUEL|BALLY|EUROSPORT|ELEVEN|\u0391\u0398\u039b\u0397\u03a4\u0399\u039a\u0391|SERIE A|COPA|UEFA|FIFA|\bEPL\b|PREMIER LEAGUE|SUPER LEAGUE|\bAHL\b|\bOHL\b|\bWHL\b|QMJH|\bCFL\b|PEACOCK|EQUIDIA|RMC|TABII|EXXEN|LALIGA|AL KASS|SPORTI/],
  ["News", /NEWS|INFOS|HABER|NACHRICHT|ALJAZEERA|NOTICIAS/],
  ["Kids", /KID|KINDER|JEUNESSE|NI\u00d1OS|NINOS|BAMBINI|COCUK|DETSA|COPII|DJECIJA|FEMIJE|ENFANT|CRIAN|\u03a0\u0391\u0399\u0394\u0399\u039a\u0391/],
  ["Movie channels", /CINEMA|MOVIE|MOVIS|FILM|KINO|SINEMA|BOX OFFICE|CINE|KINEMA|\u039a\u0399\u039d\u0397\u039c\u0391\u03a4\u039f\u0393\u03a1\u0391\u03a6\u039f\u03a3|PRIMAFILA|SKY STORE|DREAM/],
  ["Documentary", /DOC|DOKU|BELGESEL|DECOUVERTE|DISCOVERY|KULTURA/],
  ["Music", /MUSI|MUZI|\u039c\u039f\u03a5\u03a3\u0399\u039a\u0397|SPOTIFY|CLUBBER/],
  ["Radio", /RADIO/],
  ["Religious", /ISLAM|QURAN|\u0627\u0644\u0642\u0640*\u0631\u0622?\u0646|\u0645\u0633\u064a\u062d\u064a\u0629|\bDIN\b|RAMADAN|\u0642\u0640+\u0635/],
  ["Local channels", /LOCAL|REGIONAL|AUTONOM|YEREL|REGIONALI/],
  ["Entertainment & general", /./]
];
function liveType(up) { for (var i = 0; i < LIVE_TYPES.length; i++) if (LIVE_TYPES[i][1].test(up)) return LIVE_TYPES[i][0]; return "Entertainment & general"; }
function detect(list, up) { var out = []; for (var i = 0; i < list.length; i++) if (list[i][1].test(up)) out.push(list[i][0]); return out; }

/* ---------- categories + item cache ---------- */
var cats = { live: [], movies: [], series: [] };
var catById = {};
var cache = {}, inflight = {};
function procCats(type, arr) {
  var out = [];
  (Array.isArray(arr) ? arr : []).forEach(function (c, i) {
    if (!c || c.category_id == null) return;
    var raw = String(c.category_name || ""), up = raw.toUpperCase();
    var g = detect(GENRES, up), s = detect(SOURCES, up);
    var o = { id: String(c.category_id), type: type, raw: raw, up: up, code: catCode(raw), title: cleanCat(raw), order: i,
      genres: g.length ? g : ["General"], sources: s.length ? s : ["Other"] };
    if (type === "live") o.ltype = liveType(up);
    if (o.code === "ADULT" || ADULT_CAT_RE.test(up)) { o.adult = true; o.code = "ADULT"; }
    if (QC_CAT_RE.test(up)) o.qc = true;
    catById[type + ":" + o.id] = o;
    out.push(o);
  });
  return out;
}
function yearOf(s) { var m = String(s || "").match(/\((\d{4})\)/) || String(s || "").match(/\b(19\d\d|20\d\d)\b/); return m ? m[1] : ""; }
function stripTitle(n) { return n.replace(/\s*\(\s*-?\d{4}\s*\)\s*/, " ").replace(/\s+/g, " ").trim(); }
function slim(type, it, catId) {
  var cc = catById[type + ":" + catId];
  if (type === "live") { var o = { t: type, id: it.stream_id, n: cleanName(it.name), ic: it.stream_icon || "", c: catId }; if (it.is_adult == 1 || (cc && cc.adult)) o.ad = true; if (it.epg_channel_id) o.e = 1; if ((cc && cc.qc) || isQCChannel(it.name, cc ? cc.code : "")) o.qc = 1; return o; }
  var mv = slimV(type, it, catId);
  if (cc && cc.adult) mv.ad = true;
  if ((cc && cc.qc) || isQCTitle(it.name)) mv.qc = 1;
  return mv;
}
function slimV(type, it, catId) {
  if (type === "movies") return { t: type, id: it.stream_id, n: stripTitle(cleanName(it.name)), y: yearOf(it.name), ic: it.stream_icon || "",
    ext: it.container_extension || "mp4", r: parseFloat(it.rating) || 0, a: +it.added || 0, tm: it.tmdb ? String(it.tmdb) : "", ad: it.is_adult == 1 || undefined, c: catId };
  var bd = Array.isArray(it.backdrop_path) ? it.backdrop_path[0] : (typeof it.backdrop_path === "string" ? it.backdrop_path : "");
  return { t: type, id: it.series_id, n: stripTitle(cleanName(it.name)), y: String(it.releaseDate || it.release_date || "").slice(0, 4) || yearOf(it.name),
    ic: it.cover || "", plot: it.plot || "", genre: it.genre || "", r: parseFloat(it.rating) || 0, a: +it.last_modified || 0,
    bd: bd || "", cast: it.cast || "", dir: it.director || "", tm: it.tmdb ? String(it.tmdb) : "", c: catId };
}
function loadCat(c) {
  var key = c.type + ":" + c.id;
  if (cache[key]) return Promise.resolve(cache[key]);
  if (inflight[key]) return inflight[key];
  var p = api(T[c.type].itemA, "category_id=" + encodeURIComponent(c.id), 45000).then(function (arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (it) { if (it && it.name) out.push(slim(c.type, it, c.id)); });
    cache[key] = out; delete inflight[key]; return out;
  }, function (e) { delete inflight[key]; throw e; });
  inflight[key] = p;
  return p;
}
function loadAllCats() {
  return Promise.all([api(T.live.catA, "", 30000), api(T.movies.catA, "", 30000), api(T.series.catA, "", 30000)]).then(function (r) {
    catById = {};
    cats.live = procCats("live", r[0]); cats.movies = procCats("movies", r[1]); cats.series = procCats("series", r[2]);
    if (!cats.live.length && !cats.movies.length && !cats.series.length) throw new Error("empty");
  });
}
function itemKey(it) { return it.t + ":" + it.id; }
function normTitle(it) {
  if (it.tm && it.tm !== "0") return "tm" + it.t + it.tm;
  return it.t + String(it.n).toLowerCase().replace(/\b(4k|uhd|fhd|hd|sd|multi|vf|vo|vostfr|1080p|720p|hevc|3d|imax)\b/g, "").replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff]+/g, "") + (it.y || "");
}
