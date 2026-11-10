/* NickFlix v4 - TV sub-categories (country pages, networks), Adult (18+) section, extra channels from other countries */
"use strict";
var XT = {};   // id -> {label} for pages opened from dynamic tiles

/* ---------- per-channel genre (used for country sub-categories and extra channels) ---------- */
var RE_NEWS = /NEWS|\bCNN\b|MSNBC|\bMS NOW\b|CNBC|BLOOMBERG|\bBNN\b|C-?SPAN|\bCPAC\b|NEWSMAX|NEWS ?NATION|WEATHER|\bCP24\b|\bDW\b|EURONEWS|FRANCE 24|AL ?JAZEERA|\bWELT\b(?! DER)|\bN-?TV\b|\bPHOENIX\b|PARLIAMENT|\bLBC\b/;
var RE_SPORT = /SPORT|ESPN|\bTSN|SPORTSNET|\bNFL\b|\bNBA\b|\bNHL\b|\bMLB\b|GOLF|TENNIS|\bFS[12]\b|SOCCER|\bBTN\b|SEC NETWORK|ACC NETWORK|BIG TEN|EUROSPORT|BEIN|DAZN|RACING|\bSPEED\b|OUTDOOR|FIGHT|\bWWE\b|\bUFC\b|STADIUM|\bMSG\b|NESN|MARQUEE|YES NETWORK|ALTITUDE|\bSNY\b|RED BULL|FUBO|PAC-?12|WILLOW|CRICKET|\bPGA\b|\bF1\b|MOTOR|\bTNT\b ?SPORTS|PREMIER LEAGUE|\bEFL\b|RUGBY|DARTS|SNOOKER|ONE ?FC|PADEL/;
var RE_KIDS = /DISNEY ?(JR|JUNIOR|XD|CHANNEL|KIDS)|\bNICK|CARTOON|BOOMERANG|BABY|TREEHOUSE|\bYTV\b|CBEEBIES|CBBC|\bPOP\b|TINY POP|PBS KIDS|UNIVERSAL KIDS|DUCK ?TV|TELETOON|KIDS|\bKIKA\b|SUPER RTL|TOGGO|JUNIOR|FAMILY JR|LITTLE BABY|PLAY KIDZ|CARTOONITO|SPONGEBOB|PAW PATROL|PEPPA/;
var RE_MOVIES = /\bHBO|SHOWTIME|STARZ|CINEMAX|MOVIE|CINEMA|\bTCM\b|\bAMC\b|\bIFC\b|FLIX|\bEPIX\b|\bMGM|SUNDANCE|CRAVE|\bFILM|HOLLYWOOD|SUPER CHANNEL|\bTMC\b|ENCORE|\bLMN\b|KINO|SONY MAX|SKY CINEMA|TALKING PICTURES|GREAT! ?MOVIES|LEGEND/;
var RE_DOCS = /DISCOVERY|HISTORY|NAT ?GEO|NATIONAL GEOGRAPHIC|SCIENCE|ANIMAL PLANET|SMITHSONIAN|DOCU|DOKU|INVESTIGATION|\bID\b|CRIME|DESTINATION AMERICA|\bAHC\b|MILITARY|CURIOSITY|YESTERDAY|\bQUEST\b|BLAZE|\bDMAX\b|BBC EARTH|SPIEGEL|ZDF ?INFO|\bARTE\b|WELT DER WUNDER|\bVICE\b|LOVE NATURE|\bDOCS?\b|KNOWLEDGE|\bTVO\b|SKY HISTORY|SKY NATURE|EXPLORE|NATURE/;
var RE_MUSIC = /\bMTV|\bVH1|\bCMT\b|\bBET\b|MUSIC|MUSIK|\bMUCH|STINGRAY|CLUBBER|REVOLT|\bAXS|VEVO|XITE|RADIO|\bKISS\b|BOX HITS|CLUBLAND|\bHITS\b|\bJUKEBOX/;
var RE_LIFE = /FOOD|HGTV|\bTLC\b|COOKING|TRAVEL|\bDIY\b|MAGNOLIA|BRAVO|\bE!|LIFETIME|\bOWN\b|W NETWORK|SLICE|HOME|GARDEN|STYLE|FASHION|COTTAGE|GAME SHOW|\bGSN\b|HALLMARK|\bQVC|\bHSN\b|SHOP|REALLY|WEDDING|TASTEMADE|\bFYI\b|GUSTO|HAUS|COOK|KITCHEN|MAKEFUL|OXYGEN/;
function nameSub(u) {
  if (RE_NEWS.test(u)) return "News"; if (RE_SPORT.test(u)) return "Sports"; if (RE_KIDS.test(u)) return "Kids";
  if (RE_DOCS.test(u)) return "Documentary"; if (RE_MOVIES.test(u)) return "Movies"; if (RE_MUSIC.test(u)) return "Music"; if (RE_LIFE.test(u)) return "Lifestyle";
  return "";
}
function chanSub(ch, c) {
  c = c || chanCat(ch); var lt = c ? c.ltype : "", u = ch.up || String(ch.n).toUpperCase();
  if (lt === "PPV & Events") return "PPV & Events";
  if (lt === "24/7 channels") return "24/7";
  if (lt === "Local channels") return "Local";
  if (lt === "Sports") return "Sports";
  if (lt === "Kids") return "Kids";
  if (lt === "Movie channels") return RE_DOCS.test(u) ? "Documentary" : "Movies";
  if (lt === "Documentary") return "Documentary";
  if (lt === "Music" || lt === "Radio") return "Music";
  if (lt === "News") { var n = nameSub(u); return n && n !== "News" && !RE_NEWS.test(u) ? n : "News"; }
  return nameSub(u) || "Entertainment";
}
var SUBS = [["Sports", "sports"], ["News", "news"], ["Entertainment", "ent"], ["Movies", "movies"], ["Kids", "kids"], ["Documentary", "docs", "Documentary & Factual"],
  ["Music", "music"], ["Lifestyle", "life", "Lifestyle & Food"], ["Local", "local", "Local & Regional"], ["24/7", "247", "24/7 Non-Stop"], ["PPV & Events", "ppv", "PPV & Events"]];
