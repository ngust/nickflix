/* NickFlix v2 - overlays: settings, who's watching, profile editor, profile/stats, search, keys, boot */
"use strict";
var OV = { stack: [], top: function () { return this.stack.length ? this.stack[this.stack.length - 1] : null; } };
function ovOpen(o) { OV.stack.push(o); $(o.id).classList.remove("hidden"); }
function ovClose(o) { var i = OV.stack.indexOf(o); if (i >= 0) OV.stack.splice(i, 1); $(o.id).classList.add("hidden"); }
function restoreFocus() { var t = OV.top(); if (t) { if (t.refocus) t.refocus(); else lnFocus(t.ln); } else if (D.open) lnFocus(D.ln); else if (V.zone === "search") searchFocus(); else applyFocus(); }

function chip(label, sub, on, act, cls) {
  var c = ce("div", "chip" + (cls ? " " + cls : "") + (on ? " on" : ""));
  if (!cls || cls.indexOf("act") < 0) c.appendChild(ce("span", "box", on ? "\u2713" : ""));
  c.appendChild(ce("span", "cl", label));
  if (sub) c.appendChild(ce("span", "cn", sub));
  c._act = act; return c;
}
function setChip(c, on) { c.classList.toggle("on", on); var b = c.querySelector(".box"); if (b) b.textContent = on ? "\u2713" : ""; }
function grid(inner, ln, list, perLine, mk) {
  var all = [];
  for (var i = 0; i < list.length; i += perLine) {
    var l = ce("div", "s-line"), items = [];
    list.slice(i, i + perLine).forEach(function (x) { var c = mk(x); l.appendChild(c); items.push(c); all.push(c); });
    inner.appendChild(l); lnAdd(ln, l, items, { keepCol: true });
  }
  return all;
}

