/* NickFlix v4.4 - finer Live TV sub-categories (niches) + per-profile "Favourite categories".
   Niches are classified from the channel name/brand on top of the v4.1 classifier (tvc.js).
   Favourites live in the profile record (profiles.list[i].fav) and are only a boost/pin:
   they never write watch history, and they combine with the learned order (learn.js / wh.js). */
"use strict";
var NICHES = [
  // [name, parent, regex on cleaned upper-case name, colour, extra parents allowed]
  ["Travel", "Lifestyle", /TRAVEL|GO ?TRAVELER|\bESCAPE\b|WANDERLUST|NATURESCAPE|\bVOYAGE/, "#0f7a8a", ["Entertainment", "Documentary"]],
  ["Food & Cooking", "Lifestyle", /FOOD|COOK|KITCHEN|TASTEMADE|GUSTO|\bCHEF|\bBAK(E|ING)\b/, "#a3461a", ["Entertainment"]],
  ["Home & DIY", "Lifestyle", /HGTV|\bDIY\b|MAGNOLIA|\bHOME\b|GARDEN|COTTAGE|MAKEFUL|HOBBYMAKER|CRAFT|RENOVAT|\bHAUS\b|THIS OLD HOUSE/, "#5a7d1e", ["Entertainment"]],
  ["Fashion & Beauty", "Lifestyle", /FASHION|\bSTYLE\b|BEAUTY|\bFTV\b|VOGUE|RUNWAY/, "#8a1f6b", ["Entertainment"]],
  ["Shopping", "Lifestyle", /\bQVC|\bHSN\b|SHOP|IDEAL WORLD|JEWELLERY|GEMPORIA/, "#6b5a1f", ["Entertainment"]],
  ["Nature & Wildlife", "Documentary", /NAT ?GEO ?WILD|NATIONAL GEOGRAPHIC WILD|ANIMAL|\bWILD|NATURE|BBC EARTH|\bEARTH\b|\bOCEAN|\bPETS?\b|\bZOO\b|SAFARI/, "#2f7a2a"],
  ["History", "Documentary", /HISTORY|\bH2\b|YESTERDAY|MILITARY|\bAHC\b|AMERICAN HEROES|\bWAR\b|HISTORIA/, "#7a5a2a"],
  ["Science & Tech", "Documentary", /SCIENCE|CURIOSITY|SMITHSONIAN|\bTECH|\bSPACE\b|\bNASA\b|KNOWLEDGE|MAGELLAN|DISCOVERY TURBO|VELOCITY|MOTOR ?TREND/, "#2a4f8a"],
  ["True Crime", "Documentary", /TRUE CRIME|\bCRIME\b|INVESTIGATION|^ID$|\bID\b|FORENSIC|MURDER|COURT ?TV|OXYGEN|\bA ?& ?E\b|REAL CRIME|DETECTIVE|HOMICIDE|\bCOPS\b|\bFBI\b|DATELINE|CBS REALITY/, "#7a1a1a", ["Entertainment"]],
  ["Comedy", "Entertainment", /COMEDY|^DAVE$|^U ?& ?DAVE$|^GOLD$|^U ?& ?GOLD$|\bLAFF\b|CATCHY|\bTV ?LAND\b|NICK AT NITE|ADULT SWIM|JUST FOR LAUGHS|\bTBS\b|\bFXX\b|SITCOM|FUNNY/, "#b8860b"],
  ["Reality", "Entertainment", /REALITY|\bBRAVO\b|^E!$|\bE! |\bTLC\b|\bWE ?TV\b|TRU ?TV|^REALLY$|QUEST RED|\bFYI\b|^OWN$|ITVBE|^PICK$|\bSLICE\b|LOVE ISLAND|BIG BROTHER|KARDASHIAN|HOUSEWIVES/, "#a0307a", ["Lifestyle"]],
  ["Drama", "Entertainment", /DRAMA|ALIBI|SKY ATLANTIC|SKY SHOWCASE|SKY WITNESS|\bSOAP|SUNDANCE|^TNT$|USA NETWORK|ACORN|BRITBOX|^W$|^U ?& ?W$|NOVELA|^SKY MAX$/, "#4a2a7a", ["Movies"]],
  ["Hockey", "Sports", /\bNHL|HOCKEY|\bAHL\b|\bOHL\b|\bWHL\b|\bKHL\b/, "#1e4f9c"],
  ["Soccer", "Sports", /SOCCER|PREMIER LEAGUE|\bEPL\b|\bMLS\b|LA ?LIGA|SERIE A|BUNDESLIGA|LIGUE 1|\bUEFA|CHAMPIONS LEAGUE|^LFC|MUTV|CHELSEA TV|GOLAZO|\bEFL\b|\bSPFL|\bFIFA|SKY SPORTS (PREMIER LEAGUE|FOOTBALL)|\bFA CUP/, "#1f7a3a"],
  ["Football", "Sports", /\bNFL\b|COLLEGE FOOTBALL|\bNCAAF\b|\bCFL\b|AMERICAN FOOTBALL/, "#6b3a1a"],
  ["Basketball", "Sports", /\bNBA|BASKETBALL|\bWNBA|\bNCAAB|MARCH MADNESS/, "#c2551a"],
  ["Baseball", "Sports", /\bMLB|BASEBALL|STRIKE ?ZONE|BIG INNING/, "#a01e2a"],
  ["Fight sports", "Sports", /\bUFC|\bWWE|BOXING|BOX ?NATION|\bMMA\b|FIGHT|WRESTL|\bAEW\b|\bPFL\b|BELLATOR|ONE ?FC|KICKBOX|TOP RANK|\bBKFC/, "#7a1a2a"],
  ["Motorsport", "Sports", /\bF1\b|FORMULA ?(1|ONE|E)|NASCAR|INDY ?CAR|MOTO ?GP|MOTORSPORT|MOTOR ?TREND|MAVTV|\bSPEED\b|RALLY|SUPERCROSS|MOTOCROSS|SUPERBIKE|\bWRC\b|\bDTM\b/, "#3a3a3a"],
  ["Golf", "Sports", /GOLF|\bPGA\b|\bLPGA\b|\bLIV\b/, "#2a6b2a"],
  ["Tennis", "Sports", /TENNIS|\bATP\b|\bWTA\b|WIMBLEDON/, "#6b8a1a"],
  ["Cycling & Mountain Bike", "Sports", /CYCLING|\bGCN\b|GLOBAL CYCLING|FLO ?BIKES?|\bUCI\b|CRANKWORX|\bMTB\b|MOUNTAIN ?BIK|DOWNHILL MTB|\bENDURO\b|\bEWS\b|RED ?BULL ?TV|OUTSIDE ?TV|EUROSPORT|TOUR DE FRANCE|\bGIRO\b|\bVUELTA\b|CYCLO-?CROSS/, "#c8102e", ["Lifestyle", "Entertainment", "PPV & Events"]]
];
var NICHE_BY = {}; NICHES.forEach(function (n) { NICHE_BY[n[0]] = n; });
var NICHE_PARENTS = { Lifestyle: "Lifestyle & Travel", Documentary: "Documentary & Factual", Entertainment: "Entertainment", Sports: "Sports" };
/* the multi-sport channels Nicholas listed are matched but flagged as "may carry" */
var MTB_STRONG = /CYCLING|\bGCN\b|GLOBAL CYCLING|FLO ?BIKES?|\bUCI\b|CRANKWORX|\bMTB\b|MOUNTAIN ?BIK|\bENDURO\b|\bEWS\b|TOUR DE FRANCE|\bGIRO\b|\bVUELTA\b|CYCLO-?CROSS/;
var MTB_EPG = /\bMTB\b|MOUNTAIN ?BIK|DOWNHILL|CRANKWORX|WORLD CUP DH|\bDH\b|ENDURO|\bEWS\b|\bUCI\b|CYCLING|CYCLO-?CROSS|TOUR DE |\bGIRO\b|\bVUELTA\b|\bGCN\b|RED BULL (RAMPAGE|HARDLINE)|RAMPAGE|HARDLINE|SLOPESTYLE|BIKE/i;

