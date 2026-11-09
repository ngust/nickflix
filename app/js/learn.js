/* NickFlix v3 - per-profile learning: weighted counts with time decay (half-life 21 days) */
"use strict";
var LEARN_HL = 21 * 86400000;
var LEARN_KINDS = { lt: "Live channel types", cc: "Countries", ch: "Channels", lg: "Sports leagues", tm: "Teams", gen: "Genres", tile: "TV hub tiles", vt: "Content type" };
function learnBox() { if (!PD.learn) PD.learn = {}; return PD.learn; }
function learnAdd(kind, key, amt) {
  if (key == null || key === "" || !(amt > 0)) return;
  var L = learnBox(), k = L[kind] || (L[kind] = {}), now = Date.now(), e = k[key];
  var w = e ? e[0] * Math.pow(0.5, (now - e[1]) / LEARN_HL) : 0;
  k[key] = [Math.round((w + amt) * 1000) / 1000, now];
}
function learnScore(kind, key) {
  var k = learnBox()[kind], e = k && k[key]; if (!e) return 0;
  return e[0] * Math.pow(0.5, (Date.now() - e[1]) / LEARN_HL);
}
function learnTop(kind, n) {
  var k = learnBox()[kind] || {}, arr = [];
  for (var key in k) arr.push([key, learnScore(kind, key)]);
  arr.sort(function (a, b) { return b[1] - a[1]; });
  return arr.slice(0, n || 10);
}
function learnMax(kind) { var t = learnTop(kind, 1); return t.length ? t[0][1] : 0; }
function learnPrune() {
  var L = learnBox();
  for (var kind in L) { var top = learnTop(kind, 60), keep = {}; top.forEach(function (x) { keep[x[0]] = L[kind][x[0]]; }); L[kind] = keep; }
}
/* hour-of-day histogram (minutes) */
function learnHour(min) { var L = learnBox(); if (!L.hr) L.hr = []; var h = zDate(Date.now()).getUTCHours(); L.hr[h] = Math.round(((L.hr[h] || 0) + min) * 10) / 10; }
function learnHourText() {
  var hr = learnBox().hr; if (!hr) return "";
  var best = -1, bv = 0;
  for (var h = 0; h < 24; h++) { var v = (hr[(h + 23) % 24] || 0) * 0.5 + (hr[h] || 0) + (hr[(h + 1) % 24] || 0) * 0.5; if (v > bv) { bv = v; best = h; } }
  if (best < 0 || bv < 1) return "";
  function f(x) { x = x % 24; return ((x % 12) || 12) + (x < 12 ? " AM" : " PM"); }
  return "You mostly watch around " + f(best);
}
/* called from addWatchTime every few seconds of real playback */
function learnWatch(it, sec) {
  var min = sec / 60;
  learnAdd("vt", it.t, min); learnHour(min);
  if (it.t === "live") {
    var c = catById["live:" + it.c];
    learnAdd("ch", String(it.id), min);
    if (c) {
      learnAdd("lt", c.ltype, min); learnAdd("cc", c.code, min);
      tilesForCat(c).forEach(function (t) { learnAdd("tile", t, min); });
      var lg = leagueOf(c.up + " " + String(it.n).toUpperCase()); if (lg) learnAdd("lg", lg, min);
    }
    if (P && P.game) { if (P.game.lg) learnAdd("lg", P.game.lg, min); (P.game.teams || []).forEach(function (t) { learnAdd("tm", t, min); }); }
  } else itemGenres(it).forEach(function (g) { learnAdd("gen", g, min); });
}