/* ================= settings ================= */
var ST = { id: "settings", ln: null, page: "home", stack: [], dirty: false, exp: {}, ctExp: {} };
function openSettings() {
  ST.dirty = false; ST.page = "home"; ST.stack = [];
  ovOpen(ST); renderSettings();
  /* start on "Extra channels" so a stray OK press can never flip the adult / Quebec toggles */
  if (ST.ln && ST.ln.lines.length > 2) { ST.ln.li = 2; ST.ln.ci = 0; lnFocus(ST.ln); }
}
function stPage(p) { ST.stack.push({ page: ST.page, li: ST.ln.li, ci: ST.ln.ci }); ST.page = p; renderSettings(); }
function stBack() {
  var a = document.activeElement; if (a && a.tagName === "INPUT") a.blur();
  if (ST.stack.length) { var s = ST.stack.pop(); ST.page = s.page; renderSettings(); ST.ln.li = s.li; ST.ln.ci = s.ci; lnFocus(ST.ln); return; }
  closeSettings();
}
function closeSettings() {
  ovClose(ST); savePD(true);
  if (ST.dirty) { poolMem = {}; buildView(V.view === "search" ? PD.st.view : V.view); if (V.view === "search") showSearch(); }
  V.zone = "nav"; V.navIdx = TAB_VIEWS.indexOf("settings"); applyFocus();
}
function renderSettings(keepKey) {
  var inner = $("settings-inner"); inner.textContent = ""; inner.style.transform = "";
  var ln = ST.ln = LN(inner, 480);
  var hdr = ce("div", "s-hdr");
  var logo = document.createElement("img"); logo.src = "img/logo.png"; logo.className = "s-logo"; hdr.appendChild(logo);
  var who = ce("div", "s-who"); var av = document.createElement("img"); av.src = avatarSrc(PF.av); who.appendChild(av); who.appendChild(ce("span", "", PF.name)); hdr.appendChild(who);
  inner.appendChild(hdr);
  ({ home: stHome, live: stLive, vod: stVod, account: stAccount, sports: stSports, extra: stExtra })[ST.page](inner, ln);
  if (keepKey && lnFind(ln, keepKey)) {} else if (!keepKey) { ln.li = 0; ln.ci = 0; }
  lnFocus(ln);
}
function navBtn(inner, ln, title, desc, act) {
  var l = ce("div", "s-line"), b = ce("div", "s-big");
  b.appendChild(ce("div", "s-big-t", title)); b.appendChild(ce("div", "s-big-d", desc));
  b._act = act; l.appendChild(b); inner.appendChild(l); lnAdd(ln, l, [b]); return b;
}
function stHome(inner, ln) {
  inner.appendChild(ce("div", "s-h1", "Settings"));
  inner.appendChild(ce("div", "s-sub", "Filters are saved per profile (" + PF.name + ") and applied when you press BACK."));
  var lc = 0, lt = 0; cats.live.forEach(function (c) { lt++; if (catVisibleLive(c)) lc++; });
  // --- content switches (per profile) ---
  inner.appendChild(ce("div", "s-sec", "Content for " + PF.name));
  function toggleLine(key, label, desc, get, set) {
    var l = ce("div", "s-line"), c = chip(label, desc, get(), null, "wide tog"); c._key = key;
    c._act = function () { set(!get()); setChip(c, get()); ST.dirty = true; savePD(true); toast(label + ": " + (get() ? "ON" : "OFF")); };
    l.appendChild(c); inner.appendChild(l); lnAdd(ln, l, [c]);
  }
  toggleLine("tog:adult", "Adult content (18+)", "OFF hides every adult channel, category, movie and search result for this profile", function () { return !!PD.st.adult; }, function (v) { PD.st.adult = v; });
  toggleLine("tog:qc", "Hide Quebec / French-Canadian content", "Removes TVA, Noovo, RDS, ICI Radio-Canada, Télé-Québec, Super Écran\u2026 and Quebec groups from TV, Movies, Shows, search and sports", function () { return qcHidden(); }, function (v) { PD.st.hideQC = v; });
  navBtn(inner, ln, "\uD83C\uDDE9\uD83C\uDDEA  Extra channels from other countries", (extraIds().length ? "Picked: " + extraChannels().map(function (c) { return logoName(c.n).split(" ").map(niceWord).join(" "); }).join(", ") : "None picked") + "  \u00b7  e.g. German DMAX and Discovery", function () { stPage("extra"); });
  inner.appendChild(ce("div", "s-sec", "More settings"));
  navBtn(inner, ln, "\uD83D\uDCFA  Live TV filters", "Choose regions, countries and channel types for the TV tab. Showing " + lc + " of " + lt + " channel groups.", function () { stPage("live"); });
  navBtn(inner, ln, "\uD83C\uDFAC  Movies & Shows filters", "Languages, genres and streaming sources for Movies, Shows and Search.", function () { stPage("vod"); });
  navBtn(inner, ln, "\uD83C\uDFD2  Sports, events & time", "Favourite NHL team: " + (PD.st.nhlTeam ? teamName(PD.st.nhlTeam) : "none") + "  \u00b7  Game times shown in: " + tzLabel(), function () { stPage("sports"); });
  navBtn(inner, ln, "\uD83D\uDC64  Profiles", "Switch, add, rename or delete profiles and change avatars.", function () { closeSettings(); openWho(true); });
  navBtn(inner, ln, "\uD83D\uDCCA  " + PF.name + "'s viewing stats", "Hours watched, top genres, top channels, recent activity.", function () { closeSettings(); openProfilePage(); });
  navBtn(inner, ln, "\uD83D\uDD11  Account", "Your IPTV provider login (shared by all profiles).", function () { stPage("account"); });
  inner.appendChild(ce("div", "s-sec", "App"));
  toggleLine("tog:intro", "Intro animation", "Play the NickFlix intro with sound when the app starts (all profiles). Any key skips it.", function () { return introEnabled(); }, function (v) { try { localStorage.setItem("nf_intro", v ? "1" : "0"); } catch (e) {} });
  inner.appendChild(ce("div", "s-note", "NickFlix 4.3.1"));
}
function liveCodes() {
  var cnt = {}; cats.live.forEach(function (c) { if (!c.adult) cnt[c.code] = (cnt[c.code] || 0) + 1; }); return cnt;
}
function setCountry(code, on) { PD.st.live.countries[code] = on ? 1 : 0; ST.dirty = true; savePD(); }
function stLive(inner, ln) {
  var L = PD.st.live, cnt = liveCodes();
  inner.appendChild(ce("div", "s-h1", "Live TV filters"));
  inner.appendChild(ce("div", "s-sub", "These only affect the TV tab (Movies & Shows have their own filters). A channel group is shown when its country is ON, its channel type is ON, and \u2013 if you limited that country \u2013 its type is in that country's list. Order on the TV tab: Canada/US sports first, then PPV & events, then news, then everything else."));
  // presets
  inner.appendChild(ce("div", "s-sec", "Quick presets"));
  var pl = ce("div", "s-line"), pit = [];
  function preset(label, fn) { var c = chip(label, "", false, function () { fn(); ST.dirty = true; savePD(); renderSettings(c._key); toast("Applied: " + label); }, "act"); c._key = "pre:" + label; pl.appendChild(c); pit.push(c); }
  preset("Recommended (CA + US sports & news)", function () { L.countries = {}; L.typesOff = {}; L.ctypes = JSON.parse(JSON.stringify(LIVE_DEFAULT_CTYPES)); });
  preset("Hide all Asian & Latino", function () { REGIONS.forEach(function (r) { if (/Asia|Latin|Brazil/.test(r[0])) r[1].forEach(function (c) { L.countries[c] = 0; }); }); });
  preset("North America only", function () { Object.keys(cnt).forEach(function (c) { L.countries[c] = (c === "CA" || c === "US") ? 1 : 0; }); });
  preset("Show everything", function () { Object.keys(cnt).forEach(function (c) { L.countries[c] = 1; }); L.typesOff = {}; L.ctypes = {}; });
  inner.appendChild(pl); lnAdd(ln, pl, pit);
  // regions
  inner.appendChild(ce("div", "s-sec", "Regions & countries"));
  inner.appendChild(ce("div", "s-note", "OK on a region turns the whole region on/off. Use \u201cCountries \u25BE\u201d to pick individual countries. Asian regions, Latin America and Brazil are OFF by default."));
  var groups = REGIONS.map(function (r) { return [r[0], r[1].filter(function (c) { return cnt[c]; })]; });
  var other = Object.keys(cnt).filter(function (c) { return !CODE_REGION[c]; }); if (other.length) groups.push(["Other", other]);
  groups.forEach(function (g) {
    var codes = g[1]; if (!codes.length) return;
    var onN = codes.filter(liveCountryOn).length, nGroups = 0; codes.forEach(function (c) { nGroups += cnt[c]; });
    var l = ce("div", "s-line");
    var rc = chip(g[0], onN + " of " + codes.length + " countries on \u00b7 " + nGroups + " channel groups", onN > 0, null, "region" + (onN > 0 && onN < codes.length ? " part" : ""));
    rc._key = "reg:" + g[0];
    rc._act = function () { var v = onN === 0; codes.forEach(function (c) { setCountry(c, v); }); renderSettings(rc._key); };
    var ex = chip(ST.exp[g[0]] ? "Countries \u25B4" : "Countries \u25BE", "", false, function () { ST.exp[g[0]] = !ST.exp[g[0]]; renderSettings(ex._key); }, "act small");
    ex._key = "exp:" + g[0];
    l.appendChild(rc); l.appendChild(ex); inner.appendChild(l); lnAdd(ln, l, [rc, ex]);
    if (ST.exp[g[0]]) {
      grid(inner, ln, codes, 4, function (c) {
        var ch = chip(LANG_NAMES[c] || c, c + " \u00b7 " + cnt[c], liveCountryOn(c), null, "sub");
        ch._key = "c:" + c; ch._act = function () { setCountry(c, !liveCountryOn(c)); renderSettings(ch._key); };
        return ch;
      });
    }
  });
  // channel types
  inner.appendChild(ce("div", "s-sec", "Channel types (all countries)"));
  inner.appendChild(ce("div", "s-note", "Turn a type off to hide it everywhere, e.g. Radio or Religious."));
  var tcnt = {}; cats.live.forEach(function (c) { tcnt[c.ltype] = (tcnt[c.ltype] || 0) + 1; });
  var types = LIVE_TYPES.map(function (t) { return t[0]; });
  grid(inner, ln, types, 4, function (t) {
    var ch = chip(t, String(tcnt[t] || 0), !L.typesOff[t], null);
    ch._key = "t:" + t; ch._act = function () { if (L.typesOff[t]) delete L.typesOff[t]; else L.typesOff[t] = 1; ST.dirty = true; savePD(); setChip(ch, !L.typesOff[t]); };
    return ch;
  });
  // per-country limits
  inner.appendChild(ce("div", "s-sec", "Limit a country to certain types"));
  inner.appendChild(ce("div", "s-note", "Example: USA \u2192 only Sports, PPV & Events and News. Countries without a limit show every enabled type."));
  Object.keys(cnt).filter(liveCountryOn).sort(function (a, b) { var o = ["CA", "US", "UK", "EN"]; var ia = o.indexOf(a), ib = o.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b); }).forEach(function (c) {
    var lim = L.ctypes[c], l = ce("div", "s-line");
    var b = chip((LANG_NAMES[c] || c) + ": " + (lim ? (lim.length ? lim.join(", ") : "nothing") : "all types"), ST.ctExp[c] ? "\u25B4" : "change \u25BE", !!lim, null, "act wide");
    b._key = "ct:" + c; b._act = function () { ST.ctExp[c] = !ST.ctExp[c]; renderSettings(b._key); };
    l.appendChild(b); inner.appendChild(l); lnAdd(ln, l, [b]);
    if (ST.ctExp[c]) {
      var al = ce("div", "s-line"), noL = chip("No limit (all types)", "", !lim, function () { delete L.ctypes[c]; ST.dirty = true; savePD(); renderSettings(noL._key); }, "sub");
      noL._key = "ctn:" + c; al.appendChild(noL); inner.appendChild(al); lnAdd(ln, al, [noL]);
      grid(inner, ln, types, 4, function (t) {
        var on = !!lim && lim.indexOf(t) >= 0;
        var ch = chip(t, "", on, null, "sub");
        ch._key = "ctt:" + c + ":" + t;
        ch._act = function () { var cur = L.ctypes[c] ? L.ctypes[c].slice() : []; var i = cur.indexOf(t); if (i >= 0) cur.splice(i, 1); else cur.push(t); L.ctypes[c] = cur; ST.dirty = true; savePD(); renderSettings(ch._key); };
        return ch;
      });
    }
  });
}
function stSports(inner, ln) {
  inner.appendChild(ce("div", "s-h1", "Sports, events & time"));
  inner.appendChild(ce("div", "s-sub", "Game schedules come from the free public NHL and ESPN feeds; times are converted from UTC to the zone below. Major events (UFC numbered cards, Super Bowl, Stanley Cup Final, NBA Finals, World Series, F1, World Cup) appear first on the TV hub."));
  var l1 = ce("div", "s-line"), b1 = chip("Favourite NHL team: " + (PD.st.nhlTeam ? teamName(PD.st.nhlTeam) : "none") + "  \u2013 change", "", !!PD.st.nhlTeam, function () { openTeamPicker(); }, "act wide");
  l1.appendChild(b1); inner.appendChild(l1); lnAdd(ln, l1, [b1]);
  inner.appendChild(ce("div", "s-sec", "Show times in"));
  inner.appendChild(ce("div", "s-note", "Default is Creston (UTC\u22127 all year, no daylight saving). Zones marked \u201cwith DST\u201d follow the US/Canada rules (2nd Sunday of March to 1st Sunday of November). Shared by all profiles. Now: " + fmtClock(Date.now())));
  grid(inner, ln, TZ_OPTS, 2, function (o) {
    var cur = tzId();
    var c = chip(o[1], "", cur === o[0], null); c._key = "tz:" + o[0];
    c._act = function () { account.tz = o[0]; saveAccount(); XC = {}; tick(); ST.dirty = true; renderSettings(c._key); };
    return c;
  });
  inner.appendChild(ce("div", "s-sec", "Learning"));
  var l2 = ce("div", "s-line"), b2 = chip("Reset what NickFlix learned for " + PF.name, "", false, function () { if (b2._armed) { PD.learn = {}; savePD(true); toast("Learning reset for " + PF.name); ST.dirty = true; b2._armed = false; } else { b2._armed = true; toast("Press OK again to reset"); } }, "act");
  l2.appendChild(b2); inner.appendChild(l2); lnAdd(ln, l2, [b2]);
}
/* extra channels from countries that are switched off (start with Germany) */
var XC_COUNTRIES = [["DE", "Germany"], ["NOW", "Germany (Sky/WOW)"], ["AT", "Austria"], ["SW", "Switzerland"], ["FR", "France"], ["IT", "Italy"], ["ES", "Spain"], ["NL", "Netherlands"], ["AU", "Australia"], ["IE", "Ireland"]];
function stExtra(inner, ln) {
  inner.appendChild(ce("div", "s-h1", "Extra channels from other countries"));
  inner.appendChild(ce("div", "s-sub", "Pick single channels from countries you keep switched off. Picks are per profile (" + PF.name + "), appear in a \u201c" + (extraLabel() || "German Picks") + "\u201d tile and row on the TV hub, and inside matching categories (e.g. Documentary)."));
  if (!CH.all) {
    inner.appendChild(ce("div", "s-note", "Loading the channel list\u2026"));
    ensureIndex().then(function () { if (OV.top() === ST && ST.page === "extra") renderSettings("x"); });
    return;
  }
  function chChip(ch, label) {
    var c = chip(label || logoName(ch.n), (catById["live:" + ch.c] || {}).code || "", !!PD.st.extra[ch.id], null); c._key = "xch:" + ch.id;
    c._act = function () { var on = !PD.st.extra[ch.id]; setExtra(ch, on); setChip(c, on); ST.dirty = true; toast((on ? "Added " : "Removed ") + logoName(ch.n)); };
    return c;
  }
  var picks = extraChannels();
  inner.appendChild(ce("div", "s-sec", "Your picks (" + picks.length + ")"));
  if (picks.length) grid(inner, ln, picks, 3, function (ch) { return chChip(ch, logoName(ch.n).split(" ").map(niceWord).join(" ")); });
  else inner.appendChild(ce("div", "s-note", "None yet."));
  inner.appendChild(ce("div", "s-sec", "Popular German channels (best quality version)"));
  var sug = []; EXTRA_SUGGEST.forEach(function (sg) { var b = bestGerman(sg); if (b) sug.push([b, sg[0]]); });
  grid(inner, ln, sug, 3, function (x) { return chChip(x[0], x[1]); });
  inner.appendChild(ce("div", "s-sec", "Browse a country"));
  var codes = XC_COUNTRIES.filter(function (x) { return cats.live.some(function (c) { return c.code === x[0] && !c.adult; }); });
  grid(inner, ln, codes, 4, function (x) { var c = chip(x[1], "", ST.xc === x[0], null, "act"); c._key = "xc:" + x[0]; c._act = function () { ST.xc = ST.xc === x[0] ? null : x[0]; ST.xg = null; renderSettings(c._key); }; return c; });
  if (ST.xc) {
    var groups = cats.live.filter(function (c) { return c.code === ST.xc && !c.adult && !(c.qc && qcHidden()); });
    inner.appendChild(ce("div", "s-sec", "Groups in " + ST.xc));
    grid(inner, ln, groups, 3, function (g) { var c = chip(g.title, "", ST.xg === g.id, null, "act"); c._key = "xg:" + g.id; c._act = function () { ST.xg = ST.xg === g.id ? null : g.id; renderSettings(c._key); }; return c; });
    if (ST.xg) {
      var list = dedupeBest(CH.all.filter(function (ch) { return ch.c === ST.xg && !ch.ad; }), 120);
      list.sort(function (a, b) { return logoName(a.n).localeCompare(logoName(b.n)); });
      inner.appendChild(ce("div", "s-sec", "Channels \u2013 OK to add/remove"));
      grid(inner, ln, list, 3, function (ch) { return chChip(ch); });
    }
  }
}
function langList() {
  var cnt = {};
  ["movies", "series"].forEach(function (t) { cats[t].forEach(function (c) { if (!c.adult) cnt[c.code] = (cnt[c.code] || 0) + 1; }); });
  var codes = Object.keys(cnt);
  codes.sort(function (a, b) { var da = DEFAULT_LANGS[a] ? 0 : 1, db = DEFAULT_LANGS[b] ? 0 : 1; if (da !== db) return da - db; return (LANG_NAMES[a] || a).localeCompare(LANG_NAMES[b] || b); });
  return codes.map(function (c) { return { key: c, label: LANG_NAMES[c] || c, sub: c + " \u00b7 " + cnt[c] }; });
}
function tagList(field, order) {
  var cnt = {};
  ["movies", "series"].forEach(function (t) { cats[t].forEach(function (c) { c[field].forEach(function (g) { cnt[g] = (cnt[g] || 0) + 1; }); }); });
  var keys = Object.keys(cnt);
  keys.sort(function (a, b) { if (a === "Other" || a === "General") return 1; if (b === "Other" || b === "General") return -1; return order ? order.indexOf(a) - order.indexOf(b) : cnt[b] - cnt[a]; });
  return keys.map(function (k) { return { key: k, label: k, sub: String(cnt[k]) }; });
}
function stVod(inner, ln) {
  var v = PD.st.v;
  inner.appendChild(ce("div", "s-h1", "Movies & Shows filters"));
  inner.appendChild(ce("div", "s-sub", "These affect Movies, Shows and Search (not Live TV)."));
  inner.appendChild(ce("div", "s-sec", "Start Movies & Shows in"));
  var ml = ce("div", "s-line"), mit = [];
  [["movies", "Movies"], ["series", "Shows"]].forEach(function (x) {
    var c = chip(x[1] + ": " + (PD.st.mode[x[0]] === "all" ? "All categories" : "Curated"), "", true, function () { PD.st.mode[x[0]] = PD.st.mode[x[0]] === "all" ? "curated" : "all"; ST.dirty = true; savePD(); renderSettings(c._key); }, "act");
    c._key = "mode:" + x[0]; ml.appendChild(c); mit.push(c);
  });
  inner.appendChild(ml); lnAdd(ln, ml, mit);
  function section(title, note, list, isOn, toggle) {
    inner.appendChild(ce("div", "s-sec", title));
    inner.appendChild(ce("div", "s-note", note));
    var al = ce("div", "s-line"), chips;
    var aOn = chip("Turn all on", "", false, function () { list.forEach(function (x) { if (x.key !== "ADULT") toggle(x.key, true); }); chips.forEach(function (c) { if (c._k !== "ADULT") setChip(c, true); }); ST.dirty = true; savePD(); }, "act");
    var aOff = chip("Turn all off", "", false, function () { list.forEach(function (x) { toggle(x.key, false); }); chips.forEach(function (c) { setChip(c, false); }); ST.dirty = true; savePD(); }, "act");
    al.appendChild(aOn); al.appendChild(aOff); inner.appendChild(al); lnAdd(ln, al, [aOn, aOff]);
    chips = grid(inner, ln, list, 4, function (x) {
      var c = chip(x.label, x.sub, isOn(x.key), null); c._k = x.key; c._key = title + ":" + x.key;
      c._act = function () { var nv = !isOn(x.key); toggle(x.key, nv); setChip(c, nv); ST.dirty = true; savePD(); };
      return c;
    });
  }
  section("Languages & regions", "Only checked ones appear in Movies, Shows and Search.", langList(), vLangOn, function (k, on) { v.langs[k] = on ? 1 : 0; });
  section("Genres", "A category row is shown if any of its genres is checked.", tagList("genres", GENRES.map(function (g) { return g[0]; })),
    function (k) { return !v.genresOff[k]; }, function (k, on) { if (on) delete v.genresOff[k]; else v.genresOff[k] = 1; });
  section("Sources & services", "Detected from category names (Netflix, Apple TV+, Disney+, Prime Video, HBO\u2026).", tagList("sources"),
    function (k) { return !v.sourcesOff[k]; }, function (k, on) { if (on) delete v.sourcesOff[k]; else v.sourcesOff[k] = 1; });
}
function stAccount(inner, ln) {
  inner.appendChild(ce("div", "s-h1", "Account"));
  inner.appendChild(ce("div", "s-note", "Your IPTV provider login, shared by all profiles. Press OK on a field to type."));
  [["Server", "server", "text"], ["Username", "username", "text"], ["Password", "password", "password"]].forEach(function (f) {
    var l = ce("div", "s-line"); l.appendChild(ce("div", "s-lab", f[0]));
    var inp = document.createElement("input"); inp.className = "inp"; inp.type = f[2]; inp.value = account[f[1]]; inp.setAttribute("autocomplete", "off");
    inp._field = f[1]; inp._act = function () { inp.focus(); };
    l.appendChild(inp); inner.appendChild(l); lnAdd(ln, l, [inp]);
  });
  var sl = ce("div", "s-line");
  var sv = chip("Save login & reconnect", "", false, function () {
    var ins = inner.querySelectorAll("input.inp");
    for (var i = 0; i < ins.length; i++) account[ins[i]._field] = ins[i].value.trim() || account[ins[i]._field];
    saveAccount(); cache = {}; poolMem = {}; toast("Reconnecting\u2026");
    loadAllCats().then(function () { toast("Connected"); ST.dirty = true; }).catch(function () { toast("Connection failed \u2013 check server, username and password", 4000); });
  }, "act");
  sl.appendChild(sv); inner.appendChild(sl); lnAdd(ln, sl, [sv]);
}
ST.key = function (k) { if (k === "back") { stBack(); return; } lnKey(ST.ln, k); };

