/* ================= NickFlix 4.13 — audio language (AVPlay tracks) =================
   - On playback start the profile's preferred audio language (default English) is selected automatically,
     unless this title has a remembered choice.
   - In the player: YELLOW (or UP on movies/episodes) opens the Audio menu; UP/DOWN pick, OK switches live, BACK closes.
   - Tracks come from webapis.avplay.getTotalTrackInfo() (type AUDIO, language in extra_info JSON),
     switched with setSelectTrack("AUDIO", index). The HTML5 <video> fallback uses video.audioTracks when present. */
var AU = { el: null, open: false, tracks: [], sel: 0, cur: -1, autoGen: -1 };
var AU_NAMES = { en: "English", fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", nl: "Dutch", sv: "Swedish",
  no: "Norwegian", da: "Danish", fi: "Finnish", pl: "Polish", ru: "Russian", uk: "Ukrainian", tr: "Turkish", ar: "Arabic", he: "Hebrew",
  hi: "Hindi", ja: "Japanese", ko: "Korean", zh: "Chinese", el: "Greek", cs: "Czech", hu: "Hungarian", ro: "Romanian", fa: "Persian",
  ur: "Urdu", pa: "Punjabi", ta: "Tamil", th: "Thai", vi: "Vietnamese", id: "Indonesian", ms: "Malay", hr: "Croatian", sr: "Serbian", bg: "Bulgarian" };
var AU_3 = { eng: "en", fre: "fr", fra: "fr", spa: "es", ger: "de", deu: "de", ita: "it", por: "pt", dut: "nl", nld: "nl", swe: "sv", nor: "no", nob: "no",
  dan: "da", fin: "fi", pol: "pl", rus: "ru", ukr: "uk", tur: "tr", ara: "ar", heb: "he", hin: "hi", jpn: "ja", kor: "ko", chi: "zh", zho: "zh",
  gre: "el", ell: "el", cze: "cs", ces: "cs", hun: "hu", rum: "ro", ron: "ro", per: "fa", fas: "fa", urd: "ur", pan: "pa", tam: "ta", tha: "th",
  vie: "vi", ind: "id", may: "ms", msa: "ms", hrv: "hr", srp: "sr", bul: "bg" };
