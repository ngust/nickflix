/* NickFlix v3 - TV hub: tiles, sports (NHL + ESPN), news, events, EPG, channel matching */
"use strict";
var NHL_BASE = "https://api-web.nhle.com/v1", ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

/* ---------------- time zone (fixed offsets; default UTC-7 like Creston/MST) ---------------- */
var TZ_OPTS = [["-420", "Creston / MST \u2013 UTC\u22127"], ["-480", "Pacific \u2013 UTC\u22128"], ["-360", "Central \u2013 UTC\u22126"], ["-300", "Eastern \u2013 UTC\u22125"], ["-240", "Atlantic \u2013 UTC\u22124"], ["0", "UTC"], ["dev", "Use the TV's clock"]];
function tzOff() { var t = account.tz; if (t === "dev") return -new Date().getTimezoneOffset(); return t != null && t !== "" ? +t : -420; }
function tzLabel() { var t = account.tz == null ? "-420" : String(account.tz); for (var i = 0; i < TZ_OPTS.length; i++) if (TZ_OPTS[i][0] === t) return TZ_OPTS[i][1]; return TZ_OPTS[0][1]; }
function zDate(ms) { return new Date(ms + tzOff() * 60000); }
var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtClock(ms) { var d = zDate(ms), h = d.getUTCHours(), m = d.getUTCMinutes(); return ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + (h < 12 ? " AM" : " PM"); }
function dayKey(ms) { var d = zDate(ms); return d.getUTCFullYear() * 400 + d.getUTCMonth() * 32 + d.getUTCDate(); }
function fmtDay(ms) {
  var now = Date.now(), dk = dayKey(ms), d = zDate(ms);
  if (dk === dayKey(now)) return "Today"; if (dk === dayKey(now + 86400000)) return "Tomorrow"; if (dk === dayKey(now - 86400000)) return "Yesterday";
  return DOW[d.getUTCDay()] + " " + MON[d.getUTCMonth()] + " " + d.getUTCDate();
}
function fmtWhen(ms) { return fmtDay(ms) + " \u00b7 " + fmtClock(ms); }
function countdown(ms, live) {
  var s = Math.round((ms - Date.now()) / 1000);
  if (live || (s <= 0 && s > -3 * 3600)) return "LIVE NOW";
  if (s <= 0) return "";
  var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return "in " + (d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : Math.max(1, m) + " min");
}
function ymd(ms) { var d = new Date(ms); return d.getUTCFullYear() + ("0" + (d.getUTCMonth() + 1)).slice(-2) + ("0" + d.getUTCDate()).slice(-2); }

/* ---------------- cached JSON with TTL (memory + small localStorage) ---------------- */
var XC = {};
function cachedJSON(key, url, ttl, slimFn, timeout) {
  var now = Date.now(), m = XC[key];
  if (m && m.v !== undefined && now - m.t < ttl) return Promise.resolve(m.v);
  if (m && m.p) return m.p;
  var ls = lsGet("nf_x_" + key, null);
  if (ls && now - ls.t < ttl) { XC[key] = ls; return Promise.resolve(ls.v); }
  var p = getJSON(url, timeout || 12000).then(function (d) {
    var v = slimFn ? slimFn(d) : d; XC[key] = { t: Date.now(), v: v }; lsSet("nf_x_" + key, XC[key]); return v;
  }, function (e) { delete XC[key]; if (ls) return ls.v; throw e; });
  XC[key] = { t: 0, p: p };
  return p;
}

/* ---------------- channel index (whole live list, loaded once in the background) ---------------- */
var CH = { all: null, p: null };
function ensureIndex() {
  if (CH.all) return Promise.resolve(CH.all);
  if (CH.p) return CH.p;
  CH.p = api("get_live_streams", "", 120000).then(function (arr) {
    var all = [], by = {};
    (Array.isArray(arr) ? arr : []).forEach(function (it) {
      if (!it || !it.name) return;
      var cid = String(it.category_id), o = slim("live", it, cid);
      o.up = String(it.name).toUpperCase();
      (by[cid] = by[cid] || []).push(o); all.push(o);
    });
    for (var cid in by) if (!cache["live:" + cid]) cache["live:" + cid] = by[cid];
    CH.all = all; return all;
  }, function (e) { CH.p = null; throw e; });
  return CH.p;
}
function chanCat(ch) { return catById["live:" + ch.c]; }
function chanOK(ch) { var c = chanCat(ch); return c && !ch.ad && liveCountryOn(c.code) && !PD.st.live.typesOff[c.ltype]; }
function chanById(id) { if (!CH.all) return null; for (var i = 0; i < CH.all.length; i++) if (CH.all[i].id == id) return CH.all[i]; return null; }
var CC_ORDER = { CA: 0, US: 1, UK: 2, EN: 3, MULTI: 4, PPV: 2 };
function qualityBonus(ch) { var u = ch.up; return (/FHD|ᴴᴰ|\bHD\b|UHD|ᵁᴴᴰ|4K/.test(u) ? 0.6 : 0) + (ch.e ? 0.8 : 0) + (ch.ic ? 0.3 : 0) - (/\bSD\b|\(S\)|BACKUP|ALT\]|\[ALT/.test(u) ? 0.5 : 0); }

/* ---------------- EPG (get_short_epg) ---------------- */
var EPG = { c: {}, q: [], run: 0 };
function b64(s) { try { return decodeURIComponent(escape(atob(s || ""))); } catch (e) { try { return atob(s || ""); } catch (e2) { return s || ""; } } }
function getEpg(id) {
  var c = EPG.c[id]; if (c && Date.now() - c.t < 600000) return Promise.resolve(c.v);
  if (c && c.p) return c.p;
  var p = new Promise(function (res) { EPG.q.push({ id: id, res: res }); epgPump(); });
  EPG.c[id] = { t: 0, p: p }; return p;
}
function epgPump() {
  while (EPG.run < 2 && EPG.q.length) {
    var j = EPG.q.shift(); EPG.run++;
    (function (j) {
      api("get_short_epg", "stream_id=" + j.id + "&limit=3", 10000).then(function (d) {
        var L = (d && d.epg_listings) || [], now = Date.now() / 1000, v = [];
        L.forEach(function (x) { var s = +x.start_timestamp, e = +x.stop_timestamp || +x.end_timestamp; if (e > now) v.push({ t: b64(x.title), s: s * 1000, e: e * 1000 }); });
        v.sort(function (a, b) { return a.s - b.s; });
        return v.slice(0, 2);
      }).catch(function () { return []; }).then(function (v) { EPG.c[j.id] = { t: Date.now(), v: v }; EPG.run--; j.res(v); epgPump(); });
    })(j);
  }
}
function epgInto(card, it) {
  if (!it.e && !it.forceEpg) return;
  getEpg(it.id).then(function (v) {
    if (!v.length || !card.parentNode) return;
    var now = Date.now(), cur = v[0].s <= now ? v[0] : null, nx = cur ? v[1] : v[0];
    var box = ce("div", "epg");
    if (cur) {
      box.appendChild(ce("div", "epg-now", "Now: " + cur.t));
      var pb = ce("div", "epg-bar"), f = ce("div"); f.style.width = Math.max(3, Math.min(100, Math.round(100 * (now - cur.s) / (cur.e - cur.s)))) + "%"; pb.appendChild(f); box.appendChild(pb);
    }
    if (nx) box.appendChild(ce("div", "epg-next", "Next " + fmtClock(nx.s) + ": " + nx.t));
    card.appendChild(box); card.classList.add("has-epg");
  });
}