/* ================= who's watching ================= */
var WH = { id: "who", ln: null, manage: false, first: false };
function openWho(manage) {
  WH.manage = !!manage;
  if (P.open) closePlayer();
  if (D.open) closeDetails();
  if (OV.stack.indexOf(WH) < 0) ovOpen(WH);
  renderWho();
}
function renderWho(focusId) {
  var box = $("who-inner"); box.textContent = ""; box.style.transform = "";
  var ln = WH.ln = LN(box, 2000);
  box.appendChild(ce("img", "who-logo")).src = "img/logo.png";
  box.appendChild(ce("div", "who-h", WH.manage ? "Manage profiles" : "Who's watching?"));
  var l = ce("div", "who-line"), items = [];
  profiles.list.forEach(function (p) {
    var t = ce("div", "who-p" + (WH.manage ? " manage" : ""));
    var im = document.createElement("img"); im.src = avatarSrc(p.av); t.appendChild(im);
    if (WH.manage) t.appendChild(ce("div", "who-edit", "\u270E"));
    t.appendChild(ce("div", "who-n", p.name));
    t._key = p.id;
    t._act = function () { if (WH.manage) openEditor(p); else chooseProfile(p.id); };
    l.appendChild(t); items.push(t);
  });
  if (profiles.list.length < 8) {
    var add = ce("div", "who-p add"); add.appendChild(ce("div", "who-plus", "+")); add.appendChild(ce("div", "who-n", "Add profile"));
    add._key = "add"; add._act = function () { openEditor(null); };
    l.appendChild(add); items.push(add);
  }
  box.appendChild(l); lnAdd(ln, l, items);
  var bl = ce("div", "who-line2"), mb = ce("div", "btn wb", WH.manage ? "Done" : "Manage profiles");
  mb._act = function () { WH.manage = !WH.manage; renderWho(); };
  bl.appendChild(mb); box.appendChild(bl); lnAdd(ln, bl, [mb]);
  if (!lnFind(ln, focusId || (PF ? PF.id : profiles.last))) { ln.li = 0; ln.ci = 0; }
  lnFocus(ln);
}
WH.key = function (k) {
  if (k === "back") {
    if (WH.manage) { WH.manage = false; renderWho(); return; }
    if (WH.first) { exitApp(); return; }
    ovClose(WH); restoreFocus(); return;
  }
  lnKey(WH.ln, k);
};
function chooseProfile(id) {
  var changed = !PF || PF.id !== id || WH.first;
  if (PF) savePD(true);
  loadProfile(id);
  WH.first = false;
  ovClose(WH);
  $("nav-av").src = avatarSrc(PF.av); $("nav-name").textContent = PF.name;
  if (!booted) { pendingStart = true; $("splash").classList.remove("hidden"); return; }
  if (changed) startMain(); else restoreFocus();
}