var COUNTRY = { CA: "Canadian", US: "American", UK: "British" };
var NETS = {
  UK: [["BBC", /\bBBC\b|CBBC|CBEEBIES/, "#1a1a1a"], ["ITV", /\bITV/, "#00a99d"], ["Channel 4", /CHANNEL 4|\bE4\b|MORE ?4|FILM ?4|4 ?SEVEN|4 ?MUSIC/, "#6c2c91"],
    ["Channel 5", /CHANNEL 5|^5 ?(USA|STAR|ACTION|SELECT)\b|\b5USA\b|\b5STAR\b/, "#e3002b"], ["Sky", /\bSKY\b/, "#0b3fa8"]],
  US: [["ABC", /\bABC\b/, "#111111", 1], ["CBS", /\bCBS\b/, "#1a1a6e", 1], ["NBC", /\bNBC\b/, "#6b2b9e", 1], ["FOX", /\bFOX\b/, "#003a70", 1], ["PBS", /\bPBS\b/, "#2638c4", 1],
    ["CW & other locals", null, "#3a3a46", 1]],
  CA: [["CBC", /\bCBC\b/, "#d40000"], ["CTV", /\bCTV\b/, "#0055a5"], ["Global", /\bGLOBAL\b/, "#1e64c8"], ["Citytv", /\bCITY ?(TV|NEWS)\b|\bCITYTV\b/, "#0096d6"]]
};
function countryChannels(code) {
  return (CH.all || []).filter(function (ch) { var c = chanCat(ch); return c && c.code === code && chanOK(ch) && itemOK(ch); });
}
function dedupeBest(list, max) {
  var by = {}, out = [];
  list.forEach(function (ch) {
    var k = String(ch.n).toUpperCase().replace(/[\u1D00-\u1DBF\u02B0-\u02FF]+/g, "").replace(/\b(FHD|UHD|HD|SD|4K|HEVC|RAW|BACKUP|1080P?|720P?)\b/g, "").replace(/[^A-Z0-9]/g, "") || String(ch.id), s = qualityBonus(ch) + learnScore("ch", String(ch.id)) * 0.2 + (logoFor(ch) ? 0.4 : 0);
    if (!by[k] || by[k].s < s) by[k] = { ch: ch, s: s };
  });
  for (var k in by) out.push(by[k]);
  out.sort(function (a, b) { return b.s - a.s; });
  return out.slice(0, max || 400).map(function (x) { return x.ch; });
}
function netMatch(code, net, ch) {
  var c = chanCat(ch), u = ch.up;
  if (net[3]) {   // US networks: local affiliates only
    if (!c || c.ltype !== "Local channels") return false;
    if (!net[1]) return !NETS.US.some(function (n) { return n[1] && n[1].test(u); });
  }
  return net[1].test(u);
}
function loadingSpec(id, label) {
  return [{ title: "Loading " + label + "\u2026", kind: "l", load: function () { return ensureIndex().then(function () { setTimeout(function () { if (V.page && V.page.id === id && !OV.top() && !P.open) { buildView("live"); V.zone = "rows"; V.r = 0; applyFocus(); } }, 0); return []; }); } }];
}
function groupRowsSpec(filt) {
  // one row per provider group, computed lazily once the index is ready
  var specs = [];
  var groups = {};
  (CH.all || []).forEach(function (ch) { if (filt(ch)) (groups[ch.c] = groups[ch.c] || []).push(ch); });
  var ids = Object.keys(groups).sort(function (a, b) { var ca = catById["live:" + a], cb = catById["live:" + b]; return (liveRank(ca) - liveRank(cb)) || (ca.order - cb.order); });
  ids.forEach(function (id) {
    var c = catById["live:" + id], list = groups[id];
    specs.push({ title: c.title, badge: c.code !== "MULTI" ? c.code : "", tag: c.ltype, count: true, kind: "l", local: true, load: function () { return Promise.resolve(dedupeBest(list, 400)); } });
  });
  return specs;
}
function subTile(code, s, n) {
  var id = "sub:" + code + ":" + s[0]; XT[id] = { label: COUNTRY[code] + " \u203A " + (s[2] || s[0]) };
  return { t: "tile", id: id, n: s[2] || s[0], sub: n + (n === 1 ? " channel" : " channels"), img: "img/tiles/" + s[1] + ".jpg" };
}
function netTile(code, net, n) {
  var id = "net:" + code + ":" + net[0]; XT[id] = { label: COUNTRY[code] + " \u203A " + net[0] };
  return { t: "tile", id: id, n: net[0], sub: n + " channels", col: net[2] };
}
function countrySpecs(code) {
  if (!CH.all) return loadingSpec("c:" + code, COUNTRY[code] + " channels");
  var all = countryChannels(code), cnt = {}, tiles = [], nets = [];
  all.forEach(function (ch) { var s = chanSub(ch); cnt[s] = (cnt[s] || 0) + 1; });
  var mx = learnMax("sub") || 1;
  SUBS.forEach(function (s, i) { if (cnt[s[0]]) { var t = subTile(code, s, cnt[s[0]]); t.score = 20 - i + 15 * learnScore("sub", s[0]) / mx; tiles.push(t); } });
  tiles.sort(function (a, b) { return b.score - a.score; });
  (NETS[code] || []).forEach(function (net) { var n = all.filter(function (ch) { return netMatch(code, net, ch); }).length; if (n) nets.push(netTile(code, net, n)); });
  var rows = tileRows(tiles, "Browse " + COUNTRY[code] + " TV");
  if (nets.length) rows = rows.concat(tileRows(nets, code === "US" ? "Local stations by network" : "Channels by network"));
  rows.push({ title: "Top " + COUNTRY[code] + " channels", kind: "l", epg: true, load: function () { return Promise.resolve(dedupeBest(all, 30)); } });
  return rows;
}
function subSpecs(id) {
  var p = id.split(":"), code = p[1], sub = p.slice(2).join(":");
  if (!CH.all) return loadingSpec(id, "channels");
  learnAdd("sub", sub, 0.3);
  var filt = function (ch) { var c = chanCat(ch); return c && c.code === code && chanOK(ch) && itemOK(ch) && chanSub(ch, c) === sub; };
  return [{ title: "Top picks", kind: "l", epg: true, load: function () { return ensureIndex().then(function () { return dedupeBest(CH.all.filter(filt), 30); }); } }].concat(groupRowsSpec(filt));
}
function netSpecs(id) {
  var p = id.split(":"), code = p[1], name = p.slice(2).join(":"), net = null;
  if (!CH.all) return loadingSpec(id, "channels");
  (NETS[code] || []).forEach(function (n) { if (n[0] === name) net = n; });
  if (!net) return [];
  var filt = function (ch) { var c = chanCat(ch); return c && c.code === code && chanOK(ch) && itemOK(ch) && netMatch(code, net, ch); };
  return [{ title: "Main " + name + " channels", kind: "l", epg: true, load: function () { return ensureIndex().then(function () { return dedupeBest(CH.all.filter(filt), 30); }); } }].concat(groupRowsSpec(filt));
}

