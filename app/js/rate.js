/* NickFlix 4.14 - rating buttons (Netflix style): Not for me / I like this / Love this!
   Details page: three round buttons next to My List (LEFT/RIGHT to reach them, OK toggles, OK again clears).
   Player: GREEN (or DOWN on movies/episodes) opens a small Rate panel; LEFT/RIGHT pick, OK sets/clears, BACK closes.
   Ratings are stored per profile (taste.js PD.rt) and feed Top Picks, Today's picks and the themed rows. */
"use strict";
(function () {
  var st = document.createElement("style");
  st.textContent = ".btn.rate{padding:16px 22px;min-width:64px;text-align:center;background:rgba(60,60,66,.75);border-radius:44px}" +
    ".btn.rate .rl{display:none;font-size:26px;font-weight:600;margin-left:12px}.btn.rate.f .rl{display:inline}" +
    ".btn.rate.on{background:#fff;color:#000}.btn.rate.on.neg{background:#d9d9d9}" +
    "#nf-rate{position:fixed;left:50%;bottom:190px;transform:translateX(-50%);z-index:99996;background:rgba(18,18,20,.95);border:2px solid rgba(255,255,255,.25);border-radius:18px;padding:26px 34px;display:none;font-family:sans-serif;color:#fff;text-align:center}" +
    "#nf-rate .rh{font:800 32px/1.2 sans-serif;margin-bottom:6px}#nf-rate .rs{font:400 24px/1.3 sans-serif;color:#aaa;margin-bottom:20px}" +
    "#nf-rate .ro{display:inline-block;margin:0 14px;padding:18px 30px;border-radius:50px;background:rgba(90,90,96,.7);font:700 34px/1 sans-serif;border:5px solid transparent}" +
    "#nf-rate .ro.on{background:#fff;color:#000}#nf-rate .ro.f{border-color:#FFD400}#nf-rate .ro .rl{font-size:24px;margin-left:10px}";
  document.head.appendChild(st);
})();
var RATE_VALS = [-1, 1, 2];
function rateMsg(v, was) {
  if (!v) return "Rating removed";
  return v === 2 ? RT_TXT[2] + "  Love it \u2013 you'll see more like this" : v === 1 ? RT_TXT[1] + "  Liked \u2013 more like this coming up" : RT_TXT[-1] + "  Not for me \u2013 you'll see less like this";
}
function rateSync(btns, it) {
  var cur = rtGet(it);
  btns.forEach(function (b) { var on = b._rv === cur; b.classList.toggle("on", on); b.classList.toggle("neg", on && b._rv < 0); });
}
function rateButtons(it) {
  var btns = [];
  RATE_VALS.forEach(function (v) {
    var b = ce("div", "btn rate"); b._rv = v;
    b.appendChild(ce("span", "ri", RT_TXT[v])); b.appendChild(ce("span", "rl", RT_LBL[v]));
    b._act = function () { var nv = rtSet(it, v); rateSync(btns, it); toast(rateMsg(nv)); D.listChanged = true; };
    btns.push(b);
  });
  rateSync(btns, it); return btns;
}
var _renderDetails414 = renderDetails;
renderDetails = function (status) {
  _renderDetails414(status);
  try {
    var it = D.item, line = D.ln && D.ln.lines[0]; if (!it || !line || it.t === "live") return;
    var items = line.items, back = items[items.length - 1], rb = rateButtons(it);
    rb.forEach(function (b) { line.el.insertBefore(b, back); });
    Array.prototype.splice.apply(items, [items.length - 1, 0].concat(rb));
    lnFocus(D.ln);
  } catch (e) {}
};
/* ---------- player: Rate panel ---------- */
var RP = { el: null, open: false, sel: 1, it: null };
function rpItem() { try { return P.item && P.vod ? P.item : null; } catch (e) { return null; } }
function rpRender() {
  if (!RP.el) { RP.el = document.createElement("div"); RP.el.id = "nf-rate"; document.body.appendChild(RP.el); }
  var cur = rtGet(RP.it), h = "<div class='rh'>Rate " + String(RP.it.n || "this").replace(/[<>&]/g, "") + "</div><div class='rs'>Ratings shape what NickFlix suggests for you</div>";
  RATE_VALS.forEach(function (v, i) { h += "<span class='ro" + (v === cur ? " on" : "") + (i === RP.sel ? " f" : "") + "'>" + RT_TXT[v] + "<span class='rl'>" + RT_LBL[v] + "</span></span>"; });
  RP.el.innerHTML = h; RP.el.style.display = "block";
}
function rpOpen() { var it = rpItem(); if (!it) return false; RP.it = it; RP.open = true; var cur = rtGet(it); RP.sel = cur ? RATE_VALS.indexOf(cur) : 1; rpRender(); return true; }
function rpClose() { RP.open = false; if (RP.el) RP.el.style.display = "none"; }
function rpKey(k) {
  if (k === "back" || k === "green") { rpClose(); return; }
  if (k === "left") RP.sel = Math.max(0, RP.sel - 1);
  else if (k === "right") RP.sel = Math.min(2, RP.sel + 1);
  else if (k === "enter") { var nv = rtSet(RP.it, RATE_VALS[RP.sel]); toastSafe(rateMsg(nv)); rpClose(); return; }
  rpRender();
}
window.addEventListener("keydown", function (e) {
  try {
    if (!P.open) { if (RP.open) rpClose(); return; }
    var c = e.keyCode || e.which, k = c === 404 ? "green" : keyName(e);
    if (RP.open) { if (k) { e.preventDefault(); e.stopImmediatePropagation(); rpKey(k); } return; }
    if (typeof AU !== "undefined" && AU.open) return;
    if ((k === "green" || (k === "down" && P.vod && !(typeof SC !== "undefined" && SC.on))) && rpItem()) { e.preventDefault(); e.stopImmediatePropagation(); rpOpen(); }
  } catch (er) {}
}, true);
(function () { try { if (window.tizen && tizen.tvinputdevice) tizen.tvinputdevice.registerKey("ColorF1Green"); } catch (e) {} })();
/* scrubbing (left/right) must not steal keys while the panel is open; neither may the Audio menu */
if (typeof scCan === "function") { var _scCan414 = scCan; scCan = function () { return !RP.open && _scCan414.apply(this, arguments); }; }
if (typeof auOpen === "function") { var _auOpen414 = auOpen; auOpen = function () { if (RP.open) return; return _auOpen414.apply(this, arguments); }; }
var _rpClose414 = closePlayer;
closePlayer = function () { rpClose(); return _rpClose414.apply(this, arguments); };
var _rpHint414 = hintText;
hintText = function () { var h = _rpHint414(); return P.vod ? h.replace("BACK  exit", "\u25BC  rate      BACK  exit") : h; };