/* ================= profile editor ================= */
var PE = { id: "pedit", ln: null, p: null, name: "", av: 0 };
function openEditor(p) {
  PE.p = p; PE.name = p ? p.name : ""; PE.av = p ? p.av : (profiles.list.length * 5) % AVATARS;
  ovOpen(PE); renderEditor();
  PE.ln.li = 0; PE.ln.ci = 0; lnFocus(PE.ln);
}
function renderEditor(keepKey) {
  var box = $("pedit-inner"), keepLi = PE.ln ? PE.ln.li : 0, keepCi = PE.ln ? PE.ln.ci : 0;
  box.textContent = "";
  var ln = PE.ln = LN(box, 600);
  box.appendChild(ce("div", "pe-h", PE.p ? "Edit profile" : "Add profile"));
  var top = ce("div", "pe-top");
  var big = document.createElement("img"); big.className = "pe-big"; big.src = avatarSrc(PE.av); top.appendChild(big);
  var nm = ce("div", "pe-name"); nm.id = "pe-name"; top.appendChild(nm);
  box.appendChild(top);
  var cols = ce("div", "pe-cols"), kb = ce("div", "pe-kb"), avs = ce("div", "pe-avs");
  cols.appendChild(kb); cols.appendChild(avs); box.appendChild(cols);
  // keyboard lines and avatar lines are merged side-by-side: each nav line = keys + avatars on that row
  var kln = LN(kb), aln = LN(avs);
  buildKeyboard(kb, kln, function (ch) {
    if (ch === "DEL") PE.name = PE.name.slice(0, -1); else if (ch === "CLR") PE.name = ""; else if (PE.name.length < 14) PE.name += (PE.name && PE.name.slice(-1) !== " " ? ch.toLowerCase() : ch);
    showName();
  });
  for (var i = 0; i < AVATARS; i += 4) {
    var r = ce("div", "pe-arow"), its = [];
    for (var j = i; j < i + 4; j++) (function (n) {
      var a = ce("div", "pe-av" + (n === PE.av ? " sel" : "")); var im = document.createElement("img"); im.src = avatarSrc(n); a.appendChild(im);
      a._act = function () { PE.av = n; big.src = avatarSrc(n); Array.prototype.forEach.call(avs.querySelectorAll(".pe-av"), function (x, xi) { x.classList.toggle("sel", xi === n); }); };
      a._pane = 1; a._col = n % 4; r.appendChild(a); its.push(a);
    })(j);
    avs.appendChild(r); lnAdd(aln, r, its);
  }
  for (var L = 0; L < Math.max(kln.lines.length, aln.lines.length); L++) {
    var kl = kln.lines[L], al = aln.lines[L];
    lnAdd(ln, kl ? kl.el : al.el, (kl ? kl.items : []).concat(al ? al.items : []));
  }
  var bl = ce("div", "pe-btns"), bits = [];
  var save = ce("div", "btn primary", "Save"); save._act = saveEditor; bl.appendChild(save); bits.push(save);
  if (PE.p && profiles.list.length > 1) { var del = ce("div", "btn", "Delete profile"); del._act = function () { if (del._armed) { deleteProfile(PE.p.id); var wasCur = PF && PF.id === PE.p.id; ovClose(PE); if (wasCur) { PF = null; WH.first = true; } renderWho(); } else { del._armed = true; del.textContent = "Press OK again to delete"; } }; bl.appendChild(del); bits.push(del); }
  var cancel = ce("div", "btn", "Cancel"); cancel._act = function () { ovClose(PE); renderWho(); }; bl.appendChild(cancel); bits.push(cancel);
  box.appendChild(bl); lnAdd(ln, bl, bits, { resetCol: true });
  showName();
  ln.li = keepLi; ln.ci = keepCi;
}
function showName() { var n = $("pe-name"); n.textContent = PE.name ? PE.name + "_" : ""; if (!PE.name) n.appendChild(ce("span", "ph", "Type a name\u2026")); }
function saveEditor() {
  var name = PE.name.trim();
  if (!name) { toast("Type a name first"); return; }
  if (PE.p) { PE.p.name = name; PE.p.av = PE.av; saveProfiles(); if (PF && PF.id === PE.p.id) { $("nav-av").src = avatarSrc(PF.av); $("nav-name").textContent = PF.name; } }
  else { var np = createProfile(name, PE.av); toast("Profile \u201c" + name + "\u201d created"); PE.newId = np.id; }
  ovClose(PE); WH.manage = false; renderWho(PE.p ? PE.p.id : PE.newId);
}
PE.key = function (k) { if (k === "back") { ovClose(PE); renderWho(); return; } lnKey(PE.ln, k); };

