/* NickFlix 4.14 - News made easy to reach on Live TV.
   TV hub: a "News" tile row near the top (Canada / US / World / Business / All news) and a "Live news now" row
   with the main channel of each big brand (one OK to watch, EPG now/next shown).
   News pages: Canada, US and World sections, each with its featured brands (best stream per brand: HD, EPG, logo,
   your own viewing) and every other news channel of that region; the News tile page leads with all three.
   Channels are classified from the provider's country codes, the News category type and the channel names
   (world brands like BBC World, Sky News, Al Jazeera, DW, France 24 count as World even when filed under UK/EN). */
"use strict";
var NEWS_CA = [["CBC News Network", /CBC NEWS(?! EXPLORE)|CBC NN\b/], ["CTV News Channel", /CTV NEWS/], ["Global News", /GLOBAL NEWS|GLOBAL NATIONAL/], ["CP24", /\bCP24\b/],
  ["CityNews", /CITY ?NEWS/], ["CPAC", /\bCPAC\b/], ["BNN Bloomberg", /\bBNN\b/], ["CHCH News", /\bCHCH\b/], ["ICI RDI", /\bRDI\b/], ["LCN", /\bLCN\b/]];
var NEWS_US = [["CNN", /\bCNN\b(?! ?(INT|ESP|EN ESP|XPRESS|HEADLINES|CHILE|BRASIL|TURK|PRIMA|INDONESIA|PORTUGAL|GREECE))/], ["Fox News", /FOX NEWS/], ["MSNBC", /\bMSNBC\b|MS ?NOW/],
  ["CNBC", /\bCNBC\b(?! ?(EUROPE|ASIA|AFRICA|ARABIA|TV18|INDONESIA))/], ["ABC News Live", /ABC NEWS/], ["NBC News Now", /NBC NEWS/], ["CBS News", /CBS NEWS/], ["NewsNation", /NEWS ?NATION/],
  ["Newsmax", /NEWSMAX/], ["C-SPAN", /C-?SPAN/], ["Fox Business", /FOX BUSINESS/], ["Bloomberg", /BLOOMBERG(?! ?(QUICKTAKE ASIA))/], ["Scripps News", /SCRIPPS NEWS/], ["LiveNOW from FOX", /LIVE ?NOW/], ["HLN", /\bHLN\b/]];
var NEWS_WORLD = [["BBC World News", /BBC WORLD/], ["BBC News", /BBC NEWS/], ["Sky News", /SKY NEWS(?! ?(ARABIA|AUSTRALIA|EXTRA))/], ["Al Jazeera English", /AL ?JAZEERA|ALJAZEERA/], ["CNN International", /CNN INT/],
  ["DW News", /\bDW\b|DEUTSCHE WELLE/], ["France 24", /FRANCE ?24/], ["Euronews", /EURONEWS/], ["NHK World", /NHK WORLD/], ["TRT World", /TRT WORLD/], ["i24 News", /\bI24/],
  ["WION", /\bWION\b/], ["CNA", /CHANNEL NEWS ?ASIA|\bCNA\b/], ["Sky News Australia", /SKY NEWS AUS/], ["ABC Australia", /ABC (AUSTRALIA|NEWS 24)/], ["GB News", /GB NEWS/], ["Arirang", /ARIRANG/]];
var NEWS_RE = /NEWS|\bCNN\b|\bCNBC\b|MSNBC|\bCP24\b|C-?SPAN|\bCPAC\b|NEWSMAX|BLOOMBERG|AL ?JAZEERA|FRANCE ?24|\bDW\b|EURONEWS|\bBNN\b|\bRDI\b|\bLCN\b|\bHLN\b|\bI24|\bWION\b/;
var NEWS_SEC = { CA: { label: "Canada news", flag: "\uD83C\uDDE8\uD83C\uDDE6", list: NEWS_CA, col: "#8c1c1c", pref: "CA" },
  US: { label: "US news", flag: "\uD83C\uDDFA\uD83C\uDDF8", list: NEWS_US, col: "#1d3a8a", pref: "US" },
  WORLD: { label: "World news", flag: "\uD83C\uDF0D", list: NEWS_WORLD, col: "#1d6b5a", pref: "UK" } };
