/* NickFlix 4.9 - Motorsports + significant events.
   Sources (all free, public, no key): ESPN site API scoreboards/calendars (F1, NASCAR Cup, IndyCar, UFC,
   NFL/NBA/MLB/NHL post-season notes, FIFA World Cup, UCL) and TheSportsDB's public test key "123"
   (MotoGP 4407, WRC 4409, WEC 4413, World Rallycross 4730, Boxing 4445). Guide (EPG) scans of the main
   sports + motorsport channels find what is live now. Events are mapped to provider channels with
   matchChannels() (series names, broadcaster, date).
   Sports page order: NHL -> MTB -> Motorsports (incl. Live rally racing) -> Live now -> the rest. */
"use strict";
var TSDB = "https://www.thesportsdb.com/api/v1/json/123";
var MOTO_SERIES = {
  F1: { name: "Formula 1", ico: "\uD83C\uDFCE\uFE0F", espn: "racing/f1", words: [["FORMULA 1", 6], ["FORMULA ONE", 6], ["SKY SPORTS F1", 8], ["F1 TV", 6], ["F1", 4]], sig: 60 },
  NASCAR: { name: "NASCAR Cup", ico: "\uD83C\uDFC1", espn: "racing/nascar-premier", words: [["NASCAR", 7]], sig: 40 },
  INDY: { name: "IndyCar", ico: "\uD83C\uDFC1", espn: "racing/irl", words: [["INDYCAR", 8], ["INDY CAR", 8]], sig: 40 },
  MOTOGP: { name: "MotoGP", ico: "\uD83C\uDFCD\uFE0F", tsdb: 4407, words: [["MOTOGP", 8], ["MOTO GP", 8], ["TNT SPORTS", 2], ["EUROSPORT", 2]], sig: 40 },
  WRC: { name: "WRC Rally", ico: "\uD83C\uDFC1", tsdb: 4409, words: [["WRC", 8], ["RALLY", 6], ["RED BULL TV", 3]], sig: 35, rally: true },
  WRX: { name: "World Rallycross", ico: "\uD83C\uDFC1", tsdb: 4730, words: [["RALLYCROSS", 8], ["WORLD RX", 8], ["WRX", 6]], sig: 30, rally: true },
  WEC: { name: "Endurance (WEC)", ico: "\u23F1\uFE0F", tsdb: 4413, words: [["LE MANS", 8], ["WEC", 7], ["ENDURANCE", 4], ["IMSA", 4]], sig: 35 }
};
var MOTO_EPG = /FORMULA (1|ONE|E)\b|\bF1\b|GRAND PRIX|NASCAR|INDYCAR|INDY 500|MOTO ?GP|\bMOTO2\b|SUPERBIKE|\bWSBK\b|\bWRC\b|RALLY|DAKAR|RALLYCROSS|WORLD RX|LE MANS|\bWEC\b|\bIMSA\b|ENDURANCE RAC|SUPERCARS|\bDTM\b|\bBTCC\b|MOTOCROSS|SUPERCROSS|\bNHRA\b|DRAG RAC|\bRACING\b|\bRACE\b|QUALIFYING|PRACTICE/i;
var RALLY_EPG = /\bWRC\b|RALLY(?!\s*(FOR|AGAINST))|DAKAR|RALLYCROSS|WORLD RX|\bERC\b/i;
var MOTO_NAME = /\bF1\b|FORMULA|NASCAR|MOTORS? ?TV|MOTORVISION|MOTOR ?SPORT|AUTOSPORT|MOTO ?GP|INDYCAR|\bSPEED\b|MAV ?TV|\bWRC\b|RALLY|DAKAR|RED ?BULL ?TV|EUROSPORT|\bDAZN\b|TNT SPORTS|SKY SPORTS (MAIN|ACTION|F1|ARENA)|FOX SPORTS 1|\bFS1\b|\bNBC SPORTS\b|\bESPN\b|\bTSN ?[1-5]\b|SPORTSNET (ONE|360)/;
var RALLY_NAME = /\bWRC\b|RALLY|DAKAR|RED ?BULL ?TV/;
var MOTO = { epg: {}, t: 0, run: null };