/* ================= profile page + stats ================= */
var PS = { id: "profile", ln: null };
function openProfilePage() { ovOpen(PS); renderProfilePage(); }
function topN(obj, n) { return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, n); }
function hrs(sec) { var h = sec / 3600; return h >= 10 ? Math.round(h) + "" : h >= 1 ? h.toFixed(1) : Math.round(sec / 60) + " min"; }
function renderProfilePage() {
  var box = $("profile-inner"); box.textContent = ""; box.style.transform = "";
  var ln = PS.ln = LN(box, 300), s = PD.stats;
  var hd = ce("div", "pp-hd"); var im = document.createElement("img"); im.src = avatarSrc(PF.av); hd.appendChild(im);
  var hn = ce("div", "pp-hn"); hn.appendChild(ce("div", "pp-name", PF.name)); hn.appendChild(ce("div", "s-note", "Viewing stats for this profile on this TV")); hd.appendChild(hn);
  box.appendChild(hd);
  var bl = ce("div", "s-line"), bits = [];
  [["\u21C4 Switch profile", function () { ovClose(PS); openWho(false); }], ["\u270E Edit profile", function () { ovClose(PS); openWho(true); openEditor(PF); }],
   ["\u2630 My List", function () { ovClose(PS); var i = TAB_VIEWS.indexOf("mylist"); V.navIdx = i; buildView("mylist"); enterContent(); }], ["\u2190 Close", function () { ovClose(PS); restoreFocus(); }]].forEach(function (x) {
    var b = ce("div", "btn", x[0]); b._act = x[1]; bl.appendChild(b); bits.push(b);
  });
  box.appendChild(bl); lnAdd(ln, bl, bits);
  var tiles = ce("div", "pp-tiles");
  var h = s.sec / 3600;
  function tile(v, l) { var t = ce("div", "pp-tile"); t.appendChild(ce("div", "pp-v", v)); t.appendChild(ce("div", "pp-l", l)); tiles.appendChild(t); }
  function hm(sec) { if (!(sec > 0)) return "0 min"; if (sec < 60) return "<1 min"; var m = sec / 60; if (m < 60) return (m < 10 ? m.toFixed(1) : Math.round(m)) + " min"; return (sec / 3600).toFixed(1) + " h"; }
  var mins = s.sec / 60;
  tile(h >= 1 ? h.toFixed(1) : (!(s.sec > 0) ? "0" : mins < 1 ? "<1" : mins < 10 ? mins.toFixed(1) : String(Math.round(mins))), h >= 1 ? "hours watched" : "minutes watched");
  tile(String(Object.keys(s.titles).length), "titles watched");
  tile(hm(s.types.movies || 0), "movies"); tile(hm(s.types.series || 0), "shows"); tile(hm(s.types.live || 0), "live TV");
  tile(String(PD.list.length), "in My List");
  box.appendChild(tiles);
  var cols = ce("div", "pp-cols");
  var g = ce("div", "pp-col"); g.appendChild(ce("div", "s-sec", "Top genres"));
  var tg = topN(s.gen, 6), mx = tg.length ? s.gen[tg[0]] : 1;
  if (!tg.length) g.appendChild(ce("div", "s-note", "Watch something to build your taste profile."));
  tg.forEach(function (k) { var r = ce("div", "pp-bar"); r.appendChild(ce("span", "pp-bl", k)); var b = ce("div", "pp-bt"); var f = ce("div"); f.style.width = Math.max(6, Math.round(100 * s.gen[k] / mx)) + "%"; b.appendChild(f); r.appendChild(b); r.appendChild(ce("span", "pp-bv", hm(s.gen[k]))); g.appendChild(r); });
  var c = ce("div", "pp-col"); c.appendChild(ce("div", "s-sec", "Top channels"));
  var tc = topN(s.ch, 6);
  if (!tc.length) c.appendChild(ce("div", "s-note", "No live TV watched yet."));
  tc.forEach(function (k) { c.appendChild(ce("div", "pp-li", (s.chn[k] || k) + "  \u2014  " + hm(s.ch[k]))); });
  var r2 = ce("div", "pp-col"); r2.appendChild(ce("div", "s-sec", "Recent activity"));
  if (!PD.hist.length) r2.appendChild(ce("div", "s-note", "Nothing yet."));
  PD.hist.slice(0, 8).forEach(function (h2) { r2.appendChild(ce("div", "pp-li", ({ live: "\uD83D\uDCFA ", movies: "\uD83C\uDFAC ", series: "\uD83C\uDF9E " })[h2.it.t] + h2.it.n + (h2.ep ? " S" + h2.ep.s + ":E" + h2.ep.e : "") + "  \u00b7  " + ago(h2.ts))); });
  cols.appendChild(g); cols.appendChild(c); cols.appendChild(r2); box.appendChild(cols);
  var lr = ce("div", "pp-learn"); lr.appendChild(ce("div", "s-sec", "What NickFlix has learned about " + PF.name));
  lr.appendChild(ce("div", "s-note", "Each minute you watch adds weight to its channel, category, league and genre; older viewing slowly fades (half-life 3 weeks). This orders the TV hub tiles, sports leagues, featured channels and Movies/Shows picks."));
  var bits = [];
  function tops(kind, label, fmt) { var t = learnTop(kind, 4).filter(function (x) { return x[1] >= 0.2; }); if (t.length) bits.push(label + ": " + t.map(function (x) { return fmt ? fmt(x[0]) : x[0]; }).join(", ")); }
  tops("tile", "TV categories", function (k) { return TILE_BY[k] ? TILE_BY[k].label : k; });
  tops("lg", "Sports", function (k) { return LG_BY[k] ? LG_BY[k].name : k; });
  tops("tm", "Teams", function (k) { return teamName(k); });
  tops("ch", "Channels", function (k) { return s.chn[k] || k; });
  tops("gen", "Movie & show genres");
  var ht = learnHourText(); if (ht) bits.push(ht);
  if (PD.st.nhlTeam) bits.push("Favourite NHL team: " + teamName(PD.st.nhlTeam));
  if (!bits.length) bits.push("Nothing yet \u2013 it starts learning as soon as you watch.");
  bits.forEach(function (b) { lr.appendChild(ce("div", "pp-li", "\u2022 " + b)); });
  box.appendChild(lr);
  lnFocus(ln);
}
PS.key = function (k) { if (k === "back") { ovClose(PS); restoreFocus(); return; } lnKey(PS.ln, k); };

