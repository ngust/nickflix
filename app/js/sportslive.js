/* NickFlix v4.5 - Sports page: "Live now" (ESPN scoreboards with state=in + live-looking guide titles on
   sports channels) and "Coming up" for the next 7 days (Today / Tomorrow / This week), favourites first.
   Live data refreshes about every 2 minutes while the Sports or Live Events page is open. */
"use strict";
var SL_LEAGUES = [["NHL", "hockey/nhl"], ["NFL", "football/nfl"], ["NBA", "basketball/nba"], ["MLB", "baseball/mlb"], ["MLS", "soccer/usa.1"], ["EPL", "soccer/eng.1"],
  ["UCL", "soccer/uefa.champions"], ["UFC", "mma/ufc"], ["F1", "racing/f1"], ["NCAAF", "football/college-football"], ["NCAAB", "basketball/mens-college-basketball"], ["WNBA", "basketball/wnba"], ["CFL", null]];
var SL = { t: 0 };
function slScore(lgId, path, ttl) {
  if (!path) return Promise.resolve([]);
  return cachedJSON("sl_" + lgId, ESPN_BASE + "/" + path + "/scoreboard", ttl || 100000, function (d) { return (d.events || []).map(function (e) { return espnGame(e, LG_BY[lgId] ? lgId : (lgId === "NCAAB" ? "NCAAF" : lgId)); }); }, 12000).catch(function () { return []; });
}
function slLiveGames() {
  return Promise.all(SL_LEAGUES.map(function (l) { return slScore(l[0], l[1]); })).then(function (rs) {
    var out = []; rs.forEach(function (r, i) { (r || []).forEach(function (g) { if (g.state === "in") { g.lgName = SL_LEAGUES[i][0]; out.push(g); } }); });
    var fav = PD && PD.st.nhlTeam;
    out.sort(function (a, b) { return slFav(b, fav) - slFav(a, fav) || (learnScore("lg", b.lg) - learnScore("lg", a.lg)) || a.start - b.start; });
    return out;
  });
}
function slFav(g, fav) { var s = 0; if (fav && g.teams && g.teams.indexOf(fav) >= 0) s += 10; if (g.lg === "NHL") s += 2; return s; }
/* guide "now playing" on the main sports channels that looks like a live event */
var SL_LIVE_T = /\bvs?\.?\b|\s@\s|\bat\b.+\b(flames|oilers|canucks|leafs|jets|kings|rangers|bruins|lakers|celtics|yankees|dodgers)\b|\blive\b|grand prix|\brace\b|qualifying|\bmatch\b|\bgame \d|championship|\bcup\b|\bopen\b|round \d|\bufc\b|fight night|\bnhl\b|\bnfl\b|\bnba\b|\bmlb\b|\bmls\b|premier league|football|hockey|basketball|baseball|soccer|rugby|cricket|tennis|golf|boxing|darts|snooker|cycling|downhill|mtb/i;
var SL_NOT = /replay|classic|highlights?|rewind|review|best of|preview|magazine|countdown|sportscenter|\bnews\b|\btalk\b|encore|\(r\)|repeat|re-?air|documentary|\bshow\b|tonight\b|daily|podcast|recap|analysis|pre-?game|post-?game|from the vault|greatest|top 10|film room/i;
var SLE = { m: {}, t: 0, run: false };
function slEpgCands() {
  if (!CH.all) return [];
  var l = [];
  ["US", "UK"].forEach(function (cc) { tvcVisible(cc).forEach(function (ch) { var o = tvcOf(ch); if (o && o.brand && !o.slot && o.sub === "Sports" && o.rank <= 3) l.push(ch); }); });
  l = tvcDedupe(l);
  var ca = (CH.all || []).filter(function (ch) { var c = chanCat(ch); return c && c.code === "CA" && c.ltype === "Sports" && catVisibleLive(c) && chanOK(ch) && /^(SPORTSNET( ONE| 360| EAST| WEST| ONTARIO| PACIFIC)?|TSN ?[1-5])$/.test(tvcClean(ch.n)); });
  return l.concat(dedupeBest(ca, 12)).slice(0, 40);
}
function slEpgScan() {
  if (SLE.run || Date.now() - SLE.t < 110000) return Promise.resolve(SLE.m);
  SLE.run = true; SLE.t = Date.now();
  var l = slEpgCands(), m = {};
  return Promise.all(l.map(function (ch) {
    return getEpg(ch.id).then(function (v) {
      var now = Date.now(), cur = null; (v || []).forEach(function (e) { if (!cur && e.s <= now && e.e > now) cur = e; });
      if (cur && SL_LIVE_T.test(cur.t || "") && !SL_NOT.test(cur.t || "")) m[ch.id] = cur.t;
    }, function () {});
  })).then(function () { SLE.m = m; SLE.run = false; return m; });
}
function slLiveRows() {
  return [
    { title: "\u25CF Live now", kind: "g", local: true, load: function () { return slLiveGames(); } },
    { title: "\u25CF Live on sports channels now", kind: "l", epg: true, local: true, load: function () {
      return ensureIndex().then(slEpgScan).then(function (m) { return slEpgCands().filter(function (ch) { return m[ch.id]; }); });
    } }
  ];
}
/* ---------- coming up: next 7 days ---------- */
function slUpcoming() {
  var srcs = SL_LEAGUES.filter(function (l) { return l[1] && LG_BY[l[0]]; }).map(function (l) { return espnUpcoming(LG_BY[l[0]].espn === l[1] ? LG_BY[l[0]] : { id: l[0], espn: l[1] }).catch(function () { return []; }); });
  srcs.push(nhlWeek().catch(function () { return []; }));
  srcs.push(ensureIndex().then(providerEvents, function () { return []; }).then(function (evs) { return evs.map(function (e) { return { t: "game", lg: e.lg, id: e.id, title: e.n, n: e.n, start: e.start, state: "pre", nets: [], q: e.q }; }); }));
  return Promise.all(srcs).then(function (rs) {
    var now = Date.now(), all = [], seen = {}, fav = PD && PD.st.nhlTeam;
    rs.forEach(function (r) { (r || []).forEach(function (g) {
      if (g.state !== "pre" || !(g.start > now - 600000 && g.start < now + 7 * 86400000)) return;
      var hn = g.home && (g.home.common || g.home.ab), an = g.away && (g.away.common || g.away.ab); var k = hn && an ? g.lg + "|" + String(an).toLowerCase() + "@" + String(hn).toLowerCase() + "|" + dayKey(g.start) : g.id; if (seen[k]) return; seen[k] = 1; all.push(g);
    }); });
    // mountain biking / cycling seen in the guide (profiles that follow it)
    if (typeof MTB !== "undefined" && favOf(PF).niches.indexOf("Cycling & Mountain Bike") >= 0) for (var id in MTB.epg) { var e = MTB.epg[id]; if (!e.live && e.s > now) { var ch = null; (CH.all || []).some(function (c) { if (String(c.id) === String(id)) { ch = c; return true; } return false; }); if (ch) all.push({ t: "game", lg: "MTB", id: "mtb" + id, title: "\uD83D\uDEB5 " + e.t, n: e.t, start: e.s, state: "pre", nets: [tvcClean(ch.n)], q: { words: [[tvcClean(ch.n), 6]], min: 5 }, mtb: true }); } }
    function sc(g) { return (fav && g.teams && g.teams.indexOf(fav) >= 0 ? 100 : 0) + (g.mtb ? 60 : 0) + (g.lg === "NHL" ? 5 : 0) + 3 * learnScore("lg", g.lg) / (learnMax("lg") || 1); }
    all.sort(function (a, b) { return a.start - b.start; });
    var groups = { today: [], tomorrow: [], week: [] }, dk = dayKey(now), dk1 = dayKey(now + 86400000);
    all.forEach(function (g) { var d = dayKey(g.start); (d === dk ? groups.today : d === dk1 ? groups.tomorrow : groups.week).push(g); });
    for (var gk in groups) { var arr = groups[gk]; arr.forEach(function (g, i) { g._i = i; }); arr.sort(function (a, b) { return (sc(b) - sc(a)) || (a._i - b._i); }); }
    return groups;
  });
}
var SLU = { p: null, t: 0 };
function slUpcomingCached() { if (!SLU.p || Date.now() - SLU.t > 10 * 60000) { SLU.t = Date.now(); SLU.p = slUpcoming(); } return SLU.p; }
function slComingRows() {
  return [["today", "Coming up today"], ["tomorrow", "Coming up tomorrow"], ["week", "Coming up this week"]].map(function (x) {
    return { title: x[1] + " \u00B7 times in " + tzLabel(), kind: "g", load: function () { return slUpcomingCached().then(function (g) { return g[x[0]].slice(0, 40); }); } };
  });
}
var _pageSpecsV45 = pageSpecs;
pageSpecs = function (pg) {
  var rows = _pageSpecsV45(pg), id = pg.id;
  if (id === "sports") {
    var at = -1; rows.forEach(function (r, i) { if (at < 0 && /^NHL & hockey channels/.test(r.title || "")) at = i + 1; }); if (at < 0) at = Math.min(3, rows.length);
    rows = rows.slice(0, at).concat(slLiveRows(), rows.slice(at));
    var bi = -1; rows.forEach(function (r, i) { if (bi < 0 && r.title === "Browse by sport") bi = i; }); if (bi < 0) bi = at + 2;
    return rows.slice(0, bi).concat(slComingRows(), rows.slice(bi));
  }
  if (id === "events") return rows.slice(0, 1).concat(slLiveRows().slice(0, 1), slComingRows(), rows.slice(1));
  return rows;
};
/* refresh live rows ~ every 2 minutes while Sports / Live Events is on screen */
setInterval(function () {
  try {
    if (V.view !== "live" || !V.page || (V.page.id !== "sports" && V.page.id !== "events") || P.open || OV.top()) return;
    ["sl_NHL"].concat(SL_LEAGUES.map(function (l) { return "sl_" + l[0]; })).forEach(function (k) { delete XC[k]; try { localStorage.removeItem("nf_x_" + k); } catch (e) {} });
    SLE.t = 0; refreshLocalRows();
  } catch (e) {}
}, 120000);
