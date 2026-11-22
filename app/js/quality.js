/* NickFlix 4.16 - better content: quality floor, clean-up, Curated by default with Categories / Everything,
   category trim, Indian and Kids filters, per-profile mood ("vibe") rows and a taste model that learns more.
   - Hard filters (every view, search, Live TV; per profile, Settings > Content & filters):
       Hide Indian content (default ON): Indian / Bollywood / Hindi / Tamil / Telugu / Punjabi / Desi ... categories,
       channels (Star Plus, Zee, Sony SAB, Aaj Tak, PTC ...) and titles tagged Hindi / Tamil / ... .
       Kids content (default OFF = hidden): Kids / Children / Cartoon / Family-animation categories, kids channels
       and kid-targeted titles (TMDB genre Kids / Family animation, well-known kids brands).
   - Quality floor (Movies / Shows Curated + Categories, default 6.5, Off/6.0/6.5/7.0/7.5): the provider rating is the
       TMDB average; it is only trusted when it looks like it has votes behind it (movies: 2+ decimals, or 1 decimal
       and <= 9.0; shows: anything but a rounded 10). Unrated / untrusted titles pass only when they have a poster
       and are new (this or last year), or (shows) have a real plot and are recent, or strongly match the profile's taste.
       Award / top-list titles (prestige.js), the profile's liked / loved titles, the taste-seed favourites and anything
       the profile already watched always pass.
   - Clean-up (always on in Curated / Categories): cam / TS rips, no poster and no plot, foreign-language dubs (tagged
       names and Nordic / Ex-Yu / Turkish / Asia / Latino ... MULTI categories); duplicates keep the best copy
       (poster, trusted rating, no cam tag).
   - Everything: a third mode next to Curated / Categories that shows every provider category unfiltered
       (only the hard filters: adult, Quebec, Indian, Kids, Never show).
   - Category trim (Categories mode, default on): provider categories this profile never opened and never watched
       anything from are hidden once there is enough history (8+ titles of that type); the big ones (new releases,
       streaming services, 4K, documentaries, British) and genres the profile likes always stay.
   - Vibe rows: 11 new mood rows on top of the 4.14/4.15 themes; per profile they are ranked by genre affinity, seed
       theme weights, a learned vibe affinity (ratings, Never show, finished / abandoned titles, 60-day half-life) and
       the British favourite (Celia); 6 a day, rotated daily; a row needs 8 titles that pass the quality floor,
       otherwise the next vibe takes its slot.
   - Taste model: finished titles (+), rewatches (++), quick abandons under 10 % (mild -), old ratings fade
       (half-life 180 days, floor 50 %), learned vibe affinity in tasteBoost; Top Picks / vibe rows get a genre
       diversity cap (no genre over 40 % of a row) and ~10 % exploration picks that still match the taste. */