/* ---------- classification ---------- */
var NI = { src: null, by: {} };
function niInfo(ch) {
  if (NI.src !== CH.all) { NI.src = CH.all; NI.by = {}; }
  var r = NI.by[ch.id]; if (r) return r;
  var o = typeof tvcOf === "function" ? tvcOf(ch) : null, c = chanCat(ch), cl, sub, slot = false;
  if (o) { cl = o.cl || tvcClean(ch.n); sub = o.sub; slot = !!o.slot; }
  else { cl = typeof tvcClean === "function" ? tvcClean(ch.n) : String(ch.n).toUpperCase(); sub = c ? chanSub(ch, c) : ""; slot = c ? (c.ltype === "PPV & Events" || c.ltype === "24/7 channels") : false; }
  var ns = [];
  NICHES.forEach(function (n) {
    if (!n[2].test(cl)) return;
    if (n[0] === "Football" && /^(UK|CA)$/.test(c ? c.code : "") && !/\bNFL\b|AMERICAN|\bCFL\b/.test(cl)) return;
    if (n[1] === "Sports" && n[0] !== "Cycling & Mountain Bike" && slot) return;
    if (sub === n[1] || (n[4] && n[4].indexOf(sub) >= 0) || (n[0] === "Cycling & Mountain Bike" && (sub === "Sports" || MTB_STRONG.test(cl)))) ns.push(n[0]);
  });
  // a UK "football" channel is soccer
  if (/FOOTBALL/.test(cl) && sub === "Sports" && c && c.code === "UK" && ns.indexOf("Soccer") < 0 && ns.indexOf("Football") < 0) ns.push("Soccer");
  r = NI.by[ch.id] = { cl: cl, sub: sub, slot: slot, ns: ns, cc: c ? c.code : "" };
  return r;
}
/* channel pool for a scope: "UK" / "US" (country-only rule) or "ALL" (British + American + Canadian) */
var NIP = { t: 0, k: "", v: null };
function niPool(scope) {
  if (!CH.all) return [];
  var key = scope + "|" + (PF ? PF.id : "");
  if (NIP.k === key && NIP.src === CH.all && Date.now() - NIP.t < 5000) return NIP.v;
  var out = [];
  function tv(cc) {
    return tvcDedupe(tvcVisible(cc).filter(function (ch) { var o = tvcOf(ch); return o && o.sub !== "24/7" && o.sub !== "Local" && (!o.slot || MTB_STRONG.test(o.cl || "")); }));
  }
  if (scope === "UK" || scope === "US") out = tv(scope);
  else {
    out = tv("UK").concat(tv("US"));
    var ca = (CH.all || []).filter(function (ch) { var c = chanCat(ch); return c && c.code === "CA" && catVisibleLive(c) && chanOK(ch) && itemOK(ch) && c.ltype !== "24/7 channels" && c.ltype !== "Local channels" && (c.ltype !== "PPV & Events" || MTB_STRONG.test(String(ch.n).toUpperCase())); });
    out = out.concat(dedupeBest(ca, 3000));
  }
  NIP = { t: Date.now(), k: key, src: CH.all, v: out };
  return out;
}
function niList(scope, niche) { return niPool(scope).filter(function (ch) { return niInfo(ch).ns.indexOf(niche) >= 0; }); }
function niParentList(scope, parent) { return niPool(scope).filter(function (ch) { return niInfo(ch).sub === parent; }); }
function niRank(ch) { var o = typeof tvcOf === "function" ? tvcOf(ch) : null; return o ? o.rank + (o.brand ? 0 : 6) : 7; }
function niSort(list, niche) {
  return list.map(function (ch) {
    var u = niInfo(ch).cl, s = -niRank(ch) + learnScore("ch", String(ch.id)) / 10 + qualityBonus(ch) / 4 + (logoFor(ch) ? 0.5 : 0);
    if (niche === "Cycling & Mountain Bike") { s += MTB_STRONG.test(u) ? 6 : 0; var m = MTB.epg[ch.id]; if (m) s += m.live ? 30 : 12; }
    if (typeof whChanBonus === "function") s += 3 * whChanBonus(ch);
    s += favChanBonus(ch);
    return { ch: ch, s: s, n: u };
  }).sort(function (a, b) { return (b.s - a.s) || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0); }).map(function (x) { return x.ch; });
}
function niScopeAdj(scope) { return scope === "ALL" ? "" : (TVC_ADJ[scope] || COUNTRY[scope] || scope) + " "; }
function niTile(scope, niche, n) {
  var id = "niche:" + scope + ":" + niche, nd = NICHE_BY[niche];
  XT[id] = { label: (scope === "ALL" ? "" : (COUNTRY[scope] || scope) + " \u203A ") + nd[1] + " \u203A " + niche };
  return { t: "tile", id: id, n: niche, sub: n + (n === 1 ? " channel" : " channels"), col: nd[3] };
}
/* tiles + one row per non-empty niche of a parent category; empty niches are hidden */
function niParentRows(scope, parent, opt) {
  opt = opt || {}; var tiles = [], rows = [], adj = niScopeAdj(scope);
  var list = NICHES.filter(function (n) { return n[1] === parent; }).map(function (n) { return { n: n, l: niList(scope, n[0]) }; }).filter(function (x) { return x.l.length; });
  var fav = favOf(PF), fn = fav.niches;
  list.sort(function (a, b) { return ((fn.indexOf(b.n[0]) >= 0) - (fn.indexOf(a.n[0]) >= 0)) || (learnScore("tile", "niche:" + scope + ":" + b.n[0]) - learnScore("tile", "niche:" + scope + ":" + a.n[0])) || 0; });
  list.forEach(function (x) { tiles.push(niTile(scope, x.n[0], x.l.length)); });
  if (!tiles.length) return [];
  rows = rows.concat(tileRows(tiles, opt.tileTitle || (adj + (NICHE_PARENTS[parent] || parent) + " \u00B7 by type").trim()));
  if (opt.tilesOnly) return rows;
  list.forEach(function (x) { rows.push(niRow(scope, x.n[0], x.l, opt.cap || 24)); });
  return rows;
}
function niRow(scope, niche, l, cap, title) {
  var srt = niSort(l, niche), id = "niche:" + scope + ":" + niche, n = srt.length, adj = niScopeAdj(scope);
  if (!XT[id]) niTile(scope, niche, n);
  return { title: title || (adj + niche + " \u00B7 " + n + (n === 1 ? " channel" : " channels")), kind: "l", epg: true, local: true, load: function () {
    var x = srt.slice(0, cap || 24); if (n > x.length) x.push({ t: "tile", id: id, n: "See all " + n, sub: adj + niche + " \u203A", col: "#2a3a8c" }); return Promise.resolve(x);
  } };
}
function nichePageSpecs(id) {
  var m = /^niche:(\w+):(.+)$/.exec(id); if (!m) return [];
  if (!CH.all) return loadingSpec(id, "channels");
  var scope = m[1], niche = m[2], nd = NICHE_BY[niche]; if (!nd) return [];
  learnAdd("tile", id, 0.3);
  var l = niSort(niList(scope, niche), niche), rows = [], adj = niScopeAdj(scope);
  if (!l.length) return [{ title: "No " + adj + niche.toLowerCase() + " channels match your filters", kind: "l", local: true, load: function () { return Promise.resolve([]); } }];
  if (niche === "Cycling & Mountain Bike") rows = rows.concat(mtbRows(scope, l));
  rows.push({ title: "Top " + adj + niche + " channels", kind: "l", local: true, epg: true, load: function () { return Promise.resolve(l.slice(0, 30)); } });
  if (scope === "ALL") ["UK", "US", "CA"].forEach(function (cc) {
    var ll = l.filter(function (ch) { return niInfo(ch).cc === cc; }); if (!ll.length || ll.length === l.length) return;
    rows.push({ title: (COUNTRY[cc] || cc) + " " + niche.toLowerCase() + " \u00B7 " + ll.length, kind: "l", local: true, epg: true, load: function () { return Promise.resolve(ll.slice(0, 40)); } });
  });
  if (l.length > 30) {
    var a = l.slice().sort(function (x, y) { var p = niInfo(x).cl, q = niInfo(y).cl; return p < q ? -1 : p > q ? 1 : 0; });
    for (var i = 0; i < a.length; i += 30) (function (chunk) { rows.push({ title: "All " + adj + niche.toLowerCase() + " A\u2013Z", kind: "l", local: true, epg: true, load: function () { return Promise.resolve(chunk); } }); })(a.slice(i, i + 30));
  }
  return rows;
}
function niCounts(scope) { var o = {}; NICHES.forEach(function (n) { o[n[1] + " > " + n[0]] = niList(scope, n[0]).length; }); return o; }

