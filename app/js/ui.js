/* NickFlix v2 - shared UI helpers: focus, line navigation, cards, keyboard */
"use strict";
var curF = null;
function setF(el) { if (curF === el) return; if (curF) curF.classList.remove("f"); curF = el; if (el) el.classList.add("f"); }
var toastT = null;
function toast(msg, ms) { var t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add("hidden"); }, ms || 2500); }
function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function initials(n) {
  var w = String(n || "?").replace(/[^A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF ]/g, " ").trim().split(/\s+/);
  return ((w[0] ? w[0].charAt(0) : "?") + (w[1] ? w[1].charAt(0) : (w[0] && w[0].length > 1 ? w[0].charAt(1) : ""))).toUpperCase();
}
function placeholder(name) { return ce("div", "ph g" + (hash(name) % 8), initials(name)); }
function imgOr(src, name, cls) {
  var a = ce("div", cls || "art");
  if (src && /^https?:/i.test(src)) {
    var img = document.createElement("img"); img.loading = "lazy"; img.alt = "";
    img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(placeholder(name), img); };
    img.src = src; a.appendChild(img);
  } else a.appendChild(placeholder(name));
  return a;
}
function cardEl(item, cls, i, pitch) {
  var c = ce("div", "card " + cls);
  c.style.left = (i * pitch) + "px";
  var a = item.t === "live" && typeof chanArt === "function" ? chanArt(item) : imgOr(item.ic, item.n);
  if (item.sub) a.appendChild(ce("div", "csub", item.sub));
  if (item.pr > 0) { var b = ce("div", "pbar"); var f = ce("div"); f.style.width = Math.max(4, Math.round(item.pr * 100)) + "%"; b.appendChild(f); a.appendChild(b); }
  c.appendChild(a);
  c.appendChild(ce("div", "name", item.n));
  return c;
}
function fmtDur(s) { s = String(s || ""); var m = s.match(/^0?(\d+):(\d\d):\d\d$/); if (m) return (+m[1] > 0 ? +m[1] + "h " : "") + (+m[2]) + "m"; var n = +s; if (n > 0) { var h = Math.floor(n / 3600), mm = Math.round((n % 3600) / 60); return (h ? h + "h " : "") + mm + "m"; } return ""; }
function fmtTime(ms) { var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x; }
function ago(ts) { var d = (Date.now() - ts) / 1000; if (d < 3600) return Math.max(1, Math.round(d / 60)) + " min ago"; if (d < 86400) return Math.round(d / 3600) + " h ago"; return Math.round(d / 86400) + " days ago"; }
function ratingBadge(it) {
  var r = parseFloat(it.r); if (!(r > 0)) return null;
  if (r > 10) r = r / 10;
  var w = ce("span", "rate");
  w.appendChild(ce("span", "rb", it.tm ? "TMDB" : "Rating"));
  w.appendChild(document.createTextNode(" " + r.toFixed(1)));
  return w;
}

/* generic line navigation for overlays */
function LN(el, base) { return { el: el, base: base == null ? 480 : base, lines: [], li: 0, ci: 0 }; }
function lnAdd(ln, el, items, opt) { var L = { el: el, items: items }; if (opt) for (var k in opt) L[k] = opt[k]; ln.lines.push(L); return L; }
function lnFocus(ln) {
  var line = ln.lines[ln.li]; if (!line) { setF(null); return; }
  if (ln.ci >= line.items.length) ln.ci = line.items.length - 1; if (ln.ci < 0) ln.ci = 0;
  setF(line.items[ln.ci]);
  var y = line.el.offsetTop + (line.dy || 0);
  ln.el.style.transform = "translateY(" + Math.min(0, -(y - ln.base)) + "px)";
  if (line.hs != null) { var x = line.items[ln.ci].offsetLeft; line.el.style.transform = "translateX(" + Math.min(0, -(x - line.hs)) + "px)"; }
}
function lnPane(ln, from) {
  var cur = from.items[ln.ci], tgt = ln.lines[ln.li];
  if (tgt.resetCol) { ln.ci = 0; return true; }
  if (!cur || cur._pane == null) return false;
  var best = -1, bd = 1e9;
  for (var i = 0; i < tgt.items.length; i++) { var it = tgt.items[i]; if (it._pane === cur._pane) { var d = Math.abs((it._col || 0) - (cur._col || 0)); if (d < bd) { bd = d; best = i; } } }
  if (best < 0) for (var j = tgt.items.length - 1; j >= 0; j--) { best = j; break; }
  ln.ci = Math.max(0, best); return true;
}
function lnKey(ln, k) {
  var L = ln.lines; if (!L.length) return false;
  if ((k === "up" || k === "down") && L[ln.li].items[ln.ci] && (L[ln.li].items[ln.ci]._pane != null || (L[ln.li + (k === "up" ? -1 : 1)] || {}).resetCol)) {
    var from = L[ln.li], n = ln.li + (k === "up" ? -1 : 1);
    if (n < 0 || n >= L.length) return false;
    ln.li = n; lnPane(ln, from); lnFocus(ln); return true;
  }
  if (k === "up") { if (ln.li > 0) { var f = ln.ci / Math.max(1, L[ln.li].items.length); ln.li--; if (L[ln.li].keepCol) ln.ci = Math.round(f * L[ln.li].items.length); lnFocus(ln); return true; } return false; }
  if (k === "down") { if (ln.li < L.length - 1) { var f2 = ln.ci / Math.max(1, L[ln.li].items.length); ln.li++; if (L[ln.li].keepCol) ln.ci = Math.floor(f2 * L[ln.li].items.length); lnFocus(ln); return true; } return false; }
  if (k === "left") { if (ln.ci > 0) { ln.ci--; lnFocus(ln); return true; } return false; }
  if (k === "right") { if (ln.ci < L[ln.li].items.length - 1) { ln.ci++; lnFocus(ln); return true; } return false; }
  if (k === "enter") { var it = L[ln.li].items[ln.ci]; if (it && it._act) it._act(); return true; }
  return false;
}
function lnFind(ln, key) { for (var i = 0; i < ln.lines.length; i++) for (var j = 0; j < ln.lines[i].items.length; j++) if (ln.lines[i].items[j]._key === key) { ln.li = i; ln.ci = j; return true; } return false; }

/* on-screen keyboard: returns array of line item arrays; each key has _ch */
var KB_ROWS = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ-'", "1234567", "890.&!?"];
function buildKeyboard(container, ln, onKey, keyCls) {
  KB_ROWS.forEach(function (row) {
    var r = ce("div", "krow"), items = [];
    row.split("").forEach(function (ch) { var b = ce("div", "key" + (keyCls ? " " + keyCls : ""), ch); b._act = function () { onKey(ch); }; b._pane = 0; b._col = items.length * 3; r.appendChild(b); items.push(b); });
    container.appendChild(r); lnAdd(ln, r, items, { keepCol: true });
  });
  var r2 = ce("div", "krow"), it2 = [];
  [["SPACE", " "], ["\u232B DEL", "DEL"], ["CLEAR", "CLR"]].forEach(function (x) { var b = ce("div", "key wide", x[0]); b._act = function () { onKey(x[1]); }; b._pane = 0; b._col = it2.length * 9 + 3; r2.appendChild(b); it2.push(b); });
  container.appendChild(r2); lnAdd(ln, r2, it2, { keepCol: true });
}