/* keep ESPN season type (3 = post-season) on games */
var _espnGame49 = espnGame;
espnGame = function (ev, lgId) { var o = _espnGame49(ev, lgId); try { o.stype = ev.season && ev.season.type; } catch (e) {} return o; };

function motoQuery(code, extra, start, nets) {
  var s = MOTO_SERIES[code], w = s.words.slice(); (extra || []).forEach(function (x) { w.push(x); });
  return { words: w, nets: nets || [], lg: code, start: start, min: 5 };
}
function motoItem(code, title, start, end, opts) {
  var s = MOTO_SERIES[code], now = Date.now(); opts = opts || {};
  var live = opts.live || (end && start <= now && end >= now);
  var it = { t: "game", lg: code, id: "mo" + code + "_" + (opts.id || start), title: s.ico + " " + title, n: title, start: start, state: live ? "in" : "pre", detail: live ? (opts.detail || "this weekend") : "", nets: opts.nets || [], sig: opts.sig || s.sig, rally: !!s.rally, moto: true };
  var gp = (title.match(/([A-Z][\w\u00C0-\u017F\-]+) (Grand Prix|GP|Rally|Rallye)/) || [])[1];
  it.q = motoQuery(code, gp ? [[gp, 5]] : [], start, it.nets);
  return it;
}
/* ESPN racing: full-season calendar + live/next session times from the scoreboard */
function motoEspn(code) {
  var s = MOTO_SERIES[code];
  return cachedJSON("mo_" + code, ESPN_BASE + "/" + s.espn + "/scoreboard", 30 * 60000, function (d) {
    var cal = ((d.leagues || [])[0] || {}).calendar || [], ev = (d.events || [])[0], cur = null;
    if (ev) {
      var cs = ev.competitions || [], race = cs[cs.length - 1] || {}, nets = [];
      (race.broadcasts || []).forEach(function (b) { (b.names || []).forEach(function (n) { if (nets.indexOf(n) < 0) nets.push(n); }); });
      cur = { n: ev.name, start: Date.parse(race.date || ev.date), first: Date.parse((cs[0] || {}).date || ev.date), state: ev.status && ev.status.type && ev.status.type.state, nets: nets,
        sess: cs.map(function (c) { return [c.type && c.type.abbreviation || "", Date.parse(c.date), c.status && c.status.type && c.status.type.state]; }) };
    }
    return { cal: cal.map(function (c) { return [c.label, Date.parse(c.startDate), Date.parse(c.endDate)]; }), cur: cur };
  }, 12000).then(function (v) {
    var now = Date.now(), out = [];
    var cur = v.cur;
    if (cur && cur.state !== "post") {
      var liveS = null; (cur.sess || []).forEach(function (x) { if (x[2] === "in") liveS = x[0]; });
      out.push(motoItem(code, cur.n, cur.start, cur.start + 4 * 3600000, { live: !!liveS || cur.state === "in", detail: liveS || "", nets: cur.nets, id: "cur" }));
    }
    v.cal.forEach(function (c) {
      var lab = c[0], st = c[1], en = c[2] || c[1];
      if (cur && lab === cur.n) return;
      var race = code === "F1" ? en - 2 * 3600000 : en;          // F1 calendar spans the weekend; race ~2 h before its end
      if (race < now - 3 * 3600000) return;
      out.push(motoItem(code, lab, race, null, { id: st }));
    });
    return out;
  }).catch(function () { return []; });
}
/* TheSportsDB (free test key): next event + this/next season lists (free key returns the first 15) */
function motoTsdb(code) {
  var s = MOTO_SERIES[code], y = new Date().getUTCFullYear();
  var slim = function (d) { return (d.events || []).map(function (e) { return [e.idEvent, String(e.strEvent || "").trim(), e.strTimestamp || (e.dateEvent ? e.dateEvent + "T00:00:00" : ""), e.strVenue || "", e.strCountry || ""]; }); };
  var urls = [["n", TSDB + "/eventsnextleague.php?id=" + s.tsdb], ["s" + y, TSDB + "/eventsseason.php?id=" + s.tsdb + "&s=" + y], ["s" + (y + 1), TSDB + "/eventsseason.php?id=" + s.tsdb + "&s=" + (y + 1)]];
  return Promise.all(urls.map(function (u) { return cachedJSON("mo_" + code + "_" + u[0], u[1], 6 * 3600000, slim, 12000).catch(function () { return []; }); })).then(function (ls) {
    var now = Date.now(), seen = {}, out = [];
    ls.forEach(function (l) { (l || []).forEach(function (e) {
      var t = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(e[2]) ? e[2] : e[2] + "Z"); if (!t || t < now - 3 * 86400000) return;
      var base = e[1], pb; do { pb = base; base = base.replace(/\s+(Free Practice \d|Practice \d?|Qualifying( \d)?|Sprint|Warm ?Up|Race|Shakedown|Stage \d+)\s*$/i, "").trim(); } while (base !== pb);
      var k = code + "|" + base.toLowerCase().replace(/\b(motogp|grand prix|gp)\b/g, "").replace(/\s+/g, " ").trim(); if (seen[k]) return; seen[k] = 1;
      var title = code === "MOTOGP" && !/GP|Grand Prix/i.test(base) ? base + " MotoGP" : base;
      var dateOnly = /T00:00:00/.test(e[2]);
      var it = motoItem(code, title, t, t + (dateOnly ? 3 * 86400000 : 3 * 3600000), { id: e[0] });
      if (dateOnly && it.state === "in") it.detail = "rally weekend";
      out.push(it);
    }); });
    return out;
  });
}
function motoSched() {
  if (MOTO.sp && Date.now() - MOTO.st < 15 * 60000) return MOTO.sp;
  MOTO.st = Date.now();
  MOTO.sp = Promise.all(Object.keys(MOTO_SERIES).map(function (c) { return MOTO_SERIES[c].espn ? motoEspn(c) : motoTsdb(c); })).then(function (rs) {
    var all = []; rs.forEach(function (r) { all = all.concat(r || []); });
    all.forEach(function (it) { motoSig(it); });
    all.sort(function (a, b) { return (a.state === "in" ? 0 : 1) - (b.state === "in" ? 0 : 1) || a.start - b.start; });
    return all;
  }, function () { return []; });
  return MOTO.sp;
}
function motoSig(it) {
  var n = it.n || "";
  if (/MONACO|LAS VEGAS|ABU DHABI/i.test(n) && it.lg === "F1") it.sig = 70;
  if (/DAYTONA 500|CHAMPIONSHIP/i.test(n) && it.lg === "NASCAR") it.sig = 80;
  if (/INDIANAPOLIS 500|INDY 500/i.test(n)) it.sig = 85;
  if (/LE MANS|24 HOURS/i.test(n)) it.sig = 85;
  if (/MONTE[- ]CARLO/i.test(n) && it.lg === "WRC") it.sig = 45;
  return it;
}
/* guide scan: what's on now / next 48 h on sports + motorsport channels */
function motoEpgCands() {
  if (!CH.all) return [];
  var l = typeof slEpgCands === "function" ? slEpgCands() : [], seen = {};
  l.forEach(function (ch) { seen[ch.id] = 1; });
  var extra = (CH.all || []).filter(function (ch) {
    if (seen[ch.id] || !chanOK(ch) || !itemOK(ch)) return false; var c = chanCat(ch);
    if (!c || !catVisibleLive(c) || (c.ltype !== "Sports" && c.ltype !== "PPV & Events")) return false;
    return MOTO_NAME.test(ch.up) && !/\bVS?\.? |@ |\d{1,2}:\d\d/.test(ch.up);
  });
  extra = dedupeBest(extra, 40);
  return l.concat(extra).slice(0, 80);
}
function motoScan() {
  if (MOTO.run) return MOTO.run;
  if (Date.now() - MOTO.t < 10 * 60000) return Promise.resolve(MOTO.epg);
  MOTO.t = Date.now();
  var l = motoEpgCands(), m = {};
  MOTO.run = Promise.all(l.map(function (ch) {
    return getEpg(ch.id).then(function (v) {
      var now = Date.now(), best = null;
      (v || []).forEach(function (e) {
        var t = String(e.t || ""); if (!MOTO_EPG.test(t) || e.e <= now || e.s > now + 48 * 3600000) return;
        if (/GRAND PRIX/i.test(t) && /HORSE|DARTS|SNOOKER|TENNIS|CYCLING|SKI|DRESSAGE|JUMPING/i.test(t)) return;
        var live = e.s <= now, rep = SL_NOT.test(t), rally = RALLY_EPG.test(t);
        var sc = (live ? (rep ? 10 : 30) : (rep ? 2 : 8)) + (rally ? 5 : 0);
        if (!best || sc > best.sc) best = { sc: sc, live: live, rep: rep, rally: rally, t: t, s: e.s, e: e.e };
      });
      if (best) m[ch.id] = best;
    }, function () {});
  })).then(function () { MOTO.epg = m; MOTO.run = null; return m; }, function () { MOTO.run = null; return m; });
  return MOTO.run;
}
function motoLiveAny(rally) { for (var k in MOTO.epg) { var x = MOTO.epg[k]; if (x.live && !x.rep && (!rally || x.rally)) return true; } return false; }
function motoChanList(rally) {
  return ensureIndex().then(motoScan).then(function (m) {
    var pool = motoEpgCands(), sc = [];
    pool.forEach(function (ch) {
      var x = m[ch.id], nm = rally ? RALLY_NAME.test(ch.up) : (MOTO_NAME.test(ch.up) && /F1|FORMULA|NASCAR|MOTOR|MOTO ?GP|INDYCAR|SPEED|MAV|WRC|RALLY|DAKAR/.test(ch.up));
      if (rally && x && !x.rally) x = null;
      if (!x && !nm) return;
      sc.push({ ch: ch, s: (x ? x.sc : 0) + (nm ? 5 : 0) + qualityBonus(ch) * 0.2 + learnScore("ch", String(ch.id)) * 0.05 });
    });
    sc.sort(function (a, b) { return b.s - a.s; });
    var seen = {}, out = [];
    sc.forEach(function (x) { var k = x.ch.up.replace(/[^A-Z0-9]|HD|FHD|UHD|4K/g, ""); if (!seen[k] && out.length < 30) { seen[k] = 1; out.push(x.ch); } });
    return out;
  });
}
/* guide programmes that look like an upcoming race -> game cards that open the matching channel */
function motoEpgItems(rally) {
  var out = [], now = Date.now();
  for (var id in MOTO.epg) {
    var x = MOTO.epg[id]; if (x.rep || x.live || (rally && !x.rally)) continue;
    var ch = chanById(id); if (!ch) continue;
    out.push({ t: "game", lg: rally ? "WRC" : "MOTO", id: "moe" + id, title: (rally ? "\uD83C\uDFC1 " : "\uD83C\uDFCE\uFE0F ") + x.t, n: x.t, start: x.s, state: "pre", nets: [tvcClean(ch.n)], q: { words: [[tvcClean(ch.n), 6]], min: 5 }, sig: 20 });
  }
  return out;
}
function motoRows() {
  return [
    { title: "\uD83C\uDFC1 Motorsports \u00B7 live now & coming up \u00B7 F1, NASCAR, IndyCar, MotoGP, WRC, endurance", kind: "g", local: true, load: function () {
      return Promise.all([motoSched(), ensureIndex().then(motoScan, function () { return {}; })]).then(function (r) {
        var now = Date.now(), items = r[0].filter(function (it) { return it.state === "in" || it.start < now + 75 * 86400000; });
        items = items.concat(motoEpgItems(false).filter(function (g) { return !/rally/i.test(g.n); }));
        items.sort(function (a, b) { return (a.state === "in" ? 0 : 1) - (b.state === "in" ? 0 : 1) || a.start - b.start; });
        return items.slice(0, 40);
      });
    } },
    { title: "\uD83C\uDFC1 Live rally racing \u00B7 WRC, rally, Dakar, rallycross", kind: "l", epg: true, local: true, load: function () { return motoChanList(true); } },
    { title: "Rally \u00B7 coming up (WRC, World Rallycross, guide)", kind: "g", local: true, load: function () {
      return Promise.all([motoSched(), ensureIndex().then(motoScan, function () { return {}; })]).then(function (r) {
        var items = r[0].filter(function (it) { return it.rally; }).slice(0, 12).concat(motoEpgItems(true));
        items.sort(function (a, b) { return (a.state === "in" ? 0 : 1) - (b.state === "in" ? 0 : 1) || a.start - b.start; });
        return items.slice(0, 30);
      });
    } },
    { title: "Motorsport channels", kind: "l", epg: true, local: true, load: function () { return motoChanList(false); } }
  ];
}
/* Sports page: NHL -> MTB -> Motorsports -> Live now -> rest */
var _pageSpecsV49 = pageSpecs;
pageSpecs = function (pg) {
  var rows = _pageSpecsV49(pg);
  if (pg.id !== "sports") return rows;
  var live = [], rest = [];
  rows.forEach(function (r) { if (/^\u25CF Live (now|on sports channels now)/.test(r.title || "")) live.push(r); else rest.push(r); });
  var at = -1;
  rest.forEach(function (r, i) { if (/^\uD83D\uDEB5|^Cycling & MTB event feeds/.test(r.title || "")) at = i + 1; });
  if (at < 0) rest.forEach(function (r, i) { if (at < 0 && /^NHL & hockey channels/.test(r.title || "")) at = i + 1; });
  if (at < 0) at = Math.min(3, rest.length);
  var mr = motoRows();
  if (motoLiveAny(true)) mr[1].title = "\uD83C\uDFC1 Live rally racing \u00B7 \u25CF on now";
  return rest.slice(0, at).concat(mr, live, rest.slice(at));
};