/* ---------------- leagues ---------------- */
var LEAGUES = [
  { id: "NHL", name: "NHL Hockey", re: /\bNHL\b|HOCKEY|SPORTSNET|\bTSN|NHL NETWORK/, espn: null },
  { id: "NFL", name: "NFL Football", re: /\bNFL\b|REDZONE|RED ZONE|SUNDAY TICKET/, espn: "football/nfl" },
  { id: "NBA", name: "NBA Basketball", re: /\bNBA\b/, espn: "basketball/nba" },
  { id: "MLB", name: "MLB Baseball", re: /\bMLB\b|BASEBALL/, espn: "baseball/mlb" },
  { id: "MLS", name: "MLS Soccer", re: /\bMLS\b/, espn: "soccer/usa.1" },
  { id: "EPL", name: "Premier League", re: /PREMIER LEAGUE|\bEPL\b/, espn: "soccer/eng.1" },
  { id: "UCL", name: "Champions League", re: /CHAMPIONS LEAGUE|\bUCL\b|UEFA/, espn: "soccer/uefa.champions" },
  { id: "UFC", name: "UFC / MMA", re: /\bUFC\b|\bMMA\b|\bPFL\b|BELLATOR/, espn: "mma/ufc" },
  { id: "BOX", name: "Boxing", re: /BOXING|\bDAZN\b/, espn: null },
  { id: "F1", name: "Formula 1", re: /\bF1\b|FORMULA ?1/, espn: "racing/f1" },
  { id: "GOLF", name: "Golf", re: /GOLF|\bPGA\b/, espn: "golf/pga" },
  { id: "NCAAF", name: "College Football", re: /NCAA|COLLEGE|\bSEC\b|BIG TEN|\bACC\b/, espn: "football/college-football" },
  { id: "CFL", name: "CFL Football", re: /\bCFL\b/, espn: null }
];
var LG_BY = {}; LEAGUES.forEach(function (l) { LG_BY[l.id] = l; });
function leagueOf(up) { for (var i = 0; i < LEAGUES.length; i++) { var l = LEAGUES[i]; if (l.id === "NHL" ? /\bNHL\b|HOCKEY/.test(up) : l.re.test(up)) return l.id; } return null; }
function leaguesOrdered() {
  var arr = LEAGUES.slice(1);
  arr.sort(function (a, b) { return (learnScore("lg", b.id) - learnScore("lg", a.id)) || (LEAGUES.indexOf(a) - LEAGUES.indexOf(b)); });
  return [LEAGUES[0]].concat(arr);
}

/* ---------------- network -> channel regex ---------------- */
function netRe(n) {
  var u = String(n).toUpperCase().replace(/\s+/g, " ").trim();
  var M = { "SN": /SPORTSNET/, "SN1": /SPORTSNET ?(ONE|1)\b/, "SN360": /SPORTSNET ?360/, "SNE": /SPORTSNET ?EAST/, "SNO": /SPORTSNET ?ONTARIO/, "SNP": /SPORTSNET ?(PACIFIC|PITTSBURGH)/, "SNW": /SPORTSNET ?WEST/, "SN+": /SPORTSNET ?(\+|PLUS)/,
    "TSN": /\bTSN ?\d?\b/, "TVAS": /TVA ?SPORTS/, "TVAS2": /TVA ?SPORTS ?2/, "RDS": /\bRDS\b/, "RDS2": /\bRDS ?2\b/, "CBC": /\bCBC\b(?! ?NEWS)/, "CITY": /\bCITY ?TV\b|CITYTV/, "NHLN": /NHL ?NETWORK|NHL ?CHANNEL/,
    "ESPN": /\bESPN\b(?!\s*(DEPORTES|NEWS|U\b|\+))/, "ESPN+": /ESPN ?(\+|PLUS)/, "ESPN2": /ESPN ?2/, "ABC": /\bABC\b/, "TNT": /\bTNT\b/, "TRUTV": /TRU ?TV/, "MAX": /\bMAX\b|\bHBO ?MAX/, "PRIME": /PRIME|AMAZON/,
    "NBC": /\bNBC\b/, "PEACOCK": /PEACOCK/, "USA": /USA NETWORK/, "FOX": /\bFOX\b(?! ?NEWS| ?BUSINESS| ?WEATHER)/, "FS1": /\bFS ?1\b|FOX SPORTS 1/, "FS2": /\bFS ?2\b/, "CBS": /\bCBS\b/, "PARAMOUNT+": /PARAMOUNT/, "NFL NET": /NFL ?NETWORK/, "NFLN": /NFL ?NETWORK/,
    "NBA TV": /NBA ?TV/, "MLB NETWORK": /MLB ?NETWORK/, "APPLE TV": /APPLE/, "DAZN": /\bDAZN\b/, "MSG": /\bMSG\b/, "NESN": /\bNESN\b/, "ALT": /\bALT(ITUDE)?\b/, "SCRIPPS": /SCRIPPS/, "KCOP": /KCOP/,
    "MNMT": /MONUMENTAL/, "VICTORY+": /VICTORY/, "SCRIPPS SPORTS": /SCRIPPS/, "FDSN": /FAN ?DUEL|BALLY|FDSN/, "NBCSP": /NBC SPORTS ?(PHILADELPHIA|PHILLY)/, "NBCSCA": /NBC SPORTS ?(CALIFORNIA|BAY)/, "NBCSB": /NBC SPORTS ?BOSTON/, "SKY SPORTS": /SKY ?SPORTS/, "TNT SPORTS": /TNT ?SPORTS/ };
  var k = u.replace(/^(FANDUEL SN|FDSN).*$/, "FDSN");
  if (M[k]) return M[k];
  if (/^TSN\d$/.test(k)) return new RegExp("\\bTSN ?" + k.slice(3) + "\\b");
  if (/^FDSN|FANDUEL|BALLY/.test(k)) return M.FDSN;
  if (/^NBCS/.test(k)) return /NBC SPORTS/;
  return new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
}

