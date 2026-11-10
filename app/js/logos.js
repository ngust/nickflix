/* NickFlix v4 - channel logos: curated tv-logos match -> provider icon -> clean text tile */
"use strict";
var LOGO_BASE = "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/";
var LOGO_DIR = { u: ["united-states", "-us"], k: ["united-kingdom", "-uk"], c: ["canada", "-ca"], g: ["germany", "-de"], i: ["international", "-int"], r: ["ireland", "-ie"], a: ["austria", "-at"] };
var LOGO_ORDER = { CA: "cuki", US: "ucki", UK: "krui", EN: "ukci", MULTI: "ukci", PPV: "ukci", DE: "gaiuk", NOW: "gaiuk", AT: "agiuk", SW: "gaiuk" };
var LOGO_MEMO = {};
function logoName(n) {
  var s = String(n || "");
  s = s.replace(/[\u1D00-\u1DBF\u02B0-\u02FF\u2070-\u209F]+/g, " ").replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  s = s.replace(/^\s*(?:NOWTV|NOW|MAG|DE-A|USA|US|UK|CA|DE|AT|CH|IE)\s*[|:\-]\s*/i, "").replace(/^\s*NOWTV\s+/i, "");
  s = s.replace(/\b(?:FHD|UHD|HD|SD|4K|8K|HEVC|H\.?265|60 ?FPS|FPS|RAW|BACKUP|VIP|MULTI|1080P?|720P?|ORIGINAL)\b/gi, " ");
  s = s.replace(/\s\+1\b/, " ").replace(/\s+(US|USA|UK|CA)\s*$/i, "").replace(/\s+/g, " ").trim();
  return s;
}
function logoKey(s) { return s.toLowerCase().replace(/&/g, " and ").replace(/\+/g, " plus ").replace(/[^a-z0-9]/g, ""); }
function logoFor(it) {
  if (!it || it.t !== "live") return "";
  var memo = LOGO_MEMO[it.id]; if (memo !== undefined) return memo;
  var c = catById["live:" + it.c], code = c ? c.code : "", order = LOGO_ORDER[code] || "ukci";
  var nm = logoName(it.n), k = logoKey(nm), url = "";
  var noLoc = logoKey(nm.replace(/\b(EAST|WEST|PACIFIC|ATLANTIC|CENTRAL|MOUNTAIN|NORTH|SOUTH)\b/gi, ""));
  var cands = [k, noLoc, k.replace(/(channel|tv|network|hd)$/, ""), k + "tv", k + "channel", k + "network", noLoc.replace(/(channel|tv|network)$/, "")];
  // local affiliates: "ABC 7 New York (WABC)" -> network logo
  var tail = String(it.n).split("|").pop().trim().toUpperCase();
  var net = tail.match(/^(ABC|CBS|NBC|FOX|PBS|CW|MY ?NETWORK|METV|CBC|CTV|GLOBAL|CITY ?TV|ITV|BBC ONE|BBC TWO|SKY NEWS|TELEMUNDO|UNIVISION)\b/);
  if (net && (c && c.ltype === "Local channels" || /\b[KW][A-Z]{2,3}\b|\d|\|/.test(String(it.n)))) cands.push(logoKey(net[1]));
  outer:
  for (var j = 0; j < cands.length; j++) {
    var key = cands[j]; if (!key || key.length < 2) continue;
    for (var i = 0; i < order.length; i++) {
      var m = LOGO_IDX[order[i]], f = m && m[key];
      if (f) { var d = LOGO_DIR[order[i]]; url = LOGO_BASE + d[0] + "/" + f + d[1] + ".png"; break outer; }
    }
  }
  LOGO_MEMO[it.id] = url;
  return url;
}
var NET_COLORS = [[/^CBC/, "#d40000"], [/^CTV/, "#0055a5"], [/^GLOBAL/, "#1e64c8"], [/^CITY/, "#00a0e0"], [/^TSN/, "#c8102e"], [/^SPORTSNET|^SN /, "#1d3a6e"],
  [/^BBC/, "#222"], [/^ITV/, "#00a99d"], [/^CHANNEL 4|^E4|^MORE4|^FILM4/, "#6c2c91"], [/^CHANNEL 5|^5 /, "#e3002b"], [/^SKY/, "#0b3fa8"],
  [/^ABC/, "#111"], [/^CBS/, "#1a1a6e"], [/^NBC/, "#6b2b9e"], [/^FOX/, "#003a70"], [/^PBS/, "#2638c4"], [/^ESPN/, "#c00"], [/^CNN/, "#c00"], [/^HBO/, "#333"],
  [/^DISCOVERY/, "#0a4ea3"], [/^DMAX/, "#e05a00"], [/^NAT ?GEO|^NATIONAL GEO/, "#e6b800"], [/^HISTORY/, "#8a6d3b"], [/^DISNEY/, "#113ccf"], [/^NICK/, "#ff6a00"], [/^TLC/, "#d6006f"]];
function textTile(name) {
  var n = (logoName(name) || String(name || "?")).replace(/^(CA|US|USA|UK)\s+(?=\S)/, ""), up = n.toUpperCase(), col = "";
  for (var i = 0; i < NET_COLORS.length; i++) if (NET_COLORS[i][0].test(up)) { col = NET_COLORS[i][1]; break; }
  var d = ce("div", "ttile" + (col ? "" : " g" + (hash(n) % 8)));
  if (col) d.style.background = "linear-gradient(135deg," + col + ",#0d0d12)";
  var t = ce("div", "ttx" + (n.length > 18 ? " sm" : ""), n.length > 34 ? n.slice(0, 32) + "\u2026" : n);
  d.appendChild(t); return d;
}
var LIGHT_MEMO = {};
function logoIsLight(img) {
  var k = img.src; if (LIGHT_MEMO[k] !== undefined) return LIGHT_MEMO[k];
  var r = false;
  try {
    var cv = document.createElement("canvas"); cv.width = 32; cv.height = 18;
    var cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, 32, 18);
    var d = cx.getImageData(0, 0, 32, 18).data, sum = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 80) { sum += (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]); n++; }
    r = n > 10 && sum / n > 200;
  } catch (e) { r = false; }
  LIGHT_MEMO[k] = r; return r;
}
/* art box for a live channel: curated logo on a light plate, else provider logo on dark, else text tile */
var LOGO_STAT = { ok: 0, light: 0, fail: 0 };
function chanArt(it) {
  var a = ce("div", "art"), cur = logoFor(it), prov = it.ic && /^https?:/i.test(it.ic) ? it.ic : "";
  function tryImg(src, plate, next) {
    if (!src) { next(); return; }
    a.className = "art " + plate;
    var img = document.createElement("img"); img.alt = "";
    if (plate === "lplate") img.crossOrigin = "anonymous";
    img.onload = function () {
      if (img.naturalWidth < 40 || img.naturalHeight < 16) { if (img.parentNode) img.parentNode.removeChild(img); next(); return; }
      if (plate === "lplate") { LOGO_STAT.ok++; if (logoIsLight(img)) { a.className = "art dplate"; LOGO_STAT.light++; } }   // white logos go on the dark plate
    };
    img.onerror = function () { if (plate === "lplate") LOGO_STAT.fail++; if (img.parentNode) img.parentNode.removeChild(img); next(); };
    img.src = src; a.appendChild(img);
  }
  tryImg(cur, "lplate", function () { tryImg(prov, "mplate", function () { a.className = "art"; a.textContent = ""; a.appendChild(textTile(it.n)); }); });
  return a;
}
