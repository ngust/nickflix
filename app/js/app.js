/* NickFlix v2 - main views (rows, hero, Curated|All), details, player */
"use strict";
var V = { view: "movies", rows: [], r: 0, zone: "nav", navIdx: 1, heroIdx: 0, modeIdx: 0, hero: null, heroOn: false, modeOn: false, gen: 0 };
var tabs = [], TAB_VIEWS = [];
function initTabs() {
  tabs = Array.prototype.slice.call(document.querySelectorAll("#tabs .tab"));
  TAB_VIEWS = tabs.map(function (t) { return t.getAttribute("data-view"); });
}
var ROWTOP_HERO = 760, ROWTOP_PLAIN = 130;
function kindOf(spec, view) { return spec.kind || (view === "live" ? "l" : view === "mylist" ? "p" : T[view].card); }
var KIND = { p: { pitch: 264, rowH: 505, vis: 7 }, l: { pitch: 354, rowH: 400, vis: 5 }, t: { pitch: 356, rowH: 256, vis: 5 }, g: { pitch: 444, rowH: 330, vis: 4 }, e: { pitch: 884, rowH: 430, vis: 2 } };
function modeOf(view) { return PD.st.mode[view] === "all" ? "all" : "curated"; }
function specsFor(view) {
  if (view === "live") return V.page ? pageSpecs(V.page) : hubSpecs();
  if (view === "mylist") return myListRows();
  return modeOf(view) === "all" ? allRows(view) : curatedRows(view);
}
function myListRows() {
  var rows = [];
  rows.push({ title: "Continue Watching", local: true, load: function () {
    return Promise.all([rowsLocal("movies")[0].load(), rowsLocal("series")[0].load()]).then(function (r) { return r[0].concat(r[1]).sort(function (a, b) { return b.ts - a.ts; }); });
  } });
  [["movies", "Movies in My List"], ["series", "Shows in My List"], ["live", "My Channels"]].forEach(function (x) {
    rows.push({ title: x[1], local: true, kind: x[0] === "live" ? "l" : "p", load: function () {
      return Promise.resolve(PD.list.filter(function (h) { return h.it.t === x[0]; }).map(function (h) { return JSON.parse(JSON.stringify(h.it)); }));
    } });
  });
  return rows;
}
function buildView(view) {
  V.gen++;
  V.view = view; V.rows = []; V.r = 0; V.hero = null;
  if (view !== "search") { PD.st.view = view; savePD(); }
  tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-view") === view); });
  var rowsEl = $("rows"); rowsEl.textContent = "";
  $("search").classList.add("hidden");
  $("view").classList.remove("hidden");
  V.heroOn = view === "movies" || view === "series";
  V.modeOn = V.heroOn;
  $("hero").classList.toggle("hidden", !V.heroOn);
  $("modebar").classList.toggle("hidden", !V.modeOn);
  if (V.modeOn) renderModebar();
  var top = V.heroOn ? ROWTOP_HERO : ROWTOP_PLAIN;
  rowsEl.style.paddingTop = (V.heroOn ? 0 : 130) + "px";
  if (V.heroOn) rowsEl.style.paddingTop = "0px";
  if (view === "live") {
    var hd = ce("div", "phead");
    if (V.page) { hd.appendChild(ce("span", "ph-crumb", "TV  \u203A  ")); hd.appendChild(ce("span", "ph-title", pageTitle())); hd.appendChild(ce("span", "ph-hint", "BACK returns to the TV hub")); }
    else { hd.appendChild(ce("span", "ph-title", "Live TV")); hd.appendChild(ce("span", "ph-hint", "Pick a category \u2013 the tiles you use most move to the front")); }
    rowsEl.appendChild(hd);
  }
  var specs = specsFor(view);
  specs.forEach(function (sp) {
    var kind = kindOf(sp, view), K = KIND[kind];
    if (kind === "t" && !sp.title) K = { pitch: K.pitch, rowH: 222, vis: K.vis };
    var el = ce("div", "row k" + kind + (sp.title ? "" : " notitle")); el.style.height = K.rowH + "px";
    var tt = ce("div", "rtitle", sp.title);
    if (sp.badge) tt.appendChild(ce("span", "badge", sp.badge));
    if (sp.tag) tt.appendChild(ce("span", "badge tag", sp.tag));
    var cnt = ce("span", "cnt", ""); tt.appendChild(cnt);
    el.appendChild(tt);
    var track = ce("div", "track"); el.appendChild(track);
    var msg = ce("div", "rowmsg", "Loading\u2026"); el.appendChild(msg);
    rowsEl.appendChild(el);
    V.rows.push({ spec: sp, kind: kind, K: K, el: el, track: track, msg: msg, cnt: cnt, items: null, col: 0, off: 0, rendered: {}, lo: 0, hi: -1, top: 0 });
  });
  layoutRows();
  $("empty").classList.add("hidden");
  if (!specs.length) showEmpty();
  if (V.heroOn) setHeroPlaceholder();
  // local rows resolve synchronously-ish
  V.rows.slice().forEach(function (row) { if (row.spec.local) startLoad(row, V.gen); });
  updateScroll();
  ensureRows();
}
function showEmpty() {
  var e = $("empty");
  e.innerHTML = V.view === "mylist" ? "Your list is empty.<br>Open a movie or show and choose <b>+ My List</b>, or press OK twice while watching a channel."
    : V.view === "live" ? "No channels match your Live TV filters.<br>Open <b>Settings \u2192 Live TV filters</b> to turn regions or channel types on."
    : "Nothing to show here.<br>Open <b>Settings \u2192 Movies &amp; Shows filters</b> and turn on more languages, genres or sources.";
  e.classList.remove("hidden");
}
function layoutRows() {
  var y = V.heroOn ? ROWTOP_HERO : ROWTOP_PLAIN + (V.view === "live" ? 84 : 0);
  for (var i = 0; i < V.rows.length; i++) { V.rows[i].top = y; y += V.rows[i].K.rowH; }
}
function renderModebar() {
  var m = PD.st.mode[V.view] === "all" ? 1 : 0, bar = $("modebar"); bar.textContent = "";
  var a = ce("div", "mode" + (m === 0 ? " sel" : ""), "\u2728 Curated"), b = ce("div", "mode" + (m === 1 ? " sel" : ""), "\u2630 All categories");
  bar.appendChild(a); bar.appendChild(b);
  bar.appendChild(ce("div", "mode-hint", m === 0 ? "Hand-picked rows: trending, new, top rated, for you" : "Every category from your provider"));
  V.modeEls = [a, b];
}
function setMode(i) {
  var want = i === 1 ? "all" : "curated";
  if (PD.st.mode[V.view] === want) return;
  PD.st.mode[V.view] = want; savePD();
  buildView(V.view); V.zone = "mode"; V.modeIdx = i; applyFocus();
}
function setHeroPlaceholder() {
  $("hero-bg").removeAttribute("src"); $("hero-bg").style.visibility = "hidden";
  $("hero-kicker").textContent = V.view === "movies" ? "Featured movie" : "Featured show";
  $("hero-title").textContent = ""; $("hero-meta").textContent = ""; $("hero-plot").textContent = "";
  $("hero-list").textContent = "+ My List";
}
function pickHero(row) {
  if (!V.heroOn || V.hero || !row.items || !row.items.length) return;
  var pool = row.items.slice(0, 12).filter(function (x) { return x.ic; });
  if (!pool.length) pool = row.items.slice(0, 5);
  var it = pool[Math.floor(Math.random() * pool.length)];
  V.hero = it;
  var gen = V.gen;
  $("hero-title").textContent = it.n;
  setHeroMeta(it);
  setHeroBg(it.bd || it.ic);
  $("hero-list").textContent = inList(it) ? "\u2713 My List" : "+ My List";
  if (it.t === "movies") {
    api("get_vod_info", "vod_id=" + it.id, 15000).then(function (r) {
      if (gen !== V.gen || V.hero !== it) return;
      mergeInfo(it, (r && r.info) || {});
      setHeroMeta(it); if (it.bd) setHeroBg(it.bd);
    }).catch(function () {});
  }
}
function firstImg(v) {
  if (Array.isArray(v)) return v[0] || "";
  if (typeof v === "string") { var m = v.match(/https?:[^'"\],\s]+/); return m ? m[0] : ""; }
  return "";
}
function mergeInfo(it, inf) {
  it.plot = inf.plot || inf.description || it.plot || "";
  it.genre = inf.genre || it.genre || "";
  it.cast = inf.cast || inf.actors || it.cast || "";
  it.dir = inf.director || it.dir || "";
  it.age = inf.age || inf.mpaa_rating || it.age || "";
  it.country = inf.country || it.country || "";
  if (inf.duration || inf.duration_secs || inf.episode_run_time) it.dur = inf.duration || inf.duration_secs || (inf.episode_run_time ? inf.episode_run_time * 60 : "");
  if (!it.y && (inf.releasedate || inf.releaseDate || inf.release_date)) it.y = String(inf.releasedate || inf.releaseDate || inf.release_date).slice(0, 4);
  var r = parseFloat(inf.rating); if (r > 0) it.r = r;
  if (!it.tm && (inf.tmdb_id || inf.tmdb)) it.tm = String(inf.tmdb_id || inf.tmdb);
  if (inf.imdb_id) it.imdb = String(inf.imdb_id);
  var bd = firstImg(inf.backdrop_path); if (bd) it.bd = bd;
}
function setHeroBg(src) { var b = $("hero-bg"); if (!src) return; b.style.visibility = "hidden"; b.onload = function () { b.style.visibility = ""; }; b.src = src; }
function metaInto(m, it, extra) {
  m.textContent = "";
  var rb = ratingBadge(it); if (rb) m.appendChild(rb);
  var bits = [];
  if (it.y) bits.push(it.y);
  if (it.age) bits.push(it.age);
  var d = fmtDur(it.dur); if (d) bits.push(d);
  if (it.genre) bits.push(String(it.genre).replace(/\s*\/\s*/g, ", "));
  if (extra) bits.push(extra);
  m.appendChild(document.createTextNode((rb ? "   " : "") + bits.join("   \u2022   ")));
}
function setHeroMeta(it) { metaInto($("hero-meta"), it); $("hero-plot").textContent = it.plot || ""; }

/* fetch queue: nearest rows first, 3 at a time */
var active = 0;
function ensureRows() {
  var gen = V.gen, rows = V.rows, r = V.r;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i], near = i >= r - 2 && i <= r + 3;
    if (near && row.items) renderWindow(row);
    else if (!near && row.hi >= row.lo) clearRow(row);
  }
  var order = [];
  for (var k = Math.max(0, r - 1); k <= Math.min(rows.length - 1, r + 5); k++) order.push(k);
  order.sort(function (a, b) { return Math.abs(a - r) - Math.abs(b - r); });
  for (var j = 0; j < order.length && active < 3; j++) {
    var rw = rows[order[j]];
    if (rw.items || rw.loading) continue;
    startLoad(rw, gen);
  }
  // make sure a hero gets picked even when focus is near the top
  if (V.heroOn && !V.hero) {
    for (var h = 0; h < rows.length && h < 8; h++) if (rows[h].spec.hero || !rows[h].spec.local) { if (!rows[h].items && !rows[h].loading && active < 4) startLoad(rows[h], gen); break; }
  }
}
function startLoad(row, gen) {
  row.loading = true; active++;
  var p; try { p = row.spec.load(); } catch (e) { p = Promise.reject(e); }
  p.then(function (items) {
    active--; row.loading = false;
    if (gen !== V.gen) { ensureRows(); return; }
    row.items = (items || []).filter(itemOK);   // adult / Quebec gate for every row
    if (!row.items.length) removeRow(row);
    else {
      row.msg.style.display = "none";
      if (row.spec.count) row.cnt.textContent = row.items.length + (row.items.length === 1 ? " title" : " titles");
      if (V.heroOn && !V.hero && !row.spec.local) pickHero(row);
      if (V.zone === "rows" && V.rows[V.r] === row) focusRowItem();
    }
    ensureRows();
  }, function () {
    active--; row.loading = false;
    if (gen !== V.gen) { ensureRows(); return; }
    row.items = []; row.msg.textContent = "Couldn't load this row";
    ensureRows();
  });
}
function removeRow(row) {
  var idx = V.rows.indexOf(row); if (idx < 0) return;
  if (row.el.parentNode) row.el.parentNode.removeChild(row.el);
  V.rows.splice(idx, 1);
  if (idx < V.r && V.zone === "rows") V.r--;
  if (V.r >= V.rows.length) V.r = Math.max(0, V.rows.length - 1);
  layoutRows();
  if (!V.rows.length) showEmpty();
  if (V.zone === "rows") { if (!V.rows.length) V.zone = V.heroOn ? "hero" : "nav"; if (!D.open && !P.open && !OV.top()) applyFocus(); }
  else updateScroll();
}
function clearRow(row) { row.track.textContent = ""; row.rendered = {}; row.lo = 0; row.hi = -1; }
function renderWindow(row) {
  var K = row.K, n = row.items.length;
  if (row.kind === "t" || row.kind === "e") row.off = Math.min(row.off, Math.max(0, n - K.vis));
  var lo = Math.max(0, row.off - 3), hi = Math.min(n - 1, row.off + K.vis + 5), k;
  for (k in row.rendered) { k = +k; if (k < lo || k > hi) { var e = row.rendered[k]; if (e.parentNode) e.parentNode.removeChild(e); delete row.rendered[k]; } }
  var frag = document.createDocumentFragment();
  for (k = lo; k <= hi; k++) if (!row.rendered[k]) { var c = anyCard(row, row.items[k], k); row.rendered[k] = c; frag.appendChild(c); }
  row.track.appendChild(frag);
  row.lo = lo; row.hi = hi;
  row.track.style.transform = "translateX(" + (-row.off * K.pitch) + "px)";
}
function anyCard(row, it, k) {
  var K = row.K, c;
  if (it.t === "tile") c = tileCard(it); else if (row.kind === "e" && it.t !== "live") c = bigCard(it); else if (it.t === "game") c = gameCard(it); else if (it.t === "event" || it.t === "action") c = bigCard(it);
  if (c) { c.classList.add("card"); c.style.left = (k * K.pitch) + "px"; return c; }
  c = cardEl(it, row.kind, k, K.pitch);
  if (inList(it)) c.classList.add("inlist");
  if (row.spec.epg && it.t === "live") epgInto(c, it);
  return c;
}
function updateScroll() {
  var ty = 0;
  if (V.zone === "rows" && V.rows.length) { var row = V.rows[V.r]; ty = Math.min(0, -(row.top - 120 - (V.view === "live" ? 84 : 0))); }
  $("scroller").style.transform = "translateY(" + ty + "px)";
}
function focusRowItem() {
  var row = V.rows[V.r];
  if (!row || !row.items || !row.items.length) { setF(null); return; }
  if (row.col >= row.items.length) row.col = row.items.length - 1;
  renderWindow(row);
  setF(row.rendered[row.col] || null);
}
function applyFocus() {
  if (V.zone === "nav") setF(tabs[V.navIdx]);
  else if (V.zone === "mode") setF(V.modeEls[V.modeIdx]);
  else if (V.zone === "hero") setF([$("hero-play"), $("hero-info"), $("hero-list")][V.heroIdx]);
  else if (V.zone === "rows") { ensureRows(); focusRowItem(); }
  updateScroll();
}
function moveCol(row, d) {
  var K = row.K, n = row.items ? row.items.length : 0;
  if (!n) return;
  var c = Math.max(0, Math.min(n - 1, row.col + d));
  if (c === row.col) return;
  row.col = c;
  if (c < row.off + 1) row.off = Math.max(0, c - 1);
  else if (c > row.off + K.vis - 2) row.off = Math.min(Math.max(0, n - K.vis + 1), c - (K.vis - 2));
  if (c < row.off) row.off = c;
  focusRowItem();
}
function changeRow(d) {
  var nr = V.r + d;
  if (nr < 0 || nr >= V.rows.length) return false;
  var cur = V.rows[V.r], vis = cur ? cur.col - cur.off : 0;
  V.r = nr;
  var row = V.rows[nr];
  if (row.col === 0 && row.off === 0) row.col = Math.min(vis, row.K.vis - 2);
  if (row.items && row.col >= row.items.length) row.col = Math.max(0, row.items.length - 1);
  if (row.col > row.off + row.K.vis - 2) row.off = Math.max(0, row.col - (row.K.vis - 2));
  applyFocus();
  return true;
}
function upFromRows() { V.zone = V.heroOn && V.hero ? "hero" : V.modeOn ? "mode" : "nav"; applyFocus(); }
function mainKey(k) {
  if (V.zone === "nav") {
    if (k === "left") { if (V.navIdx > 0) V.navIdx--; applyFocus(); }
    else if (k === "right") { if (V.navIdx < tabs.length - 1) V.navIdx++; applyFocus(); }
    else if (k === "enter") selectTab(TAB_VIEWS[V.navIdx], true);
    else if (k === "down") enterContent();
    else if (k === "back") openWho();
    return;
  }
  if (V.view === "search") { searchKey(k); return; }
  if (V.zone === "mode") {
    if (k === "left") { V.modeIdx = 0; applyFocus(); }
    else if (k === "right") { V.modeIdx = 1; applyFocus(); }
    else if (k === "enter") setMode(V.modeIdx);
    else if (k === "up" || k === "back") { V.zone = "nav"; applyFocus(); }
    else if (k === "down") { if (V.heroOn && V.hero) { V.zone = "hero"; V.heroIdx = 0; } else if (V.rows.length) { V.zone = "rows"; V.r = 0; } applyFocus(); }
    return;
  }
  if (V.zone === "hero") {
    if (k === "left") { if (V.heroIdx > 0) V.heroIdx--; applyFocus(); }
    else if (k === "right") { if (V.heroIdx < 2) V.heroIdx++; applyFocus(); }
    else if (k === "up") { V.zone = V.modeOn ? "mode" : "nav"; V.modeIdx = PD.st.mode[V.view] === "all" ? 1 : 0; applyFocus(); }
    else if (k === "back") { V.zone = "nav"; applyFocus(); }
    else if (k === "down") { if (V.rows.length) { V.zone = "rows"; V.r = 0; applyFocus(); } }
    else if (k === "enter" && V.hero) {
      if (V.heroIdx === 0) { if (V.hero.t === "movies") playItem(V.hero); else openDetails(V.hero); }
      else if (V.heroIdx === 1) openDetails(V.hero);
      else { var on = toggleList(V.hero); $("hero-list").textContent = on ? "\u2713 My List" : "+ My List"; toast(on ? "Added to My List" : "Removed from My List"); refreshLocalRows(); }
    }
    return;
  }
  if (V.zone === "rows") {
    var row = V.rows[V.r];
    if (k === "left") { if (row) moveCol(row, -1); }
    else if (k === "right") { if (row) moveCol(row, 1); }
    else if (k === "up") { if (!changeRow(-1)) upFromRows(); }
    else if (k === "down") changeRow(1);
    else if (k === "back") { if (V.view === "live" && V.page) closeLivePage(); else { V.zone = "nav"; applyFocus(); } }
    else if (k === "enter" && row && row.items && row.items[row.col]) activate(row.items[row.col], row.items, row.col);
  }
}
/* rebuild local rows (continue/recent/list) in place after changes */
function refreshLocalRows() {
  if (!V.view || V.view === "search") return;
  var oldIdx = V.r, keepR = V.zone === "rows" ? V.rows[V.r] : null, z = V.zone, title = keepR ? keepR.spec.title : null, col = keepR ? keepR.col : 0;
  buildView(V.view);
  V.zone = z === "rows" ? "rows" : z;
  var oldR = oldIdx;
  if (title) { var found = false; for (var i = 0; i < V.rows.length; i++) if (V.rows[i].spec.title === title) { V.r = i; V.rows[i].col = col; V.rows[i].off = Math.max(0, col - 1); found = true; break; } if (!found) V.r = Math.min(oldR, V.rows.length - 1); }
  if (V.zone === "hero" && !V.hero) V.zone = V.modeOn ? "mode" : "nav";
}
function enterContent() {
  var v = TAB_VIEWS[V.navIdx];
  if (v === "settings" || v === "profile") return;
  if (v !== V.view) selectTab(v, false);
  if (V.view === "search") { V.zone = "search"; S.pane = "kbd"; searchFocus(); return; }
  if (V.modeOn) { V.zone = "mode"; V.modeIdx = PD.st.mode[V.view] === "all" ? 1 : 0; }
  else if (V.rows.length) V.zone = "rows";
  applyFocus();
}
function selectTab(v, fromOk) {
  if (v === "settings") { openSettings(); return; }
  if (v === "profile") { openProfilePage(); return; }
  if (v === "search") { showSearch(); if (fromOk) { V.zone = "search"; S.pane = "kbd"; searchFocus(); } return; }
  if (v === "live" && (V.page || v !== V.view)) { V.page = null; V.pageStack = []; buildView(v); }
  else if (v !== V.view) buildView(v);
  if (fromOk) {
    // OK on a tab jumps straight into the first row of content
    if (V.heroOn && V.hero) { V.zone = "hero"; V.heroIdx = 0; applyFocus(); }
    else enterContent();
  }
}
function activate(item, list, idx) {
  if (item.t === "tile") { openLivePage(item.id); return; }
  if (item.t === "game" || item.t === "event") { openPicker(item); return; }
  if (item.t === "action") { item.act(); return; }
  if (item.t === "live") { P.game = null; playItem(item, list, idx); }
  else if (item._resume) resumeItem(item);
  else openDetails(item);
}

/* ================= details ================= */
var D = { open: false, item: null, ln: null, seasons: null, season: null, eps: {}, flat: [] };
function openDetails(item) {
  D.open = true; D.item = item; D.eps = {}; D.season = null; D.seasons = []; D.flat = []; D.loaded = false;
  $("details").classList.remove("hidden");
  var bg = $("d-bg"); bg.style.visibility = "hidden"; bg.onload = function () { bg.style.visibility = ""; };
  if (item.bd || item.ic) bg.src = item.bd || item.ic;
  D.ln = LN($("d-body"), 760);
  renderDetails("Loading details\u2026");
  var p = item.t === "movies" ? api("get_vod_info", "vod_id=" + item.id, 15000) : api("get_series_info", "series_id=" + item.id, 20000);
  p.then(function (r) {
    if (!D.open || D.item !== item) return;
    mergeInfo(item, (r && r.info) || {});
    if (item.bd) bg.src = item.bd;
    if (item.t === "series") {
      var eps = r && r.episodes, seasons = [];
      if (eps && !Array.isArray(eps)) { for (var s in eps) if (Array.isArray(eps[s]) && eps[s].length) { seasons.push(s); D.eps[s] = eps[s]; } }
      else if (Array.isArray(eps)) { eps.forEach(function (e) { var s2 = String(e.season || 1); (D.eps[s2] = D.eps[s2] || []).push(e); }); seasons = Object.keys(D.eps); }
      seasons.sort(function (a, b) { return (+a) - (+b); });
      D.seasons = seasons;
      seasons.forEach(function (s3) { D.eps[s3].forEach(function (e, i) { D.flat.push({ s: +s3, e: +(e.episode_num || i + 1), id: e.id, ext: e.container_extension || "mp4", title: epTitle(e), dur: e.info && (e.info.duration_secs || e.info.duration) }); }); });
      var ps = getPos(item);
      D.season = ps && ps.ep && D.eps[String(ps.ep.s)] ? String(ps.ep.s) : (seasons[0] || null);
    }
    D.loaded = true;
    renderDetails("");
  }).catch(function () { if (D.open && D.item === item) { D.loaded = true; renderDetails(""); } });
}
function epTitle(e) {
  var t = String(e.title || ""), m = t.match(/S\d+\s*E\d+\s*-\s*(.+)$/i);
  if (m) t = m[1];
  return t || ("Episode " + (e.episode_num || ""));
}
function epIndex(s, e) { for (var i = 0; i < D.flat.length; i++) if (D.flat[i].s === +s && D.flat[i].e === +e) return i; return -1; }
function renderDetails(status) {
  var item = D.item, body = $("d-body"), ln = D.ln, keepLi = ln.li, keepCi = ln.ci;
  body.textContent = ""; ln.lines = [];
  var top = ce("div", "d-top");
  var po = ce("div", "d-poster");
  if (item.ic) { var im = document.createElement("img"); im.src = item.ic; im.onerror = function () { po.textContent = ""; po.appendChild(placeholder(item.n)); }; po.appendChild(im); }
  else po.appendChild(placeholder(item.n));
  top.appendChild(po);
  var inf = ce("div", "d-info");
  inf.appendChild(ce("div", "kicker", item.t === "movies" ? "Movie" : "Series"));
  inf.appendChild(ce("div", "d-title", item.n));
  var meta = ce("div", "meta");
  metaInto(meta, item, D.seasons && D.seasons.length ? D.seasons.length + (D.seasons.length === 1 ? " season" : " seasons") : "");
  inf.appendChild(meta);
  inf.appendChild(ce("div", "d-plot", status || item.plot || ""));
  if (item.dir) inf.appendChild(ce("div", "d-cast", "Director: " + item.dir));
  if (item.cast) inf.appendChild(ce("div", "d-cast", "Cast: " + item.cast));
  if (item.country) inf.appendChild(ce("div", "d-cast", "Country: " + item.country));
  var bl = ce("div", "d-line"), btns = [];
  var ps = getPos(item);
  function btn(label, cls, act) { var b = ce("div", "btn" + (cls ? " " + cls : ""), label); b._act = act; bl.appendChild(b); btns.push(b); return b; }
  if (item.t === "movies") {
    if (ps && ps.t > 5000 && !(ps.d && ps.t > 0.92 * ps.d)) {
      btn("\u25B6\u00a0 Resume " + fmtTime(ps.t), "primary", function () { playItem(item, null, 0, ps.t); });
      btn("\u21BA Start over", "", function () { playItem(item, null, 0, 0); });
    } else btn("\u25B6\u00a0 Play", "primary", function () { playItem(item, null, 0, 0); });
  } else {
    var ep = ps && ps.ep, idx = ep ? epIndex(ep.s, ep.e) : -1;
    if (idx >= 0) {
      var label = (ep.next ? "\u25B6\u00a0 Play next S" : "\u25B6\u00a0 Resume S") + ep.s + ":E" + ep.e + (!ep.next && ps.t > 5000 ? " (" + fmtTime(ps.t) + ")" : "");
      btn(label, "primary", function () { playFlat(idx, ep.next ? 0 : ps.t); });
      btn("\u21BA From S" + D.flat[0].s + ":E" + D.flat[0].e, "", function () { playFlat(0, 0); });
    } else btn("\u25B6\u00a0 Play first episode", "primary", function () { if (D.flat.length) playFlat(0, 0); else toast(D.loaded ? "No episodes available yet" : "Still loading\u2026"); });
  }
  var lb = btn(inList(item) ? "\u2713 My List" : "+ My List", "", function () {
    var on = toggleList(item); lb.textContent = on ? "\u2713 My List" : "+ My List"; toast(on ? "Added to My List" : "Removed from My List"); D.listChanged = true;
  });
  btn("\u2190 Back", "", closeDetails);
  inf.appendChild(bl);
  lnAdd(ln, bl, btns);
  top.appendChild(inf);
  body.appendChild(top);
  if (item.t === "series" && D.seasons.length) {
    var sl = ce("div", "d-line"); sl.style.marginTop = "34px";
    var sitems = [];
    D.seasons.forEach(function (s) {
      var b = ce("div", "season" + (s === D.season ? " sel" : ""), "Season " + s);
      b._act = function () { D.season = s; var li = ln.li; renderDetails(""); ln.li = li; ln.ci = D.seasons.indexOf(s); lnFocus(ln); };
      sl.appendChild(b); sitems.push(b);
    });
    body.appendChild(sl);
    lnAdd(ln, sl, sitems, { hs: sitems.length > 6 ? 900 : null });
    body.appendChild(ce("div", "d-eps-h", "Episodes"));
    (D.eps[D.season] || []).forEach(function (e, i) {
      var b = ce("div", "ep"), en = +(e.episode_num || i + 1);
      b.appendChild(ce("span", "en", "E" + en));
      b.appendChild(ce("span", "et", epTitle(e)));
      var du = fmtDur(e.info && (e.info.duration || e.info.duration_secs));
      if (du) b.appendChild(ce("span", "ed", du));
      var fi = epIndex(D.season, en);
      if (ps && ps.ep && +ps.ep.s === +D.season && +ps.ep.e === en && ps.d > 0 && !ps.ep.next) { var pb = ce("div", "pbar ep-pbar"); var f = ce("div"); f.style.width = Math.round(100 * ps.t / ps.d) + "%"; pb.appendChild(f); b.appendChild(pb); }
      b._act = function () { playFlat(fi, 0); };
      var l2 = ce("div", "d-line"); l2.appendChild(b); body.appendChild(l2);
      lnAdd(ln, l2, [b]);
    });
  }
  ln.li = Math.min(keepLi, ln.lines.length - 1); ln.ci = keepCi;
  lnFocus(ln);
}
function closeDetails() {
  D.open = false; $("details").classList.add("hidden"); $("d-bg").removeAttribute("src");
  if (V.zone === "search") searchFocus();
  else { if (D.listChanged || D.played) { D.listChanged = D.played = false; refreshLocalRows(); } applyFocus(); }
}
function detailsKey(k) {
  if (k === "back") { closeDetails(); return; }
  var ln = D.ln;
  if (k === "down" && ln.li === 0 && D.seasons && D.seasons.length) { ln.li = 1; ln.ci = Math.max(0, D.seasons.indexOf(D.season)); lnFocus(ln); return; }
  if (k === "up" && ln.li === 1) { ln.li = 0; ln.ci = 0; lnFocus(ln); return; }
  if ((k === "down" || k === "up") && ln.li >= 1) { var n = ln.li + (k === "down" ? 1 : -1); if (n >= 2 && n < ln.lines.length) { ln.li = n; ln.ci = 0; lnFocus(ln); return; } if (n === 1) { ln.li = 1; ln.ci = Math.max(0, D.seasons.indexOf(D.season)); lnFocus(ln); return; } }
  lnKey(ln, k);
}

/* ================= player ================= */
var P = { open: false, list: null, idx: 0, item: null, useAV: false, osdT: null, urls: [], ui: 0, title: "", vod: false, resume: 0, ep: null, flatIdx: -1, tickT: null, lastSave: 0, started: false };
function base() { return account.server.replace(/\/+$/, ""); }
function cred() { return encodeURIComponent(account.username) + "/" + encodeURIComponent(account.password); }
function liveURLs(it) { return [base() + "/live/" + cred() + "/" + it.id + ".m3u8", base() + "/live/" + cred() + "/" + it.id + ".ts"]; }
function playItem(item, list, idx, resumeMs) {
  P.item = item; P.ep = null; P.flatIdx = -1; P.series = null;
  if (item.t === "live") {
    P.list = list || null; P.idx = idx || 0;
    addHistory(item);
    startPlayback(item.n, liveURLs(item), false, 0);
    osdEpg(item);
  } else {
    P.list = null;
    addHistory(item);
    startPlayback(item.n, [base() + "/movie/" + cred() + "/" + item.id + "." + (item.ext || "mp4")], true, resumeMs || 0);
  }
  if (D.open) D.played = true;
}
function playFlat(i, resumeMs) {
  var e = D.flat[i]; if (!e) return;
  P.item = D.item; P.series = D.flat; P.flatIdx = i; P.list = null;
  P.ep = { s: e.s, e: e.e, id: e.id, ext: e.ext, title: e.title };
  addHistory(D.item, { s: e.s, e: e.e });
  D.played = true;
  startPlayback(D.item.n + "  \u2022  S" + e.s + ":E" + e.e + " " + e.title, [base() + "/series/" + cred() + "/" + e.id + "." + e.ext], true, resumeMs || 0);
}
function resumeItem(it) {
  var ps = it._resume;
  if (it.t === "movies") { playItem(it, null, 0, ps.t); return; }
  if (ps.ep && ps.ep.id) {
    P.item = it; P.series = null; P.flatIdx = -1; P.list = null;
    P.ep = { s: ps.ep.s, e: ps.ep.e, id: ps.ep.id, ext: ps.ep.ext || "mp4", title: ps.ep.title || "" };
    if (ps.ep.next) { openDetails(it); return; }
    addHistory(it, { s: ps.ep.s, e: ps.ep.e });
    startPlayback(it.n + "  \u2022  S" + ps.ep.s + ":E" + ps.ep.e + " " + (ps.ep.title || ""), [base() + "/series/" + cred() + "/" + ps.ep.id + "." + (ps.ep.ext || "mp4")], true, ps.t);
  } else openDetails(it);
}
function osdEpg(it) {
  var e = $("osd-epg"); e.textContent = "";
  if (!it || it.t !== "live") return;
  getEpg(it.id).then(function (v) {
    if (!P.open || P.item !== it || !v.length) return;
    var now = Date.now(), cur = v[0].s <= now ? v[0] : null, nx = cur ? v[1] : v[0];
    e.textContent = (cur ? "Now: " + cur.t + " (until " + fmtClock(cur.e) + ")" : "") + (nx ? (cur ? "     " : "") + "Next " + fmtClock(nx.s) + ": " + nx.t : "");
  });
}
function osd(status, hint, stay) {
  if (status != null) $("osd-status").textContent = status;
  if (hint != null) $("osd-hint").textContent = hint;
  var o = $("osd"); o.classList.remove("hide"); clearTimeout(P.osdT);
  if (!stay) P.osdT = setTimeout(function () { o.classList.add("hide"); }, 4500);
}
function osdVisible() { return !$("osd").classList.contains("hide"); }
function hintText() {
  if (!P.vod) return (P.list ? "\u25B2 \u25BC  change channel      " : "") + "OK OK  " + (inList(P.item) ? "remove from" : "add to") + " My Channels      BACK  exit";
  return "OK  pause / play      \u25C0 \u25B6  back 10s / forward 30s      BACK  exit";
}
function startPlayback(title, urls, vod, resumeMs) {
  if (P.open) saveProgress(true);
  P.open = true; P.title = title; P.urls = urls; P.ui = 0; P.vod = vod; P.resume = resumeMs || 0; P.started = false; P.lastSave = Date.now();
  document.body.classList.add("playing"); document.documentElement.classList.add("playing");
  $("player").classList.remove("hidden");
  $("osd-title").textContent = title;
  setF(null);
  clearInterval(P.tickT); P.tickT = setInterval(playTick, 5000);
  playURL(urls[0]);
}
function avOK() { try { return !!(window.webapis && webapis.avplay); } catch (e) { return false; } }
function curTimes() {
  try {
    if (P.useAV) return { t: webapis.avplay.getCurrentTime() || 0, d: webapis.avplay.getDuration() || 0, playing: webapis.avplay.getState() === "PLAYING" };
    var v = $("video"); return { t: (v.currentTime || 0) * 1000, d: isFinite(v.duration) ? v.duration * 1000 : 0, playing: !v.paused && !v.ended && v.readyState > 2 };
  } catch (e) { return { t: 0, d: 0, playing: false }; }
}
function playTick() {
  if (!P.open || !P.item) return;
  var c = curTimes();
  if (c.playing) { P.started = true; addWatchTime(P.item, 5); }
  if (P.vod && c.playing && Date.now() - P.lastSave >= 9500) saveProgress(false);
  else savePD();
}
function saveProgress(final) {
  if (!P.item || !P.vod || !P.started) return;
  var c = curTimes(); if (!(c.t > 0)) return;
  P.lastSave = Date.now();
  var done = c.d > 0 && c.t > 0.92 * c.d;
  if (P.item.t === "movies") { if (done && final) clearPos(P.item); else setPos(P.item, c.t, c.d, null); return; }
  if (P.ep) {
    if (done && final) {
      var nx = P.series && P.flatIdx >= 0 ? P.series[P.flatIdx + 1] : null;
      if (nx) setPos(P.item, 0, 0, { s: nx.s, e: nx.e, id: nx.id, ext: nx.ext, title: nx.title, next: true });
      else clearPos(P.item);
    } else setPos(P.item, c.t, c.d, { s: P.ep.s, e: P.ep.e, id: P.ep.id, ext: P.ep.ext, title: P.ep.title });
  }
}
function playURL(url) {
  stopMedia();
  osd("Loading\u2026", hintText(), true);
  var resume = P.resume;
  if (avOK()) {
    P.useAV = true; $("video").classList.add("off");
    var av = webapis.avplay;
    try {
      av.open(url);
      av.setDisplayRect(0, 0, 1920, 1080);
      try { av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e0) {}
      av.setListener({
        onbufferingstart: function () { osd("Buffering\u2026", null, true); },
        onbufferingprogress: function (p) { osd("Buffering " + p + "%", null, true); },
        onbufferingcomplete: function () { osd("", null, false); },
        onstreamcompleted: function () { onEnded(); },
        oncurrentplaytime: function () {},
        onerror: function (e) { playFailed(String(e)); },
        onevent: function () {}
      });
      av.prepareAsync(function () {
        try {
          av.play(); P.started = true;
          if (resume > 0) { try { av.seekTo(resume, function () { osd("Resumed at " + fmtTime(resume), null, false); }, function () {}); } catch (e3) {} }
          else osd("", null, false);
        } catch (e1) { playFailed(String(e1)); }
      }, function (err) { playFailed(err && err.name ? err.name : String(err)); });
    } catch (e) { playFailed(e && e.name ? e.name : String(e)); }
  } else {
    P.useAV = false; var v = $("video"); v.classList.remove("off");
    v.onplaying = function () { P.started = true; osd("", null, false); };
    v.onloadedmetadata = function () { if (resume > 0) { try { v.currentTime = resume / 1000; } catch (e5) {} resume = 0; } };
    v.onwaiting = function () { osd("Buffering\u2026", null, true); };
    v.onerror = function () { playFailed("video error"); };
    v.onended = function () { onEnded(); };
    v.src = url;
    var pr; try { pr = v.play(); } catch (e2) {}
    if (pr && pr.catch) pr.catch(function () {});
  }
}
function onEnded() {
  saveProgress(true);
  if (P.series && P.flatIdx >= 0 && P.series[P.flatIdx + 1]) { playFlat(P.flatIdx + 1, 0); return; }
  closePlayer();
}
function playFailed(why) {
  if (!P.open) return;
  if (P.ui < P.urls.length - 1) { P.ui++; playURL(P.urls[P.ui]); return; }
  osd("Couldn't play this stream (" + why + ")", "BACK  exit" + (P.list ? "      \u25B2 \u25BC  try another channel" : ""), true);
}
function stopMedia() {
  if (P.useAV && avOK()) { try { webapis.avplay.stop(); } catch (e) {} try { webapis.avplay.close(); } catch (e2) {} }
  var v = $("video"); try { v.pause(); } catch (e3) {} if (v.getAttribute("src")) { v.removeAttribute("src"); try { v.load(); } catch (e4) {} }
}
function closePlayer() {
  if (!P.open) return;
  saveProgress(true);
  savePD(true);
  P.open = false; clearInterval(P.tickT); stopMedia();
  $("player").classList.add("hidden");
  document.body.classList.remove("playing"); document.documentElement.classList.remove("playing");
  if (D.open) { renderDetails(""); }
  else if (V.zone === "search") searchFocus();
  else { refreshLocalRows(); applyFocus(); }
}
function togglePause() {
  if (!P.vod) {
    var again = Date.now() - (P.lastOk || 0) < 6000; P.lastOk = Date.now();
    if (again && osdVisible()) { P.lastOk = 0; var on = toggleList(P.item); osd(on ? "\u2665 Added to My Channels" : "Removed from My Channels", hintText(), false); }
    else osd("", hintText(), false);
    return;
  }
  if (P.useAV) {
    var st = ""; try { st = webapis.avplay.getState(); } catch (e) {}
    if (st === "PLAYING") { try { webapis.avplay.pause(); } catch (e1) {} osd("Paused", null, true); saveProgress(false); }
    else { try { webapis.avplay.play(); } catch (e2) {} osd("", null, false); }
  } else { var v = $("video"); if (v.paused) { v.play(); osd("", null, false); } else { v.pause(); osd("Paused", null, true); saveProgress(false); } }
}
function seek(ms) {
  if (!P.vod) return;
  if (P.useAV) { try { if (ms > 0) webapis.avplay.jumpForward(ms); else webapis.avplay.jumpBackward(-ms); } catch (e) {} }
  else { var v = $("video"); try { v.currentTime = Math.max(0, v.currentTime + ms / 1000); } catch (e2) {} }
  osd((ms > 0 ? "\u23E9 +" : "\u23EA ") + Math.round(ms / 1000) + "s", null, false);
}
function zap(d) {
  if (!P.list) { osd(null, hintText(), false); return; }
  var n = P.idx + d; if (n < 0 || n >= P.list.length) return;
  P.idx = n; var it = P.list[n]; P.item = it;
  addHistory(it);
  $("osd-title").textContent = it.n; P.title = it.n;
  P.urls = liveURLs(it); P.ui = 0;
  playURL(P.urls[0]); osdEpg(it);
  var row = V.rows[V.r]; if (row && row.items === P.list) { row.col = n; row.off = Math.max(0, Math.min(n - 1, row.items.length - row.K.vis + 1)); }
}
function playerKey(k) {
  if (k === "back") closePlayer();
  else if (k === "enter") togglePause();
  else if (k === "left") seek(-10000);
  else if (k === "right") seek(30000);
  else if (k === "up") zap(-1);
  else if (k === "down") zap(1);
}
document.addEventListener("visibilitychange", function () { if (document.hidden && P.open) closePlayer(); else if (document.hidden) savePD(true); });
window.addEventListener("beforeunload", function () { if (P.open) saveProgress(true); savePD(true); });