/* ---------------- matching channels for a game / event ---------------- */
function matchChannels(q) {
  var words = (q.words || []).filter(function (w) { return w[0] && w[0].length > 2; }).map(function (w) { return [w[0].toUpperCase(), w[1]]; });
  var nets = (q.nets || []).map(function (n) { return [netRe(n), n]; });
  var lgRe = q.lg && LG_BY[q.lg] ? LG_BY[q.lg].re : null, d = q.start ? zDate(q.start) : null;
  var dayRe = d ? new RegExp("\\b" + MON[d.getUTCMonth()].toUpperCase() + "\\w* ?0?" + d.getUTCDate() + "\\b|" + d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2)) : null;
  var out = [];
  CH.all.forEach(function (ch) {
    if (!chanOK(ch)) return;
    var c = chanCat(ch), u = ch.up, s = 0, why = [], hits = 0;
    var strong = 0;
    words.forEach(function (w) { if (u.indexOf(w[0]) >= 0) { s += w[1]; hits++; if (w[1] >= 5) strong++; why.push(w[0].toLowerCase()); } });
    // event-style channels ("A vs B @ Nov 9 8:00 PM", "(TSN+ 022) | ...") only count when a team/fighter name matches
    var evLike = /\bVS?\.? |@ |\d{1,2}:\d\d|\(\d{4}-\d\d-\d\d|\| /.test(u);
    if (evLike && !strong) return;
    if (hits >= 2) s += 4;
    nets.forEach(function (n) { if (n[0].test(u)) { s += 3; why.push(n[1]); } });
    if (s > 0 && lgRe && (lgRe.test(u) || lgRe.test(c.up))) s += 2;
    if (s > 0 && dayRe) { if (dayRe.test(u)) s += 3; else if (/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w* ?\d{1,2}\b|\d{4}-\d\d-\d\d|\b\d\d\/\d\d\b/.test(u)) s -= 6; }
    if (/ESPA[NÑ]OL|PORTUGU|FRAN[CÇ]AIS|SPANISH|\bFR\b|\bESP\b|\bLAT(INO)?\b|DEUTSCH|ITALIANO|ARABIC/.test(u)) s -= 3;
    if (q.lg !== "NCAAF" && /\bU\d\d\b|NCAA|COLLEGE|\bAAA\b|ELITE|WOMEN|\bW\d|JUNIOR|\bOHL\b|\bWHL\b|\bAHL\b/.test(u)) s -= 8;
    if (s >= (q.min || 3)) { s += qualityBonus(ch) - (CC_ORDER[c.code] != null ? CC_ORDER[c.code] * 0.3 : 1.5) + learnScore("ch", String(ch.id)) * 0.05; out.push({ ch: ch, s: s, why: why }); }
  });
  out.sort(function (a, b) { return b.s - a.s; });
  return out.slice(0, 30);
}
function gameQuery(g) {
  var w = [];
  [g.away, g.home].forEach(function (t) { if (!t) return; if (t.common) w.push([t.common, 5]); if (t.place && t.place.length > 3) w.push([t.place, 2]); if (t.full && t.full !== t.common) w.push([t.full, 3]); });
  (g.extra || []).forEach(function (x) { w.push(x); });
  return { words: w, nets: g.nets || [], lg: g.lg, start: g.start, min: 3 };
}

/* ---------------- NHL data ---------------- */
var NHL_TEAMS = [["ANA", "Anaheim Ducks"], ["BOS", "Boston Bruins"], ["BUF", "Buffalo Sabres"], ["CGY", "Calgary Flames"], ["CAR", "Carolina Hurricanes"], ["CHI", "Chicago Blackhawks"], ["COL", "Colorado Avalanche"], ["CBJ", "Columbus Blue Jackets"],
  ["DAL", "Dallas Stars"], ["DET", "Detroit Red Wings"], ["EDM", "Edmonton Oilers"], ["FLA", "Florida Panthers"], ["LAK", "Los Angeles Kings"], ["MIN", "Minnesota Wild"], ["MTL", "Montreal Canadiens"], ["NSH", "Nashville Predators"],
  ["NJD", "New Jersey Devils"], ["NYI", "New York Islanders"], ["NYR", "New York Rangers"], ["OTT", "Ottawa Senators"], ["PHI", "Philadelphia Flyers"], ["PIT", "Pittsburgh Penguins"], ["SJS", "San Jose Sharks"], ["SEA", "Seattle Kraken"],
  ["STL", "St. Louis Blues"], ["TBL", "Tampa Bay Lightning"], ["TOR", "Toronto Maple Leafs"], ["UTA", "Utah Mammoth"], ["VAN", "Vancouver Canucks"], ["VGK", "Vegas Golden Knights"], ["WSH", "Washington Capitals"], ["WPG", "Winnipeg Jets"]];
function nhlLogo(ab) { return "https://assets.nhle.com/logos/nhl/svg/" + ab + "_light.svg"; }
function teamName(ab) { for (var i = 0; i < NHL_TEAMS.length; i++) if (NHL_TEAMS[i][0] === ab) return NHL_TEAMS[i][1]; return ab; }
function nhlGame(g) {
  function tm(t) { var common = t.commonName && t.commonName.default || "", place = t.placeName && t.placeName.default || ""; return { ab: t.abbrev, common: common, place: place, full: (place + " " + common).trim(), logo: t.logo || nhlLogo(t.abbrev), score: t.score }; }
  var st = g.gameState, state = st === "LIVE" || st === "CRIT" ? "in" : (st === "FINAL" || st === "OFF") ? "post" : "pre";
  var o = { t: "game", lg: "NHL", id: "nhl" + g.id, start: Date.parse(g.startTimeUTC), state: state, away: tm(g.awayTeam), home: tm(g.homeTeam), nets: [] };
  (g.tvBroadcasts || []).forEach(function (b) { if (o.nets.indexOf(b.network) < 0) o.nets.push(b.network); });
  if (g.gameType === 3) { o.playoff = true; if (g.seriesStatus && g.seriesStatus.round === 4) o.final = true; }
  if (state === "in" && g.periodDescriptor) o.detail = "P" + g.periodDescriptor.number + (g.clock && g.clock.timeRemaining ? " " + g.clock.timeRemaining : "");
  o.n = o.away.ab + " @ " + o.home.ab; o.teams = [o.away.ab, o.home.ab];
  return o;
}
function nhlWeek() {
  return cachedJSON("nhlwk", NHL_BASE + "/schedule/now", 15 * 60000, function (d) {
    var out = []; (d.gameWeek || []).forEach(function (w) { (w.games || []).forEach(function (g) { out.push(nhlGame(g)); }); }); return out;
  });
}
function nhlTeamGames(ab) {
  return cachedJSON("nhlt_" + ab, NHL_BASE + "/club-schedule-season/" + ab + "/now", 3 * 3600000, function (d) {
    var now = Date.now(), out = [];
    (d.games || []).forEach(function (g) { var s = Date.parse(g.startTimeUTC); if (s > now - 4 * 3600000 && out.length < 6) out.push(nhlGame(g)); });
    return out;
  }, 20000).then(function (games) {
    var live = games.filter(function (g) { return g.start <= Date.now() && g.start > Date.now() - 4 * 3600000; });
    if (!live.length) return games;
    // a game may be live right now: refresh state from the (shorter TTL) weekly schedule
    return nhlWeek().then(function (wk) { return games.map(function (g) { for (var i = 0; i < wk.length; i++) if (wk[i].id === g.id) return wk[i]; return g; }); }, function () { return games; });
  });
}