/* ================= search ================= */
var S = { q: "", pane: "kbd", kln: null, res: [], rl: 0, done: 0, total: 0, timer: null, gen: 0 };
function showSearch() {
  V.view = "search"; V.gen++;
  tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-view") === "search"); });
  $("view").classList.add("hidden"); $("search").classList.remove("hidden");
  if (!S.kln) { S.kln = LN($("kbd"), 99999); buildKeyboard($("kbd"), S.kln, typeKey); }
  renderQ(); startIndex(); runSearch();
}
function renderQ() { var q = $("search-q"); q.textContent = ""; if (S.q) q.textContent = S.q + "_"; else q.appendChild(ce("span", "ph", "Type to search\u2026")); }
function searchCats() { var out = []; ["live", "movies", "series"].forEach(function (t) { cats[t].forEach(function (c) { if (catVisible(c) || (c.adult && adultOk())) out.push(c); }); }); return out; }
function startIndex() {
  var list = searchCats(); S.total = list.length; S.done = 0; var g = ++S.gen, i = 0, running = 0;
  function next() { if (g !== S.gen) return; while (running < 3 && i < list.length) { var c = list[i++]; running++; loadCat(c).then(fin, fin); } }
  function fin() { running--; S.done++; if (g !== S.gen) return; if (S.done % 5 === 0 || S.done === S.total) status(); if (S.q.length >= 2) schedule(); next(); }
  status(); next();
}
function stopIndex() { S.gen++; }
function status() { $("search-status").textContent = (S.done < S.total ? "Indexing library\u2026 " + S.done + " / " + S.total + " categories" : "Searching " + S.total + " categories") + "\nUse \u25B6 to move to results."; }
function schedule() { if (S.timer) return; S.timer = setTimeout(function () { S.timer = null; runSearch(); }, 700); }
function runSearch() {
  var box = $("search-results"); box.textContent = ""; S.res = [];
  var q = S.q.toLowerCase();
  if (q.length < 2) { box.appendChild(ce("div", "search-status", q ? "Keep typing\u2026" : "Search TV channels, movies and shows.")); return; }
  var groups = { live: [], movies: [], series: [] }, seen = {}, ok = adultOk();
  searchCats().forEach(function (c) {
    var arr = cache[c.type + ":" + c.id]; if (!arr) return;
    var g = groups[c.type]; if (g.length >= 40) return;
    for (var i = 0; i < arr.length && g.length < 40; i++) {
      var it = arr[i], key = normTitle(it);
      if (!itemOK(it)) continue;
      if (!seen[key] && it.n.toLowerCase().indexOf(q) >= 0) { seen[key] = 1; g.push(it); }
    }
  });
  ["movies", "series", "live"].forEach(function (t) {
    var items = groups[t]; if (!items.length) return;
    var info = T[t], l = ce("div", "sline" + (t === "live" ? " lv" : ""));
    l.appendChild(ce("div", "rtitle", info.label + "  (" + items.length + (items.length >= 40 ? "+" : "") + ")"));
    var tr = ce("div", "track"); l.appendChild(tr);
    var els = items.map(function (it, i) { var c = cardEl(it, info.card, i, info.pitch); tr.appendChild(c); return c; });
    box.appendChild(l);
    S.res.push({ el: l, track: tr, items: items, els: els, col: 0, off: 0, info: info });
  });
  if (!S.res.length) box.appendChild(ce("div", "search-status", S.done < S.total ? "No matches yet \u2013 still indexing\u2026" : "No matches for \u201c" + S.q + "\u201d"));
  if (S.pane === "res") { if (!S.res.length) S.pane = "kbd"; if (S.rl >= S.res.length) S.rl = 0; if (V.zone === "search" && !D.open && !P.open && !OV.top()) searchFocus(); }
}
function searchFocus() {
  if (S.pane === "kbd") { lnFocus(S.kln); $("kbd").style.transform = ""; $("search-results").style.transform = ""; return; }
  var r = S.res[S.rl]; if (!r) { S.pane = "kbd"; searchFocus(); return; }
  if (r.col >= r.items.length) r.col = r.items.length - 1;
  setF(r.els[r.col]);
  var vis = r.info.vis - 2;
  if (r.col < r.off + 1) r.off = Math.max(0, r.col - 1); else if (r.col > r.off + vis - 2) r.off = r.col - (vis - 2);
  r.track.style.transform = "translateX(" + (-r.off * r.info.pitch) + "px)";
  $("search-results").style.transform = "translateY(" + Math.min(0, -r.el.offsetTop) + "px)";
}
function typeKey(ch) { if (ch === "DEL") S.q = S.q.slice(0, -1); else if (ch === "CLR") S.q = ""; else if (S.q.length < 30) S.q += ch; renderQ(); clearTimeout(S.timer); S.timer = null; schedule(); }
function searchKey(k) {
  if (V.zone !== "search") { if (k === "down" || k === "enter") { V.zone = "search"; S.pane = "kbd"; searchFocus(); } return; }
  if (S.pane === "kbd") {
    var ln = S.kln;
    if (k === "right" && ln.ci >= ln.lines[ln.li].items.length - 1) { if (S.res.length) { S.pane = "res"; searchFocus(); } return; }
    if (k === "up" && ln.li === 0) { V.zone = "nav"; applyFocus(); return; }
    if (k === "back") { if (S.q) { S.q = ""; renderQ(); runSearch(); } else { V.zone = "nav"; applyFocus(); } return; }
    lnKey(ln, k); $("kbd").style.transform = ""; return;
  }
  var r = S.res[S.rl];
  if (k === "left") { if (r.col > 0) r.col--; else S.pane = "kbd"; }
  else if (k === "right") { if (r.col < r.items.length - 1) r.col++; }
  else if (k === "up") { if (S.rl > 0) S.rl--; }
  else if (k === "down") { if (S.rl < S.res.length - 1) S.rl++; }
  else if (k === "back") S.pane = "kbd";
  else if (k === "enter") { activate(r.items[r.col], r.items, r.col); return; }
  searchFocus();
}