/* ---------------- Live Events banner: more events, ranked by significance ---------------- */
function sigEvent(g, lg, title, sig) { var e = mkEvent(g, lg, title); e.sig = sig; if (g.q) e.q = g.q; return e; }
majorEvents = function () {
  var y = function (p) { return p.catch(function () { return []; }); };
  var srcs = [
    y(espnUpcoming(LG_BY.UFC).then(function (gs) { return gs.map(function (g) { var t = g.title || g.n, num = /UFC \d+/.test(t); return sigEvent(g, "UFC", t, num ? 100 : 55); }); })),
    y(espnUpcoming(LG_BY.NFL).then(function (gs) { return gs.filter(function (g) { return g.stype === 3 || /SUPER BOWL|WILD CARD|DIVISIONAL|CONFERENCE|CHAMPIONSHIP|PLAYOFF/i.test(g.note + " " + g.full); }).map(function (g) { var sb = /SUPER BOWL/i.test(g.note + " " + g.full); return sigEvent(g, "NFL", (sb ? "Super Bowl: " : "NFL Playoffs: ") + g.n, sb ? 100 : 70); }); })),
    y(espnUpcoming(LG_BY.NBA).then(function (gs) { return gs.filter(function (g) { return g.stype === 3 || /FINALS|PLAYOFF|PLAY-IN/i.test(g.note); }).map(function (g) { var f = /NBA FINALS/i.test(g.note); return sigEvent(g, "NBA", (f ? "NBA Finals: " : "NBA Playoffs: ") + g.n, f ? 90 : 55); }); })),
    y(espnUpcoming(LG_BY.MLB).then(function (gs) { return gs.filter(function (g) { return g.stype === 3 || /WORLD SERIES|ALCS|NLCS|DIVISION SERIES|WILD CARD/i.test(g.note); }).map(function (g) { var f = /WORLD SERIES/i.test(g.note); return sigEvent(g, "MLB", (f ? "World Series: " : "MLB Playoffs: ") + g.n, f ? 90 : 55); }); })),
    y(espnUpcoming({ id: "WC", espn: "soccer/fifa.world" }).then(function (gs) { return gs.slice(0, 8).map(function (g) { var f = /\bFINAL\b/i.test(g.note) && !/SEMI|QUARTER/i.test(g.note); return sigEvent(g, "WC", (f ? "World Cup Final: " : "World Cup: ") + g.n, f ? 100 : 80); }); })),
    y(espnUpcoming(LG_BY.UCL).then(function (gs) { return gs.filter(function (g) { return /\bFINAL\b/i.test(g.note) && !/SEMI|QUARTER/i.test(g.note); }).map(function (g) { return sigEvent(g, "UCL", "Champions League Final: " + g.n, 85); }); })),
    y(nhlWeek().then(function (gs) { return gs.filter(function (g) { return g.playoff && g.state !== "post"; }).map(function (g) { return sigEvent(g, "NHL", (g.final ? "Stanley Cup Final: " : "NHL Playoffs: ") + g.n, g.final ? 95 : 65); }); })),
    y(motoSched().then(function (l) { return l.map(function (it) { var e = mkEvent(it, it.lg, (MOTO_SERIES[it.lg] ? MOTO_SERIES[it.lg].name + ": " : "") + it.n); e.q = it.q; e.sig = it.sig; e.moto = true; if (it.state === "in") e.state = "in"; return e; }); })),
    y(cachedJSON("ev_box", TSDB + "/eventsnextleague.php?id=4445", 6 * 3600000, function (d) { return (d.events || []).map(function (e) { return [e.idEvent, String(e.strEvent || "").trim(), e.strTimestamp || ""]; }); }, 12000).then(function (l) {
      return l.filter(function (e) { return e[2]; }).map(function (e) { var t = Date.parse(/Z$/.test(e[2]) ? e[2] : e[2] + "Z"), names = e[1].split(/ vs\.? /i);
        return { t: "event", lg: "BOX", id: "bx" + e[0], n: "Boxing: " + e[1], start: t, state: "pre", nets: [], sig: 50, q: { words: names.map(function (x) { return [x.trim().split(" ").pop(), 6]; }).concat([["BOXING", 2]]), nets: [], min: 6 } }; });
    }))
  ];
  srcs.push(y(ensureIndex().then(function (all) {
    var out = providerEvents(all).map(function (e) { e.sig = 85; return e; });     // provider PPV channels = PPV fights
    var oly = all.filter(function (ch) { return chanOK(ch) && /OLYMPIC/.test(ch.up); });
    if (oly.length) out.push({ t: "event", lg: "OLY", id: "oly", n: "Olympic Games", start: Date.now(), state: "in", nets: [], sig: 100, q: { words: [["OLYMPIC", 8]], nets: [], min: 6 } });
    return out;
  })));
  return Promise.all(srcs).then(function (rs) {
    var all = [], seen = {}, now = Date.now();
    rs.forEach(function (r) { (r || []).forEach(function (e) {
      if (!(e.start > now - 8 * 3600000 && e.start < now + 8 * 86400000)) return;
      var k = String(e.n).toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ").filter(function (w) { return w.length > 3; }).slice(-2).join("|") + "|" + dayKey(e.start);
      if (seen[k]) return; seen[k] = 1; all.push(e);
    }); });
    all.forEach(function (e) {
      var live = e.state === "in" || (e.start <= now && e.start > now - 3 * 3600000);
      e.soon = live || e.start < now + (e.sig >= 80 ? 4 : e.sig >= 55 ? 2 : 1.5) * 86400000;
      e._live = live;
    });
    all.sort(function (a, b) { return (b._live - a._live) || (b.soon - a.soon) || ((b.sig || 0) - (a.sig || 0)) || a.start - b.start; });
    return all.slice(0, 16);
  });
};