/* ---------- mountain biking: guide scan (now / next) on the cycling channels ---------- */
var MTB = { epg: {}, t: 0, run: false };
function mtbScan() {
  if (MTB.run || Date.now() - MTB.t < 10 * 60000 || !CH.all) return;
  var l = niList("ALL", "Cycling & Mountain Bike").filter(function (ch) { return !niInfo(ch).slot; }).slice(0, 30);
  MTB.run = true; MTB.t = Date.now(); var left = l.length; if (!left) { MTB.run = false; return; }
  l.forEach(function (ch) {
    getEpg(ch.id).then(function (v) {
      var now = Date.now(), hit = null;
      (v || []).forEach(function (e) { if (!hit && MTB_EPG.test(String(e.t || "")) && e.e > now && e.s < now + 48 * 3600000) hit = { live: e.s <= now, t: e.t, s: e.s }; });
      if (hit) MTB.epg[ch.id] = hit; else delete MTB.epg[ch.id];
    }, function () {}).then(function () { if (--left <= 0) MTB.run = false; });
  });
}
function mtbLiveAny() { for (var k in MTB.epg) if (MTB.epg[k].live) return true; return false; }
function mtbRows(scope, l) {
  var ev = l.filter(function (ch) { return niInfo(ch).slot; }), lin = l.filter(function (ch) { return !niInfo(ch).slot; });
  var rows = [];
  rows.push({ title: "\uD83D\uDEB5 Mountain biking & cycling channels" + (mtbLiveAny() ? " \u00B7 MTB on now" : ""), kind: "l", epg: true, local: true, load: function () { mtbScan(); return Promise.resolve(niSort(lin, "Cycling & Mountain Bike").slice(0, 30)); } });
  if (ev.length) rows.push({ title: "Cycling & MTB event feeds \u00B7 " + ev.length, kind: "l", epg: true, local: true, load: function () { return Promise.resolve(ev.slice(0, 40)); } });
  return rows;
}