/* ================= keys ================= */
function keyName(e) {
  var c = e.keyCode || e.which;
  var map = { 37: "left", 38: "up", 39: "right", 40: "down", 13: "enter", 10009: "back", 27: "back", 8: "back", 415: "play", 19: "pause", 10252: "playpause", 413: "stop", 417: "ff", 412: "rw" };
  if (map[c]) return map[c];
  var km = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Enter: "enter", Escape: "back", GoBack: "back", Back: "back", XF86Back: "back" };
  return km[e.key] || null;
}
function exitApp() { savePD(true); try { tizen.application.getCurrentApplication().exit(); } catch (e) {} }
var lastKeyT = 0;
document.addEventListener("keydown", function (e) {
  var a = document.activeElement;
  if (a && a.tagName === "INPUT") {
    var c = e.keyCode;
    if (c === 65376 || c === 65385 || c === 38 || c === 40 || c === 10009 || c === 27) {
      a.blur(); e.preventDefault();
      if ((c === 38 || c === 40) && OV.top() === ST) lnKey(ST.ln, c === 38 ? "up" : "down");
      return;
    }
    return;
  }
  var k = keyName(e);
  if (!k) return;
  e.preventDefault();
  if (P.open) {
    if (k === "play" || k === "pause" || k === "playpause") { togglePause(); return; }
    if (k === "stop") { closePlayer(); return; }
    if (k === "ff") { seek(30000); return; }
    if (k === "rw") { seek(-10000); return; }
    playerKey(k); return;
  }
  if (k === "play" || k === "pause" || k === "playpause" || k === "stop" || k === "ff" || k === "rw") return;
  var top = OV.top();
  if (top) { top.key(k); return; }
  if (!booted) return;
  if (D.open) { detailsKey(k); return; }
  mainKey(k);
}, true);