XT["news:CA"] = { label: "News \u203A Canada" }; XT["news:US"] = { label: "News \u203A US" }; XT["news:WORLD"] = { label: "News \u203A World" };
function newsOn() { return !(PD && PD.st && PD.st.newsRow === false); }
function newsRegion(ch) {   // "CA" | "US" | "WORLD" | ""
  var c = chanCat(ch), u = ch.up || String(ch.n).toUpperCase(), i;
  if (!c) return "";
  for (i = 0; i < NEWS_WORLD.length; i++) if (NEWS_WORLD[i][1].test(u)) return "WORLD";
  var isNews = c.ltype === "News" || NEWS_RE.test(u); if (!isNews) return "";
  if (c.code === "CA") return "CA";
  if (c.code === "US") return "US";
  for (i = 0; i < NEWS_CA.length; i++) if (NEWS_CA[i][1].test(u)) return "CA";
  for (i = 0; i < NEWS_US.length; i++) if (NEWS_US[i][1].test(u)) return "US";
  return /^(UK|EN|MULTI|PPV)$/.test(c.code || "") || c.ltype === "News" ? "WORLD" : "";
}
function newsFeatured(all, sec) {
  var S = NEWS_SEC[sec], out = [], seen = {};
  S.list.forEach(function (f) { var b = bestFor(all, f[1], S.pref); if (b && !seen[b.id]) { seen[b.id] = 1; var x = JSON.parse(JSON.stringify(b)); x.lbl = f[0]; out.push(x); } });
  // your own viewing moves a brand forward, the list order (importance) breaks ties
  return out.map(function (ch, i) { return { ch: ch, s: -i * 0.15 + Math.min(4, learnScore("ch", String(ch.id)) / 10) }; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.ch; });
}
function newsMore(all, sec, skip) {
  var out = [], seen = {};
  all.forEach(function (ch) {
    if (skip[ch.id] || !chanOK(ch) || !itemOK(ch) || newsRegion(ch) !== sec) return;
    var k = (ch.up || "").replace(/[^A-Z0-9]|FHD|UHD|HD|SD|4K/g, ""); if (seen[k]) return; seen[k] = 1;
    out.push({ ch: ch, s: qualityBonus(ch) + learnScore("ch", String(ch.id)) / 10 });
  });
  out.sort(function (a, b) { return b.s - a.s; });
  return out.slice(0, 60).map(function (x) { return x.ch; });
}
function newsRowsFor(sec, more) {
  var S = NEWS_SEC[sec], feat = null;
  var rows = [{ title: S.flag + " " + S.label, kind: "l", epg: true, newsSec: sec, load: function () { return ensureIndex().then(function (all) { feat = newsFeatured(all, sec); return feat; }); } }];
  if (more) rows.push({ title: "More " + S.label.replace(" news", "") + " news channels", kind: "l", epg: true, load: function () {
    return ensureIndex().then(function (all) { var skip = {}; (feat || newsFeatured(all, sec)).forEach(function (c) { skip[c.id] = 1; }); return newsMore(all, sec, skip); });
  } });
  return rows;
}
function newsLiveNow() {   // hub row: the lead channel of the main brands, Canada first
  return ensureIndex().then(function (all) {
    var out = [], seen = {};
    [["CA", 4], ["US", 4], ["WORLD", 4]].forEach(function (x) { newsFeatured(all, x[0]).filter(function (c) { return !/BNN|CNBC|BLOOMBERG|FOX BUSINESS|CPAC|C-?SPAN/.test(c.up); }).slice(0, x[1]).forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; out.push(c); } }); });
    return out;
  });
}
function newsTiles() {
  var t = [];
  ["CA", "US", "WORLD"].forEach(function (s) { var S = NEWS_SEC[s]; t.push({ t: "tile", id: "news:" + s, n: S.flag + " " + S.label.replace(" news", ""), sub: S.list.slice(0, 3).map(function (x) { return x[0].replace(" Network", "").replace(" Channel", ""); }).join(" \u00b7 "), col: S.col }); });
  t.push({ t: "tile", id: "news", n: "\uD83D\uDCF0 All news", sub: "Business, weather & every news group", col: "#3a3a46" });
  return t;
}
var _hubSpecs414 = hubSpecs;
hubSpecs = function () {
  var rows = _hubSpecs414(); if (!newsOn()) return rows;
  var i = 0; while (i < rows.length && rows[i].kind === "e") i++;   // right under Live Events
  var add = [{ title: "\uD83D\uDCF0 News", kind: "t", local: true, news: true, load: function () { return Promise.resolve(newsTiles()); } },
    { title: "\uD83D\uDD34 Live news now", kind: "l", epg: true, news: true, load: newsLiveNow }];
  return rows.slice(0, i).concat(add, rows.slice(i));
};
var _pageSpecs414 = pageSpecs;
pageSpecs = function (pg) {
  var id = pg && pg.id;
  if (id === "news:CA" || id === "news:US" || id === "news:WORLD") {
    var sec = id.slice(5), rows = newsRowsFor(sec, true);
    var cc = sec === "WORLD" ? null : sec;
    var catl = pageCats(TILE_BY.news).filter(function (c) { return cc ? c.code === cc : ["CA", "US"].indexOf(c.code) < 0; });
    return rows.concat(catRows(catl));
  }
  if (id === "news") {
    var base = _pageSpecs414(pg);   // Top news channels / Business / Weather / news categories (live.js)
    var keep = base.filter(function (r) { return r.title !== "Top news channels"; });
    return newsRowsFor("CA").concat(newsRowsFor("US"), newsRowsFor("WORLD"), keep);
  }
  return _pageSpecs414(pg);
};
