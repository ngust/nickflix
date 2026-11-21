/* NickFlix v4.12 - profile backup to the NAS (nfproxy on wcp-nas01, /backup/profiles).
   The TV's localStorage stays the primary copy. Every save of user state (nf_profiles, nf_p_<id> with watch
   history / My List / positions / learning / favourites / avatars, plus app settings) schedules a debounced copy
   to the NAS; a periodic check copies anything the debounce missed. If the proxy is unreachable nothing breaks:
   the copy fails silently and is retried later.
   On start-up, if this TV holds only the single default profile (e.g. after a firmware update wiped app data)
   and the NAS has a real backup, everything is restored automatically and the app reloads.
   A fresh default state is marked "default" and never replaces a real backup (the proxy enforces this too). */
"use strict";
var BK_KEY = /^nf_(profiles|p_[A-Za-z0-9_]+|st_cat|intro|mini|mini_live|proxy|play|okfmt|fmtstat|nasseen|nas_base)$/;
var BK_QUIET = /^nf_(fmtstat|okfmt|nasseen)$/;          // copied, but do not trigger a copy on their own
var BK = { t: null, busy: false, debounce: 30000, every: 10 * 60000, remote: null, url: "" };
function bkMeta() { return lsGet("nf_bk_meta", null) || {}; }
function bkSetMeta(m) { var o = bkMeta(); for (var k in m) o[k] = m[k]; try { localStorage.setItem("nf_bk_meta", JSON.stringify(o)); } catch (e) {} return o; }
function bkUrls() {
  var L = [];
  try { L = ((window.NF_CONFIG && NF_CONFIG.backupUrls) || (window.NF_CONFIG && NF_CONFIG.proxyUrls) || []).filter(function (u) { return /^https?:\/\//.test(u); }); } catch (e) {}
  var last = bkMeta().url;
  if (last && L.indexOf(last) > 0) { L = L.slice(); L.splice(L.indexOf(last), 1); L.unshift(last); }
  return L;
}
function bkCollect() {
  var keys = {};
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (BK_KEY.test(k)) keys[k] = localStorage.getItem(k); } } catch (e) {}
  return keys;
}
/* how much real user data a key set holds (same rule as nfproxy.py bk_info) */
function bkInfo(keys) {
  var pr = null; try { pr = JSON.parse(keys.nf_profiles || "null"); } catch (e) {}
  var list = (pr && pr.list) || [], content = 0, names = [];
  list.forEach(function (p) { names.push(p.name); });
  Object.keys(keys).forEach(function (k) {
    if (k.indexOf("nf_p_") !== 0) return;
    var d = null; try { d = JSON.parse(keys[k]); } catch (e) {}
    if (!d) return;
    content += (d.hist || []).length + (d.wl || []).length + (d.list || []).length + Object.keys(d.pos || {}).length + ((d.stats && d.stats.sec > 0) ? 1 : 0) + Object.keys(d.rt || {}).length;   // 4.14: ratings count, the taste seed (tp) does not
  });
  var score = content + 5 * Math.max(0, list.length - 1);
  return { profiles: list.length, names: names, score: score, def: list.length <= 1 && content === 0 };
}
function bkHash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + s.length; }
function bkXhr(method, url, body, timeout, cb) {
  try {
    var x = new XMLHttpRequest(); x.open(method, url, true); x.timeout = timeout || 6000;
    if (body != null) x.setRequestHeader("Content-Type", "text/plain");   // simple request: no CORS preflight
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) {} cb(x.status, j); };
    x.onerror = function () { cb(0, null); }; x.ontimeout = function () { cb(0, null); };
    x.send(body == null ? null : body);
  } catch (e) { cb(0, null); }
}
/* try each NAS address in turn; cb(status, json, url) */
function bkReq(method, path, body, cb) {
  var L = bkUrls(), i = 0;
  if (!L.length) { cb(-1, null, ""); return; }
  (function next() {
    var u = L[i++];
    bkXhr(method, u.replace(/\/+$/, "") + path, body, 6000, function (st, j) {
      if (st === 0 && i < L.length) { next(); return; }
      if (st !== 0) BK.url = u;
      cb(st, j, u);
    });
  })();
}
function bkHost(u) { return String(u || "").replace(/^https?:\/\//, "").replace(/:\d+$/, ""); }
/* ---- 4.12b: second copy on the TV itself, outside the app's own storage (Tizen shared "documents" folder,
   "downloads" if documents is missing): <root>/NickFlix/nf_backup.json + one previous copy nf_backup.prev.json.
   App storage can be wiped by a firmware update; shared user storage normally is not. */
var BKF = { roots: ["documents", "downloads"], dir: "NickFlix", name: "nf_backup.json", prev: "nf_backup.prev.json", perm: null };
function bkFs() { try { return (window.tizen && tizen.filesystem && tizen.filesystem.openFile) ? tizen.filesystem : null; } catch (e) { return null; } }
function bkFilePerm(cb) {
  if (BKF.perm !== null) { cb(BKF.perm); return; }
  var done = function (v) { BKF.perm = v; cb(v); };
  try {
    if (!(window.tizen && tizen.ppm)) { done(true); return; }
    var pv = "http://tizen.org/privilege/mediastorage", st = tizen.ppm.checkPermission(pv);
    if (st === "PPM_ALLOW") { done(true); return; }
    if (st === "PPM_DENY") { done(false); return; }
    tizen.ppm.requestPermission(pv, function (r) { done(r === "PPM_ALLOW_FOREVER" || r === "PPM_ALLOW_ONCE"); }, function () { done(true); });
  } catch (e) { done(true); }   // TV firmwares without ppm for this privilege: just try the write
}
function bkFileRead(root) {
  var fs = bkFs(); if (!fs) return null;
  var path = root + "/" + BKF.dir + "/" + BKF.name;
  try { if (fs.pathExists && !fs.pathExists(path)) return null; var fh = fs.openFile(path, "r"); var t = fh.readString(); fh.close(); var j = JSON.parse(t); return j && j.keys ? j : null; } catch (e) { return null; }
}
/* newest readable TV-file copy over all roots */
function bkFileLoad() { var best = null; BKF.roots.forEach(function (r) { var j = bkFileRead(r); if (j && (!best || (j.ts || 0) > (best.ts || 0))) { j._root = r; best = j; } }); return best; }
function bkFileSave(keys, info, cb) {
  cb = cb || function () {};
  var fs = bkFs();
  if (!fs) { bkSetMeta({ fErr: "TV file storage not available", fTried: Date.now() }); cb(false); return; }
  var old = bkFileLoad();
  if (info.def && old && !(old.default || bkInfo(old.keys).def)) { bkSetMeta({ fErr: "Kept the TV file (it has more than the app)", fTried: Date.now(), fRoot: old._root, fTs: old.ts }); cb(false); return; }
  var payload = { v: 1, app: "4.12", ts: Date.now(), default: info.def, profiles: info.profiles, names: info.names, score: info.score, keys: keys };
  payload.meta = { ts: payload.ts, default: info.def, profiles: info.profiles, names: info.names, score: info.score, where: "tv-file" };
  var txt = JSON.stringify(payload), i = 0;
  bkFilePerm(function () {
    (function tryRoot() {
      if (i >= BKF.roots.length) { cb(false); return; }
      var root = BKF.roots[i++], dir = root + "/" + BKF.dir, path = dir + "/" + BKF.name, prev = dir + "/" + BKF.prev;
      var write = function () {
        try {
          try { if (fs.pathExists(path)) { var a = fs.openFile(path, "r"), t = a.readString(); a.close(); var b = fs.openFile(prev, "w"); b.writeString(t); b.close(); } } catch (e0) {}
          var fh = fs.openFile(path, "w"); fh.writeString(txt); fh.close();
          var chk = bkFileRead(root);
          if (!chk || chk.ts !== payload.ts) throw new Error("verify");
          bkSetMeta({ fOk: 1, fTs: payload.ts, fRoot: root, fPath: path, fErr: "", fTried: Date.now(), fDef: info.def });
          cb(true);
        } catch (e) { bkSetMeta({ fErr: "TV file write failed (" + root + ": " + ((e && e.name) || e) + ")", fTried: Date.now() }); tryRoot(); }
      };
      try {
        if (fs.pathExists(dir)) write();
        else fs.createDirectory(dir, true, write, function (e) { bkSetMeta({ fErr: "TV folder failed (" + root + ": " + ((e && e.name) || e) + ")", fTried: Date.now() }); tryRoot(); });
      } catch (e) { bkSetMeta({ fErr: "TV folder failed (" + root + ": " + ((e && e.name) || e) + ")", fTried: Date.now() }); tryRoot(); }
    })();
  });
}
/* copy this TV's state to the NAS now. force=true only skips the "fewer profiles than the NAS copy" guard
   (never the default-over-real guard). cb(ok, msg) */
function bkUpload(force, cb) {
  cb = cb || function () {};
  if (BK.busy) { cb(false, "busy"); return; }
  var keys = bkCollect(), info = bkInfo(keys), body = JSON.stringify(keys), h = bkHash(body), m = bkMeta();
  if (!keys.nf_profiles) { cb(false, "nothing to back up"); return; }
  BK.busy = true;
  var fdone = false, go = function () { if (fdone) return; fdone = true; bkNas(force, keys, info, h, cb); };
  try { bkFileSave(keys, info, function (ok) { if (ok) bkSetMeta({ fHash: h }); go(); }); } catch (e) { go(); }
  setTimeout(go, 4000);
}
function bkNas(force, keys, info, h, cb) {
  var fm = bkMeta();
  var payload = JSON.stringify({ v: 1, app: "4.12", ts: Date.now(), default: info.def, profiles: info.profiles, score: info.score, keys: keys,
    tvfile: { ok: !!fm.fOk, ts: fm.fTs || 0, path: fm.fPath || "", err: fm.fErr || "", api: !!bkFs() } });
  bkReq("POST", "/backup/profiles" + (force ? "?force=1" : ""), payload, function (st, j, u) {
    BK.busy = false;
    if (st === 200 && j && j.ok) {
      var mm = j.meta || {};
      bkSetMeta({ ok: 1, ts: mm.ts || Date.now(), tried: Date.now(), hash: h, url: u, profiles: mm.profiles, names: mm.names || info.names, def: !!mm.default, file: mm.file || "", err: "" });
      BK.remote = mm; cb(true, j.unchanged ? "unchanged" : "saved"); return;
    }
    if (st === 409) {
      var why = (j && j.reason) || "conflict";
      bkSetMeta({ tried: Date.now(), hash: h, url: u, err: why === "default_over_real" ? "Kept the NAS copy (it has more than this TV)" : "NAS copy has more profiles \u2013 press Back up now to replace it" });
      if (j && j.latest) BK.remote = j.latest;
      cb(false, why); return;
    }
    bkSetMeta({ tried: Date.now(), err: st === -1 ? "No NAS address in config" : st === 0 ? "NAS not reachable \u2013 will retry" : "NAS error " + st });
    cb(false, "unreachable");
  });
}
/* copy only if something changed since the last good copy (or last refused attempt) */
function bkMaybe() {
  try {
    if (typeof P !== "undefined" && P.open) { bkSoon(60000); return; }    // never while something is playing
    var keys = bkCollect(); if (!keys.nf_profiles) return;
    var h = bkHash(JSON.stringify(keys)), m = bkMeta();
    if (m.hash === h && (m.fHash === h || !bkFs() || Date.now() - (m.fTried || 0) < 6 * 3600000) && (m.ok || Date.now() - (m.tried || 0) < 6 * 3600000)) return;
    bkUpload(false, function (ok, why) { if (!ok && why === "unreachable") bkSoon(5 * 60000); });
  } catch (e) {}
}
function bkSoon(ms) { clearTimeout(BK.t); BK.t = setTimeout(bkMaybe, ms || BK.debounce); }
function bkTouch(k) { if (BK_KEY.test(k) && !BK_QUIET.test(k)) bkSoon(); }
/* hook every lsSet (profiles, profile data, settings) */
(function () {
  var orig = lsSet;
  lsSet = function (k, v) { var r = orig(k, v); try { bkTouch(k); } catch (e) {} return r; };
})();
function bkFetch(cb) { bkReq("GET", "/backup/profiles", null, function (st, j, u) { if (st === 200 && j && j.keys) { BK.remote = j.meta || null; cb(j, u); } else { if (st === 404) BK.remote = { none: true }; cb(null, u, st); } }); }
/* replace this TV's user state with a backup and reload */
function bkApply(bk) {
  var keys = bk.keys || {}, n = 0;
  try { localStorage.setItem("nf_bk_prev", JSON.stringify({ ts: Date.now(), keys: bkCollect() })); } catch (e) {}
  try {
    var drop = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^nf_p_/.test(k) && !(k in keys)) drop.push(k); }
    drop.forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(keys).forEach(function (k) { if (BK_KEY.test(k) && typeof keys[k] === "string") { localStorage.setItem(k, keys[k]); n++; } });
  } catch (e) { return 0; }
  var h = bkHash(JSON.stringify(bkCollect()));
  var ri = bkInfo(keys);
  bkSetMeta({ restored: Date.now(), restoredFrom: (bk.meta && bk.meta.ts) || 0, hash: "", ok: 0, err: "", profiles: ri.profiles, def: ri.def });   // hash "" -> next check copies the restored state to both places
  return n;
}
function bkRestore(cb) {
  bkFetch(function (bk, u, st) {
    if (!bk) { cb(false, st === 404 ? "No backup on the NAS yet" : "NAS not reachable"); return; }
    var info = bkInfo(bk.keys);
    if (info.def || (bk.meta && bk.meta.default)) { cb(false, "The NAS backup only has a default profile"); return; }
    var n = bkApply(bk);
    if (!n) { cb(false, "Could not write to this TV's storage"); return; }
    cb(true, "Restored " + info.profiles + " profile" + (info.profiles === 1 ? "" : "s") + " (" + info.names.join(", ") + ")");
  });
}
function bkRestoreFile(cb) {
  var f = null; try { f = bkFileLoad(); } catch (e) {}
  if (!f) { cb(false, "No backup file on this TV yet"); return; }
  var info = bkInfo(f.keys);
  if (info.def || f.default) { cb(false, "The TV file only has a default profile"); return; }
  if (!f.meta) f.meta = { ts: f.ts };
  if (!bkApply(f)) { cb(false, "Could not write to this TV's storage"); return; }
  cb(true, "Restored " + info.profiles + " profile" + (info.profiles === 1 ? "" : "s") + " (" + info.names.join(", ") + ")");
}
/* start-up: auto-restore after a wipe, then the periodic copy */
function bkBoot() {
  var m = bkMeta(), local = bkInfo(bkCollect());
  if (local.def && !(m.autoTry && Date.now() - m.autoTry < 10 * 60000)) {
    // restore order: app storage (already default here) -> TV file -> NAS; the newest real copy wins
    var tvf = null; try { tvf = bkFileLoad(); } catch (e) {}
    if (tvf && (tvf.default || bkInfo(tvf.keys).def)) tvf = null;
    bkFetch(function (bk) {
      if (bk && (bkInfo(bk.keys).def || (bk.meta && bk.meta.default))) bk = null;
      var pick = tvf, from = "the TV backup file";
      if (bk && (!pick || ((bk.meta && bk.meta.ts) || 0) > (pick.ts || 0))) { pick = bk; from = "the NAS backup"; }
      if (!pick) return;
      if (!bkInfo(bkCollect()).def) return;                 // someone started using the TV meanwhile - leave it
      bkSetMeta({ autoTry: Date.now(), restoredWhere: from });
      if (!pick.meta) pick.meta = { ts: pick.ts };
      var info = bkInfo(pick.keys);
      if (bkApply(pick)) {
        try { toast("Restored " + info.profiles + " profiles from " + from, 4000); } catch (e) {}
        setTimeout(function () { location.reload(); }, 1800);
      }
    });
  }
  setTimeout(bkMaybe, 45000);
  setInterval(bkMaybe, BK.every);
}
function bkFileText() {
  var m = bkMeta();
  if (!bkFs()) return "TV file: not available on this TV";
  var s = m.fOk && m.fTs ? "TV file: " + fmtWhen(m.fTs) + (m.fDef ? " (default only)" : "") + "  \u00b7  " + (m.fPath || "") : "TV file: none yet";
  if (m.fErr) s += "  \u00b7  " + m.fErr;
  return s;
}
function bkStatusText() {
  var m = bkMeta();
  if (!bkUrls().length) return "No NAS address set up (proxyUrls in config.js)";
  var s = m.ok && m.ts ? "NAS: " + fmtWhen(m.ts) + (m.profiles ? "  \u00b7  " + m.profiles + " profile" + (m.profiles === 1 ? "" : "s") + (m.def ? " (default only)" : "") : "") + (m.url ? "  \u00b7  " + bkHost(m.url) : "") : "NAS: none yet";
  if (m.err) s += "  \u00b7  " + m.err;
  return s;
}
function bkRemoteText() {
  var r = BK.remote;
  if (!r) return "Checking the NAS\u2026";
  if (r.none) return "No backup on the NAS yet";
  return "NAS copy: " + fmtWhen(r.ts) + "  \u00b7  " + (r.names || []).join(", ") + (r.default ? " (default only)" : "");
}
try { bkBoot(); } catch (e) {}