/* ================= boot ================= */
var booted = false, pendingStart = false;
function tick() { $("clock").textContent = fmtClock(Date.now()); }
function startMain() {
  $("splash").classList.add("hidden");
  stopIndex();
  var view = PD.st.view || "movies";
  V.navIdx = Math.max(0, TAB_VIEWS.indexOf(view));
  buildView(view);
  V.zone = "nav"; applyFocus();
  var tries = 0, iv = setInterval(function () {
    tries++;
    if (V.zone !== "nav" || OV.top() || D.open || P.open || V.view === "search") { clearInterval(iv); return; }
    if (V.modeOn || (V.rows[0] && V.rows[0].items)) { clearInterval(iv); enterContent(); }
    else if (tries > 40) clearInterval(iv);
  }, 250);
}
function boot() {
  loadAllCats().then(function () {
    booted = true;
    if (pendingStart) { pendingStart = false; startMain(); }
  }).catch(function () {
    $("splash-msg").textContent = "Can't reach your provider. Retrying\u2026";
    setTimeout(boot, 5000);
  });
}
function init() {
  initTabs();
  tick(); setInterval(tick, 20000);
  loadProfile(profiles.last);
  $("nav-av").src = avatarSrc(PF.av); $("nav-name").textContent = PF.name;
  $("splash").classList.add("hidden");
  WH.first = true; openWho(false);
  try { window.focus(); } catch (e) {}
  boot();
}
init();
