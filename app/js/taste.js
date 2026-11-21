/* NickFlix 4.14 - taste profile seed, people (cast / director) affinity and ratings (thumbs down / up / Love it).
   - Seed: a one-time, versioned taste profile for the profile named "Nick" (PD.tp). It merges with the existing
     watch history (nothing is replaced) and is only used for scoring: there is no "your favourites" row. It acts as a
     head start: its weight fades as real viewing builds up (1 / (1 + finished-or-watched VOD sittings / 60), floor 0.35).
   - People: cast (top 4 billed) and director come from data the app already has (series list API, details pages via
     get_vod_info, NAS/Cinemeta), cached per title in nf_ppl (no extra network calls). Watching feeds learn "pp";
     ratings and the seed add to it. Used as a moderate bonus next to genre affinity, only when a title has cast data.
   - Ratings: PD.rt[itemKey] = { v: -1 | 1 | 2, ts, it, g, p }. Toggle (press the active one again to clear).
     Love > Like; Not for me demotes the title hard (and hides it from Today's picks / themed rows) and its genres lightly.
   Everything stays per profile in localStorage and is included in the 4.12 profile backup (nf_p_<id>). */
"use strict";
var TS_VER = 2;   // 4.15: v2 adds documentaries / motorsport / mountain biking / space westerns, a Quebec penalty and stronger weights
var TS_SEED = {
  id: "nick-2026-11", re: /^nick\b/i,
  // genre weights (category genres from core.js GENRES + TMDB/provider genre words)
  gen: { "Thriller & Crime": 95, "Crime": 85, "Comedy": 70, "Drama": 55, "Sci-Fi & Fantasy": 80, "Sci-Fi": 60, "Science Fiction": 50, "Fantasy": 25,
    "Documentary": 92, "Action & Adventure": 55, "Action": 40, "Adventure": 30, "Mystery": 35, "Western": 42, "War & History": 48, "War": 20,
    "Politics": 48, "History": 40, "Sport": 35, "Sports": 35, "Animation & Anime": 15, "Animation": 15, "Reality": 10 },
  // [title, type, year, tmdb, weight (Love = 2), genres, people]
  titles: [
    ["Fight Club", "movies", 1999, 550, 1, ["Drama", "Thriller & Crime"], ["Brad Pitt", "Edward Norton", "Helena Bonham Carter", "David Fincher"]],
    ["Heat", "movies", 1995, 949, 1, ["Thriller & Crime", "Action & Adventure"], ["Al Pacino", "Robert De Niro", "Val Kilmer", "Michael Mann"]],
    ["The Big Lebowski", "movies", 1998, 115, 1, ["Comedy", "Thriller & Crime"], ["Jeff Bridges", "John Goodman", "Steve Buscemi", "Joel Coen", "Ethan Coen"]],
    ["Die Hard", "movies", 1988, 562, 1, ["Action & Adventure", "Thriller & Crime"], ["Bruce Willis", "Alan Rickman", "John McTiernan"]],
    ["A Scanner Darkly", "movies", 2006, 3509, 1, ["Sci-Fi & Fantasy", "Animation & Anime"], ["Keanu Reeves", "Robert Downey Jr.", "Woody Harrelson", "Richard Linklater"]],
    ["Fear and Loathing in Las Vegas", "movies", 1998, 1878, 1, ["Comedy", "Drama"], ["Johnny Depp", "Benicio del Toro", "Terry Gilliam"]],
    ["Mr. Brooks", "movies", 2007, 3432, 1, ["Thriller & Crime"], ["Kevin Costner", "Demi Moore", "William Hurt", "Bruce A. Evans"]],
    ["One Battle After Another", "movies", 2025, 1054867, 1, ["Thriller & Crime", "Comedy", "Action & Adventure"], ["Leonardo DiCaprio", "Sean Penn", "Benicio del Toro", "Paul Thomas Anderson"]],
    ["The Wolf of Wall Street", "movies", 2013, 106646, 1, ["Comedy", "Thriller & Crime", "Drama"], ["Leonardo DiCaprio", "Jonah Hill", "Margot Robbie", "Martin Scorsese"]],
    ["Blow", "movies", 2001, 4133, 1, ["Thriller & Crime", "Drama"], ["Johnny Depp", "Penelope Cruz", "Ray Liotta", "Ted Demme"]],
    ["Pulp Fiction", "movies", 1994, 680, 1, ["Thriller & Crime", "Comedy"], ["John Travolta", "Samuel L. Jackson", "Uma Thurman", "Bruce Willis", "Quentin Tarantino"]],
    ["Vicky Cristina Barcelona", "movies", 2008, 5038, 1, ["Romance", "Comedy", "Drama"], ["Javier Bardem", "Scarlett Johansson", "Penelope Cruz", "Woody Allen"]],
    ["The Life Aquatic with Steve Zissou", "movies", 2004, 421, 1, ["Comedy", "Action & Adventure"], ["Bill Murray", "Owen Wilson", "Cate Blanchett", "Wes Anderson"]],
    ["Super Troopers", "movies", 2001, 39939, 1, ["Comedy", "Thriller & Crime"], ["Jay Chandrasekhar", "Kevin Heffernan", "Steve Lemme", "Paul Soter", "Erik Stolhanske"]],
    ["Breaking Bad", "series", 2008, 1396, 1, ["Drama", "Crime", "Thriller & Crime"], ["Bryan Cranston", "Aaron Paul", "Anna Gunn", "Vince Gilligan"]],
    ["Game of Thrones", "series", 2011, 1399, 1, ["Sci-Fi & Fantasy", "Drama", "Action & Adventure"], ["Peter Dinklage", "Emilia Clarke", "Kit Harington", "Lena Headey"]],
    ["Seinfeld", "series", 1989, 1400, 1, ["Comedy"], ["Jerry Seinfeld", "Julia Louis-Dreyfus", "Jason Alexander", "Michael Richards", "Larry David"]],
    ["How It's Made", "series", 2001, 1749, 2, ["Documentary"], []],
    ["Rick and Morty", "series", 2013, 60625, 1, ["Animation", "Comedy", "Sci-Fi & Fantasy"], ["Justin Roiland", "Chris Parnell", "Dan Harmon"]],
    ["Better Call Saul", "series", 2015, 60059, 1, ["Crime", "Drama", "Thriller & Crime"], ["Bob Odenkirk", "Rhea Seehorn", "Jonathan Banks", "Giancarlo Esposito", "Vince Gilligan"]],
    ["Top Gear", "series", 2002, 45, 1, ["Reality", "Documentary"], ["Jeremy Clarkson", "Richard Hammond", "James May"]],
    ["South Park", "series", 1997, 2190, 1, ["Animation", "Comedy"], ["Trey Parker", "Matt Stone"]],
    ["Black Mirror", "series", 2011, 42009, 1, ["Sci-Fi & Fantasy", "Drama", "Mystery"], ["Charlie Brooker"]],
    ["Stranger Things", "series", 2016, 66732, 1, ["Sci-Fi & Fantasy", "Drama", "Mystery"], ["Millie Bobby Brown", "David Harbour", "Winona Ryder", "The Duffer Brothers"]],
    ["Severance", "series", 2022, 95396, 1, ["Sci-Fi & Fantasy", "Drama", "Mystery"], ["Adam Scott", "Britt Lower", "John Turturro", "Ben Stiller"]],
    ["The X-Files", "series", 1993, 4087, 1, ["Sci-Fi & Fantasy", "Mystery", "Drama"], ["David Duchovny", "Gillian Anderson", "Chris Carter"]],
    ["Archer", "series", 2009, 10283, 1, ["Animation", "Comedy", "Action & Adventure"], ["H. Jon Benjamin", "Aisha Tyler", "Adam Reed"]],
    ["Mr. Robot", "series", 2015, 62560, 1, ["Crime", "Drama", "Mystery"], ["Rami Malek", "Christian Slater", "Carly Chaikin", "Sam Esmail"]],
    ["Trailer Park Boys", "series", 2001, 3796, 1, ["Comedy", "Crime"], ["Robb Wells", "John Paul Tremblay", "Mike Smith", "Mike Clattenburg"]],
    // added later: "I loved that show" -> weighted like a Love it
    ["The Mandalorian", "series", 2019, 82856, 2, ["Sci-Fi & Fantasy", "Action & Adventure", "Western"], ["Pedro Pascal", "Jon Favreau", "Dave Filoni", "Giancarlo Esposito"]],
    // 4.15 (v2): things Nick named - Senna / sports legends, How It's Made, motorsport incl. rally
    ["Senna", "movies", 2010, 58496, 2, ["Documentary"], ["Ayrton Senna", "Asif Kapadia"]],
    ["Formula 1: Drive to Survive", "series", 2019, 0, 1, ["Documentary"], []]
  ],
  // extra people (on top of those listed with the titles)
  people: { "David Fincher": 2, "Michael Mann": 2, "Joel Coen": 2, "Ethan Coen": 2, "Martin Scorsese": 2, "Quentin Tarantino": 2, "Wes Anderson": 2,
    "Richard Linklater": 1.5, "Terry Gilliam": 1.5, "Paul Thomas Anderson": 1.5, "Ted Demme": 1, "Woody Allen": 1, "Jay Chandrasekhar": 1.5, "Broken Lizard": 1.5,
    "Brad Pitt": 2, "Edward Norton": 1.5, "Al Pacino": 2, "Robert De Niro": 2, "Jeff Bridges": 1.5, "John Goodman": 1.5, "Bruce Willis": 1.5,
    "Keanu Reeves": 1.5, "Johnny Depp": 2, "Kevin Costner": 1.5, "Leonardo DiCaprio": 2.5, "Samuel L. Jackson": 1.5, "John Travolta": 1, "Uma Thurman": 1,
    "Bill Murray": 1.5, "Javier Bardem": 1, "Scarlett Johansson": 1, "Bryan Cranston": 2, "Aaron Paul": 1.5, "Bob Odenkirk": 2, "Rami Malek": 1.5, "Pedro Pascal": 2.5 },
  // keywords in title / plot / genre text
  kw: [["heist|robbery|bank job|\\bthie(f|ves)\\b|con (man|artist)", 1], ["cartel|narco|drug (lord|dealer|trade)|smuggl|cocaine|kingpin", 1], ["\\bmob\\b|mafia|gangster|organi[sz]ed crime", 1],
    ["conspirac|cover.?up|government secret|whistleblow", 1], ["hacker|cyber|dystopi|simulation|alien|time travel|parallel (world|universe)", 1], ["star wars|mandalorian|bounty hunter|space western|galax|jedi|boba fett|andor|firefly|serenity", 2],
    ["stoner|psychedelic|\\blsd\\b|hallucinat", 0.8], ["mockumentary|satir|dark comedy|black comedy", 1], ["top gear|grand tour|\\bcars?\\b|motor|racing|rally|garage|mechanic|horsepower", 0.8],
    ["how it'?s made|engineering|factory|megastructure|how .{1,20} works", 0.8], ["9\\/11|september 11|twin towers|world trade center|al.?qaeda|war on terror", 1.2],
    ["politic|election|president|white house|congress|parliament|democracy|propaganda", 1], ["science|scientist|physics|cosmos|universe|space|nasa", 0.7], ["documentar|docu.?series", 0.8],
    // 4.15 (v2)
    ["rally|\\bwrc\\b|dakar|formula (1|one)|\\bf1\\b|grand prix|motogp|le mans|nascar|indycar|motorsport|isle of man tt|superbike|senna|schumacher|lauda|mclaren|ferrari", 1.4],
    ["mountain bik|\\bmtb\\b|downhill|rampage|freeride|enduro|\\bbmx\\b|red bull|extreme sport|free solo|climb", 1.2],
    ["cold war|world war|wwii|vietnam|chernobyl|apollo|moon landing|iraq war|afghanistan|modern history|watergate|kennedy|nixon|ground zero", 1],
    ["sports? (legend|documentar)|the last dance|30 for 30|untold|biopic|champion|olympi", 0.8],
    ["heist|robbery|cartel|mafia|gangster", 0.4],
    // he dislikes Quebec / French-Canadian content (also hidden by the Quebec filter when it is on)
    ["qu[e\\u00e9]bec|qu[e\\u00e9]b[e\\u00e9]cois|montr[e\\u00e9]al|french.canadian|\\bvfq\\b|\\(qc\\)|radio.canada|t[e\\u00e9]l[e\\u00e9].qu[e\\u00e9]bec", -4]],
  // theme preferences for the daily themed rows (themes.js)
  th: { crime: 1, cult: 1, scifi: 0.9, darkcom: 0.9, docthink: 1.1, polit: 1, cars: 0.9, space: 1.2, stoner: 0.6, canuck: 0.7, how: 1, prestige: 1,
    motor: 1.3, mtb: 1.1, sportsleg: 1.2, history: 1.1 },
  // 4.15: prestige collections (prestige.js) Nick leans to
  pr: { m_doc: 1.4, m_bp: 1, m_imdb: 1.1, m_palme: 0.6, m_critics: 0.8, m_modern: 0.9, s_imdb: 1.1, s_emmyd: 1.1, s_great: 1, s_globe: 0.8 }
};
function tsNorm(s) { return String(s || "").toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, ""); }
function tsPerson(s) { return String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z\u00c0-\u024f]+/g, " ").trim(); }
/* ---------- seed (one time, versioned, merges) ---------- */
function tsApplySeed() {
  if (!PF || !PD || !TS_SEED.re.test(String(PF.name || "").trim())) return false;
  var tp = PD.tp;
  if (tp && tp.seed === TS_SEED.id && tp.v >= TS_VER) return false;
  tp = tp || {}; var S = TS_SEED;
  tp.gen = tp.gen || {}; tp.pp = tp.pp || {}; tp.tl = tp.tl || {}; tp.tm = tp.tm || {}; tp.th = tp.th || {};
  function mx(o, k, v) { if (!(o[k] >= v)) o[k] = v; }
  for (var g in S.gen) mx(tp.gen, g, S.gen[g]);
  S.titles.forEach(function (t) {
    mx(tp.tl, t[1] + ":" + tsNorm(t[0]), t[4]); if (t[3]) mx(tp.tm, t[1] + ":" + t[3], t[4]);
    t[5].forEach(function (g2) { mx(tp.gen, g2, (tp.gen[g2] || 0) + 4 * t[4]); });
    t[6].forEach(function (p, i) { var k = tsPerson(p); mx(tp.pp, k, Math.min(3, (tp.pp[k] || 0) + (i < 4 ? 1 : 0.5) * t[4])); });
  });
  for (var p2 in S.people) mx(tp.pp, tsPerson(p2), S.people[p2]);
  for (var h in S.th) mx(tp.th, h, S.th[h]);
  tp.pr = tp.pr || {}; for (var h2 in (S.pr || {})) mx(tp.pr, h2, S.pr[h2]);
  tp.kw = S.kw.slice(); tp.seed = S.id; tp.v = TS_VER; tp.ts = Date.now();
  PD.tp = tp; TSC.v = null; savePD(); return true;
}
var _loadProfile414 = loadProfile;
loadProfile = function (id) { _loadProfile414(id); try { tsApplySeed(); } catch (e) {} };
try { if (PF && PD) tsApplySeed(); } catch (e0) {}
/* the seed is a head start: it fades as real (not abandoned) VOD viewing builds up */
function tsFade() {
  var n = 0; try { (PD.wl || []).forEach(function (e) { if (e.t !== "live" && !whAbandon(e)) n++; }); } catch (e) {}
  return Math.max(0.35, 1 / (1 + n / 60));
}
/* ---------- people cache (from details pages, series list, NAS) ---------- */
var PPL = null;
function pplBox() { if (!PPL) PPL = lsGet("nf_ppl", null) || { k: [], m: {} }; return PPL; }
function pplSplit(s) { return String(s || "").split(/\s*[,;\/|]\s*|\s+and\s+/).map(function (x) { return x.replace(/\(.*?\)/g, "").trim(); }).filter(function (x) { return x.length > 2 && x.length < 40; }); }
function pplFromItem(it) { var c = pplSplit(it.cast).slice(0, 4), d = pplSplit(it.dir).slice(0, 2); return c.length || d.length ? { c: c, d: d } : null; }
var pplSaveT = null;
function pplRemember(it) {
  if (!it || it.t === "live") return; var x = pplFromItem(it); if (!x) return;
  var B = pplBox(), ks = [itemKey(it)]; if (it.tm && it.tm !== "0") ks.push("tm:" + it.t + ":" + it.tm);
  var v = x.c.join(";") + "|" + x.d.join(";"), ch = false;
  ks.forEach(function (k) { if (B.m[k] !== v) { if (!(k in B.m)) B.k.push(k); B.m[k] = v; ch = true; } });
  while (B.k.length > 1500) delete B.m[B.k.shift()];
  if (ch) { clearTimeout(pplSaveT); pplSaveT = setTimeout(function () { lsSet("nf_ppl", PPL); }, 1500); }
}
/* [{n: lowercased name, w: billing weight}] - cast top 4 (1, .8, .65, .5) + director (1) */
function ppOf(it) {
  if (!it || it.t === "live") return [];
  var x = pplFromItem(it);
  if (!x) { var B = pplBox(), v = B.m[itemKey(it)] || (it.tm ? B.m["tm:" + it.t + ":" + it.tm] : null); if (v) { var a = v.split("|"); x = { c: a[0] ? a[0].split(";") : [], d: a[1] ? a[1].split(";") : [] }; } }
  if (!x) return [];
  var W = [1, 0.8, 0.65, 0.5], out = [];
  x.c.forEach(function (n, i) { out.push({ n: tsPerson(n), w: W[i] || 0.4, d: n }); });
  x.d.forEach(function (n) { out.push({ n: tsPerson(n), w: 1, d: n, dir: true }); });
  return out.filter(function (p) { return p.n; });
}
var _mergeInfo414 = mergeInfo;
mergeInfo = function (it, inf) { _mergeInfo414(it, inf); try { pplRemember(it); } catch (e) {} };
/* watching feeds people affinity (learn kind "pp", 21-day half-life like the other learned kinds) */
var _addWatchTime414 = addWatchTime;
addWatchTime = function (it, sec) {
  _addWatchTime414(it, sec);
  try { if (it && it.t !== "live") { pplRemember(it); ppOf(it).forEach(function (p) { learnAdd("pp", p.n, sec / 60 * p.w); }); TSC.v = null; } } catch (e) {}
};
/* ---------- ratings ---------- */
var RT_TXT = { "-1": "\uD83D\uDC4E", "1": "\uD83D\uDC4D", "2": "\uD83D\uDC4D\uD83D\uDC4D" };
var RT_LBL = { "-1": "Not for me", "1": "I like this", "2": "Love this!" };
function rtBox() { if (!PD.rt) PD.rt = {}; return PD.rt; }
function rtIndex() {
  if (TSC.rti && TSC.rtiPD === PD && TSC.rtiN === TSC.n) return TSC.rti;
  var o = {}, R = rtBox(); for (var k in R) { var e = R[k]; o[k] = e.v; if (e.nt) o["n:" + e.nt] = e.v; }
  TSC.rti = o; TSC.rtiPD = PD; TSC.rtiN = TSC.n; return o;
}
function rtGet(it) { if (!PD || !it) return 0; var I = rtIndex(); return I[itemKey(it)] || I["n:" + normTitle(it)] || 0; }
function rtSet(it, v) {
  var R = rtBox(), k = itemKey(it), cur = rtGet(it);
  // clear any copy of the same title (another provider entry / tmdb twin)
  var nt = normTitle(it); for (var x in R) if (x === k || R[x].nt === nt) delete R[x];
  if (cur === v) v = 0;
  if (v) {
    var g = []; try { g = itemGenres(it).slice(0, 4); if (it.t !== "live") g = g.concat(whInfo(it).cats.filter(function (c) { return g.indexOf(c) < 0 && c !== "Movies" && c !== "Shows"; })); } catch (e) {}
    R[k] = { v: v, ts: Date.now(), it: snap(it), g: g.slice(0, 6), p: ppOf(it).slice(0, 5).map(function (p) { return p.n; }), nt: nt };
    var ks = Object.keys(R); if (ks.length > 600) { ks.sort(function (a, b) { return R[a].ts - R[b].ts; }); delete R[ks[0]]; }
  }
  TSC.n++; TSC.v = null; try { WHA.v = null; } catch (e2) {}
  savePD(true);
  return v;
}
function rtDisliked(it) { return rtGet(it) < 0; }
/* ---------- the combined taste model ---------- */
var TSC = { v: null, t: 0, pd: null, n: 0 };
function tsModel() {
  if (TSC.v && TSC.pd === PD && Date.now() - TSC.t < 4000) return TSC.v;
  var tp = PD.tp || null, f = tsFade(), M = { gen: {}, pp: {}, tl: {}, tm: {}, kw: [], ppMax: 0, f: f };
  if (tp) {
    for (var g in tp.gen) M.gen[g] = 5 * f * tp.gen[g] / 95;
    for (var p in tp.pp) M.pp[p] = 2 * f * tp.pp[p];
    M.tl = tp.tl || {}; M.tm = tp.tm || {};
    (tp.kw || []).forEach(function (k) { try { M.kw.push([new RegExp(k[0], "i"), k[1] * f]); } catch (e) {} });
  }
  learnTop("pp", 60).forEach(function (x) { M.pp[x[0]] = (M.pp[x[0]] || 0) + Math.min(6, x[1] / 15); });
  var R = rtBox();
  for (var k in R) {
    var e = R[k], gw = e.v === 2 ? 5 : e.v === 1 ? 2.5 : -1.5, pw = e.v === 2 ? 4 : e.v === 1 ? 2 : -0.5;
    (e.g || []).forEach(function (x) { M.gen[x] = (M.gen[x] || 0) + gw; });
    (e.p || []).forEach(function (x, i) { M.pp[x] = (M.pp[x] || 0) + pw * (i < 4 ? 1 : 0.6); });
  }
  for (var q in M.pp) M.ppMax = Math.max(M.ppMax, M.pp[q]);
  TSC.v = M; TSC.t = Date.now(); TSC.pd = PD; return M;
}
/* genre affinity (profiles.js affinity -> wh.js) now also includes the seed and ratings */
var _affinity414 = affinity;
affinity = function () {
  var a = _affinity414(), M = tsModel();
  for (var g in M.gen) a[g] = (a[g] || 0) + M.gen[g];
  return a;
};
function tsIsSeedTitle(it) { var M = tsModel(); return (it.tm && M.tm[it.t + ":" + it.tm]) || M.tl[it.t + ":" + tsNorm(it.n)] || 0; }
/* people bonus in "genre points" (0..6), only when the title has cast/director data */
function ppBonus(it) {
  var ps = ppOf(it); if (!ps.length) return 0;
  var M = tsModel(), s = 0; ps.forEach(function (p) { var a = M.pp[p.n]; if (a) s += p.w * a; });
  return Math.max(-2, Math.min(6, s * 0.8));
}
function ppTop(n) {   // strongest person affinities [[name, score]] (display names from the seed / cache)
  var M = tsModel(), arr = []; for (var k in M.pp) if (M.pp[k] > 0) arr.push([k, M.pp[k]]);
  arr.sort(function (a, b) { return b[1] - a[1]; }); return arr.slice(0, n || 5);
}
function tsKwBonus(it) {
  var M = tsModel(); if (!M.kw.length) return 0;
  var n = String(it.n || ""), o = String(it.genre || "") + " " + String(it.plot || "").slice(0, 400), s = 0;
  M.kw.forEach(function (k) { if (k[0].test(n)) s += 1.2 * k[1]; else if (o.length > 1 && k[0].test(o)) s += 0.6 * k[1]; });
  return Math.min(3, s);
}
/* item-level taste on top of genre affinity (Top Picks, Today's picks, themed rows) */
function tasteBoost(it) {
  if (!PD || !it || it.t === "live") return 0;
  var r = rtGet(it); if (r < 0) return -60;
  // the seed favourites themselves are known: they drive the scores but are held back a little so the rows don't read
  // like a "your favourites" list (they can still show up naturally)
  return ppBonus(it) + tsKwBonus(it) + (tsIsSeedTitle(it) && !r ? -4 : 0) + (r === 2 ? 6 : r === 1 ? 3 : 0);
}
/* deterministic per-day jitter 0..1 for one item (date + profile + salt) */
function tsJit(it, salt) { return dpRng(dpToday() + "|" + (PF ? PF.id : "") + "|" + (salt || "") + "|" + itemKey(it))(); }   // mulberry32: well mixed
/* daily mix: keep the top relevance but vary order and which items fill the row */
function tsMix(items, salt) {
  if (!items || !items.length || !PF) return items || [];
  var l = items.filter(function (it) { return !rtDisliked(it); }), head = l.slice(0, 90), rest = l.slice(90);
  var sc = head.map(function (it, i) { return { it: it, k: i < 2 ? i - 10 : i + tsJit(it, salt) * 7 }; });
  sc.sort(function (a, b) { return a.k - b.k; });
  return sc.map(function (x) { return x.it; }).concat(rest);
}
/* the series list carries cast/director (the 6 h pool cache drops it): remember it for titles with people you like */
var _loadCat414 = loadCat;
loadCat = function (c) {
  var p = _loadCat414(c);
  if (c && c.type === "series" && !c._ppl) { c._ppl = 1; p.then(function (l) { try { var M = tsModel(); (l || []).forEach(function (it) { if ((it.cast || it.dir) && ppOf(it).some(function (q) { return M.pp[q.n] > 0; })) pplRemember(it); }); } catch (e) {} }, function () {}); }
  return p;
};