/* ---------- per-profile favourite categories ---------- */
var FAV_CC = [["UK", "British"], ["US", "American"], ["CA", "Canadian"]];
var FAV_SUBS = ["Sports", "News", "Entertainment", "Movies", "Kids", "Documentary", "Music", "Lifestyle"];
function favOf(p) {
  if (!p) return { cc: [], subs: [], niches: [] };
  if (!p.favInit) {   // one-time defaults Nicholas asked for; editable in Settings > Favourite categories
    p.favInit = 1;
    if (!p.fav) {
      if (/^nick$/i.test(p.name)) p.fav = { cc: [], subs: ["Documentary"], niches: ["Cycling & Mountain Bike"] };
      else if (/^celia$/i.test(p.name)) p.fav = { cc: ["UK"], subs: [], niches: [] };
    }
    try { saveProfiles(); } catch (e) {}
  }
  var f = p.fav || {}; return { cc: f.cc || [], subs: f.subs || [], niches: f.niches || [] };
}
function favHas() { var f = favOf(PF); return !!(f.cc.length || f.subs.length || f.niches.length); }
function favToggle(kind, v) {
  var f = favOf(PF); PF.fav = { cc: f.cc.slice(), subs: f.subs.slice(), niches: f.niches.slice() };
  var a = PF.fav[kind], i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v);
  saveProfiles(); NIP.t = 0;
}
function favIs(kind, v) { return favOf(PF)[kind].indexOf(v) >= 0; }
function favSubBoost(sub) { return PF && favIs("subs", sub) ? 60 : 0; }
function favChanBonus(ch) {
  if (!PF) return 0; var f = favOf(PF), i = niInfo(ch), b = 0;
  if (f.subs.indexOf(i.sub) >= 0) b += 3;
  if (f.cc.indexOf(i.cc) >= 0) b += 2.5;
  if (i.ns.some(function (n) { return f.niches.indexOf(n) >= 0; })) b += 3;
  var m = MTB.epg[ch.id]; if (m && f.niches.indexOf("Cycling & Mountain Bike") >= 0) b += m.live ? 8 : 3;
  return b;
}