/* ---------- Adult (18+) ---------- */
function adultCats(type) { return cats[type].filter(function (c) { return c.adult; }); }
function adultSpecs() {
  if (!adultOk()) return [];
  var live = adultCats("live").map(function (c) { var id = "acat:live:" + c.id; XT[id] = { label: "Adult \u203A " + c.title }; return { t: "tile", id: id, n: c.title, sub: "Live channels", col: "#3a0d1e" }; });
  var vod = adultCats("movies").concat(adultCats("series")).map(function (c) { var id = "acat:" + c.type + ":" + c.id; XT[id] = { label: "Adult \u203A " + c.title }; return { t: "tile", id: id, n: c.title, sub: c.type === "movies" ? "Movies" : "Series", col: "#2a1030" }; });
  var rows = [];
  if (live.length) rows = rows.concat(tileRows(live, "Adult live TV"));
  if (vod.length) rows = rows.concat(tileRows(vod, "Adult movies & series"));
  return rows;
}
function adultCatSpecs(id) {
  if (!adultOk()) return [];
  var p = id.split(":"), c = catById[p[1] + ":" + p[2]]; if (!c) return [];
  return [{ title: c.title, count: true, kind: c.type === "live" ? "l" : "p", load: function () { return loadCat(c).then(function (l) { return l.filter(itemOK); }); } }];
}