var AU_WORDS = { english: "en", french: "fr", "fran\u00e7ais": "fr", francais: "fr", spanish: "es", "espa\u00f1ol": "es", german: "de", deutsch: "de", italian: "it" };
function auNorm(l) {
  l = String(l || "").toLowerCase().replace(/[_].*$/, "").trim(); if (!l || l === "und" || l === "unknown") return "";
  if (AU_WORDS[l]) return AU_WORDS[l];
  var b = l.split("-")[0]; if (AU_3[b]) return AU_3[b]; if (b.length === 2) return b; return b;
}
function auName(code, raw) { return code ? (AU_NAMES[code] || code.toUpperCase()) : (raw ? String(raw) : "Unknown"); }
function auPref() { try { return (PD && PD.alang) || "en"; } catch (e) { return "en"; } }
function auKey() { try { if (!P.item) return ""; return P.ep && P.ep.id ? "e" + P.ep.id : (P.vod ? "m" : "l") + P.item.id; } catch (e) { return ""; } }
function auMem(k, v) { try { if (!PD) return null; PD.atr = PD.atr || {}; if (v === undefined) return PD.atr[k] || null; PD.atr[k] = v; var ks = Object.keys(PD.atr); if (ks.length > 300) delete PD.atr[ks[0]]; savePD(true); } catch (e) { return null; } }
/* list of audio tracks: [{index, lang, name, ch, codec}] */
function auTracks() {
  var out = [];
  try {
    if (P.useAV && avOK()) {
      var all = webapis.avplay.getTotalTrackInfo() || [];
      for (var i = 0; i < all.length; i++) {
        var t = all[i]; if (String(t.type).toUpperCase() !== "AUDIO") continue;
        var x = {}; try { x = typeof t.extra_info === "string" ? JSON.parse(t.extra_info) : (t.extra_info || {}); } catch (e1) { x = {}; }
        var raw = x.language || x.lang || x.track_lang || "", code = auNorm(raw);
        out.push({ index: Number(t.index), lang: code, name: auName(code, raw), ch: x.channels || "", codec: x.fourCC || x.codec || "" });
      }
    } else {
      var v = $("video"), at = v && v.audioTracks;
      if (at) for (var j = 0; j < at.length; j++) { var c2 = auNorm(at[j].language); out.push({ index: j, lang: c2, name: auName(c2, at[j].label || at[j].language), ch: "", codec: "", html: true }); }
    }
  } catch (e) {}
  return out;
}
function auCurrent(tr) {
  try {
    if (P.useAV && avOK() && webapis.avplay.getCurrentStreamInfo) {
      var cs = webapis.avplay.getCurrentStreamInfo() || [];
      for (var i = 0; i < cs.length; i++) if (String(cs[i].type).toUpperCase() === "AUDIO") return Number(cs[i].index);
    } else if (!P.useAV) { var at = $("video").audioTracks; if (at) for (var j = 0; j < at.length; j++) if (at[j].enabled) return j; }
  } catch (e) {}
  return AU.cur >= 0 ? AU.cur : (tr && tr[0] ? tr[0].index : -1);
}
function auSelect(t) {
  try {
    if (t.html) { var at = $("video").audioTracks; for (var j = 0; j < at.length; j++) at[j].enabled = (j === t.index); }
    else webapis.avplay.setSelectTrack("AUDIO", t.index);
    AU.cur = t.index; try { pdiag("audio", t.name + " #" + t.index); } catch (e2) {}
    return true;
  } catch (e) { try { pdiag("audio-fail", String(e && e.name || e)); } catch (e3) {} return false; }
}
/* called right after playback starts (player.js) */
function auAuto(tries) {
  AU.cur = -1; var gen = PB.gen; tries = tries || 0;
  var tr = auTracks();
  if (!tr.length) { if (tries < 4) setTimeout(function () { if (gen === PB.gen && P.open) auAuto(tries + 1); }, 1500); return; }
  if (tr.length < 2) return;
  var want = auMem(auKey()) || auPref(), cur = auCurrent(tr), hit = null;
  for (var i = 0; i < tr.length; i++) if (tr[i].lang === want) { hit = tr[i]; break; }
  if (!hit) { if (tries === 0) toastSafe(tr.length + " audio tracks \u2013 press YELLOW (or \u25B2) for Audio"); return; }
  if (hit.index === cur) { AU.cur = cur; return; }
  if (auSelect(hit)) toastSafe("Audio: " + hit.name);
}
function auUI() {
  if (AU.el) return AU.el;
  var st = document.createElement("style");
  st.textContent = "#nf-audio{position:fixed;right:90px;bottom:200px;z-index:99995;min-width:460px;max-height:640px;overflow:hidden;background:rgba(20,20,20,.94);border:2px solid rgba(255,255,255,.25);border-radius:14px;padding:22px 0;display:none;font-family:sans-serif;color:#fff}" +
    "#nf-audio .au-h{font:800 34px/1.2 sans-serif;padding:0 30px 14px}#nf-audio .au-i{font:500 30px/1.3 sans-serif;padding:12px 30px;color:#ccc}" +
    "#nf-audio .au-i.f{background:#fff;color:#000}#nf-audio .au-i .au-s{font-size:22px;color:#999;margin-left:12px}#nf-audio .au-i.f .au-s{color:#444}#nf-audio .au-n{font:400 22px/1.3 sans-serif;color:#aaa;padding:14px 30px 0}";
  document.head.appendChild(st);
  AU.el = document.createElement("div"); AU.el.id = "nf-audio"; document.body.appendChild(AU.el);
  return AU.el;
}
function auRender() {
  var el = auUI(), h = "<div class='au-h'>Audio</div>";
  if (!AU.tracks.length) h += "<div class='au-n'>This stream reports no selectable audio tracks.</div>";
  for (var i = 0; i < AU.tracks.length; i++) {
    var t = AU.tracks[i], on = t.index === AU.cur;
    h += "<div class='au-i" + (i === AU.sel ? " f" : "") + "'>" + (on ? "\u2713 " : "\u2003 ") + t.name.replace(/[<>&]/g, "") +
      "<span class='au-s'>" + [t.codec, t.ch ? t.ch + "ch" : ""].filter(Boolean).join(" ").replace(/[<>&]/g, "") + "</span></div>";
  }
  if (AU.tracks.length) h += "<div class='au-n'>Preferred language: " + auName(auPref()) + "</div>";
  el.innerHTML = h; el.style.display = "block";
}
function auOpen() {
  AU.tracks = auTracks(); AU.cur = auCurrent(AU.tracks); AU.sel = 0;
  for (var i = 0; i < AU.tracks.length; i++) if (AU.tracks[i].index === AU.cur) AU.sel = i;
  AU.open = true; auRender();
}
function auClose() { AU.open = false; if (AU.el) AU.el.style.display = "none"; }
function auKeyMenu(k) {
  if (k === "back") { auClose(); return; }
  if (k === "up") AU.sel = Math.max(0, AU.sel - 1);
  else if (k === "down") AU.sel = Math.min(AU.tracks.length - 1, AU.sel + 1);
  else if (k === "enter") {
    var t = AU.tracks[AU.sel];
    if (t && auSelect(t)) { auMem(auKey(), t.lang || null); if (t.lang) { try { PD.alang = t.lang; savePD(true); } catch (e) {} } toastSafe("Audio: " + t.name); }
    auClose(); return;
  }
  auRender();
}
/* window capture phase runs before the document key handlers (player, scrubbing) */
window.addEventListener("keydown", function (e) {
  try {
    if (!P.open) { if (AU.open) auClose(); return; }
    var c = e.keyCode || e.which, k = c === 405 ? "yellow" : keyName(e);
    if (AU.open) { if (k) { e.preventDefault(); e.stopImmediatePropagation(); auKeyMenu(k); } return; }
    if (k === "yellow" || (k === "up" && P.vod && !(typeof SC !== "undefined" && SC.on))) { e.preventDefault(); e.stopImmediatePropagation(); auOpen(); }
  } catch (er) {}
}, true);
(function () { try { if (window.tizen && tizen.tvinputdevice) tizen.tvinputdevice.registerKey("ColorF2Yellow"); } catch (e) {} })();
var _auClose413 = closePlayer;
closePlayer = function () { auClose(); return _auClose413.apply(this, arguments); };
var _auHint413 = hintText;
hintText = function () { var h = _auHint413(); return P.vod ? h.replace("BACK  exit", "\u25B2  audio      BACK  exit") : h.replace("BACK  exit", "YELLOW  audio      BACK  exit"); };