/* ---------- hub: Lifestyle tile, favourite pins, favourite rows ---------- */
var FAV_TILE = { "c:UK": ["cc", "UK"], "c:US": ["cc", "US"], "c:CA": ["cc", "CA"], sports: ["subs", "Sports"], news: ["subs", "News"], "t:Kids": ["subs", "Kids"], "t:Movie channels": ["subs", "Movies"], "t:Documentary": ["subs", "Documentary"], "t:Music": ["subs", "Music"], "t:Entertainment & general": ["subs", "Entertainment"], "n:Lifestyle": ["subs", "Lifestyle"] };
XT["n:Lifestyle"] = { label: "Lifestyle & Travel" };
var _hubTilesV43 = hubTiles;
hubTiles = function (evN) {
  var out = _hubTilesV43(evN);
  if (CH.all) {
    var n = niParentList("ALL", "Lifestyle").length, mx = learnMax("tile") || 1;
    if (n && !out.some(function (t) { return t.id === "n:Lifestyle"; })) out.push({ t: "tile", id: "n:Lifestyle", n: "Lifestyle & Travel", sub: n + " channels", img: "img/tiles/life.jpg", score: 37.5 + 40 * learnScore("tile", "n:Lifestyle") / mx });
  }
  var f = favOf(PF);
  out.forEach(function (t) {
    var k = FAV_TILE[t.id]; if (!k) return;
    if (f[k[0]].indexOf(k[1]) >= 0) { t.score += k[0] === "cc" ? 300 : 150; t.fav = true; }
  });
  out.sort(function (x, y) { return y.score - x.score; });
  return out;
};
var DOC_PRI = [/^DISCOVERY( CHANNEL)?$/, /^NAT(IONAL)? ?GEO(GRAPHIC)?$/, /^HISTORY( CHANNEL)?$/, /^(INVESTIGATION DISCOVERY|ID)$/, /ANIMAL PLANET/, /NAT(IONAL)? ?GEO(GRAPHIC)? WILD/, /^SCIENCE( CHANNEL)?$|DISCOVERY SCIENCE/, /SMITHSONIAN/, /SKY DOCUMENTARIES/, /SKY HISTORY/, /SKY NATURE/, /BBC EARTH/, /CRIME ?(\+|AND) ?INVESTIGATION/, /QUEST/, /YESTERDAY/, /D ?MAX/];
function favSubRow(sub) {
  var name = PF.name, adjL = { Documentary: "Documentaries", Sports: "Sports", News: "News", Entertainment: "Entertainment", Movies: "Movie channels", Kids: "Kids channels", Music: "Music", Lifestyle: "Lifestyle & travel" }[sub] || sub;
  return { title: "\u2B50 " + adjL + " for " + name, kind: "l", epg: true, local: true, load: function () {
    return ensureIndex().then(function () {
      var l = niParentList("ALL", sub).filter(function (ch) { return !niInfo(ch).slot; });
      var sc = l.map(function (ch) { var u = niInfo(ch).cl, p = -1; DOC_PRI.forEach(function (re, i) { if (p < 0 && sub === "Documentary" && re.test(u)) p = i; });
        return { ch: ch, s: (p >= 0 ? 40 - p : 0) - niRank(ch) + learnScore("ch", String(ch.id)) / 10 + (typeof whChanBonus === "function" ? 3 * whChanBonus(ch) : 0) + qualityBonus(ch) / 4 + (logoFor(ch) ? 0.5 : 0), k: tvcOf(ch) ? tvcOf(ch).key : u }; });
      sc.sort(function (a, b) { return b.s - a.s; });
      var seen = {}, out = []; sc.forEach(function (x) { if (!seen[x.k] && out.length < 30) { seen[x.k] = 1; out.push(x.ch); } });
      return out;
    });
  } };
}
function favCcRows(cc) {
  var adj = TVC_ADJ[cc] || COUNTRY[cc], name = PF.name, first = [], later = [];
  first.push({ title: (TVC_FLAG[cc] || "") + adj + " picks for " + name, kind: "l", epg: true, local: true, load: function () {
    return ensureIndex().then(function () {
      var l = tvcDedupe(tvcVisible(cc).filter(function (ch) { var o = tvcOf(ch); return o && o.brand && !o.slot && !o.local && o.sub !== "24/7" && o.sub !== "PPV & Events"; }));
      var srt = tvcSort(l).map(function (ch, i) { return { ch: ch, s: -i / 12 + (typeof whChanBonus === "function" ? 4 * whChanBonus(ch) : 0) + (/^(Entertainment|Documentary)$/.test(tvcOf(ch).sub) ? 1.5 : 0) }; });
      srt.sort(function (a, b) { return b.s - a.s; }); return srt.slice(0, 30).map(function (x) { return x.ch; });
    });
  } });
  [["Entertainment", adj + " drama & entertainment"], ["Documentary", adj + " documentary & factual"]].forEach(function (s) {
    later.push({ title: s[1], kind: "l", epg: true, local: true, load: function () {
      return ensureIndex().then(function () {
        var l = tvcSubList(cc, s[0]);
        var sc = tvcSort(l).map(function (ch, i) { var ns = niInfo(ch).ns; return { ch: ch, s: -i / 12 + (ns.indexOf("Drama") >= 0 ? 2 : 0) + (typeof whChanBonus === "function" ? 4 * whChanBonus(ch) : 0) }; });
        sc.sort(function (a, b) { return b.s - a.s; }); return sc.slice(0, 30).map(function (x) { return x.ch; });
      });
    } });
  });
  return { first: first, later: later };
}
function favHubRows() {
  var f = favOf(PF), first = [], later = [];
  f.cc.forEach(function (cc) { var r = favCcRows(cc); first = first.concat(r.first); later = later.concat(r.later); });
  f.subs.forEach(function (s) { first.push(favSubRow(s)); });
  f.niches.forEach(function (n) {
    var nd = NICHE_BY[n]; if (!nd || !CH.all) return;
    var l = niList("ALL", n); if (!l.length) return;
    var title = n === "Cycling & Mountain Bike" ? "\uD83D\uDEB5 Mountain biking for " + PF.name + (mtbLiveAny() ? " \u00B7 on now" : "") : "\u2B50 " + n + " for " + PF.name;
    var row = niRow("ALL", n, l, 24, title);
    if (n === "Cycling & Mountain Bike") { mtbScan(); if (mtbLiveAny()) { first.unshift(row); return; } }
    later.push(row);
  });
  return { first: first, later: later };
}
var _hubSpecsV43 = hubSpecs;
hubSpecs = function () {
  var rows = _hubSpecsV43(); if (!PF || !favHas()) return rows;
  var fr = favHubRows();
  var i = 0; while (i < rows.length && rows[i].kind !== "t") i++;
  var j = i; while (j < rows.length && rows[j].kind === "t") j++;
  // favourites: the main pick row right above "Browse TV", the rest right below the tiles
  var out = rows.slice(0, i).concat(fr.first, rows.slice(i, j), fr.later, rows.slice(j));
  if (!(typeof whHas === "function" && whHas())) {   // Top picks also for favourites-only profiles
    var k = out.indexOf(fr.later[fr.later.length - 1]); if (k < 0) k = i + fr.first.length + (j - i) - 1;
    out.splice(k + 1, 0, { title: "Top picks for " + PF.name, kind: "l", epg: true, local: true, load: function () { return ensureIndex().then(function () { return whTopPicksLive(24); }); } });
  }
  return out;
};
/* Top picks: learned affinity + favourites (+ MTB on now for profiles that follow it) */
whTopPicksLive = function (max) {
  var a = whAff(), f = favOf(PF);
  var ccs = f.cc.filter(function (c) { return c === "UK" || c === "US"; });
  Object.keys(a.cc).sort(function (x, y) { return a.cc[y] - a.cc[x]; }).forEach(function (c) { if ((c === "UK" || c === "US") && ccs.indexOf(c) < 0) ccs.push(c); });
  if (!ccs.length) ccs = ["US"]; if (f.subs.length && ccs.indexOf("UK") < 0) ccs.push("UK"); ccs = ccs.slice(0, 2);
  var sc = [];
  ccs.forEach(function (cc, ci) {
    var l = tvcDedupe(tvcVisible(cc).filter(function (ch) { var o = tvcOf(ch); return o && o.brand && !o.slot && !o.local && o.sub !== "24/7"; }));
    tvcSort(l).forEach(function (ch, i) { sc.push({ ch: ch, s: 6 * whChanBonus(ch) + favChanBonus(ch) - i / 40 - ci * 0.4 + learnScore("ch", String(ch.id)) / 30 }); });
  });
  if (f.niches.indexOf("Cycling & Mountain Bike") >= 0) niList("ALL", "Cycling & Mountain Bike").forEach(function (ch) { var m = MTB.epg[ch.id]; if (m) sc.push({ ch: ch, s: 20 + (m.live ? 10 : 0) }); });
  sc.sort(function (x, y) { return y.s - x.s; });
  var seen = {}, out = [];
  sc.forEach(function (x) { var o = tvcOf(x.ch), k = o ? o.key : "id" + x.ch.id; if (!seen[k] && out.length < (max || 24) && (a.key["live:" + x.ch.id] || 0) >= 0) { seen[k] = 1; out.push(x.ch); } });
  return out;
};