/* ---------------- ESPN scoreboards ---------------- */
function espnGame(ev, lgId) {
  var c = (ev.competitions || [])[0] || {}, st = ev.status && ev.status.type || {}, o = { t: "game", lg: lgId, id: "es" + ev.id, start: Date.parse(ev.date), n: ev.shortName || ev.name, full: ev.name, nets: [] };
  o.state = st.state || "pre"; if (o.state === "in") o.detail = st.shortDetail || "";
  (c.broadcasts || []).forEach(function (b) { (b.names || []).forEach(function (n) { if (o.nets.indexOf(n) < 0) o.nets.push(n); }); });
  var comp = c.competitors || [];
  if (comp.length === 2 && comp[0].team) {
    comp.forEach(function (x) { var t = x.team || {}; var tm = { ab: t.abbreviation, common: t.shortDisplayName || t.name, place: t.location, full: t.displayName, logo: t.logo, score: x.score }; if (x.homeAway === "home") o.home = tm; else o.away = tm; });
    o.teams = [o.away && o.away.ab, o.home && o.home.ab];
  }
  var notes = (c.notes || []).map(function (n) { return n.headline || ""; }).join(" ");
  o.note = notes;
  if (lgId === "UFC" || lgId === "F1" || lgId === "GOLF") {
    o.extra = []; var nm = String(ev.name || ""); o.title = nm;
    var m = nm.match(/UFC \d+/); if (m) o.extra.push([m[0], 10]);
    if (lgId === "UFC") { o.extra.push(["UFC", 3]); var mm = nm.match(/:\s*(.+?) vs\.? (.+)$/); if (mm) { o.extra.push([mm[1].split(" ").pop(), 6]); o.extra.push([mm[2].split(" ").pop(), 6]); } }
    if (lgId === "F1") { o.extra.push(["F1", 3]); o.extra.push(["FORMULA", 3]); var gp = nm.replace(/^.*?(\w+ Grand Prix).*$/, "$1"); if (gp) o.extra.push([gp, 6]); }
    // main card time: last competition
    var cs = ev.competitions || []; if (lgId === "UFC" && cs.length) { var last = cs[cs.length - 1]; if (last.date) o.main = Date.parse(last.date); (last.broadcasts || []).forEach(function (b) { (b.names || []).forEach(function (n) { if (o.nets.indexOf(n) < 0) o.nets.push(n); }); }); }
  }
  return o;
}
function espnUpcoming(lg) {
  if (!lg.espn) return Promise.resolve([]);
  var now = Date.now(), multi = /mma|racing|golf/.test(lg.espn);
  var slim = function (d) { return (d.events || []).map(function (e) { return espnGame(e, lg.id); }); };
  var urls = [ESPN_BASE + "/" + lg.espn + "/scoreboard"];
  // ESPN's date-range form is unreliable, so ask for each of the next days separately (cached 20 min each)
  if (!multi) for (var k = 0; k < 6; k++) urls.push(ESPN_BASE + "/" + lg.espn + "/scoreboard?dates=" + ymd(now - 5 * 3600000 + k * 86400000) + "&limit=100");
  return Promise.all(urls.map(function (u, i) { return cachedJSON("es_" + lg.id + "_" + (i ? u.slice(-18, -10) : "d"), u, 20 * 60000, slim, 15000).catch(function () { return []; }); })).then(function (ls) {
    var seen = {}, gs = [];
    ls.forEach(function (l) { (l || []).forEach(function (g) { if (!seen[g.id]) { seen[g.id] = 1; gs.push(g); } }); });
    return gs;
  }).then(function (gs) {
    var t = Date.now();
    return gs.filter(function (g) { return g.state === "in" || (g.state === "pre" && g.start > t - 3600000) || (multi && g.state !== "post" && g.start > t - 4 * 86400000); })
      .sort(function (a, b) { return (a.state === "in" ? 0 : 1) - (b.state === "in" ? 0 : 1) || a.start - b.start; });
  });
}