"use strict";
var Q_VER = 416;
/* ---------------------------------------------------------------- detection */
var IN_CAT_RE = /INDIA(?!NA)|BOLLYWOOD|TOLLYWOOD|KOLLYWOOD|LOLLYWOOD|HINDI|TAMIL|TELUGU|PUNJAB|\bDESI\b|MALAYALAM|KANNADA|MARATHI|BENGALI|BANGLA|GUJARAT|BHOJPURI|\bODIA\b|PAKISTAN|\bURDU\b/;
var IN_CH_RE = /\bSTAR ?(PLUS|BHARAT|GOLD|UTSAV|JALSHA|PRAVAH|MAA|VIJAY|SUVARNA|SPORTS ?\d? ?(HINDI|TAMIL|TELUGU))\b|\bZEE ?(TV|CINEMA|ANMOL|PUNJABI|BANGLA|TAMIL|TELUGU|MARATHI|NEWS|ACTION|CLASSIC|BOLLYWOOD|ZEST|BUSINESS)?\b|\bSONY ?(SAB|SET|MAX|YAY|AATH|MARATHI|PAL|WAH|TEN)\b|\bAAJ ?TAK\b|\bNDTV\b|\bABP\b|\bINDIA ?(TV|TODAY|NEWS)\b|\bREPUBLIC ?(TV|BHARAT)\b|\bPTC\b|\bB4U\b|\bSUN ?(TV|NEWS|MUSIC)\b|\bASIANET\b|\bMAA ?TV\b|\bGEMINI ?(TV|MOVIES)\b|\bETV ?(TELUGU|BANGLA|MARATHI)\b|\b9X ?M\b|\bMTV ?INDIA\b|\bSHEMAROO\b|\bDD ?(NATIONAL|NEWS|BHARATI)\b|\bTV9\b|\bTIMES NOW\b|\bCOLORS ?(TV|CINEPLEX|RISHTEY|BANGLA|MARATHI|KANNADA|TAMIL)\b|\bHUM ?(TV|SITARAY|MASALA)\b|\bGEO ?(TV|NEWS|ENTERTAINMENT|KAHANI)\b|\bARY ?(DIGITAL|NEWS|ZINDAGI)?\b|\bATN ?BANGLA\b/;
var IN_LANG_RE = /\b(HINDI|TAMIL|TELUGU|PUNJABI|MALAYALAM|KANNADA|MARATHI|BENGALI|BHOJPURI|GUJARATI|BOLLYWOOD|URDU|DESI)\b/;
var IN_TITLE_RE = /\b(hindi|tamil|telugu|punjabi|malayalam|kannada|marathi|bengali|bhojpuri|gujarati|bollywood|tollywood|kollywood|desi)\b|[\[(](hin|tam|tel|mal|kan)[\])]/i;
var KID_CAT_RE = /\bKIDS?\b|KIDZ|CHILD|CARTOON|CRTANI|BAJKI|ENFANT|JEUNESSE|KINDER|FAMILIA|FAMILIJNE|FAMILIAL|FAMILY|FAMILLE|JUNIOR|\bJR\b|BABY|TODDLER|PRESCHOOL|DREAMWORKS|PIXAR|\bANIMATIONS?\b/;
var KID_CH_RE = /DISNEY ?(JR|JUNIOR|CHANNEL|XD|KIDS)|NICK ?JR|NICKELODEON|NICKTOONS|CARTOON|BOOMERANG|TREEHOUSE|PBS ?KIDS|BABY ?(TV|FIRST)|\bYTV\b|FAMILY ?(JR|CHANNEL|CH)\b|\bDUCK ?TV|TINY ?POP|CBEEBIES|\bCBBC\b|POP ?MAX|\bKIKA\b|SUPER ?RTL|JIM ?JAM|TELETOON|SPROUT|UNIVERSAL KIDS|DISCOVERY FAMILY|\bKIDS?\b|KIDZ|TOONAMI|\bPOGO\b|HUNGAMA|\bGULLI\b|TIJI|PIWI|MINIMINI/;
var KID_BRAND_RE = /paw patrol|peppa pig|\bbluey\b|cocomelon|blippi|baby shark|teletubbies|thomas (and|&) friends|thomas the tank|barney( (and|&) friends|'s great adventure| the purple| the dinosaur)|^barney$|dora the explorer|sesame street|mickey mouse|minnie'?s|my little pony|pj masks|octonauts|in the night garden|fireman sam|bob the builder|postman pat|caillou|curious george|daniel tiger|team umizoomi|bubble guppies|doc mcstuffins|vampirina|sofia the first|puppy dog pals|spidey and his amazing friends|gabby'?s dollhouse|ryan'?s world|masha and the bear|lego (friends|city|ninjago|duplo|star wars|scooby)|barbie( and|:| &|'s| in| as| mermaid| dreamhouse| fairytopia)|polly pocket|shimmer and shine|blaze and the monster machines|hey duggee|ben (and|&) holly|numberblocks|alphablocks|the wiggles|care bears|strawberry shortcake|\btrolls\b|minions|despicable me|kung fu panda|madagascar( [23]|: escape| escape)|^madagascar$|^ice age|the smurfs|alvin and the chipmunks|scooby-?doo|tom (and|&) jerry|looney tunes|spongebob|power rangers|pok[e\u00e9]mon|yo-kai|beyblade|rescue bots|winnie the pooh(?!: blood)|toy story|finding (nemo|dory)|how to train your dragon|the boss baby|hotel transylvania|the secret life of pets|paddington|shrek|tinker ?bell|super wings|robocar poli|larva|oddbods|pinkfong|little baby bum|super simple|the land before time|veggietales|the cat in the hat|dr\.? seuss|the grinch/i;
var KID_EXACT_RE = /^(sing 2|cars [23]|frozen( ii| 2)?|moana( 2)?|encanto|zootopia( 2)?|inside out( 2)?|turning red|tangled|ratatouille|wall-?e|bolt|cinderella|aladdin|the lion king|the little mermaid|beauty and the beast|mulan|pocahontas|bambi|dumbo|pinocchio|peter pan|the jungle book|lilo (and|&) stitch|big hero 6|wreck-it ralph|ralph breaks the internet|monsters,? inc\.?|monsters university|the incredibles|incredibles 2|a bug'?s life|the good dinosaur|raya and the last dragon|strange world|the bad guys|the wild robot|vivo|the sea beast|abominable|the croods.*|megamind|bee movie|happy feet.*|rio 2|cloudy with a chance of meatballs.*|the lego movie.*|smurfs.*|sonic the hedgehog.*|the angry birds movie.*|spirit.*|storks|ferdinand|rango|over the hedge|shark tale|chicken run.*|wallace (and|&) gromit.*|early man|arthur christmas)$/i;
/* one-word kids titles only count with their year (Up 2009, not any film called "Up") */
var KID_YEAR = { up: 2009, coco: 2017, soul: 2020, brave: 2012, cars: 2006, luca: 2021, elemental: 2023, wish: 2023, onward: 2020, bolt: 2008, epic: 2013, migration: 2023, luck: 2022, rio: 2011, spirit: 2021, coraline: 2009, frozen: 2013, sing: 2016, trolls: 2016 };
function qKidTitle(n, y) { n = String(n || "").trim(); if (KID_BRAND_RE.test(n) || KID_EXACT_RE.test(n)) return true; var k = KID_YEAR[n.toLowerCase()]; return !!(k && (!+y || Math.abs(+y - k) <= 1)); }
var CAM_RE = /\u1D34\u1D30TS\b|\b(hd)?cam(rip)?\b|\bhdts\b|\btelesync\b|\bhdtc\b|\btelecine\b|\b(dvd)?scr\b|\bpre-?dvd\b|[\[(]ts[\])]|\sts\s*$/i;
var DUB_RE = /[\[(](ita|italian|fr|french|vf|vff|de|ger|german|esp|spanish|lat|latino|tr|turkish|ar|arabic|dub|dubbed|vost|vostfr|rus|pl)[\])]|\b(dubbed|vostfr|castellano|latino)\b|\s(DE|FR|IT|ES|TR|PL|RU)\s*$/i;
var DUB_CAT_RE = /NORDIC|DANSKE|NORDKA|SUOMALAINEN|EX-?YU|TABII|TURKISH|NETFLIX ASIA|\bASIA\b|LATINO|CASTELLANO|DRAMABITE|BOLLYWOOD/;
var CAM_CAT_RE = /\bCAM\b/;
function qInText(s) { s = String(s || ""); return IN_TITLE_RE.test(s) && !/lucy (and|&) desi|desi arnaz/i.test(s); }
/* category flags (once per catalogue load) */
function qFlagCats(type, out) {
  (out || []).forEach(function (c) {
    var up = c.up || "";
    if (IN_CAT_RE.test(up) || (type !== "live" && c.code === "IN")) c.ind = true;
    if (type === "live" ? (c.ltype === "Kids" || /\bKIDS?\b|KIDZ|CHILD|CARTOON|ENFANT|JEUNESSE|KINDER|BABY/.test(up)) : (KID_CAT_RE.test(up) || c.genres.indexOf("Kids & Family") >= 0) && !/ANIME|HANIME/.test(up)) c.kid = true;
    if (type !== "live" && DUB_CAT_RE.test(up) && !c.ind) c.fdub = true;
    if (type !== "live" && CAM_CAT_RE.test(up)) c.cam = true;
  });
  return out;
}
var _procCats416 = procCats;
procCats = function (type, arr) { return qFlagCats(type, _procCats416(type, arr)); };
/* screens.js boots before this file loads: flag whatever is already in memory */
try { ["live", "movies", "series"].forEach(function (t) { qFlagCats(t, cats[t]); }); } catch (e0) {}
/* tidy provider names: "Toy Story 4 - 2019", "Narcos _eng", "Dune Part Two 2024 2160p MAX WEB-DL ...", "Show MX" */
var QN_SRC = /^(EN|SC|DS|NF|AZ|HBO|DSTV|DST|AP|DK|EX|NRC|CA|AMZ)\s*-\s*(4k|uhd|hd)?\s*/i;
function qCleanName(n, y) {
  var s = String(n || ""), o = s;
  for (var pass = 0; pass < 3; pass++) {
    s = s.replace(QN_SRC, "");
    s = s.replace(/\s+(2160p|1080p|720p|480p|web-?dl|webrip|bluray|blu-ray|hdrip|brrip|x26[45]|h ?26[45]|hevc|ddp?5|aac2?)\b.*$/i, "");
    s = s.replace(/\s*[-_.]+\s*(eng|en|msub|multi|mutli|esub|subs?)\s*$/i, "").replace(/\s+_(eng|en)\s*$/i, "");
    s = s.replace(/\s+(MX|NF|AMZ|AMZV|VP|TB|AP|ESUB|SUBS?|MULTI|Multi|Mutli|MSUB|OA|AZ|DL|NOGRP)\s*$/, "");
    s = s.replace(/\s+\)\s*$/, "").replace(/\s*\(\s*\)\s*$/, "");
    if (y) s = s.replace(new RegExp("(\\S)\\s*(?:[-\u2013]\\s*)?\\(?-?" + y + "\\)?\\s*$"), "$1");
    s = s.replace(/\s+(4k|uhd|fhd|hd)\s*$/i, "").replace(/\s+/g, " ").trim();
  }
  return s.length >= 2 ? s : o;
}
/* item flags from the raw provider name / rating */
var _slim416 = slim;
slim = function (type, it, catId) {
  var o = _slim416(type, it, catId), raw = String(it.name || "");
  try {
    if (type === "live") {
      var u = raw.toUpperCase();
      if (IN_CH_RE.test(u) || IN_LANG_RE.test(u)) o.ind = 1;
      if (KID_CH_RE.test(u) && !/ADULT ?SWIM/.test(u)) o.kid = 1;
      return o;
    }
    if (o.n) o.n = qCleanName(o.n, o.y);
    if (qInText(raw)) o.ind = 1;
    if (CAM_RE.test(raw)) o.cam = 1;
    if (DUB_RE.test(raw)) o.dub = 1;
    var g = String(it.genre || ""), n = o.n || "";
    if (/\bkids\b/i.test(g) || (/family/i.test(g) && /animation/i.test(g)) || qKidTitle(n, o.y)) o.kid = 1;
    var rs = String(it.rating == null ? "" : it.rating).trim();
    if (/^\d+(\.\d+)?$/.test(rs) && parseFloat(rs) > 0) o.rq = rs.indexOf(".") >= 0 ? rs.split(".")[1].length : 0;
  } catch (e) {}
  return o;
};
function qFlagLoaded() {
  try {
    for (var key in cache) (cache[key] || []).forEach(function (o) {
      if (!o || o._q) return; o._q = 1; var u = String(o.n || "").toUpperCase();
      if (o.t === "live") { if (IN_CH_RE.test(u) || IN_LANG_RE.test(u)) o.ind = 1; if (KID_CH_RE.test(u) && !/ADULT ?SWIM/.test(u)) o.kid = 1; return; }
      o.n = qCleanName(o.n, o.y); if (qInText(o.n)) o.ind = 1; if (CAM_RE.test(o.n)) o.cam = 1; if (qKidTitle(o.n, o.y) || /\bkids\b/i.test(o.genre || "")) o.kid = 1;
    });
    if (typeof CH !== "undefined" && CH && CH.all) CH.all.forEach(function (o) { var u = String(o.n || "").toUpperCase(); if (IN_CH_RE.test(u) || IN_LANG_RE.test(u)) o.ind = 1; if (KID_CH_RE.test(u) && !/ADULT ?SWIM/.test(u)) o.kid = 1; });
  } catch (e) {}
}
qFlagLoaded();
/* ---------------------------------------------------------------- settings (per profile) */
function inHidden() { return !(PD && PD.st && PD.st.hideIN === false); }
function kidsOn() { return !!(PD && PD.st && PD.st.kids === true); }
var QF_STEPS = [0, 6, 6.5, 7, 7.5];
function qFloor() { var f = PD && PD.st ? PD.st.qf : undefined; return f === undefined || f === null ? 6.5 : +f || 0; }
function qTrimOn() { return !(PD && PD.st && PD.st.qtrim === false); }
function qSig() { return "q" + Q_VER + (inHidden() ? "i" : "") + (kidsOn() ? "k" : ""); }
var ADULT_ANIM_RE = /^(rick and morty|south park|archer|bojack horseman|family guy|the simpsons|futurama|american dad!?|bob'?s burgers|king of the hill|big mouth|f is for family|solar opposites|invincible|harley quinn|primal|love,? death (and|&) robots|arcane|castlevania.*|blue eye samurai|beavis and butt-?head.*|daria|the boondocks|robot chicken|aqua teen hunger force|the venture bros\.?|metalocalypse|final space|disenchantment|inside job|hazbin hotel|helluva boss|smiling friends|the legend of vox machina|velma|krapopolis|central park|the great north|duncanville|a scanner darkly|waking life|fritz the cat|heavy metal|sausage party|anomalisa|isle of dogs|fantastic mr\.? fox|the triplets of belleville|persepolis|waltz with bashir|akira|ghost in the shell.*|perfect blue|paprika|spirited away|princess mononoke|grave of the fireflies)$/i;
function qKidOK(it) { try { return ADULT_ANIM_RE.test(String(it.n || "").trim()) || rtGet(it) > 0 || !!tsIsSeedTitle(it); } catch (e) { return false; } }
/* hard gate */
var _itemOK416 = itemOK;
itemOK = function (it) {
  if (!_itemOK416(it)) return false;
  if (it.nas) return true;
  var c = catById[it.t + ":" + it.c];
  if (inHidden() && (it.ind || (c && c.ind))) return false;
  if (!kidsOn() && (it.kid || (c && c.kid)) && !qKidOK(it)) return false;
  return true;
};
var _catVisibleV416 = catVisibleV;
catVisibleV = function (c) { if (!_catVisibleV416(c)) return false; if (c.ind && inHidden()) return false; if (c.kid && !kidsOn()) return false; return true; };
var _catVisibleLive416 = catVisibleLive;
catVisibleLive = function (c) { if (!_catVisibleLive416(c)) return false; if (c.ind && inHidden()) return false; if (c.kid && !kidsOn()) return false; return true; };
/* ---------------------------------------------------------------- quality floor + clean-up */
var Q_WATCHED = { pd: null, t: 0, o: {} };
function qMine() {
  if (Q_WATCHED.pd === PD && Date.now() - Q_WATCHED.t < 5000) return Q_WATCHED.o;
  var o = {}; try { PD.hist.forEach(function (h) { o[h.k] = 1; }); (PD.wl || []).forEach(function (e) { o[e.k] = 1; }); for (var k in PD.pos) o[k] = 1; PD.list.forEach(function (h) { o[h.k] = 1; }); } catch (e) {}
  Q_WATCHED = { pd: PD, t: Date.now(), o: o }; return o;
}
function qRating(it) { var r = parseFloat(it.r) || 0; if (r > 10) r /= 10; return r; }
/* is the provider (TMDB) rating trustworthy?  movies: 3 decimals = real vote average; shows are rounded to integers */
function qTrusted(it) {
  var r = qRating(it); if (!(r > 0)) return false;
  if (it.t === "series") return r < 9.6;
  if (it.rq === undefined) return r < 9.6;
  return it.rq >= 2 || (it.rq === 1 && r <= 9.0);
}
function qJunk(it) {
  var c = catById[it.t + ":" + it.c];
  if (it.cam || (c && c.cam)) return "cam";
  if (!it.ic && !String(it.plot || "").trim()) return "noart";
  if (it.dub || (c && c.fdub)) return "dub";
  return "";
}
/* why a title would be hidden ("" = it passes) */
function qWhy(it, floor) {
  if (!it || (it.t !== "movies" && it.t !== "series") || it.nas) return "";
  try {
    if (qMine()[itemKey(it)]) return "";
    if (rtGet(it) > 0) return "";
    if (tsIsSeedTitle(it)) return "";
    if (typeof prOf === "function" && prOf(it).length) return "";
  } catch (e) {}
  var j = qJunk(it); if (j) return j;
  if (floor === undefined) floor = qFloor();
  if (!floor) return "";
  var r = qRating(it);
  if (qTrusted(it)) return r >= floor - (it.t === "series" ? 0.5 : 0) ? "" : "low";   // shows are rounded: 7 = 6.5..7.4
  var y = +it.y || 0, plot = String(it.plot || "");
  if (it.ic && y >= THIS_YEAR - 1) return "";                                       // too new to be rated yet
  if (it.t === "series" && it.ic && plot.length >= 60 && y >= THIS_YEAR - 3 && !(r > 0 && r < floor - 0.5)) return "";
  try { if (it.ic && tasteBoost(it) >= 4) return ""; } catch (e2) {}
  return "unrated";
}
function qOK(it) { return !qWhy(it); }
/* the startLoad gate: Movies / Shows rows in Curated and Categories (Everything and personal rows stay unfiltered) */
function qGate(view) { return (view === "movies" || view === "series") && modeOf(view) !== "every"; }
/* dedupe: the better of two copies of the same title */
function qRank(it) { return (it.ic ? 4 : 0) + (qTrusted(it) ? 2 : 0) + (it.cam ? -6 : 0) + (it.dub ? -3 : 0) + (String(it.plot || "").length > 40 ? 1 : 0) + (/\b4k\b|uhd/i.test(String(it.n)) ? 0.5 : 0); }
function qBetter(a, b) { return qRank(b) > qRank(a); }
/* ---------------------------------------------------------------- Curated / Categories / Everything */
var Q_MODES = [["curated", "\u2728 Curated", "Hand-picked rows that pass the quality floor"], ["all", "\u2630 Categories", "Provider categories you use, quality floor on"], ["every", "\uD83C\uDF10 Everything", "Every category, unfiltered"]];
modeOf = function (view) { var m = PD.st.mode[view]; return m === "all" || m === "every" ? m : "curated"; };
modeCur = function () { if (V.view === "nas" && typeof nasModeCur === "function") return nasModeCur(); var m = modeOf(V.view); for (var i = 0; i < Q_MODES.length; i++) if (Q_MODES[i][0] === m) return i; return 0; };
var _renderModebar416 = renderModebar;
renderModebar = function () {
  if (V.view === "nas") return _renderModebar416();
  var m = modeCur(), bar = $("modebar"); bar.textContent = ""; V.modeEls = [];
  Q_MODES.forEach(function (x, i) { var e = ce("div", "mode" + (i === m ? " sel" : ""), x[1]); bar.appendChild(e); V.modeEls.push(e); });
  var hint = Q_MODES[m][2];
  if (m === 1) try { qtFilter(V.view, cats[V.view].filter(catVisible)); } catch (e) {}
  if (m === 1 && QT.hidden[V.view]) hint += "  \u00b7  " + QT.hidden[V.view] + " unused categories tucked away (see Everything)";
  bar.appendChild(ce("div", "mode-hint", hint));
};
/* the picks.js wrapper (Surprise me) sits on top of the original renderModebar; re-attach it on top of this one */
(function () {
  var base = renderModebar;
  renderModebar = function () {
    base();
    if ((V.view !== "movies" && V.view !== "series") || typeof surpriseOn !== "function" || !surpriseOn() || typeof openSlot !== "function") return;
    var bar = $("modebar"), b = ce("div", "mode surprise", "\uD83C\uDFB0 Surprise me"), hint = bar.getElementsByClassName("mode-hint")[0];
    b._act = function () { openSlot(V.view); };
    if (hint) bar.insertBefore(b, hint); else bar.appendChild(b);
    V.modeEls = (V.modeEls || []).concat([b]);
  };
})();
var _setMode416 = setMode;
setMode = function (i) {
  var e = V.modeEls && V.modeEls[i]; if (e && e._act) { e._act(); return; }
  if (V.view === "nas") return _setMode416(i);
  var want = (Q_MODES[i] || Q_MODES[0])[0];
  if (modeOf(V.view) === want) return;
  PD.st.mode[V.view] = want; savePD();
  buildView(V.view); V.zone = "mode"; V.modeIdx = i; applyFocus();
};
/* ---------------------------------------------------------------- category trim (Categories mode) */
var QT = { hidden: {} };
var QT_KEEP_RE = /NEW|RECENT|2026|2025|NETFLIX|AMAZON|PRIME|APPLE|DISNEY|HBO|\bMAX\b|PARAMOUNT|HULU|PEACOCK|4K|UHD|IMAX|TOP|BLOCKBUSTER|BOX OFFICE|DOCU|BRITBOX|BRITISH|\|UK\||CRAVE|SERIES$|SPORT/;
function qtOpened() { if (!PD.cop) PD.cop = {}; return PD.cop; }
function qtUsed(type) {
  var o = {}, add = function (it) { if (it && it.t === type && it.c != null) o[String(it.c)] = 1; };
  PD.hist.forEach(function (h) { add(h.it); }); (PD.wl || []).forEach(function (e) { add(e.it); }); for (var k in PD.pos) add(PD.pos[k].it); PD.list.forEach(function (h) { add(h.it); });
  var R = rtBox(); for (var k2 in R) add(R[k2].it);
  var op = qtOpened(); for (var k3 in op) { var p = k3.split(":"); if (p[0] === type) o[p.slice(1).join(":")] = 1; }
  return o;
}
function qtHistN(type) { var n = 0, s = {}; PD.hist.concat(PD.wl || []).forEach(function (h) { var it = h.it; if (it && it.t === type && !s[h.k]) { s[h.k] = 1; n++; } }); return n; }
/* the categories Categories mode shows (trim) - Everything shows all */
function qtFilter(type, list) {
  QT.hidden[type] = 0;
  if (!qTrimOn() || qtHistN(type) < 8) return list;
  var used = qtUsed(type), aff = affinity(), top = Object.keys(aff).filter(function (g) { return aff[g] > 0; }).sort(function (a, b) { return aff[b] - aff[a]; }).slice(0, 4);
  var out = list.filter(function (c) {
    if (used[c.id] || QT_KEEP_RE.test(c.up)) return true;
    if (c.fdub) return false;
    return c.genres.some(function (g) { return top.indexOf(g) >= 0; });
  });
  QT.hidden[type] = list.length - out.length;
  return out;
}
var _allRows416 = allRows;
allRows = function (type, every) {
  if (type !== "movies" && type !== "series") return _allRows416(type);
  var keep = null;
  if (!every) { keep = {}; qtFilter(type, cats[type].filter(catVisible)).forEach(function (c) { keep[c.title + "\u0000" + c.code] = 1; }); }
  var rows = _allRows416(type);
  if (!keep) return rows;
  return rows.filter(function (r) { return !r.count || keep[r.title + "\u0000" + (r.badge || "MULTI")]; });
};
/* remember which categories this profile opens (details / play) */
function qtNote(it) { try { if (it && (it.t === "movies" || it.t === "series") && it.c != null && !it.nas) { qtOpened()[it.t + ":" + it.c] = Date.now(); } } catch (e) {} }
var _openDetails416 = openDetails;
openDetails = function (item) { qtNote(item); return _openDetails416.apply(this, arguments); };
/* ---------------------------------------------------------------- row gate (app.js startLoad) */
function qRowFilter(spec, items) {
  if (!items || !items.length || !spec || spec.local || spec.noFloor || !qGate(V.view)) return items;
  return items.filter(qOK);
}
/* ---------------------------------------------------------------- implicit signals + decay (taste model) */
var Q_HL_IMP = 60 * 86400000, Q_HL_RT = 180 * 86400000;
function qImplicit() {
  var by = {}, now = Date.now();
  (PD.wl || []).forEach(function (e) {
    if (!e || e.t === "live" || !e.it) return;
    var b = by[e.k] || (by[e.k] = { it: e.it, cats: e.cats || [], fin: 0, ab: 0, part: 0, rec: 0 });
    var rec = Math.pow(0.5, (now - (e.ts || now)) / Q_HL_IMP); b.rec = Math.max(b.rec, rec);
    var fr = e.fr == null ? 0 : e.fr;
    if (fr >= 0.9 || (e.t === "show" && e.min >= 20)) b.fin += rec;
    else if (fr < 0.1 && e.min < 12 && now - (e.ts || now) > 3600000) b.ab += rec;
    else b.part += rec * Math.max(0.2, fr);
  });
  return by;
}
var _tsModel416 = tsModel;
tsModel = function () {
  var M = _tsModel416();
  if (M._q416) return M;
  M._q416 = 1; M.imp = {}; M.vibe = null;
  try {
    var now = Date.now(), R = rtBox();
    // old ratings fade (the base model added them at full weight)
    for (var k in R) {
      var e = R[k]; if (!(e.v === 1 || e.v === 2 || e.v === -1)) continue;
      var d = Math.max(0.5, Math.pow(0.5, (now - (e.ts || now)) / Q_HL_RT)) - 1; if (d > -0.01) continue;
      var gw = e.v === 2 ? 5 : e.v === 1 ? 2.5 : -1.5, pw = e.v === 2 ? 4 : e.v === 1 ? 2 : -0.5;
      (e.g || []).forEach(function (x) { M.gen[x] = (M.gen[x] || 0) + gw * d; });
      (e.p || []).forEach(function (x, i) { M.pp[x] = (M.pp[x] || 0) + pw * d * (i < 4 ? 1 : 0.6); });
    }
    // finished / rewatched / abandoned
    var I = qImplicit();
    for (var key in I) {
      var b = I[key], w = 1.6 * Math.min(2, b.fin) + (b.fin > 1.2 ? 1.5 : 0) + 0.5 * b.part - 0.8 * Math.min(2, b.ab);
      if (Math.abs(w) < 0.05) continue;
      M.imp[key] = w;
      (b.cats || []).forEach(function (x) { if (x !== "Movies" && x !== "Shows") M.gen[x] = (M.gen[x] || 0) + w; });
      ppOf(b.it).forEach(function (p) { M.pp[p.n] = (M.pp[p.n] || 0) + 0.6 * w * p.w; });
    }
    M.ppMax = 0; for (var q in M.pp) M.ppMax = Math.max(M.ppMax, M.pp[q]);
  } catch (e2) {}
  return M;
};
/* learned vibe affinity: ratings, Never show and implicit signals on titles that match a vibe (decayed) */
function qVibeAff() {
  var M = tsModel(); if (M.vibe) return M.vibe;
  var v = {}, now = Date.now(), R = rtBox();
  function hit(it, w) { if (!it) return; THEMES.forEach(function (t) { var m = 0; try { m = thMatch(t, it); } catch (e) {} if (m >= 2) v[t.id] = (v[t.id] || 0) + w * Math.min(1.5, m / 4); }); }
  for (var k in R) { var e = R[k], dec = Math.max(0.5, Math.pow(0.5, (now - (e.ts || now)) / Q_HL_RT)); hit(e.it, (e.v === 2 ? 2 : e.v === 1 ? 1 : e.v === -1 ? -0.8 : e.v === -2 ? -2 : 0) * dec); }
  var I = qImplicit(); for (var key in I) { var b = I[key]; hit(b.it, Math.min(2, b.fin) * 1.2 + 0.4 * b.part - 0.5 * Math.min(2, b.ab)); }
  M.vibe = v; return v;
}
function qVibeOf(it) { var o = []; THEMES.forEach(function (t) { try { if (thTypeOK(t, it.t) && thMatch(t, it) >= 2) o.push(t.id); } catch (e) {} }); return o; }
var QVB = { m: null, c: {}, t: 0 };
var _tasteBoost416 = tasteBoost;
tasteBoost = function (it) {
  var b = _tasteBoost416(it); if (!it || it.t === "live" || b <= -60) return b;
  try {
    var M = tsModel(), k = itemKey(it);
    if (M.imp[k] < 0) b += Math.max(-3, M.imp[k] * 1.5);              // started and dropped quickly
    var sg = (PD && PF ? PF.id : "") + "|" + TSC.n + "|" + Object.keys(rtBox()).length + "|" + (PD.wl ? PD.wl.length : 0);
    if (QVB.m !== sg || Date.now() - QVB.t > 600000) { QVB.m = sg; QVB.t = Date.now(); QVB.c = {}; }
    var vb = QVB.c[k];
    if (vb === undefined) { var va = qVibeAff(), s = 0; qVibeOf(it).forEach(function (id) { s += va[id] || 0; }); vb = QVB.c[k] = Math.max(-3, Math.min(3, s * 0.8)); }
    b += vb;
  } catch (e) {}
  return b;
};
/* ---------------------------------------------------------------- diversity + exploration */
function qPrimary(it) { var g = itemGenres(it); return g[0] || "?"; }
function qShape(list, salt, n) {
  n = n || 30; if (!list || list.length < 12) return list;
  var cap = Math.max(3, Math.ceil(0.4 * n)), cnt = {}, out = [], later = [], i;
  for (i = 0; i < list.length && out.length < n * 3; i++) { var g = qPrimary(list[i]); if ((cnt[g] || 0) >= cap) { later.push(list[i]); continue; } cnt[g] = (cnt[g] || 0) + 1; out.push(list[i]); }
  out = out.concat(later, list.slice(i));
  // exploration: ~10 % of the visible slots (4, 14, 24) go to a deeper title outside the top genres that still fits the taste
  try {
    var aff = affinity(), topG = Object.keys(aff).sort(function (a, b) { return (aff[b] || 0) - (aff[a] || 0); }).slice(0, 3);
    var pool = out.slice(n).filter(function (it) { return topG.indexOf(qPrimary(it)) < 0 && tasteBoost(it) >= 0 && (!qGate(V.view) || qOK(it)); });
    var rnd = dpRng(dpToday() + "|" + (PF ? PF.id : "") + "|explore|" + (salt || ""));
    [4, 14, 24].forEach(function (pos) {
      if (!pool.length || pos >= out.length) return;
      var x = pool.splice(Math.floor(rnd() * Math.min(pool.length, 12)), 1)[0], j = out.indexOf(x); if (j < 0) return;
      out.splice(j, 1); out.splice(pos, 0, x); x._explore = 1;
    });
  } catch (e) {}
  return out;
}
/* ---------------------------------------------------------------- vibe rows */
var VIBES = [
  { id: "gritty", title: "\uD83E\uDE78 Gritty true stories", types: "ms", g: ["Drama", "Thriller & Crime", "Crime", "Documentary"], src: /CRIME|DRAM|GANGSTER|BIOGRAPH|HISTOR/,
    allow: /^(goodfellas|casino|the irishman|blow|black mass|american made|american gangster|catch me if you can|the wolf of wall street|spotlight|zodiac|monster|captain phillips|dallas buyers club|the big short|lord of war|donnie brasco|public enemies|the town|sicario|narcos.*|mindhunter|chernobyl|when they see us|dopesick|unbelievable|american crime story.*|the people v\.? o\.?j\.? simpson|escape at dannemora|black bird|dahmer.*|monster: the jeffrey dahmer story|the staircase|making a murderer|the jinx|the act|painkiller|griselda|american animals|i, tonya|the report|zero dark thirty|argo|bridge of spies|the post|all the president'?s men|richard jewell|sully|the infiltrator|killers of the flower moon|mank|cocaine bear|pain (and|&) gain|bernie|the founder|blackberry|tetris|air|w\.?|vice|the social network|molly'?s game|war dogs|bad education|the dropout|super pumped|inventing anna|the serpent|the investigation|the tourist|the night of|boardwalk empire|snowfall|griselda|we own this city|the wire|band of brothers|the pacific|masters of the air|hacksaw ridge|lone survivor|13 hours.*|black hawk down|american sniper|the hurt locker|scarface|carlito'?s way|the french connection|serpico|dog day afternoon|prince of the city|eight men out|rush|ford v(s\.?)? ferrari|senna|the fighter|raging bull|i am a killer|the crown)$/i,
    kw: /true story|based on (a |the )?true|real(-| )life|real events|actual events|inspired by (the )?true|biopic|true crime|untold story|infamous/i },
  { id: "survive", title: "\uD83E\uDDD7 Edge-of-your-seat survival", types: "ms", g: ["Action & Adventure", "Thriller & Crime", "Documentary", "Drama"], src: /ACTION|THRILLER|ADVENTURE|DOCU/,
    allow: /^(127 hours|the revenant|cast away|everest|touching the void|the grey|alive|society of the snow|free solo|the impossible|gravity|the martian|adrift|kon-tiki|into the wild|alone|yellowjackets|lost|man vs\.? wild|naked and afraid|thirteen lives|the rescue|apollo 13|captain phillips|sully|the edge|arctic|wild|life of pi|buried|dunkirk|1917|the 33|the perfect storm|in the heart of the sea|all is lost|open water|the shallows|47 meters down|frozen \(2010\)|the descent|cliffhanger|vertical limit|the north face|meru|14 peaks.*|the alpinist|the dawn wall|deadliest catch|life below zero|mountain men|the wild|survivor|the long walk|unbroken|rescue dawn|the way back|backcountry|the mountain between us|crawl|greenland|2012|the day after tomorrow|the poseidon adventure|titanic|deepwater horizon|the hurt locker|the lost city of z|the river wild|hostiles|the hateful eight|the road|a quiet place.*|bird box|10 cloverfield lane|outlast|race to survive.*|surviving the wild|i shouldn'?t be alive|survivorman)$/i,
    kw: /\bsurviv(e|al|ors?|ing)\b|stranded|wilderness|shipwreck|plane crash|avalanche|lost at sea|castaway|everest|marooned|against all odds/i },
  { id: "rebels", title: "\u270A Real-life rebels & rule-breakers", types: "ms", g: ["Drama", "Documentary", "War & History"], src: /DRAM|DOCU|BIOGRAPH|HISTOR/,
    allow: /^(snowden|citizenfour|the post|erin brockovich|milk|selma|malcolm x|the trial of the chicago 7|dallas buyers club|the people vs\.? larry flynt|pirates of silicon valley|the social network|blackberry|steve jobs|jobs|air|ford v(s\.?)? ferrari|rush|senna|the dirt|bohemian rhapsody|rocketman|walk the line|straight outta compton|lords of dogtown|dogtown (and|&) z-?boys|catch me if you can|blow|american made|moneyball|the big short|the insider|silkwood|norma rae|harriet|judas and the black messiah|one night in miami.*|the hurricane|ali|the united states vs\.? billie holiday|the fifth estate|we steal secrets.*|the dissident|navalny|icarus|the great hack|the social dilemma|official secrets|the mauritanian|dark waters|the laundromat|the founder|tetris|the dropout|super pumped|halt and catch fire|wild wild country|the king of staten island|the disaster artist|ed wood|man on the moon|the aviator|the greatest showman|hustlers|a complete unknown|elvis|i'?m still here|the wolf of wall street|lord of war|war dogs|american animals|free state of jones|braveheart|v for vendetta|rebel without a cause|easy rider|the motorcycle diaries|into the wild|amy|kurt cobain: montage of heck|the last dance|when we were kings)$/i,
    kw: /whistleblow|activist|civil rights|dissident|rule.?break|counterculture|renegade|maverick|true story of (a|the) rebel|took on the (system|government|establishment)/i },
  { id: "britmyst", title: "\uD83D\uDD75\uFE0F Slow-burn British mysteries", types: "ms", g: ["Thriller & Crime", "Crime", "Mystery", "Drama"], src: /\|UK\||BRIT|BBC|ITV|CRIME/, uk: 1,
    allow: /^(broadchurch|happy valley|line of duty|shetland|vera|midsomer murders|endeavour|inspector morse|lewis|unforgotten|luther|sherlock|bodyguard|the fall|marcella|grantchester|father brown|death in paradise|agatha christie'?s poirot|poirot|agatha christie'?s marple|miss marple|marple|foyle'?s war|prime suspect|cracker|wycliffe|a touch of frost|dalgliesh|strike|c\.?b\.? strike|the tourist|collateral|the missing|baptiste|river|no offence|scott (and|&) bailey|silent witness|waking the dead|wire in the blood|whitechapel|taggart|rebus|the bay|innocent|liar|the capture|hidden|keeping faith|hinterland|the killing|the night manager|des|white house farm|the long call|ridley|annika|karen pirie|the responder|blue lights|time|sherwood|mrs\.? wilson|the a word|apple tree yard|cuffs|dci banks|inspector lynley.*|the inspector lynley mysteries|morse|wallander|the coroner|mcdonald (and|&) dodds|signora volpe|the marlow murder club|the thursday murder club|knives out|glass onion.*|gosford park|murder on the orient express|death on the nile|a haunting in venice|see how they run|the third man|frenzy|the 39 steps|hot fuzz|the limehouse golem|enola holmes.*|sherlock holmes.*)$/i,
    kw: /detective|inspector|\bdci\b|murder mystery|whodunit|cold case|disappearance|body (is )?found|murder in (a|the) (small|quiet|sleepy)/i, ukkw: /british|england|english|london|yorkshire|scotland|scottish|wales|welsh|cornwall|cornish|oxford|cambridge|\bbbc\b|\bitv\b|northern ireland|belfast|manchester|liverpool|\(uk\)|\(gb\)/i },
  { id: "comfort", title: "\uD83E\uDDF8 Feel-good comfort", types: "ms", g: ["Comedy", "Romance"], src: /COMED|ROMAN|FAMIL/,
    allow: /^(ted lasso|schitt'?s creek|parks and recreation|the office|brooklyn nine-nine|abbott elementary|paddington( 2)?|chef|the intouchables|amelie|am\u00e9lie|little miss sunshine|the secret life of walter mitty|groundhog day|notting hill|about time|love actually|the holiday|mrs\.? doubtfire|school of rock|hunt for the wilderpeople|derry girls|gilmore girls|friends|frasier|detectorists|gavin (and|&) stacey|the great british bake off|great british bake off|queer eye|all creatures great (and|&) small|call the midwife|ghosts|only murders in the building|shrinking|the durrells|kim'?s convenience|corner gas|the grand budapest hotel|the princess bride|forrest gump|big|elf|the full monty|billy elliot|pride|the best exotic marigold hotel|the hundred-foot journey|julie (and|&) julia|the intern|crazy rich asians|the proposal|10 things i hate about you|clueless|legally blonde|the devil wears prada|sing street|begin again|yesterday|the guernsey literary and potato peel pie society|military wives|the repair shop|escape to the country|grand designs|this farming life|our yorkshire farm|clarkson'?s farm|the good place|new girl|community|scrubs|modern family|cheers|the good wife|northern exposure|everybody loves raymond|kim'?s convenience|letterkenny|son of a critch|heartland|virgin river|sweet magnolias|emily in paris|bridgerton|the vicar of dibley|last tango in halifax|doc martin|wild at heart|monarch of the glen|ballykissangel|hamish macbeth|the darling buds of may|heartbeat|as time goes by)$/i,
    kw: /feel.?good|heartwarming|uplifting|wholesome|\bcozy\b|\bcosy\b|found family|warm.?hearted|life.?affirming/i },
  { id: "underdog", title: "\uD83E\uDD4A Underdog sports stories", types: "ms", g: ["Drama", "Sports", "Sport", "Documentary"], src: /SPORT|DRAM/,
    allow: /^(rocky.*|creed.*|rudy|miracle|moneyball|hoosiers|remember the titans|cinderella man|the fighter|warrior|million dollar baby|rush|ford v(s\.?)? ferrari|senna|le mans '?66|cool runnings|the blind side|invictus|coach carter|friday night lights|slap shot|goon.*|the mighty ducks|major league|bull durham|tin cup|eddie the eagle|king richard|ted lasso|sunderland '?til i die|welcome to wrexham|formula 1: drive to survive|drive to survive|last chance u|the last dance|cheer|hard knocks|all or nothing.*|the natural|field of dreams|a league of their own|42|seabiscuit|secretariat|the karate kid|cobra kai|any given sunday|varsity blues|the replacements|draft day|jerry maguire|white men can'?t jump|he got game|glory road|the express|we are marshall|the way back|air|chariots of fire|i, tonya|battle of the sexes|the wrestler|southpaw|foxcatcher|the hurricane|ali|raging bull|happy gilmore|caddyshack|dodgeball.*|the waterboy|kingpin|semi-pro|blades of glory|talladega nights.*|days of thunder|ip man.*|bloodsport|kickboxer|real steel|the program|icarus|free solo|the redeem team|untold.*|30 for 30.*|quarterback|full swing|break point|tour de france: unchained|the boys in the boat|the iron claw|challengers|f1|f1: the movie)$/i,
    kw: /underdog|comeback|unlikely (champion|team|hero)|ragtag|against the odds|title fight|(boxing|hockey|football|basketball|baseball|soccer) (team|coach|legend|story)/i },
  { id: "bigmach", title: "\uD83C\uDFD7 Big-machine engineering", types: "ms", g: ["Documentary", "Reality"], src: /DOCU|DISCOVERY|SCIENCE|REALITY|HISTOR/,
    allow: /^(ice road truckers|gold rush.*|megastructures|modern marvels|mighty ships|deadliest catch|impossible engineering|megafactories|mega ?factories|ax men|highway thru hell|heavy rescue: 401|street outlaws.*|diesel brothers|fast n'? loud|overhaulin'?|wheeler dealers|bitchin'? rides|counting cars|american chopper.*|how it'?s made.*|inside the factory|the machines that built america|the men who built america|extreme engineering|big, bigger, biggest|superstructures|world'?s toughest fixes|secrets of the underground|engineering (connections|disasters)|strip the city|unbuilt|apollo 13|first man|the right stuff|hidden figures|apollo 11|for all mankind|the martian|top gun: maverick|top gun|sully|sorcerer|the wages of fear|ford v(s\.?)? ferrari|tucker: the man and his dream|the dam busters|the aviator|october sky|the current war|chernobyl|deepwater horizon|the bridge on the river kwai|oppenheimer|the imitation game|spacex.*|return to space|countdown: inspiration4 mission to space|man vs\.? machine|mythbusters|dirty jobs|bering sea gold|mighty trains|mighty planes|air disasters|seconds from disaster|mayday|aircrash confidential|the detectorists|clarkson'?s farm|top gear|the grand tour|james may: our man in.*|james may'?s man lab|the toys that made us|the food that built america|unwrapped)$/i,
    kw: /engineer|machines?\b|construction|megastructure|mega ?(project|factor)|aircraft|rocket|\btrucks?\b|truckers?|\bmining\b|tunnel|factory|heavy (equipment|machinery)|excavat|\bcranes?\b|locomotive|diesel|space ?x/i },
  { id: "darkfun", title: "\uD83C\uDFB2 Twisty crime capers", types: "ms", g: ["Thriller & Crime", "Comedy"], src: /CRIME|THRILLER|GANGSTER|COMED/,
    allow: /^(knives out|glass onion.*|snatch|lock,? stock.*|the nice guys|in bruges|seven psychopaths|the gentlemen|baby driver|logan lucky|ocean'?s (eleven|twelve|thirteen|8)|the sting|catch me if you can|the usual suspects|now you see me.*|the italian job|inside man|the prestige|memento|fargo|burn after reading|the big lebowski|pulp fiction|reservoir dogs|jackie brown|true romance|kiss kiss bang bang|the hateful eight|game night|bad times at the el royale|free fire|the grand budapest hotel|hot fuzz|guns akimbo|bullet train|the menu|triangle of sadness|only murders in the building|barry|killing eve|lupin|white collar|leverage|hustle|the good thief|matchstick men|the brothers bloom|focus|american hustle|the score|heat|the town|baby driver|hell or high water|good time|uncut gems|after hours|very bad things|the house|vacation friends|my cousin vinny|get shorty|out of sight|be cool|the hangover)$/i,
    kw: /heist|con (man|artist)|caper|scheme|swindl|double.?cross|grifter|stolen|robbery|getaway|scam/i },
  { id: "period", title: "\uD83D\uDC51 Period drama & royals", types: "ms", g: ["Drama", "War & History", "Romance"], src: /\|UK\||BRIT|HISTOR|DRAM/, uk: 1,
    allow: /^(the crown|downton abbey|bridgerton|victoria|the tudors|wolf hall|peaky blinders|poldark|call the midwife|the gilded age|outlander|the last kingdom|vikings|the great|north (and|&) south|pride (and|&) prejudice|sense (and|&) sensibility|emma\.?|persuasion|little women|jane eyre|wuthering heights|the remains of the day|atonement|the king'?s speech|the queen|spencer|the favourite|mary queen of scots|elizabeth.*|the young victoria|darkest hour|the imitation game|dunkirk|the duchess|anne boleyn|becoming jane|howards end|a room with a view|gosford park|the forsyte saga|upstairs,? downstairs|mr selfridge|the paradise|the durrells|all creatures great (and|&) small|lark rise to candleford|cranford|the pursuit of love|belgravia|sanditon|vanity fair|war (and|&) peace|les mis[e\u00e9]rables|the english|shogun|the serpent queen|becoming elizabeth|the spanish princess|the white queen|the white princess|the hollow crown|rome|the borgias|the last duel|the king|braveheart|gladiator|master and commander.*|the man who knew infinity)$/i,
    kw: /\broyal(s|ty)?\b|\bqueen (elizabeth|victoria|mary|anne|of)\b|\bking (henry|charles|george|edward|richard|arthur|louis)\b|victorian|edwardian|\btudors?\b|regency|aristocra|19th.century|18th.century|period drama|costume drama/i },
  { id: "ukspyv", title: "\uD83D\uDD76 British spy & political thrillers", types: "ms", g: ["Thriller & Crime", "Drama", "Action & Adventure"], src: /\|UK\||BRIT|BBC|THRILLER/, uk: 1,
    allow: /^(bodyguard|the night manager|slow horses|spooks|mi-?5|killing eve|the capture|the little drummer girl|tinker tailor soldier spy|smiley'?s people|the honourable woman|collateral|the undeclared war|the day of the jackal|state of play|house of cards \(1990\)|the thick of it|the gold|the diplomat|the agency|the ipcress file|a very english scandal|a very british coup|official secrets|the spy who came in from the cold|the constant gardener|the courier|operation mincemeat|munich: the edge of war|our kind of traitor|a most wanted man|the third man|skyfall|spectre|casino royale|no time to die|quantum of solace|goldeneye|dr\.? no|goldfinger|from russia with love|kingsman.*|the gentlemen|sherlock|luther|deep state|the state|bancroft|traitors|the secret agent|london spy|codename: kyiv|the old man|the agency|the recruit|homeland|the americans|the night agent|jack ryan|reacher|the terminal list|the day of the jackal)$/i,
    kw: /\bspy\b|espionage|\bmi-?[56]\b|secret service|intelligence|\bagent\b|double agent|cold war|kgb|cia|whitehall|westminster|parliament|downing street|conspiracy/i },
  { id: "brcom", title: "\uD83C\uDFA9 British comedy gold", types: "ms", g: ["Comedy"], src: /\|UK\||BRIT|BBC|COMED/, uk: 1,
    allow: /^(fawlty towers|only fools and horses|the office|gavin (and|&) stacey|blackadder.*|mr\.? bean|red dwarf|the inbetweeners|peep show|absolutely fabulous|the vicar of dibley|father ted|derry girls|ghosts|fleabag|the it crowd|spaced|black books|the thick of it|motherland|detectorists|toast of london|this country|people just do nothing|stath lets flats|man down|catastrophe|friday night dinner|after life|extras|the young ones|keeping up appearances|are you being served\??|yes,? minister|yes,? prime minister|porridge|dad'?s army|monty python.*|the royle family|alan partridge.*|i'?m alan partridge|the trip.*|w1a|twenty twelve|the league of gentlemen|inside no\.? 9|car share|still game|chewing gum|plebs|ted lasso|hot fuzz|shaun of the dead|the world'?s end|in bruges|four lions|withnail (and|&) i|lock,? stock.*|snatch|love actually|notting hill|four weddings and a funeral|bridget jones.*|the full monty|kinky boots|johnny english.*|paddington( 2)?|death at a funeral|wallace (and|&) gromit.*|the death of stalin|in the loop|the inbetweeners movie)$/i,
    kw: /sitcom|british comedy|deadpan/i, ukkw: /british|england|london|\bbbc\b|\(uk\)|\(gb\)/i }
].filter(function (t) { return t.types; });
VIBES.forEach(function (t) { t.vibe = 1; if (!TH_BY[t.id]) { THEMES.push(t); TH_BY[t.id] = t; } });
/* British vibes need a British signal: allow-list, British category, or UK words in the plot / name */
var _thMatch416 = thMatch;
thMatch = function (t, it) {
  var s = _thMatch416(t, it); if (!s || !t.vibe) return s;
  if (s < 1.9) return 0;                                 // a vibe needs its allow-list or a keyword, not just a genre
  if (!t.ukkw) return s;
  var n = String(it.n || "").trim(); if (t.allow.test(n)) return s;
  var c = catById[it.t + ":" + it.c], uk = (c && /BRITBOX|\|UK\||BRITISH/.test(c.up)) || t.ukkw.test(n + " " + String(it.plot || "").slice(0, 500));
  return uk ? s : Math.min(s, 0.9);
};
var TH_PICK = 6;      // rows a day (4.14/4.15: 4)
TH_MIN = 8;           // a vibe / theme row needs 8 titles that pass the quality floor
function qUKfav() { try { return favIs("cc", "UK"); } catch (e) { return false; } }
/* per-profile ranking of every theme / vibe for a section (stable all day, avoids yesterday's set) */
function thRank(type) {
  var rnd = dpRng(dpToday() + "|" + PF.id + "|themes|" + type), aff = affinity(), tp = PD.tp || {}, R = rtBox(), va = qVibeAff(), box = dpBox();
  var yday = {}; ((box.past && box.past[0] && box.past[0].th && box.past[0].th[type]) || []).forEach(function (id) { yday[id] = 1; });
  var amax = 0; for (var g in aff) amax = Math.max(amax, aff[g]);
  var vmax = 0; for (var v in va) vmax = Math.max(vmax, Math.abs(va[v]));
  var uk = qUKfav();
  var cand = THEMES.filter(function (t) { return thTypeOK(t, type); }).map(function (t) {
    var a = 0; t.g.forEach(function (x) { a = Math.max(a, amax > 0 ? Math.max(0, aff[x] || 0) / amax : 0); });
    var w = 0.6 + 1.4 * a + 1.2 * ((tp.th && tp.th[t.id]) || 0) + (t.vibe ? 0.5 : 0);
    if (vmax > 0 && va[t.id]) w += 1.5 * va[t.id] / vmax;
    if (t.uk) w += uk ? 1.8 : -0.3;
    for (var k in R) if (R[k].v > 0 && R[k].it && t.allow.test(String(R[k].it.n || "").trim())) w += 0.5 * R[k].v;
    if (yday[t.id]) w *= 0.45;
    return { t: t, w: Math.max(0.05, w) };
  });
  var out = [];
  while (cand.length) {
    var sum = 0, i; for (i = 0; i < cand.length; i++) sum += cand[i].w;
    var x = rnd() * sum; for (i = 0; i < cand.length - 1 && x > cand[i].w; i++) x -= cand[i].w;
    out.push(cand.splice(i, 1)[0].t);
  }
  return out;
}
thDaily = function (type) {
  var box = dpBox(); box.th = box.th || {};
  if (box.th[type] && box.th[type].length === TH_PICK && box.thv === Q_VER) return box.th[type].map(function (id) { return TH_BY[id]; }).filter(Boolean);
  if (box.thv !== Q_VER) { box.th = {}; box.thv = Q_VER; }
  var out = thRank(type).slice(0, TH_PICK);
  box.th[type] = out.map(function (t) { return t.id; }); savePD();
  return out;
};
/* a theme row that comes up short hands its slot to the next theme in today's ranking */
var THS = {};
var _thItems416 = thItems;
thItems = function (t, type) {
  return _thItems416(t, type).then(function (l) { return l.length ? qShape(l, "th" + t.id, TH_MAX).slice(0, TH_MAX) : l; });
};
thSpec = function (t, type) {
  var spec = { title: t.title, tag: "Today", theme: t.id, load: function () {
    var st = THS[type + PF.id + dpToday()]; if (!st) st = THS[type + PF.id + dpToday()] = { used: {}, rank: null };
    st.used[t.id] = 1;
    function retitle(tt) { spec.title = tt.title; spec.theme = tt.id; try { V.rows.forEach(function (r) { if (r.spec === spec) { var e = r.el.querySelector(".rtitle"); if (e && e.firstChild) e.firstChild.nodeValue = tt.title; } }); } catch (e) {} }
    function tryT(tt, n) {
      return thItems(tt, type).then(function (l) {
        if (l.length || n > 6) { if (tt !== t) retitle(tt); return l; }
        if (!st.rank) st.rank = thRank(type).slice(TH_PICK);
        var nx = null; while (st.rank.length && !nx) { var c = st.rank.shift(); if (!st.used[c.id]) nx = c; }
        if (!nx) return l; st.used[nx.id] = 1; return tryT(nx, n + 1);
      });
    }
    return tryT(t, 0);
  } };
  return spec;
};
/* more sources for vibe rows (allow-lists need a wider net) */
var _thSources416 = thSources;
thSources = function (t, type) {
  var out = _thSources416(t, type); if (!t.vibe) return out;
  var en = cats[type].filter(catVisibleV), seen = {}; out.forEach(function (c) { seen[c.id] = 1; });
  en.filter(function (c) { return !seen[c.id] && t.g.length && c.genres.some(function (g) { return t.g.indexOf(g) >= 0; }); }).slice(0, 3).forEach(function (c) { out.push(c); });
  if (t.uk) en.filter(function (c) { return !seen[c.id] && /BRITBOX|\|UK\||BRITISH/.test(c.up); }).slice(0, 2).forEach(function (c) { out.push(c); });
  return out.slice(0, 8);
};
/* ---------------------------------------------------------------- pool cache: new flags need a fresh pool */
(function () { try { if (lsGet("nf_q_ver", 0) !== Q_VER) { localStorage.removeItem("nf_pool_movies"); localStorage.removeItem("nf_pool_series"); lsSet("nf_q_ver", Q_VER); } } catch (e) {} })();
/* ---------------------------------------------------------------- Settings > Content & filters */
function qFloorLabel() { var f = qFloor(); return f ? f.toFixed(1) + "+" : "Off"; }
function stContent416(inner, ln) {
  stRow(inner, ln, { key: "tog:in", ic: "\uD83C\uDDEE\uD83C\uDDF3", t: "Hide Indian content", d: "Removes Indian / Bollywood / Hindi / Tamil / Telugu / Punjabi / Desi categories, channels and titles from TV, Movies, Shows and search", get: inHidden, set: function (v) { PD.st.hideIN = v; } });
  stRow(inner, ln, { key: "tog:kids", ic: "\uD83E\uDDF8", t: "Kids content", d: "Off hides kids / children / cartoon / family-animation categories, kids channels and kid-targeted titles everywhere", get: kidsOn, set: function (v) { PD.st.kids = v; } });
  inner.appendChild(ce("div", "s-sec", "Quality (Movies & Shows)"));
  stRow(inner, ln, { key: "q:floor", ic: "\u2B50", t: "Quality floor", d: "Curated and Categories only show titles rated at least this (TMDB, with enough votes), award / top-list titles and your likes. Everything shows the rest.", val: qFloorLabel,
    act: function (r, paint) { var f = qFloor(), i = QF_STEPS.indexOf(f); PD.st.qf = QF_STEPS[(i + 1) % QF_STEPS.length]; ST.dirty = true; savePD(true); paint(); toast("Quality floor: " + qFloorLabel()); } });
  stRow(inner, ln, { key: "q:trim", ic: "\u2702\uFE0F", t: "Tuck away unused categories", d: "Categories mode hides provider categories " + PF.name + " never opens (once there is enough history). They stay in Everything.", get: qTrimOn, set: function (v) { PD.st.qtrim = v; } });
}