/* ---------- pages: broad tile -> niche tiles + niche rows; country pages; sports ---------- */
var NI_TILE_PARENT = { "t:Documentary": "Documentary", "t:Entertainment & general": "Entertainment" };
var _pageSpecsV43 = pageSpecs;
pageSpecs = function (pg) {
  var id = pg.id, m;
  if (id.indexOf("niche:") === 0) return nichePageSpecs(id);
  if (id === "n:Lifestyle") {
    if (!CH.all) return loadingSpec(id, "channels");
    var rows = niParentRows("ALL", "Lifestyle", { tileTitle: "Lifestyle & Travel \u00B7 by type" });
    var other = niParentList("ALL", "Lifestyle").filter(function (ch) { return !niInfo(ch).ns.length; });
    if (other.length) rows.push({ title: "Other lifestyle channels \u00B7 " + other.length, kind: "l", epg: true, local: true, load: function () { return Promise.resolve(niSort(other).slice(0, 40)); } });
    return rows.length ? rows : [{ title: "No lifestyle channels match your filters", kind: "l", local: true, load: function () { return Promise.resolve([]); } }];
  }
  var rows0 = _pageSpecsV43(pg);
  if (!CH.all) return rows0;
  if (NI_TILE_PARENT[id]) return niParentRows("ALL", NI_TILE_PARENT[id]).concat(rows0);
  if (id === "sports") {
    // NHL section ends with the \u201cNHL & hockey channels\u201d row; favourite sports go right under it, then "by sport" tiles
    var f = favOf(PF), add = [];
    f.niches.forEach(function (n) { var nd = NICHE_BY[n]; if (!nd || nd[1] !== "Sports") return; var l = niList("ALL", n); if (!l.length) return;
      if (n === "Cycling & Mountain Bike") add = add.concat(mtbRows("ALL", l).map(function (r, i) { if (i === 0) r.title = "\uD83D\uDEB5 Mountain biking" + (mtbLiveAny() ? " \u00B7 on now" : "") + " \u00B7 " + l.filter(function (ch) { return !niInfo(ch).slot; }).length + " channels"; return r; }));
      else add.push(niRow("ALL", n, l, 24, "\u2B50 " + n));
    });
    add = add.concat(niParentRows("ALL", "Sports", { tilesOnly: true, tileTitle: "Browse by sport" }));
    var at = -1; rows0.forEach(function (r, i) { if (at < 0 && /^NHL & hockey channels/.test(r.title || "")) at = i + 1; });
    if (at < 0) at = Math.min(3, rows0.length);
    return rows0.slice(0, at).concat(add, rows0.slice(at));
  }
  if ((m = /^c:(UK|US)$/.exec(id))) {
    var cc = m[1], out = [];
    rows0.forEach(function (r) {
      out.push(r);
      Object.keys(NICHE_PARENTS).forEach(function (p) {
        var lbl = (TVC_ADJ[cc] + " " + tvcSubLbl(p) + " \u00B7 ");
        if (r.title && r.title.indexOf(lbl) === 0) out = out.concat(niParentRows(cc, p, { tilesOnly: true, tileTitle: TVC_ADJ[cc] + " " + tvcSubLbl(p) + " by type" }));
      });
    });
    return out;
  }
  if ((m = /^sub:(UK|US):(.+)$/.exec(id)) && NICHE_PARENTS[m[2]]) return niParentRows(m[1], m[2]).concat(rows0);
  return rows0;
};