/* ---------------- major events ---------------- */
function majorEvents() {
  var srcs = [
    espnUpcoming(LG_BY.UFC).then(function (gs) { return gs.filter(function (g) { return /UFC \d+/.test(g.title || g.n); }).map(function (g) { return mkEvent(g, "UFC", g.title || g.n); }); }),
    espnUpcoming(LG_BY.F1).then(function (gs) { return gs.map(function (g) { return mkEvent(g, "F1", g.title || g.n); }); }),
    espnUpcoming(LG_BY.NFL).then(function (gs) { return gs.filter(function (g) { return /SUPER BOWL/i.test(g.note + " " + g.full); }).map(function (g) { return mkEvent(g, "NFL", "Super Bowl: " + g.n); }); }),
    espnUpcoming(LG_BY.NBA).then(function (gs) { return gs.filter(function (g) { return /NBA FINALS/i.test(g.note); }).map(function (g) { return mkEvent(g, "NBA", "NBA Finals: " + g.n); }); }),
    espnUpcoming(LG_BY.MLB).then(function (gs) { return gs.filter(function (g) { return /WORLD SERIES/i.test(g.note); }).map(function (g) { return mkEvent(g, "MLB", "World Series: " + g.n); }); }),
    espnUpcoming({ id: "WC", espn: "soccer/fifa.world" }).then(function (gs) { return gs.slice(0, 4).map(function (g) { return mkEvent(g, "WC", "World Cup: " + g.n); }); }),
    nhlWeek().then(function (gs) { return gs.filter(function (g) { return g.final && g.state !== "post"; }).map(function (g) { return mkEvent(g, "NHL", "Stanley Cup Final: " + g.n); }); })
  ].map(function (p) { return p.catch(function () { return []; }); });
  srcs.push(ensureIndex().then(providerEvents, function () { return []; }));
  return Promise.all(srcs).then(function (rs) {
    var all = []; rs.forEach(function (r) { all = all.concat(r); });
    var now = Date.now();
    all = all.filter(function (e) { return e.start > now - 8 * 3600000 && e.start < now + 8 * 86400000; });
    all.forEach(function (e) { e.soon = e.start < now + 3 * 86400000; });
    all.sort(function (a, b) { return (b.soon - a.soon) || a.start - b.start; });
    return all.slice(0, 8);
  });
}
function mkEvent(g, lg, title) {
  var e = { t: "event", lg: lg, id: "ev" + g.id, n: title, start: g.main || g.start, state: g.state, nets: g.nets, game: g };
  e.q = gameQuery(g);
  return e;
}
/* provider PPV / event channels whose names carry a "X vs Y" and a date in the window */
function providerEvents(all) {
  var out = [], seen = {}, now = Date.now();
  all.forEach(function (ch) {
    var c = chanCat(ch); if (!c || c.ltype !== "PPV & Events" || !chanOK(ch)) return;
    if (!/BOXING|UFC|\bPPV\b|FIGHT|WWE/.test(ch.up + " " + c.up) || !/ VS\.? /.test(ch.up)) return;
    var t = parseChanDate(ch.n); if (!t || t < now - 8 * 3600000 || t > now + 8 * 86400000) return;
    var key = ch.up.replace(/^.*?[:|]\s*/, "").replace(/\(.*$/, "").trim(); if (seen[key]) return; seen[key] = 1;
    var title = ch.n.replace(/^.*?(UFC|BOXING|PPV|EVENT)[^:|]*[:|]\s*/i, "").replace(/\s*\(\d{4}-.*$/, "").trim() || ch.n;
    out.push({ t: "event", lg: /UFC/.test(ch.up) ? "UFC" : "BOX", id: "pv" + ch.id, n: title, start: t, nets: [], q: { words: title.split(/ vs\.? /i).map(function (x) { return [x.trim().split(" ").pop(), 6]; }), nets: [], min: 6 }, fromProvider: true });
  });
  return out.slice(0, 4);
}
function parseChanDate(n) {
  var m = String(n).match(/\((\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return 0;
}

/* ---------------- hub tiles ---------------- */
var TILE_DEFS = [
  { id: "events", label: "Live Events", img: "events", base: 100 },
  { id: "sports", label: "Sports", img: "sports", base: 90, f: function (c) { return c.ltype === "Sports" || c.ltype === "PPV & Events"; } },
  { id: "news", label: "News", img: "news", base: 85, f: function (c) { return c.ltype === "News"; } },
  { id: "c:CA", label: "Canadian", img: "canada", base: 60, f: function (c) { return c.code === "CA"; } },
  { id: "c:US", label: "American", img: "usa", base: 58, f: function (c) { return c.code === "US"; } },
  { id: "c:UK", label: "British", img: "uk", base: 56, f: function (c) { return c.code === "UK"; } },
  { id: "fav", label: "My Channels", img: "fav", base: 54 },
  { id: "recent", label: "Recently Watched", img: "recent", base: 53 },
  { id: "t:Kids", label: "Kids", img: "kids", base: 40, f: function (c) { return c.ltype === "Kids"; } },
  { id: "t:Movie channels", label: "Movie Channels", img: "movies", base: 40, f: function (c) { return c.ltype === "Movie channels"; } },
  { id: "t:Documentary", label: "Documentary", img: "docs", base: 38, f: function (c) { return c.ltype === "Documentary"; } },
  { id: "t:Music", label: "Music", img: "music", base: 36, f: function (c) { return c.ltype === "Music" || c.ltype === "Radio"; } },
  { id: "t:Entertainment & general", label: "Entertainment", img: "ent", base: 37, f: function (c) { return c.ltype === "Entertainment & general" || c.ltype === "Religious"; } },
  { id: "t:24/7 channels", label: "24/7 Non-Stop", img: "247", base: 34, f: function (c) { return c.ltype === "24/7 channels"; } },
  { id: "t:Local channels", label: "Local", img: "local", base: 33, f: function (c) { return c.ltype === "Local channels"; } },
  { id: "intl", label: "International", img: "world", base: 30, f: function (c) { return ["CA", "US", "UK"].indexOf(c.code) < 0; } },
  { id: "all", label: "All Channels", img: "world", base: 5, f: function () { return true; } }
];
var TILE_BY = {}; TILE_DEFS.forEach(function (t) { TILE_BY[t.id] = t; });
function tilesForCat(c) { var o = []; TILE_DEFS.forEach(function (t) { if (t.f && t.id !== "all" && t.f(c)) o.push(t.id); }); return o; }
function pageCats(t) { return cats.live.filter(function (c) { return catVisibleLive(c) && t.f(c); }).sort(function (a, b) { return (liveRank(a) - liveRank(b)) || (a.order - b.order); }); }
function hubTiles(evCount) {
  var mx = learnMax("tile") || 1, out = [];
  TILE_DEFS.forEach(function (t) {
    var n = 0, sub = "";
    if (t.id === "events") { if (!evCount) return; n = evCount; sub = evCount + (evCount === 1 ? " event" : " events") + " coming up"; }
    else if (t.id === "fav") { n = PD.list.filter(function (h) { return h.it.t === "live"; }).length; if (!n) return; sub = n + " saved"; }
    else if (t.id === "recent") { n = PD.hist.filter(function (h) { return h.it.t === "live"; }).length; if (!n) return; sub = Math.min(n, 30) + " channels"; }
    else { n = pageCats(t).length; if (!n) return; sub = n + (n === 1 ? " group" : " groups"); }
    var score = t.base + (t.id === "events" ? 100 : 40 * learnScore("tile", t.id) / mx);
    out.push({ t: "tile", id: t.id, n: t.label, sub: sub, img: "img/tiles/" + t.img + ".jpg", score: score, learned: learnScore("tile", t.id) > 0.5 });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out;
}

/* ---------------- page specs ---------------- */
var EV = { list: null, p: null, t: 0 };
function eventsP() { if (EV.list && Date.now() - EV.t < 10 * 60000) return Promise.resolve(EV.list); if (EV.p) return EV.p; EV.p = majorEvents().then(function (l) { EV.list = l; EV.t = Date.now(); EV.p = null; return l; }, function () { EV.p = null; return []; }); return EV.p; }
function liveLocalRows() { return rowsLocal("live"); }
function tileRows(tiles) {
  var rows = [];
  for (var i = 0; i < tiles.length; i += 5) (function (chunk, first) {
    rows.push({ title: first ? "Browse TV" : "", kind: "t", local: true, load: function () { return Promise.resolve(chunk); } });
  })(tiles.slice(i, i + 5), i === 0);
  return rows;
}
function hubSpecs() {
  var rows = [];
  var evN = EV.list ? EV.list.length : 0;
  if (!EV.list) eventsP().then(function (l) { if (V.view === "live" && !V.page && l.length && !OV.top() && !P.open) { var z = V.zone, top = z !== "rows" || (V.r === 0 && V.rows[0] && V.rows[0].col === 0); refreshLocalRows(); V.zone = z; if (top && V.rows.length) { V.r = 0; V.rows[0].col = 0; } if (z === "rows") applyFocus(); } });
  if (evN) rows.push({ title: EV.list.some(function (e) { return e.soon; }) ? "\u2B50 Live Events" : "\u2B50 Coming Up", kind: "e", local: true, load: function () { return Promise.resolve(EV.list); } });
  rows = rows.concat(tileRows(hubTiles(evN)));
  rows.push({ title: "Your top channels", kind: "l", epg: true, local: true, load: function () {
    var top = learnTop("ch", 20), out = [];
    top.forEach(function (x) { var h = histChan(x[0]); if (h) out.push(h); });
    if (out.length < 4) PD.hist.forEach(function (h) { if (h.it.t === "live" && out.length < 20 && !out.some(function (o) { return o.id == h.it.id; })) out.push(JSON.parse(JSON.stringify(h.it))); });
    return Promise.resolve(out);
  } });
  return rows;
}
function histChan(id) {
  for (var i = 0; i < PD.hist.length; i++) if (PD.hist[i].it.t === "live" && String(PD.hist[i].it.id) === String(id)) return JSON.parse(JSON.stringify(PD.hist[i].it));
  for (var j = 0; j < PD.list.length; j++) if (PD.list[j].it.t === "live" && String(PD.list[j].it.id) === String(id)) return JSON.parse(JSON.stringify(PD.list[j].it));
  var c = chanById(id); return c;
}
function catRows(list) {
  return list.map(function (c) {
    return { count: true, title: c.title, badge: c.code !== "MULTI" ? c.code : "", tag: c.ltype, load: function () { return loadCat(c).then(function (items) { var ok = adultOk(); return ok ? items : items.filter(function (x) { return !x.ad; }); }); } };
  });
}
function featuredFrom(list, max) {
  // learned favourites inside this page first, then channels with EPG/icons from the top categories
  return function () {
    var ids = {}; list.forEach(function (c) { ids[c.id] = 1; });
    return Promise.all(list.slice(0, 4).map(function (c) { return settle(loadCat(c)); })).then(function (ls) {
      var pool = []; ls.forEach(function (l) { pool = pool.concat(l.slice(0, 40)); });
      var learned = learnTop("ch", 40).map(function (x) { return x[0]; });
      var seen = {}, out = [];
      learned.forEach(function (id) { var h = histChan(id); if (h && ids[h.c] && !seen[h.id]) { seen[h.id] = 1; out.push(h); } });
      pool.sort(function (a, b) { return ((b.e ? 2 : 0) + (b.ic ? 1 : 0)) - ((a.e ? 2 : 0) + (a.ic ? 1 : 0)); });
      pool.forEach(function (it) { var k = it.n.toUpperCase().replace(/\W|HD|FHD|UHD/g, ""); if (!seen[it.id] && !seen[k] && out.length < (max || 24) && !it.ad) { seen[it.id] = 1; seen[k] = 1; out.push(it); } });
      return out;
    });
  };
}
function pageSpecs(pg) {
  var id = pg.id, t = TILE_BY[id] || {};
  if (id === "sports") return sportsSpecs();
  if (id === "news") return newsSpecs();
  if (id === "events") {
    return [{ title: "Major events", kind: "e", load: function () { return eventsP(); } }].concat(catRows(cats.live.filter(function (c) { return catVisibleLive(c) && c.ltype === "PPV & Events"; })));
  }
  if (id === "fav") return [{ title: "My Channels", kind: "l", epg: true, local: true, load: function () { return Promise.resolve(PD.list.filter(function (h) { return h.it.t === "live"; }).map(function (h) { return JSON.parse(JSON.stringify(h.it)); })); } }];
  if (id === "recent") return [{ title: "Recently Watched", kind: "l", epg: true, local: true, load: function () { return Promise.resolve(PD.hist.filter(function (h) { return h.it.t === "live"; }).slice(0, 40).map(function (h) { return JSON.parse(JSON.stringify(h.it)); })); } }];
  var list = pageCats(t);
  return [{ title: "Featured " + t.label, kind: "l", epg: true, load: featuredFrom(list) }].concat(catRows(list));
}
function sportsSpecs() {
  var rows = [], fav = PD.st.nhlTeam;
  rows.push({ title: fav ? "\uD83C\uDFD2 " + teamName(fav) + " \u2013 next games" : "\uD83C\uDFD2 NHL Hockey \u2013 your team", kind: "e", load: function () {
    var pick = { t: "action", id: "pickteam", n: fav ? "Change favourite team" : "Pick your favourite NHL team", sub: "Each profile can follow its own team", act: function () { openTeamPicker(); } };
    if (!fav) return nhlWeek().then(function (gs) { var up = gs.filter(function (g) { return g.state !== "post"; }); return [pick].concat(up.slice(0, 2).map(function (g) { g.big = true; return g; })); }, function () { return [pick]; });
    return nhlTeamGames(fav).then(function (gs) { gs = gs.filter(function (g) { return g.state !== "post"; }).slice(0, 3); gs.forEach(function (g) { g.big = true; g.fav = fav; }); return gs.concat([pick]); }, function () { pick.sub = "Couldn't reach the NHL schedule right now"; return [pick]; });
  } });
  rows.push({ title: "NHL Hockey \u2013 games this week", kind: "g", load: function () {
    return nhlWeek().then(function (gs) {
      var t = Date.now();
      return gs.filter(function (g) { return g.state === "in" || (g.state === "pre" && g.start > t - 3 * 3600000); }).sort(function (a, b) { return (a.state === "in" ? 0 : 1) - (b.state === "in" ? 0 : 1) || a.start - b.start || ((b.home.ab === fav || b.away.ab === fav) - (a.home.ab === fav || a.away.ab === fav)); });
    });
  } });
  rows.push({ title: "NHL & hockey channels", kind: "l", epg: true, load: leagueChannels(LEAGUES[0]) });
  leaguesOrdered().slice(1).forEach(function (lg) {
    if (lg.espn) rows.push({ title: lg.name + " \u2013 upcoming", kind: "g", load: function () { return espnUpcoming(lg).then(function (g) { return g.slice(0, 30); }); } });
    rows.push({ title: lg.name + " channels", kind: "l", epg: true, load: leagueChannels(lg) });
  });
  return rows.concat(catRows(pageCats(TILE_BY.sports)));
}
function leagueChannels(lg) {
  return function () {
    return ensureIndex().then(function (all) {
      var out = [], seen = {};
      all.forEach(function (ch) {
        if (!chanOK(ch)) return; var c = chanCat(ch);
        if (c.ltype !== "Sports" && c.ltype !== "PPV & Events" && !lg.re.test(ch.up)) return;
        var hit = lg.id === "NHL" ? /\bNHL\b|HOCKEY|NHL NETWORK/.test(ch.up) || (/SPORTSNET|\bTSN ?\d/.test(ch.up) && (c.code === "CA")) : lg.re.test(ch.up);
        if (!hit) return;
        var k = ch.up.replace(/[^A-Z0-9]|HD|FHD|UHD/g, ""); if (seen[k]) return; seen[k] = 1;
        out.push({ ch: ch, s: qualityBonus(ch) + (c.code === "CA" ? 2 : c.code === "US" ? 1.5 : 0) + learnScore("ch", String(ch.id)) + (/\d{1,2}:\d\d|@|VS/.test(ch.up) ? 1 : 0) });
      });
      out.sort(function (a, b) { return b.s - a.s; });
      return out.slice(0, 40).map(function (x) { return x.ch; });
    });
  };
}
var NEWS_FEAT = [["CBC News", /CBC NEWS(?! EXPLORE)/, "CA"], ["CTV News", /CTV NEWS/, "CA"], ["Global News", /GLOBAL NEWS|GLOBAL NATIONAL/, "CA"], ["CP24", /\bCP24\b/, "CA"], ["CNN", /\bCNN\b(?! ?(INT|ESP|EN ESP|XPRESS|HEADLINES|CHILE|BRASIL|TURK|PRIMA))/, "US"],
  ["Fox News", /FOX NEWS/, "US"], ["MSNBC", /\bMSNBC\b|MS NOW/, "US"], ["CNN International", /CNN INTERNATIONAL/, "US"], ["ABC News Live", /ABC NEWS/, "US"], ["NBC News Now", /NBC NEWS/, "US"], ["CBS News", /CBS NEWS/, "US"],
  ["BBC News", /BBC NEWS/, "UK"], ["Sky News", /SKY NEWS/, "UK"], ["GB News", /GB NEWS/, "UK"]];
var BIZ_FEAT = [["CNBC", /\bCNBC\b/], ["Bloomberg", /BLOOMBERG/], ["BNN Bloomberg", /\bBNN\b/], ["Fox Business", /FOX BUSINESS/]];
var WX_FEAT = [["The Weather Network", /WEATHER ?NETWORK|METEOMEDIA/], ["The Weather Channel", /WEATHER CHANNEL/], ["Fox Weather", /FOX WEATHER/], ["AccuWeather", /ACCU ?WEATHER/], ["WeatherNation", /WEATHER ?NATION/]];
function bestFor(all, re, pref) {
  var best = null, bs = -1e9;
  all.forEach(function (ch) {
    if (!re.test(ch.up) || !chanOK(ch)) return; var c = chanCat(ch);
    var s = qualityBonus(ch) + (pref && c.code === pref ? 2 : 0) - (CC_ORDER[c.code] != null ? CC_ORDER[c.code] * 0.2 : 2) + (c.ltype === "News" ? 0.5 : 0) + learnScore("ch", String(ch.id));
    if (s > bs) { bs = s; best = ch; }
  });
  return best;
}
function newsSpecs() {
  function feat(list) {
    return function () {
      return ensureIndex().then(function (all) {
        var out = []; list.forEach(function (f) { var b = bestFor(all, f[1], f[2]); if (b) { b.lbl = f[0]; out.push(b); } });
        out.sort(function (a, b) { return learnScore("ch", String(b.id)) - learnScore("ch", String(a.id)); });
        return out;
      });
    };
  }
  return [{ title: "Top news channels", kind: "l", epg: true, load: feat(NEWS_FEAT) },
    { title: "Business & markets", kind: "l", epg: true, load: feat(BIZ_FEAT) },
    { title: "Weather", kind: "l", epg: true, load: feat(WX_FEAT) }].concat(catRows(pageCats(TILE_BY.news)));
}

/* ---------------- cards for new kinds ---------------- */
function tileCard(it) {
  var c = ce("div", "tile");
  var im = document.createElement("img"); im.src = it.img; im.alt = ""; c.appendChild(im);
  c.appendChild(ce("div", "tile-shade"));
  c.appendChild(ce("div", "tile-l", it.n));
  c.appendChild(ce("div", "tile-s", it.sub || ""));
  if (it.learned) c.appendChild(ce("div", "tile-b", "For you"));
  return c;
}
function logoImg(src, cls) { var im = document.createElement("img"); im.className = cls || "tlogo"; im.alt = ""; if (src) im.src = src; im.onerror = function () { im.style.visibility = "hidden"; }; return im; }
function gameCard(g) {
  var c = ce("div", "gcard" + (g.state === "in" ? " live" : ""));
  if (g.home && g.away) {
    var r = ce("div", "g-teams");
    [g.away, g.home].forEach(function (t, i) {
      var b = ce("div", "g-team"); b.appendChild(logoImg(t.logo)); b.appendChild(ce("div", "g-ab", t.ab || t.common || ""));
      if (g.state !== "pre" && t.score != null) b.appendChild(ce("div", "g-sc", String(t.score)));
      r.appendChild(b); if (!i) r.appendChild(ce("div", "g-at", "@"));
    });
    c.appendChild(r);
  } else c.appendChild(ce("div", "g-title", g.title || g.n));
  var when = ce("div", "g-when cd"); when._start = g.start; when._live = g.state === "in";
  when.textContent = g.state === "in" ? "\u25CF LIVE " + (g.detail || "") : fmtWhen(g.start);
  c.appendChild(when);
  if (g.nets && g.nets.length) c.appendChild(ce("div", "g-net", "TV: " + g.nets.slice(0, 4).join(", ")));
  return c;
}
function bigCard(it) {
  var c = ce("div", "ecard" + (it.t === "action" ? " act" : ""));
  var bg = document.createElement("img"); bg.className = "e-bg"; bg.alt = "";
  bg.src = "img/tiles/" + (it.t === "event" ? "events" : it.lg === "NHL" || it.t === "action" ? "hockey" : "sports") + "_big.jpg";
  c.appendChild(bg); c.appendChild(ce("div", "e-shade"));
  var body = ce("div", "e-body");
  if (it.t === "action") {
    body.appendChild(ce("div", "e-kick", "\u2605 Favourite team"));
    body.appendChild(ce("div", "e-title", it.n)); body.appendChild(ce("div", "e-sub", it.sub || ""));
    var tl = ce("div", "e-logos"); NHL_TEAMS.slice(0, 8).forEach(function (t) { tl.appendChild(logoImg(nhlLogo(t[0]), "e-mini")); }); body.appendChild(tl);
  } else {
    var live = it.state === "in" || (it.start <= Date.now() && it.start > Date.now() - 3 * 3600000);
    var kick = it.t === "event" ? (live ? "\u25CF LIVE EVENT" : it.soon ? "LIVE EVENT" : "COMING UP") : it.fav ? (it.home.ab === it.fav || it.away.ab === it.fav ? "\u2605 Your team \u2013 next game" : "Next game") : "NHL \u2013 up next";
    body.appendChild(ce("div", "e-kick" + (live ? " red" : ""), kick));
    if (it.t === "game" && it.home) {
      var row = ce("div", "e-match");
      row.appendChild(logoImg(it.away.logo, "e-logo")); row.appendChild(ce("div", "e-vs", "@")); row.appendChild(logoImg(it.home.logo, "e-logo"));
      body.appendChild(row);
      var opp = it.fav ? (it.home.ab === it.fav ? "vs " + it.away.full : "at " + it.home.full) : it.away.full + " at " + it.home.full;
      body.appendChild(ce("div", "e-title sm", opp));
    } else body.appendChild(ce("div", "e-title", it.n));
    var w = ce("div", "e-when", live ? "" : fmtWhen(it.start)); body.appendChild(w);
    var cd = ce("div", "e-cd cd" + (live ? " live" : "")); cd._start = it.start; cd._live = it.state === "in"; cd.textContent = live ? "\u25CF LIVE NOW" + (it.detail ? " \u2013 " + it.detail : "") : countdown(it.start);
    body.appendChild(cd);
    if (it.nets && it.nets.length) body.appendChild(ce("div", "e-net", "TV: " + it.nets.slice(0, 5).join(", ")));
    body.appendChild(ce("div", "e-btn", "\u25B6 Watch \u2013 find channels"));
  }
  c.appendChild(body);
  return c;
}
/* keep countdowns fresh (only cards currently rendered) */
setInterval(function () {
  if (V.view !== "live" || P.open) return;
  var els = $("rows").getElementsByClassName("cd");
  for (var i = 0; i < els.length; i++) { var e = els[i]; if (e._start && !e._live && e.classList.contains("e-cd")) e.textContent = countdown(e._start); }
}, 30000);

/* ---------------- channel picker overlay ---------------- */
var PK = { id: "pick", ln: null, item: null, list: [] };
function openPicker(item) {
  PK.item = item; ovOpen(PK); renderPicker(null);
  var q = item.q || gameQuery(item);
  learnAdd("lg", item.lg, 1); (item.teams || []).forEach(function (t) { learnAdd("tm", t, 1); });
  ensureIndex().then(function () { if (PK.item !== item) return; PK.list = matchChannels(q); renderPicker(PK.list); }, function () { if (PK.item === item) renderPicker([], "Couldn't load the channel list from your provider."); });
}
function renderPicker(list, err) {
  var box = $("pick-inner"), it = PK.item; box.textContent = ""; box.style.transform = "";
  var ln = PK.ln = LN(box, 520);
  box.appendChild(ce("div", "pk-kick", it.t === "event" ? "LIVE EVENT" : (LG_BY[it.lg] ? LG_BY[it.lg].name : it.lg)));
  box.appendChild(ce("div", "pk-title", it.home && it.away ? it.away.full + " at " + it.home.full : it.n));
  var live = it.state === "in";
  box.appendChild(ce("div", "pk-when", (live ? "\u25CF LIVE NOW" : fmtWhen(it.start) + "  \u00b7  " + countdown(it.start)) + (it.nets && it.nets.length ? "   \u00b7   TV: " + it.nets.join(", ") : "")));
  if (!list) { box.appendChild(ce("div", "pk-note", err || "Finding matching channels in your provider\u2026")); var b0 = ce("div", "btn", "\u2190 Back"); b0._act = closePicker; var l0 = ce("div", "s-line"); l0.appendChild(b0); box.appendChild(l0); lnAdd(ln, l0, [b0]); lnFocus(ln); return; }
  box.appendChild(ce("div", "pk-note", list.length ? "Best matches first (team names, broadcaster and date). Press OK to watch; \u25B2\u25BC while watching flips through these channels." : (err || "No matching channel found yet \u2013 providers usually add game/event channels a few hours before start. Try the league channels below.")));
  var items = list.map(function (m) { return m.ch; });
  list.slice(0, 14).forEach(function (m, i) {
    var c = chanCat(m.ch), l = ce("div", "s-line"), b = ce("div", "pk-ch");
    b.appendChild(logoImg(m.ch.ic, "pk-ic"));
    var tx = ce("div", "pk-tx"); tx.appendChild(ce("div", "pk-n", m.ch.n)); tx.appendChild(ce("div", "pk-c", (c ? c.title + " \u00b7 " + c.code : "") + (m.why.length ? "  \u00b7  matched: " + m.why.slice(0, 4).join(", ") : ""))); b.appendChild(tx);
    if (i === 0) b.appendChild(ce("div", "pk-best", "Best match"));
    b._act = function () { closePicker(true); P.game = PK.item; playItem(m.ch, items, i); };
    l.appendChild(b); box.appendChild(l); lnAdd(ln, l, [b]);
  });
  var bl = ce("div", "s-line"), bits = [];
  if (LG_BY[it.lg]) { var lb = ce("div", "btn", "Browse " + LG_BY[it.lg].name + " channels"); lb._act = function () { closePicker(); openLivePage("sports"); }; bl.appendChild(lb); bits.push(lb); }
  var bb = ce("div", "btn", "\u2190 Back"); bb._act = closePicker; bl.appendChild(bb); bits.push(bb);
  box.appendChild(bl); lnAdd(ln, bl, bits);
  lnFocus(ln);
}
function closePicker(silent) { ovClose(PK); PK.item = null; if (!silent) restoreFocus(); }
PK.key = function (k) { if (k === "back") { closePicker(); return; } lnKey(PK.ln, k); };

/* ---------------- team picker overlay ---------------- */
var TP = { id: "teams", ln: null };
function openTeamPicker() { ovOpen(TP); renderTeams(); }
function renderTeams() {
  var box = $("teams-inner"); box.textContent = ""; box.style.transform = "";
  var ln = TP.ln = LN(box, 520);
  box.appendChild(ce("div", "s-h1", "Favourite NHL team"));
  box.appendChild(ce("div", "s-sub", "For " + PF.name + ". Your team's next game is shown first in Sports with a countdown, and the Watch button finds the right channel."));
  var list = NHL_TEAMS.concat([["", "No favourite"]]);
  grid(box, ln, list, 8, function (t) {
    var b = ce("div", "tm" + (PD.st.nhlTeam === t[0] || (!t[0] && !PD.st.nhlTeam) ? " sel" : ""));
    if (t[0]) b.appendChild(logoImg(nhlLogo(t[0]), "tm-logo")); else b.appendChild(ce("div", "tm-none", "\u2715"));
    b.appendChild(ce("div", "tm-n", t[0] ? t[1].split(" ").slice(-1)[0] === "Leafs" ? "Maple Leafs" : t[1].replace(/^(New York|Los Angeles|San Jose|St\. Louis|Tampa Bay|New Jersey|Las Vegas|Vegas) /, "").split(" ").slice(-2).join(" ").replace(/^(Toronto|Montreal|Calgary|Edmonton|Ottawa|Winnipeg|Vancouver|Boston|Buffalo|Anaheim|Carolina|Chicago|Colorado|Columbus|Dallas|Detroit|Florida|Minnesota|Nashville|Philadelphia|Pittsburgh|Seattle|Utah|Washington) /, "") : t[1]));
    b._key = "tm:" + t[0];
    b._act = function () { PD.st.nhlTeam = t[0] || ""; savePD(true); if (t[0]) learnAdd("tm", t[0], 3); ovClose(TP); toast(t[0] ? t[1] + " is now " + PF.name + "'s team" : "Favourite team cleared"); if (OV.top() === ST) { ST.dirty = true; renderSettings("x"); return; } if (V.view === "live") refreshLocalRows(); restoreFocus(); };
    return b;
  });
  if (!PD.st.nhlTeam || !lnFind(ln, "tm:" + PD.st.nhlTeam)) { ln.li = 0; ln.ci = 0; }
  lnFocus(ln);
}
TP.key = function (k) { if (k === "back") { ovClose(TP); restoreFocus(); return; } lnKey(TP.ln, k); };

/* ---------------- navigation between hub and pages ---------------- */
function openLivePage(id) {
  learnAdd("tile", id, 0.3);
  V.pageStack = V.pageStack || [];
  V.pageStack.push({ page: V.page, r: V.r, col: V.rows[V.r] ? V.rows[V.r].col : 0, tileId: id });
  V.page = { id: id };
  if (V.view !== "live") { V.navIdx = TAB_VIEWS.indexOf("live"); }
  buildView("live"); V.zone = "rows"; V.r = 0; applyFocus();
  if (!CH.all) ensureIndex().catch(function () {});
}
function closeLivePage() {
  var s = (V.pageStack || []).pop();
  V.page = s ? s.page : null;
  buildView("live"); V.zone = "rows";
  if (s && V.rows.length) {
    V.r = Math.min(s.r, V.rows.length - 1); var row = V.rows[V.r];
    // tiles may have been re-ordered by learning: put focus back on the tile we came from
    V.rows.forEach(function (rw, ri) { (rw.items || []).forEach(function (it, ci) { if (it.t === "tile" && it.id === s.tileId) { V.r = ri; row = rw; s.col = ci; } }); });
    row.col = s.col; row.off = Math.max(0, Math.min(s.col - 1, (row.items ? row.items.length : 99) - row.K.vis + 1)); }
  applyFocus();
}
function pageTitle() {
  if (!V.page) return "";
  var t = TILE_BY[V.page.id]; return t ? t.label : V.page.id;
}
