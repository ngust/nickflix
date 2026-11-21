/* NickFlix 4.15 - "Never show" (hate) rating, no NAS titles on Movies / Shows, stronger taste model, new themes.
   - Hate (PD.rt v = -2, per profile, in the profile backup like the other ratings): a 4th button on the details
     page and in the player Rate panel. On press the title disappears at once from every row and the hero of the
     current view (no reload), the details page / player closes, and it never appears again for that profile
     (Movies, Shows, Today's picks, themes, prestige rows, search: itemOK gate). The taste model takes a strong hit
     on its genres (-6), cast / director (-3 each) and its franchise (same title root, -8 per title).
     Settings > Content & filters > "Never show" lists hated titles; OK on one shows it again.
   - My Media (NAS) titles stay in the My Media tab only: Movies, Shows and search no longer show them.
   - Taste: prestige lists are a quality boost; three more daily themes for Nick (motorsport & rally,
     mountain biking & extreme, sports legends) plus modern history documentaries. */
"use strict";
RT_TXT["-2"] = "\uD83D\uDEAB"; RT_LBL["-2"] = "Never show";
RATE_VALS = [-2, -1, 1, 2];
(function () {
  var st = document.createElement("style");
  st.textContent = ".btn.rate.on.hate{background:#e50914;color:#fff}#nf-rate .ro.on.hate{background:#e50914;color:#fff}";
  document.head.appendChild(st);
})();
function rtHated(it) { return !!it && it.t !== "live" && rtGet(it) === -2; }
var _rateMsg415 = rateMsg;
rateMsg = function (v, was) { return v === -2 ? RT_TXT[-2] + "  Never showing this again \u2013 and less like it" : _rateMsg415(v, was); };
var _rateSync415 = rateSync;
rateSync = function (btns, it) { _rateSync415(btns, it); btns.forEach(function (b) { b.classList.toggle("hate", b._rv === -2 && b.classList.contains("on")); }); };
/* franchise root: "The Fast and the Furious 6: Tokyo" -> "fastandthefurious" */
function htRoot(n) {
  var s = String(n || "").toLowerCase().split(/[:\u2013\u2014]| - /)[0];
  s = s.replace(/\b(part|chapter|vol(ume)?|season)\b.*$/, "").replace(/\b(\d+|ii|iii|iv|v|vi)\s*$/, "").replace(/^\s*(the|a|an)\s+/, "").replace(/[^a-z0-9]+/g, "");
  return s.length >= 4 ? s : "";
}
/* ---------- the gate: hated titles nowhere, NAS titles only in My Media ---------- */
var _itemOK415 = itemOK;
itemOK = function (it) {
  if (!_itemOK415(it)) return false;
  if (it.t === "movies" || it.t === "series") {
    if ((typeof isNas === "function" && (isNas(it) || isNasHome(it))) && V && (V.view === "movies" || V.view === "series" || V.view === "search")) return false;
    try { if (PD && PD.rt && rtHated(it)) return false; } catch (e) {}
  }
  return true;
};
/* the "Documentaries on your NAS" row leaves Movies / Shows */
function htNoNasRows(rows) { return rows.filter(function (r) { return !/on your NAS/i.test(r.title || ""); }); }
var _curatedRows415h = curatedRows; curatedRows = function (type) { return htNoNasRows(_curatedRows415h(type)); };
var _allRows415h = allRows; allRows = function (type) { return htNoNasRows(_allRows415h(type)); };
/* ---------- hate: remove now, everywhere in this view ---------- */
function hatePurge(it) {
  var k = itemKey(it), nt = normTitle(it);
  function bad(x) { return x && x.t !== "tile" && x.t !== "live" && (itemKey(x) === k || normTitle(x) === nt || rtHated(x)); }
  V.rows.slice().forEach(function (row) {
    if (!row.items) return;
    var n = row.items.filter(function (x) { return !bad(x); }); if (n.length === row.items.length) return;
    row.items = n; clearRow(row);
    if (!n.length) { removeRow(row); return; }
    if (row.col >= n.length) row.col = n.length - 1;
    row.off = Math.max(0, Math.min(row.off, n.length - row.K.vis + 1));
    if (row.spec.count) row.cnt.textContent = n.length + (n.length === 1 ? " title" : " titles");
  });
  if (V.hero && bad(V.hero)) {
    V.hero = null; setHeroPlaceholder();
    for (var i = 0; i < V.rows.length; i++) if (!V.rows[i].spec.local && V.rows[i].items && V.rows[i].items.length) { pickHero(V.rows[i]); break; }
    if (V.zone === "hero" && !V.hero) V.zone = V.rows.length ? "rows" : "nav";
  }
  try { if (V.view === "search" && typeof runSearch === "function" && S.q) runSearch(); } catch (e) {}
  ensureRows();
  if (!D.open && !P.open && !OV.top()) applyFocus();
}
var _rtSet415 = rtSet;
rtSet = function (it, v) {
  var nv = _rtSet415(it, v);
  try { TSC.v = null; } catch (e) {}
  if (nv === -2) setTimeout(function () {
    try {
      if (P.open && P.item && normTitle(P.item) === normTitle(it)) closePlayer();
      if (D.open && D.item && normTitle(D.item) === normTitle(it)) { D.listChanged = false; D.played = false; closeDetails(); }
      hatePurge(it);
    } catch (e) {}
  }, 0);
  return nv;
};
/* player Rate panel: 4 choices now (Never show, Not for me, Like, Love) */
rpOpen = function () { var it = rpItem(); if (!it) return false; RP.it = it; RP.open = true; var cur = rtGet(it); RP.sel = cur ? RATE_VALS.indexOf(cur) : RATE_VALS.indexOf(1); rpRender(); return true; };
var _rpRender415 = rpRender;
rpRender = function () { _rpRender415(); try { var o = RP.el.querySelectorAll(".ro"); if (o[0] && rtGet(RP.it) === -2) o[0].classList.add("hate"); } catch (e) {} };
rpKey = function (k) {
  if (k === "back" || k === "green") { rpClose(); return; }
  if (k === "left") RP.sel = Math.max(0, RP.sel - 1);
  else if (k === "right") RP.sel = Math.min(RATE_VALS.length - 1, RP.sel + 1);
  else if (k === "enter") { var nv = rtSet(RP.it, RATE_VALS[RP.sel]); toastSafe(rateMsg(nv)); rpClose(); return; }
  rpRender();
};
/* ---------- taste model: hate hits hard; prestige = quality ---------- */
var _tsModel415 = tsModel;
tsModel = function () {
  var M = _tsModel415();
  if (M._h415) return M;
  M._h415 = 1; M.hroot = {};
  var R = rtBox();
  for (var k in R) {
    var e = R[k]; if (e.v !== -2) continue;
    (e.g || []).forEach(function (x) { M.gen[x] = (M.gen[x] || 0) - 4.5; });            // total -6 with the base -1.5
    (e.p || []).forEach(function (x) { M.pp[x] = (M.pp[x] || 0) - 2.5; });             // total -3 with the base -0.5
    var r = e.it && htRoot(e.it.n); if (r) M.hroot[(e.it.t || "") + ":" + r] = 1;
  }
  M.ppMax = 0; for (var q in M.pp) M.ppMax = Math.max(M.ppMax, M.pp[q]);
  return M;
};
var _tasteBoost415 = tasteBoost;
tasteBoost = function (it) {
  var b = _tasteBoost415(it); if (!it || it.t === "live" || b <= -60) return b;
  try {
    var M = tsModel(), r = htRoot(it.n); if (r && M.hroot && M.hroot[it.t + ":" + r]) b -= 8;
    if (typeof prBoost === "function") b += prBoost(it);
  } catch (e) {}
  return b;
};
/* ---------- more daily themes (themes.js) for what Nick asked for ---------- */
[
  { id: "motor", title: "\uD83C\uDFC1 Motorsport, F1 & rally", types: "ms", g: ["Documentary"], src: /MOTOR|RACING|F1\b|FORMULA|SPORT/,
    allow: /^(senna|rush|ford v(s\.?)? ferrari|le mans( '?66)?|grand prix|days of thunder|schumacher|mclaren|williams|1|weekend of a champion|the speed of life|formula 1: drive to survive|drive to survive|f1|f1: the movie|ferrari|gran turismo|the art of racing in the rain|talladega nights.*|herbie.*|cannonball run|death race|ronin|bullitt|baby driver|drive|the italian job|gone in (60|sixty) seconds|fast (and|&) furious.*|the fast and the furious.*|top gear|the grand tour|wrc|dakar.*|rally.*|isle of man tt.*|closer to the edge|tt3d.*|race to glory.*|lauda.*|hunt vs lauda|the limit|moto gp.*|motogp unlimited|nascar.*|indycar.*|winning|truth in 24.*|apex.*|one: the life and times.*)$/i,
    kw: /rally|\bwrc\b|dakar|formula (1|one)|\bf1\b|grand prix|motogp|le mans|nascar|indycar|motorsport|isle of man|superbike|racing driver|race car|senna|schumacher|lauda/i },
  { id: "mtb", title: "\uD83D\uDEB5 Mountain biking & extreme", types: "ms", g: ["Documentary"], src: /SPORT|EXTREME|ADVENTURE|RED BULL|DOCU/,
    allow: /^(free solo|the dawn wall|valley uprising|meru|14 peaks.*|the alpinist|touching the void|the art of flight|riding giants|dogtown (and|&) z-?boys|the sound of speed|unreal|follow me|north of nightfall|return to earth|where the trail ends|the moment|seasons|klunkerz|pedal|the ride|this is mtb|hello world|loam|ready to roll|life cycles|the last mountain|everest|k2.*|man on wire|the summit|the barkley marathons.*|chasing mavericks|point break|the endless summer)$/i,
    kw: /mountain bik|\bmtb\b|downhill|rampage|freeride|enduro|\bbmx\b|red bull|extreme sport|climb(er|ing)|skateboard|snowboard|surf(ing|er)|base jump|wingsuit/i },
  { id: "sportsleg", title: "\uD83C\uDFC6 Sports legends", types: "ms", g: ["Documentary"], need: "Documentary", src: /SPORT|DOCU/,
    allow: /^(senna|the last dance|when we were kings|hoop dreams|icarus|free solo|schumacher|maradona|diego maradona|pele|pel\u00e9|ali|the armstrong lie|o\.?j\.?: made in america|tyson|untold.*|30 for 30.*|the redeem team|beckham|sunderland 'til i die|all or nothing.*|drive to survive|formula 1: drive to survive|quarterback|receiver|full swing|the test|break point|tour de france: unchained|welcome to wrexham|being messi|kobe.*|gretzky|of miracles and men|the two escobars|man on wire|the dawn wall|14 peaks.*)$/i,
    kw: /legend|champion|olympi|world cup|stanley cup|super bowl|\bnba\b|\bnfl\b|\bnhl\b|boxing|boxer|football|soccer|hockey|basketball|baseball|tennis|golf|cycling|athlete|sports? (documentar|star)|biography of/i },
  { id: "history", title: "\uD83D\uDCDC 9/11, war & modern history", types: "ms", g: ["Documentary", "War & History"], need: "Documentary", src: /DOCU|HISTOR|WAR/,
    allow: /^(102 minutes that changed america|9\/11|turning point: 9\/11.*|the fog of war|the vietnam war|the world at war|apollo 11|chernobyl.*|they shall not grow old|20 days in mariupol|navalny|citizenfour|the cold war|the civil war|ken burns.*|the last days|the gatekeepers|restrepo|korengal|taxi to the dark side|no end in sight|fahrenheit 9\/11|9\/11: inside the president'?s war room|9\/11: one day in america|the bush years|the kennedys|jfk.*|watergate|all the president'?s men|the putin interviews|bowling for columbine|the act of killing|night will fall)$/i,
    kw: /9\/11|september 11|twin towers|world trade center|ground zero|bin laden|al.?qaeda|war on terror|cold war|world war|wwii|ww2|vietnam|korean war|iraq|afghanistan|chernobyl|apollo|moon landing|watergate|kennedy|nixon|holocaust|berlin wall|soviet|history of/i }
].forEach(function (t) { if (!TH_BY[t.id]) { THEMES.push(t); TH_BY[t.id] = t; } });
/* ---------- Settings: Content & filters > Never show ---------- */
var _stContent415 = stContent;
stContent = function (inner, ln) {
  _stContent415(inner, ln);
  inner.appendChild(ce("div", "s-sec", RT_TXT[-2] + " Never show"));
  var R = rtBox(), hs = [];
  for (var k in R) if (R[k].v === -2 && R[k].it) hs.push(R[k]);
  hs.sort(function (a, b) { return b.ts - a.ts; });
  if (!hs.length) { stRow(inner, ln, { key: "ht:none", ic: RT_TXT[-2], t: "No hidden titles", d: "Press " + RT_TXT[-2] + " Never show on a movie or show (details page, or \u25BC while watching) to hide it for " + PF.name + " for good" }); return; }
  hs.slice(0, 40).forEach(function (e, i) {
    stRow(inner, ln, { key: "ht:" + i, ic: e.it.t === "series" ? "\uD83D\uDCFA" : "\uD83C\uDFAC", t: e.it.n + (e.it.y ? " (" + e.it.y + ")" : ""), d: "Hidden from Movies, Shows, picks and search  \u00b7  OK shows it again", act: function () {
      rtSet(e.it, -2); ST.dirty = true; toast("\u2713 " + e.it.n + " can show up again"); renderSettings("ht:" + Math.max(0, i - 1));
    } });
  });
};
