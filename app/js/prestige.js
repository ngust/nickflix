/* NickFlix 4.15 - prestige collections on Movies / Shows (Curated mode), chosen and ordered daily by taste.
   - Lists (prestige_data.js): Oscars (Best Picture, other major winners, documentaries), Cannes / Venice / Berlin /
     Sundance / TIFF, IMDb all-time top, critics' greats, AFI 100, modern classics, Golden Globes; Emmys, Golden Globe
     TV, BAFTA TV, IMDb top TV, Peabody, greatest TV of all time.
   - Matching: normalised title (case, accents, "The", punctuation, " - 2019" / "(2019)" / quality tags) + year
     within 1 year when both are known. Catalogue = the Curated pool + up to 16 visible English-language categories.
   - Daily: which lists appear and their order are drawn every day (date + profile, Settings time zone) with weights
     from the taste model (genre affinity, seed preferences PD.tp.pr, loved titles in the list), never the same set as
     yesterday; inside a row the order is reshuffled daily (taste + rating + jitter). Hated / "Not for me" and
     already-watched titles stay out; a list needs at least 8 matches to show.
   - Quality signal: being on prestige lists lifts a title in Top Picks / themed rows / Today's picks (tasteBoost). */
"use strict";
var PR_MIN = 8, PR_MAX = 30, PR_N = { movies: 4, series: 3 };
var PR_BY = {}, PR_IDX = {};
function prNorm(s) {
  s = String(s || "").toLowerCase();
  try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  s = s.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/^\s*\|?[a-z]{2}\|\s*/, "").replace(/^\s*(en|us|uk|ca|multi)\s*[-:|]\s+/, "")
    .replace(/\s+-\s+(19|20)\d\d\b.*$/, "").replace(/\s+(19|20)\d\d\s*$/, "")
    .replace(/[_\s](eng|en|4k|uhd|fhd|hd|sd|multi|multisub|hevc|1080p|720p|imax|3d)\b/g, " ")
    .replace(/\bse7en\b/, "seven").replace(/&/g, " and ").replace(/\bpart (ii|2)\b/, "part 2").replace(/\bvs?\.?\b/g, "vs")
    .replace(/^\s*(the|a|an)\s+/, "").replace(/[^a-z0-9]+/g, "");
  return s;
}
(function () {
  (typeof PR_LISTS !== "undefined" ? PR_LISTS : []).forEach(function (l) {
    PR_BY[l.id] = l; l.type = l.ty === "m" ? "movies" : "series"; l.n = 0;
    l.d.split(";").forEach(function (e) {
      var p = e.split("|"), k = l.ty + ":" + prNorm(p[0]); if (!p[0] || k.length < 3) return; l.n++;
      (PR_IDX[k] = PR_IDX[k] || []).push({ id: l.id, y: +p[1] || 0 });
    });
  });
})();
function prYear(it) { var y = +it.y || 0; if (!y) { var m = /\b(19[2-9]\d|20[0-4]\d)\b/.exec(String(it.n || "")); if (m) y = +m[1]; } return y; }
/* list ids a catalogue title belongs to (cached on the item) */
function prOf(it) {
  if (!it || (it.t !== "movies" && it.t !== "series")) return [];
  if (it._pr !== undefined) return it._pr;
  var hits = PR_IDX[(it.t === "movies" ? "m:" : "s:") + prNorm(it.n)] || [], y = prYear(it), out = [];
  hits.forEach(function (h) { if ((!h.y || !y || Math.abs(h.y - y) <= 1) && out.indexOf(h.id) < 0) out.push(h.id); });
  try { Object.defineProperty(it, "_pr", { value: out, enumerable: false, writable: true }); } catch (e) {}
  return out;
}
/* catalogue scan (once per type and session) */
var PRC = {};
function prSources(type) {
  var en = cats[type].filter(catVisibleV), out = [], seen = {};
  function add(c) { if (c && !seen[c.id] && out.length < 16) { seen[c.id] = 1; out.push(c); } }
  poolFor(type, en).forEach(add);
  var re = /CLASSIC|OSCAR|AWARD|ACADEMY|TOP|IMDB|BLURAY|BLU.?RAY|4K|DRAMA|CRIME|GANGSTER|THRILLER|DOCU|WAR|WESTERN|SCI|COMED|ACTION|HBO|NETFLIX|AMAZON|APPLE|SERIES|EMMY|BBC|BRIT/;
  en.filter(function (c) { return re.test(c.up) && /^(EN|US|UK|CA|MULTI|)$/.test(c.code || ""); }).forEach(add);
  en.forEach(add);
  return out;
}
function prCatalog(type) {
  var key = type + ":" + (adultOk() ? 1 : 0);
  if (PRC[key]) return PRC[key];
  var src = prSources(type);
  PRC[key] = Promise.all(src.map(function (c) { return settle(loadCat(c)); })).then(function (ls) {
    var by = {}, cnt = {};
    ls.forEach(function (l) { (l || []).forEach(function (it) {
      if (!it || !itemOK(it)) return; var ids = prOf(it); if (!ids.length) return;
      ids.forEach(function (id) {
        var b = by[id] = by[id] || { l: [], k: {} }, k = prNorm(it.n);
        if (b.k[k] !== undefined) { var o = b.l[b.k[k]]; if (!o.ic && it.ic) b.l[b.k[k]] = it; return; }
        b.k[k] = b.l.length; b.l.push(it);
      });
    }); });
    for (var id in by) cnt[id] = by[id].l.length;
    try { var c0 = lsGet("nf_pr_cnt", null) || {}; c0[type] = cnt; lsSet("nf_pr_cnt", c0); } catch (e) {}
    return by;
  });
  return PRC[key];
}
function prKnownCount(type, id) { try { var c = lsGet("nf_pr_cnt", null); if (c && c[type] && c[type][id] !== undefined) return c[type][id]; } catch (e) {} return -1; }
/* today's lists for a section: weighted draw, stable all day, never yesterday's exact set */
function prDaily(type) {
  var box = dpBox(); box.pr = box.pr || {};
  if (box.pr[type]) return box.pr[type].map(function (id) { return PR_BY[id]; }).filter(Boolean);
  var rnd = dpRng(dpToday() + "|" + PF.id + "|prestige|" + type), aff = affinity(), tp = PD.tp || {}, R = rtBox(), amax = 0;
  for (var g in aff) amax = Math.max(amax, aff[g]);
  var yd = (box.past && box.past[0] && box.past[0].pr && box.past[0].pr[type]) || [], yday = {}; yd.forEach(function (id) { yday[id] = 1; });
  var cand = (typeof PR_LISTS !== "undefined" ? PR_LISTS : []).filter(function (l) { return l.type === type && prKnownCount(type, l.id) !== 0 && (prKnownCount(type, l.id) < 0 || prKnownCount(type, l.id) >= PR_MIN); }).map(function (l) {
    var a = 0; l.g.forEach(function (x) { a = Math.max(a, amax > 0 ? Math.max(0, aff[x] || 0) / amax : 0); });
    var w = 0.8 + 1.2 * a + 1.5 * ((tp.pr && tp.pr[l.id]) || 0) + 0.6 * Math.min(1, (learnScore("pr", l.id) || 0) / ((learnMax("pr") || 1)));
    for (var k in R) { var e = R[k]; if (!e.it || e.it.t !== type) continue; var ids = prOf(e.it); if (ids.indexOf(l.id) >= 0) w += e.v > 0 ? 0.35 * e.v : -0.4; }
    if (yday[l.id]) w *= 0.4;
    return { l: l, w: Math.max(0.05, w) };
  });
  var out = [], n = PR_N[type] || 3;
  while (out.length < n && cand.length) {
    var sum = 0, i; for (i = 0; i < cand.length; i++) sum += cand[i].w;
    var x = rnd() * sum; for (i = 0; i < cand.length - 1 && x > cand[i].w; i++) x -= cand[i].w;
    out.push(cand.splice(i, 1)[0]);
  }
  // never the exact same set as yesterday
  if (yd.length && out.length === yd.length && out.every(function (o) { return yday[o.l.id]; }) && cand.length) {
    cand.sort(function (a, b) { return b.w - a.w; }); out[out.length - 1] = cand[0];
  }
  out = out.map(function (o) { return o.l; });
  box.pr[type] = out.map(function (l) { return l.id; }); savePD();
  return out;
}
var _dpBox415 = dpBox;
dpBox = function () {
  var old = PD.dp, b = _dpBox415();
  if (old && old !== b && old.pr) {
    if (b.past && b.past[0] && b.past[0].d === old.d) b.past[0].pr = old.pr;
    else { b.past = b.past || []; b.past.unshift({ d: old.d, k: {}, pr: old.pr, th: old.th }); b.past = b.past.slice(0, 3); }
  }
  return b;
};
function prItems(l, type) {
  if (!cats[type] || !cats[type].filter(catVisibleV).length) return Promise.resolve([]);
  return prCatalog(type).then(function (by) {
    var b = by[l.id]; if (!b || b.l.length < PR_MIN) return [];
    var aff = affinity(), seen = dpSeen(), rnd = dpRng(dpToday() + "|" + PF.id + "|pr|" + l.id);
    var sc = b.l.filter(function (it) { return itemOK(it) && !rtDisliked(it); }).map(function (it) {
      var g = 0; itemGenres(it).forEach(function (x) { g += aff[x] || 0; });
      var r = parseFloat(it.r) || 0; if (r > 10) r /= 10;
      var s = Math.min(5, g / 5) + tasteBoost(it) / 2 + (ratingOK(it) ? (r - 6) / 1.2 : 0) + (it.ic ? 1 : -3) + rnd() * 6 + (seen[itemKey(it)] ? -4 : 0);
      return { it: it, s: s };
    });
    sc.sort(function (a, c) { return c.s - a.s; });
    var out = sc.slice(0, PR_MAX).map(function (x) { return x.it; });
    return out.length >= PR_MIN ? out : [];
  });
}
/* a list picked before the catalogue was known can come back too small: swap in an unused list with enough matches */
var PR_SUB = {};
function prSpec(l, type) {
  var spec = { title: l.ic + " " + l.t, tag: "Today", prestige: l.id, load: function () {
    return prItems(l, type).then(function (out) {
      if (out.length) return out;
      return prCatalog(type).then(function (by) {
        var box = dpBox(), today = (box.pr && box.pr[type]) || [], used = PR_SUB[dpToday() + type] = PR_SUB[dpToday() + type] || {};
        var alt = (typeof PR_LISTS !== "undefined" ? PR_LISTS : []).filter(function (x) { return x.type === type && today.indexOf(x.id) < 0 && !used[x.id] && by[x.id] && by[x.id].l.length >= PR_MIN; });
        if (!alt.length) return [];
        var rnd = dpRng(dpToday() + "|" + PF.id + "|prsub|" + l.id), a = alt[Math.floor(rnd() * alt.length)]; used[a.id] = 1;
        var i = today.indexOf(l.id); if (i >= 0) { today[i] = a.id; savePD(); }
        spec.title = a.ic + " " + a.t; spec.prestige = a.id;
        try { V.rows.forEach(function (r) { if (r.spec === spec) { var t = r.el.querySelector(".rtitle"); if (t && t.firstChild) t.firstChild.nodeValue = spec.title; } }); } catch (e) {}
        return prItems(a, type);
      });
    });
  } };
  return spec;
}
/* watching a title from a prestige list lifts that list */
var _addWatchTime415p = addWatchTime;
addWatchTime = function (it, sec) { _addWatchTime415p(it, sec); try { prOf(it).forEach(function (id) { learnAdd("pr", id, sec / 60); }); } catch (e) {} };
/* quality signal for the taste model */
function prBoost(it) { var n = prOf(it).length; return n ? Math.min(4, 1.5 + n) : 0; }
/* ---------- wire into Curated Movies / Shows (after the 4.14 themed rows) ---------- */
var _curatedRows415p = curatedRows;
curatedRows = function (type) {
  var rows = _curatedRows415p(type);
  if ((type !== "movies" && type !== "series") || !PF || !rows.length) return rows;
  try {
    var pr = prDaily(type).map(function (l) { return prSpec(l, type); }); if (!pr.length) return rows;
    var t0 = -1; for (var i = 0; i < rows.length; i++) if (rows[i].theme) { t0 = i; break; }
    if (t0 < 0) { t0 = 0; while (t0 < rows.length && (rows[t0].local || rows[t0].hero || /^Today|^Because You Watched/.test(rows[t0].title || ""))) t0++; t0--; }
    var out = rows.slice(0, t0 + 1), rest = rows.slice(t0 + 1);
    out.push(pr.shift());
    rest.forEach(function (r, j) { out.push(r); if (j % 2 === 1 && pr.length) out.push(pr.shift()); });
    return out.concat(pr);
  } catch (e) { return rows; }
};