/* ---------- extra channels from other countries (per profile) ---------- */
var EXTRA_SUGGEST = [["DMAX", /^DMAX$/, [12595, 78477]], ["Discovery Channel", /^DISCOVERY( CHANNEL)?$/, [267892, 268082, 609]], ["Kabel Eins Doku", /^KABEL ?(EINS|1) DOKU$/], ["N24 Doku", /^N24 DOKU$/],
  ["WELT", /^(WELT|N24)$/], ["Sky Documentaries", /^SKY DOCUMENTARIES$/], ["National Geographic", /^(NATIONAL GEOGRAPHIC|NAT GEO)$/], ["History", /^(HISTORY|THE HISTORY CHANNEL)$/],
  ["ZDFinfo", /^ZDF ?INFO$/], ["Spiegel Geschichte", /^SPIEGEL GESCHICHTE$/], ["Animal Planet", /^ANIMAL PLANET$/], ["TLC", /^TLC$/]];
var GERMAN = { DE: 1, NOW: 1, AT: 1, SW: 1 };
function extraIds() { return Object.keys(PD.st.extra || {}); }
function bestGerman(sg) {
  if (!CH.all) return null;
  var pref = sg[2] || [], best = null, bs = -1e9;
  CH.all.forEach(function (ch) {
    var c = chanCat(ch); if (!c || !GERMAN[c.code] || ch.ad) return;
    var nm = logoName(ch.n).toUpperCase().replace(/\s+/g, " ").trim(); if (!sg[1].test(nm)) return;
    var s = (c.code === "DE" ? 2 : 0) + (/\u1D41\u1D34\u1D30|UHD|4K/.test(ch.n) ? 2 : /\u1D34\u1D30|FHD|\bHD\b/.test(ch.n) ? 1 : 0) + (ch.e ? 1 : 0);
    var pi = pref.indexOf(+ch.id); if (pi >= 0) s += 10 - pi;
    if (s > bs) { bs = s; best = ch; }
  });
  return best;
}
function setExtra(ch, on) {
  if (on) PD.st.extra[ch.id] = { n: ch.n, c: ch.c }; else delete PD.st.extra[ch.id];
  savePD(true);
}
/* first run for Nick: preselect DMAX + Discovery (best German versions) once the channel list is known */
function resolveExtraWant() {
  var want = PD.st.extraWant; if (!want || !CH.all) return;
  want.forEach(function (w) { EXTRA_SUGGEST.forEach(function (sg) { if (sg[0].toUpperCase().indexOf(w) === 0) { var b = bestGerman(sg); if (b) PD.st.extra[b.id] = { n: b.n, c: b.c }; } }); });
  delete PD.st.extraWant; savePD(true);
  if (V.view === "live" && !V.page && !OV.top() && !P.open) refreshLocalRows();
}
function extraChannels() {
  var out = [];
  extraIds().forEach(function (id) { var ch = chanById(id); if (ch) out.push(ch); else { var x = PD.st.extra[id]; out.push({ t: "live", id: +id, n: x.n, c: x.c, ic: "" }); } });
  return out;
}
function extraLabel() {
  var ids = extraIds(); if (!ids.length) return "";
  var de = ids.every(function (id) { var c = catById["live:" + PD.st.extra[id].c]; return c && GERMAN[c.code]; });
  return de ? "German Picks" : "Extra Channels";
}
function extraSpecs(sub) {
  return [{ title: (extraLabel() === "German Picks" ? "\uD83C\uDDE9\uD83C\uDDEA " : "") + (sub ? "Your extra " + sub.toLowerCase() + " channels" : "Your " + extraLabel()), kind: "l", epg: true, local: true, load: function () {
    var l = extraChannels(); if (sub) l = l.filter(function (ch) { return chanSub(ch) === sub || nameSub(ch.up || String(ch.n).toUpperCase()) === sub; });
    return Promise.resolve(l);
  } }];
}