/* ---------- Settings > Favourite categories ---------- */
function stFav(inner, ln) {
  inner.appendChild(ce("div", "s-h1", "Favourite categories"));
  inner.appendChild(ce("div", "s-sub", "For " + PF.name + " only. Favourites are pinned higher on the TV hub, get their own rows and are weighted up in Top picks. They add to what NickFlix learns from viewing; they don't change watch history."));
  function tl(kind, v, label, desc) {
    var l = ce("div", "s-line"), c = chip(label, desc, favIs(kind, v), null, "wide tog"); c._key = "fav:" + kind + ":" + v;
    c._act = function () { favToggle(kind, v); setChip(c, favIs(kind, v)); ST.dirty = true; toast(label + ": " + (favIs(kind, v) ? "favourite" : "not a favourite")); };
    l.appendChild(c); inner.appendChild(l); lnAdd(ln, l, [c]);
  }
  inner.appendChild(ce("div", "s-sec", "Countries"));
  FAV_CC.forEach(function (x) { tl("cc", x[0], x[1], x[1] + " tile first, \u201c" + x[1] + " picks\u201d rows on the home page"); });
  inner.appendChild(ce("div", "s-sec", "Categories"));
  FAV_SUBS.forEach(function (s) { tl("subs", s, s === "Lifestyle" ? "Lifestyle & Travel" : s, "Tile pinned high, its own row on the home page, raised on British/American pages"); });
  inner.appendChild(ce("div", "s-sec", "Sports & niches"));
  NICHES.forEach(function (n) { tl("niches", n[0], n[0], n[1] + " \u203A " + n[0]); });
}