/* ---------- wire into the v3 hub ---------- */
var TILE_SUB = { "t:Documentary": "Documentary", "t:Kids": "Kids", "t:Movie channels": "Movies", "t:Music": "Music", "t:Entertainment & general": "Entertainment", news: "News", sports: "Sports" };
var _pageSpecsV3 = pageSpecs;
pageSpecs = function (pg) {
  var id = pg.id;
  if (/^c:(CA|US|UK)$/.test(id)) return countrySpecs(id.slice(2));
  if (id.indexOf("sub:") === 0) return subSpecs(id);
  if (id.indexOf("net:") === 0) return netSpecs(id);
  if (id === "adult") return adultSpecs();
  if (id.indexOf("acat:") === 0) return adultCatSpecs(id);
  if (id === "extra") return extraSpecs("").concat([{ title: "Change your picks in Settings \u203A Extra channels", kind: "e", local: true, load: function () { return Promise.resolve([{ t: "action", id: "xset", n: "Pick channels from other countries", sub: "Germany and more \u2013 per profile", act: function () { openSettings(); stPage("extra"); } }]); } }]);
  var rows = _pageSpecsV3(pg);
  var sub = TILE_SUB[id];
  if (sub && extraIds().length) rows = extraSpecs(sub).concat(rows);
  return rows;
};
var _pageTitleV3 = pageTitle;
pageTitle = function () {
  if (V.page && !XT[V.page.id]) { var m = /^(sub|net):(\w+):(.+)$/.exec(V.page.id); if (m && COUNTRY[m[2]]) { var lb = m[3]; SUBS.forEach(function (s) { if (s[0] === m[3]) lb = s[2] || s[0]; }); XT[V.page.id] = { label: COUNTRY[m[2]] + " \u203A " + lb }; } }
  if (V.page && XT[V.page.id]) return XT[V.page.id].label; if (V.page && V.page.id === "adult") return "Adult (18+)"; if (V.page && V.page.id === "extra") return extraLabel() || "Extra Channels"; return _pageTitleV3(); };
