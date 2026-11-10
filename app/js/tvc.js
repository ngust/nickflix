/* NickFlix v4.1 - British / American (and Canadian) TV sorted by real content category.
   Every channel is classified on its own: country (group code + name tags, foreign feeds removed),
   linear channel vs event slot vs 24/7 feed, and content type from brand dictionaries. */
"use strict";
var TVC = { src: null, by: {}, list: {} };
var TVC_SUP = /[\u1D00-\u1DBF\u02B0-\u02FF\u2070-\u209F\u24B6-\u24FF\u2780-\u27BF]+/g;
function tvcClean(n) {
  var s = String(n || "").toUpperCase().replace(TVC_SUP, " ").replace(/[\u2580-\u259F\u2726\u2605\u2606\u25CF]+/g, " ");
  s = s.replace(/\((S|D|F|ALT)\)/g, " ").replace(/\[(ONLY ON[^\]]*|ALT|BACKUP|EVENT ONLY|SLING)\]/g, " ");
  s = s.replace(/^\s*(?:HD|SD|FHD|UHD)?\s*[|:]\s*/, "").replace(/^\s*(?:UK|US|USA|GB)\s*[:|\-]\s*/, "").replace(/^\s*(?:UK|US|USA)\s+(?=[A-Z])/, "");
  s = s.replace(/\b(?:FHD|UHD|HD|SD|4K|8K|HEVC|H\.?265|50 ?FPS|60 ?FPS|FPS|RAW|BACKUP|1080P?|720P?|VIP|ULTRA)\b/g, " ");
  s = s.replace(/\s+(?:UK|US|USA|GB)\s*$/, "").replace(/\s+/g, " ").trim();
  return s;
}
function tvcBase(s) { return s.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\b(EAST|WEST|PACIFIC)\b/g, " ").replace(/\s*\+1$/, " ").replace(/[^A-Z0-9&!+ ]/g, " ").replace(/\s+/g, " ").trim(); }

/* foreign / non-national content mixed into UK and US groups */
var TVC_FOREIGN_GROUP = {
  UK: /ASIA|^BEIN|SERIE A|LA LIGA|LIGUE 1|HUB SPORTS|HUB PREMIER|CRICKET LIVE|BEIN|VIDIO|MONOMAX|DREAM 4K|^IRELAND|BUNDESLIGA|LIGA SERIES|NRL|WC 2026|OXING/,
  US: /HAITI|DOMINICAN|LATINO|SLING ASIAN|SLING INTERNATIONAL|NOW HK|VIX|SAUDI|LIGUE|AFL|PREMIERSHIP RUGBY|EPC RUGBY|SUPER LEAGUE|WORLD FOOTBALL|TOP MOVIES 250|EXTRA EVENTS|BEST ACTORS|EUROPA|BEIN/,
  CA: /^$/
};
var TVC_FOREIGN_NAME = /\[(BR|MX|PL|DE|ES|PT|AR|CO|IN|PK|FR|IT|TR|NL|LAT|LATAM|CL|PE)\]|\b(ESPA[NÑ]OL|SPANISH|LATINO|LATINA|DEPORTES|TELEMUNDO|UNIVISION|UNIMAS|AZTECA|GALAVISION|TUDN|VIX|CINE|CUBA|ECUAVISA|MULTIMEDIOS|PASIONES|ESTRELLA|TELEFE|MENA|UTSAV|ZEE|COLORS|AKAAL|ISLAM CHANNEL|PTV|GEO|ARY|DAWN NEWS|OPTUS|ASTRO|INDONESIA|POLSAT|GLOBO|RAKUTEN|SETANTA|MOLA|PREMIERE \d|RTE|TG4|VIRGIN MEDIA|STAR GOLD|STAR PLUS|SONY MAX|SONY SAB|HUM|BRITASIA|B4U|PREMIERE|DEUTSCH|ARABIA|CABLENET|SAUDI|TV18|NEWS 18|DINAMITA|CONCURSOS|DICHO|AMOR REAL|NOVELAS?|TELENOVELAS?)\b|\[ESP\]|PEL[IÍ]CULAS|CR[IÍ]MENES|AQU[IÍ] Y|\s(TR|DE|FR|IT|ES|PT|BR|AR|NL|PL)$/;
/* event slots (a numbered feed that carries whatever game is on) */
var TVC_SLOT = /NO (SCHEDULED )?EVENT|EVENTS? ONLY|\bEVENT\b|\sVS?\.?\s|\s@\s|\d{4}-\d\d-\d\d|START:|REPLAY|^\s*[:|]|[:|]\s*$|GAME PASS|STREAM \d|\bFEED\b|\bINFO\b|^\d+\s*-|^4K\s*-|\bPPV\b|^PSF ?\d|^(L1|L2|CHAMP|SPFL|UEFA|ECB|PDC|TC\+|MLS LIVE|NRL TV|NCAAF?B?W?|ESPN\+|SEC\+|BTN\+|DAZN UK|D\+ UK|HBO UK|P\+ US|PRIME US|PRIME-|FLO|FLOWSPORTS|FLOSPORTS|MILB|WNBA|LIVE FOOTBALL|LIVE EVENT|NATIONAL LEAGUE|SCOTTISH (CUP|PREM)|PARAMOUNT\+ \d|GALLAGHER|EPC RUGBY|FITE TV|PAY PER VIEW|SLING PPV|MLB GAME|MLB \d|NBA \d|NHL \d|NFL GAME|BOXING|UFC \d|DAZN \d|SKY SPORT\+ ?\d|PREMIER LEAGUE\+|HBOMAX ORIGINAL|NFL NOW)|:\s*(NBA|NHL|ESPN\+|SEC\+|MAX US|NCAAB|MILB|FLO|PEACOCK|VICTORY|FOX ONE|DISNEY\+|PARAMOUNT\+|VIX|TENNIS|SKY SPORTS UK|NBC SPORTS)\b/;
var TVC_TEAM_GROUP = /NFL TEAMS?|NHL TEAMS?|NBA TEAMS?|MLB TEAMS?|^MLB$|EPL PREMIER LEAGUE|LEAGUE ONE|LEAGUE TWO/;

/* brand dictionaries: [regex on cleaned name, sub-category, popularity rank (lower = more popular)] */
function B(re, sub, rank, net) { return { re: re, sub: sub, rank: rank, net: net || "" }; }
var TVC_BRANDS = {
  UK: [
    B(/^SKY SPORTS (MAIN EVENT|PREMIER LEAGUE)$/, "Sports", 1), B(/^SKY SPORTS (FOOTBALL|F1|CRICKET|GOLF|ACTION|ARENA|MIX|RACING|TENNIS|NFL|NBA|PLUS|\+)$/, "Sports", 3), B(/^SKY SPORTS NEWS$/, "Sports", 4),
    B(/^TNT SPORTS ?[1-4]$|^TNT SPORTS ULTIMATE/, "Sports", 2), B(/^TNT SPORTS/, "Sports", 6), B(/^(SKY SPORTS|SKY GOLF)\b/, "Sports", 7), B(/^PREMIER SPORTS ?\d?/, "Sports", 8), B(/^EUROSPORTS? ?\d?$/, "Sports", 9),
    B(/^(LFC|LFC TV|MUTV|CHELSEA TV|RACING TV|RACING|SKY BOX OFFICE.*|BOX NATION|FREE ?SPORTS|VIAPLAY SPORTS.*|UK LACROSSE TV|PREMIER LEAGUE TV|BT SPORT.*|ITV RACING)$/, "Sports", 12),
    B(/^BBC NEWS$|^BBC ONE NEWS$/, "News", 1), B(/^SKY NEWS$/, "News", 1), B(/^GB NEWS$/, "News", 2), B(/^(TALK ?TV|TIMES RADIO|LBC|BBC PARLIAMENT|BBC WORLD NEWS)$/, "News", 4), B(/^(CNN|CNN INTERNATIONAL|BLOOMBERG( NEWS)?|EURONEWS|AL ?JAZEERA( NEWS)?( ENGLISH)?|CNBC|FRANCE 24.*|DW|SKY NEWS ARABIA)$/, "News", 8),
    B(/^BBC (ONE|1|TWO|2|THREE|3|FOUR|4)$|^BBC 1 HD$/, "Entertainment", 1, "BBC"), B(/^ITV ?1?$|^ITV ?[2-4]$|^ITVBE$|^ITV QUIZ$/, "Entertainment", 1, "ITV"), B(/^(CHANNEL 4|E4|E4 EXTRA|MORE ?4|4 ?SEVEN)$/, "Entertainment", 2, "Channel 4"),
    B(/^(CHANNEL 5|5 ?STAR|5 ?USA|5 ?SELECT)$/, "Entertainment", 3, "Channel 5"), B(/^SKY (ONE|SHOWCASE|ATLANTIC|MAX|WITNESS|COMEDY|REPLAY|CRIME|DRAMA|ARTS|MIX|SCI-?FI)$/, "Entertainment", 2, "Sky"),
    B(/^(DAVE|U ?& ?DAVE|GOLD|U ?& ?GOLD|ALIBI|U ?& ?ALIBI|W|U ?& ?W|DRAMA|U ?& ?DRAMA|COMEDY ?CENTRAL|COMEDY ?XTRA|PICK|CHALLENGE|SONY CHANNEL|TOGETHER|GREAT! ?TV|BLAZE|U ?& ?EDEN|EDEN|S4C|STV|UTV|VIRGIN ?(ONE|1|2|TWO)|LOCAL TV|TRUE CRIME|CBS REALITY|LEGEND XTRA|HORROR XTRA|SONY ACTION|E!|PARAMOUNT NETWORK|5 ?ACTION)$/, "Entertainment", 5),
    B(/^SKY (CINEMA|MOVIES) /, "Movies", 1, "Sky"), B(/^(FILM ?4|GREAT! ?MOVIES.*|TALKING PICTURES( TV)?|SONY MOVIES.*|LEGEND|MOVIES 24|TCM|HORROR CHANNEL|5ACTION|CINEMA (PREMIERE|ANIMATION)|SKY CINEMA|SKY MOVIES)$/, "Movies", 4),
    B(/^(CBBC|CBEEBIES|CITV|SKY KIDS|NICKELODEON|NICK ?JR|NICKTOONS|CARTOON ?NETWORK|CARTOONITO|BOOMERANG|DISNEY( CHANNEL| JR| JUNIOR| XD)?|POP|POP MAX|TINY ?POP|BABY ?TV|RTE JUNIOR)$/, "Kids", 3),
    B(/^(DISCOVERY( CHANNEL)?|DISCOVERY (SCIENCE|HISTORY|TURBO)|ANIMAL PLA?NE?T|NAT ?GEO( WILD)?|NATIONAL GEOGRAPHIC( WILD)?|HISTORY|HISTORY ?2|H2|SKY HISTORY|SKY DOCUMENTARIES|SKY NATURE|QUEST|QUEST RED|YESTERDAY|U ?& ?YESTERDAY|D ?MAX|INVESTIGATION DISCOVERY|ID|CRIME ?(\+|AND) ?INVESTIGATION|LOVE NATURE|PBS AMERICA|SMITHSONIAN|H&C TV|BBC EARTH|EARTHX)$/, "Documentary", 3),
    B(/^(MTV.*|NOW ?\d0'?S|NOW ROCK|BOX HITS|KISS|KERRANG|MAGIC|CAPITAL|CLUBLAND|THAT'?S (ROCK|60S|70S|80S|90S|TV|MELODY)|MUSIC CHOICE.*|VEVO.*|TRACE.*|SCUZZ|THE BOX)$/, "Music", 4),
    B(/^(FOOD NETWORK|HGTV|HOME|TLC|REALLY|QVC|IDEAL WORLD|TRAVEL CHANNEL|GOOD FOOD|FOOD XP|LIVING|HOBBYMAKER|CREATE AND CRAFT|JEWELLERY MAKER|SHOPPING QUARTER|GEMPORIA)$/, "Lifestyle", 5)
  ],
  US: [
    B(/^ESPN( USA)?$/, "Sports", 1), B(/^(ESPN ?2|FS1|FOX SPORTS 1)$/, "Sports", 2), B(/^(ESPNU|ESPN ?NEWS|FS2|FOX SPORTS 2|NFL NETWORK|NFL RED ?ZONE|NBA TV|MLB NETWORK|NHL NETWORK|GOLF CHANNEL|GOLF|TENNIS CHANNEL|CBS SPORTS( NETWORK)?|BIG TEN NETWORK|BTN|SEC NETWORK|ACC NETWORK|NBC SPORTS|USA SPORTS|NBCSN)$/, "Sports", 3),
    B(/^(ESPN 8 OCHO|ESPN COLLEGE EXTRA.*|ESPN ?(PLUS|\+)|CBS SPORTS GOLAZO( NETWORK)?|PAC-?12.*|MLB STRIKE ?ZONE|MLB BIG INNING|NFL RED ZONE.*|STADIUM|OUTDOOR CHANNEL|SPORTSMAN CHANNEL|WWE( NETWORK| USA)?|MAVTV|FIGHT NETWORK|OLYMPIC CHANNEL|BILLIARD TV|POKERGO|ACC DIGITAL NETWORK|BIG TEN NETWORK.*|OVERTIME|RACER.*|TNA WRESTLING.*|FUBO SPORTS.*|BEIN SPORTS ?(\d|XTRA)?|GOLAZO|TENNIS CHANNEL.*|NBC SPORTS NOW|MSG.*|YES NETWORK|NESN|MARQUEE.*|SNY|ALTITUDE.*|ROOT SPORTS.*|MASN.*|SPECTRUM SPORTSNET.*|FANDUEL SPORTS.*|FANDUEL TV|FANDUAL TV|BALLY SPORTS.*|NBC SPORTS .+|FOX SPORTS .+|KJZZ|SPORTSNET LA|DAZN( \d+)?|SPEED)$/, "Sports", 6),
    B(/^(CNN|FOX NEWS( CHANNEL)?|MSNBC|MS NOW)$/, "News", 1), B(/^(CNBC|FOX BUSINESS|BLOOMBERG( TV| NEWS)?|NEWSMAX|NEWS ?NATION|CBS NEWS|ABC NEWS( LIVE)?|NBC NEWS( NOW)?|HLN|C-?SPAN ?\d?|THE WEATHER CHANNEL|WEATHER CHANNEL|FOX WEATHER|CNN INTERNATIONAL|CNBC WORLD|LIVENOW( FROM FOX)?|BLAZE ?TV|OAN|NEWSY|SCRIPPS NEWS|BBC WORLD NEWS|BBC NEWS|EURONEWS|AL JAZEERA.*|ACCUWEATHER|NEWS ?12.*|SPECTRUM NEWS.*|NECN|CHEDDAR.*|COURT ?TV|LAW ?& ?CRIME)$/, "News", 4),
    B(/^(USA NETWORK|TNT|TBS|FX|FXX|A ?& ?E|BRAVO|E!|SYFY|PARAMOUNT NETWORK|COMEDY CENTRAL|TV LAND|BET|FREEFORM|TRUTV|TRU TV|OXYGEN|WE ?TV|ION( TELEVISION)?|USA)$/, "Entertainment", 2),
    B(/^(METV|ME TV|ANTENNA TV|COZI( TV)?|GET ?TV|START ?TV|REELZ|POP ?TV|LOGO|OWN|CW|THE CW|MYNETWORK ?TV|BOUNCE|GRIT|LAFF|COMET|CHARGE!?|HEROES ?& ?ICONS|DECADES|CATCHY COMEDY|TBD|BUZZR|FETV|INSP|UPTV|UP TV|AXS TV|NUVO|NEWSY|ASPIRE|CLEO TV|BET HER|TV ONE|NICK AT NITE|GAME SHOW NETWORK|GSN|SMITHSONIAN|DATELINE.*|A ?& ?E .*)$/, "Entertainment", 5),
    B(/^HBO( \d| 2| SIGNATURE| FAMILY| COMEDY| ZONE| DRAMA| HITS| EAST| WEST)?$|^HBO /, "Movies", 1), B(/^(SHOWTIME.*|STARZ.*|CINEMAX.*|MAX( EAST| WEST)?|(MORE|ACTION|MOVIE|THRILLER|5 STAR) ?MAX|MGM\+?.*|EPIX.*|THE MOVIE CHANNEL.*|TMC.*|MOVIEPLEX.*|FLIX)$/, "Movies", 2),
    B(/^(AMC|TCM|IFC|SUNDANCE ?TV|SONY MOVIE CHANNEL|LMN|HALLMARK MOVIES.*|HALLMARK (CHANNEL|FAMILY)|HALLMARK|FXM|STARZ ENCORE.*|ENCORE.*|SHORTSTV|FILMRISE.*|GREAT AMERICAN.*|MOVIESPHERE)$/, "Movies", 3),
    B(/^(DISNEY( CHANNEL)?|DISNEY ?JR\.?|DISNEY JUNIOR|DISNEY XD|NICKELODEON|NICK ?JR|NICKTOONS|TEENNICK|CARTOON NETWORK|BOOMERANG|PBS KIDS|UNIVERSAL KIDS|BABY ?TV|DISCOVERY FAMILY|NICK)$/, "Kids", 2),
    B(/^(DISCOVERY( CHANNEL)?|HISTORY( CHANNEL)?|NAT ?GEO( WILD)?|NATIONAL GEOGRAPHIC( WILD)?|ANIMAL PLANET|SCIENCE( CHANNEL)?|DISCOVERY SCIENCE|SMITHSONIAN( CHANNEL)?|INVESTIGATION DISCOVERY|ID|DESTINATION AMERICA|AHC|AMERICAN HEROES CHANNEL|HISTORY MILITARY|MILITARY HISTORY|VICE( TV)?|CURIOSITY.*|MOTOR ?TREND|DISCOVERY TURBO|CRIME ?& ?INVESTIGATION|DISCOVERY LIFE|WORLD FISHING NETWORK|MEATEATER|LOVE NATURE)$/, "Documentary", 2),
    B(/^(MTV.*|VH1.*|CMT.*|BET JAMS|BET SOUL|REVOLT|VEVO.*|MUSIC CHOICE.*|STINGRAY.*|AXS)$/, "Music", 3),
    B(/^(FOOD NETWORK|COOKING( CHANNEL)?|HGTV|TLC|TRAVEL CHANNEL|DIY( NETWORK)?|MAGNOLIA( NETWORK)?|LIFETIME|LIFETIME MOVIES|FYI|QVC.*|HSN.*|TASTEMADE|GOTRAVELER|OUTSIDE TV|DISCOVERY HOME|A WEALTH OF ENTERTAINMENT)$/, "Lifestyle", 3)
  ]
};
var TVC_UK_REGIONAL = /^(BBC (ONE|1|TWO|2)|ITV ?1?|STV|UTV)\s+(?!(BE|2|3|4|X|QUIZ)\b)\S/;
var TVC_VFEED = /^(NETFLIX|PRIME|PLUTO|HBO|DISNEY\+|HULU|PARAMOUNT\+|APPLE TV\+|PRIMEVIDEO|KIDZ|PLAY KIDZ|BOX ?OFFICE|DMTV|MOVIES CLASSIC|REALITY SHOW|HUB PREMIER|SKY STORE PREMIERE|PROTIME|DREAM4K|24\/7)\b/;
var TVC_VFEED_ALWAYS = /^(KIDZ|PLAY KIDZ|DMTV|MOVIES CLASSIC|PROTIME|DREAM4K|SKY STORE PREMIERE|HUB PREMIER|24\/7)\b|^(BOX ?OFFICE|REALITY SHOW|HULU ORIGINALS|NETFLIX (PREMIERE|SERIES)|DISNEY\+ SERIES|APPLE TV\+ SERIES|PARAMOUNT\+ ON-DEMAND|PRIMEVIDEO SERIE|HBOMAX ORIGINAL) ?\d+$/;
var TVC_JUNK = /SERVICE INFO|TEST CHANNEL|^INFO\b|^NO SIGNAL/;

var TVC_ALIAS = [[/^FOX SPORTS ([12])$/, "FS$1"], [/^ESPN USA$/, "ESPN"], [/^ESPN ?2$/, "ESPN2"], [/^ESPN ?U$/, "ESPNU"], [/\bJUNIOR\b/, "JR"], [/\bJR\.?/, "JR"], [/^AHC$/, "AMERICAN HEROES"], [/^ID$/, "INVESTIGATION DISCOVERY"],
  [/^SKY (F1|GOLF|CRICKET|ACTION)/, "SKY SPORTS $1"], [/LEAUGE/, "LEAGUE"], [/MAIN EVENTS/, "MAIN EVENT"], [/^TNT SPORT\b/, "TNT SPORTS"], [/^EUROSPORTS/, "EUROSPORT"], [/^(LFC|LIVERPOOL( FC)?)( TV)?$/, "LFC"], [/^BLOOMBERG( TV| NEWS)?$/, "BLOOMBERG"],
  [/^FOX NEWS CHANNEL$/, "FOX NEWS"], [/^TRU ?TV$/, "TRUTV"], [/^ITV ?1?$/, "ITV1"], [/^NBC GOLF CHANNEL$/, "GOLF"], [/^SKY SPORTS ACTION ?\/? ?NFL$/, "SKY SPORTS ACTION"], [/^BBC (ONE|1) HD$/, "BBC ONE"], [/^BBC 1$/, "BBC ONE"], [/^BBC 2$/, "BBC TWO"], [/^BBC 4$/, "BBC FOUR"], [/^D ?MAX$/, "DMAX"], [/^ANIMAL PLANT$/, "ANIMAL PLANET"]];
function tvcAlias(base) { var k = base; TVC_ALIAS.forEach(function (a) { k = k.replace(a[0], a[1]); }); return k; }
function tvcKey(base) {
  var k = tvcAlias(base);
  return k.replace(/^THE /, "").replace(/\s+(CHANNEL|NETWORK|TV)$/, "").replace(/\s/g, "");
}
function tvcBrand(code, base) {
  var L = TVC_BRANDS[code]; if (!L) return null;
  for (var i = 0; i < L.length; i++) if (L[i].re.test(base)) return L[i];
  return null;
}
function tvcGroupInfo(c, members) {
  if (c._tvc) return c._tvc;
  var slot = 0, pre = {}, top = 0;
  members.forEach(function (ch) {
    var cl = tvcClean(ch.n); if (TVC_SLOT.test(cl) || TVC_SLOT.test(String(ch.n).toUpperCase())) slot++;
    var p = cl.replace(/[\d:|].*$/, "").trim().split(" ")[0]; pre[p] = (pre[p] || 0) + 1; if (pre[p] > top) top = pre[p];
  });
  var n = members.length || 1;
  c._tvc = { slot: slot / n > 0.4, feed: n >= 6 && top / n >= 0.6, team: TVC_TEAM_GROUP.test(c.up) };
  return c._tvc;
}
var TVC_EVT_OK = {
  UK: function (u) { return /\bSKY\b|\bTNT\b|PREMIER LEAGUE|\bEFL\b|SPFL|SCOTTISH|^CHAMP\b|SUPER LEAGUE|BOX OFFICE|\bPDC\b|DARTS|DAZN (UK|PPV)|\bBBC\b|\bITV|\bLFC|MUTV|\bUK\b/.test(u) && !/\bUEFA\b|D\+ UK|NCAA/.test(u); },
  US: function (u) { return !/SERIE A|ENGLISH FA|BARCLAYS|LA ?LIGA|BUNDESLIGA|LIGUE 1|PREMIER LEAGUE|\bEPL\b|\bUEFA\b|EREDIVISIE|SPFL/.test(u); },
  CA: function () { return true; }
};
/* classify one channel; returns null when it does not belong to the country page */
function tvcClassify(ch, c, gi) {
  var code = c.code, raw = String(ch.n || "").toUpperCase();
  if (/\u2726|^\s*[-=*#]{3}/.test(ch.n)) return null;
  var cl = tvcClean(ch.n), base = tvcBase(cl); if (!base || base.length < 2) return null;
  if (TVC_FOREIGN_NAME.test(raw) || TVC_FOREIGN_NAME.test(cl)) return null;
  if (TVC_JUNK.test(base)) return null;
  if (code === "UK" && /^BEIN/.test(base)) return null;
  var br = tvcBrand(code, tvcAlias(base)), lt = c.ltype, o = { base: base, cl: cl, rank: br ? br.rank : 50, brand: !!br, net: br ? br.net : "" };
  if (lt === "Local channels") { if (!br || br.sub !== "News") { o.sub = "Local"; o.local = true; o.key = cl.replace(/[^A-Z0-9]/g, ""); return o; } }
  if (code === "US" && (!br || br.sub !== "News") && /^(ABC|CBS|NBC|FOX|PBS|CW|MYNETWORK ?TV|MY ?TV)\b/.test(base) && (/\b[KW][A-Z]{2,3}(-[A-Z0-9]+)?\b/.test(cl) || /^\S+ \d+\b/.test(base) || /^(ABC|CBS|NBC|FOX|CW)$/.test(base))) { o.sub = "Local"; o.local = true; o.key = cl.replace(/[^A-Z0-9]/g, ""); return o; }
  if (code === "UK" && TVC_UK_REGIONAL.test(base) && !br) { o.sub = "Local"; o.key = base; return o; }
  if ((gi.feed && TVC_VFEED.test(cl) && !br) || TVC_VFEED_ALWAYS.test(cl)) { o.sub = "24/7"; o.brand = false; o.rank = 50; o.key = base; return o; }
  var isSlot = TVC_SLOT.test(cl) || TVC_SLOT.test(raw.trim()) || ((lt === "PPV & Events" || gi.slot) && (!br || /\|/.test(raw)));
  if (isSlot && !TVC_EVT_OK[code](raw)) return null;   // event slots must be this country's own events
  if (isSlot) { o.sub = "PPV & Events"; o.slot = true; o.brand = false; o.empty = /NO (SCHEDULED )?EVENT|^[^A-Z]*$|[:|]\s*$|^\s*:|\bINFO\b/.test(cl) || cl.length < 4; o.key = String(ch.id); return o; }
  if (br) { o.sub = br.sub; o.key = tvcKey(base); if (gi.team && br.sub === "Sports") o.rank = Math.min(o.rank, 20); return o; }
  if (gi.team) { o.sub = "Sports"; o.team = true; o.key = base; o.rank = 30; return o; }
  if (code === "UK" && /^(BBC|ITV|S4C|STV|UTV|SKY|CHANNEL [45]|CBBC|CBEEBIES)\b/.test(base)) { o.sub = /CBBC|CBEEBIES/.test(base) ? "Kids" : nameSub(base) || (/NEWS/.test(base) ? "News" : /SPORT/.test(base) ? "Sports" : "Entertainment"); o.key = tvcKey(base); return o; }
  if (lt === "24/7 channels" || gi.feed || /^24\/7/.test(cl)) { o.sub = "24/7"; o.key = base; return o; }
  var n = nameSub(base);
  if (n) { o.sub = n; o.key = tvcKey(base); return o; }
  if (lt === "Sports" || lt === "News" || lt === "Kids" || lt === "Music" || lt === "Documentary") { o.sub = lt; o.key = tvcKey(base); return o; }
  if (lt === "Movie channels") { o.sub = "Movies"; o.key = tvcKey(base); return o; }
  o.sub = "Entertainment"; o.key = tvcKey(base); return o;
}
function tvcBuild(code) {
  if (TVC.src !== CH.all) { TVC.src = CH.all; TVC.by = {}; TVC.list = {}; }
  if (TVC.list[code]) return TVC.list[code];
  var groups = {}, out = [];
  (CH.all || []).forEach(function (ch) { var c = chanCat(ch); if (c && c.code === code) (groups[ch.c] = groups[ch.c] || []).push(ch); });
  var fg = TVC_FOREIGN_GROUP[code] || /^$/;
  Object.keys(groups).forEach(function (gid) {
    var c = catById["live:" + gid]; if (!c || c.adult) return;
    if (fg.source !== "^$" && fg.test(c.up)) return;
    var gi = tvcGroupInfo(c, groups[gid]);
    groups[gid].forEach(function (ch) { var o = tvcClassify(ch, c, gi); if (o) { TVC.by[ch.id] = o; out.push(ch); } });
  });
  TVC.list[code] = out; return out;
}
function tvcOf(ch) { return TVC.by[ch.id]; }
function tvcVisible(code) {
  var b = tvcBuild(code), m = TVC.vis && TVC.vis[code];
  if (m && m.b === b && Date.now() - m.t < 3000) return m.l;
  var l = b.filter(function (ch) { return chanOK(ch) && itemOK(ch); });
  TVC.vis = TVC.vis || {}; TVC.vis[code] = { b: b, t: Date.now(), l: l }; return l;
}
/* collapse quality duplicates: keep the best version of each channel */
function tvcDedupe(list) {
  var by = {}, out = [];
  list.forEach(function (ch) {
    var o = tvcOf(ch), k = o.key, s = qualityBonus(ch) + (logoFor(ch) ? 0.5 : 0) + learnScore("ch", String(ch.id)) * 0.3 + (/\bEAST\b/.test(o.cl) ? 0.2 : 0);
    if (!by[k] || by[k].s < s) by[k] = { ch: ch, s: s };
  });
  for (var k in by) out.push(by[k].ch);
  return out;
}
var TVC_POP = ["SKYSPORTSMAINEVENT", "SKYSPORTSPREMIERLEAGUE", "TNTSPORTS1", "SKYSPORTSFOOTBALL", "TNTSPORTS2", "SKYSPORTSF1", "SKYSPORTSNEWS", "BBCONE", "BBCTWO", "ITV1", "ITV", "CHANNEL4", "CHANNEL5", "BBCNEWS", "SKYNEWS", "GBNEWS", "SKYATLANTIC", "SKYSHOWCASE", "ITV2", "E4", "DAVE", "BBCFOUR",
  "ESPN", "ESPN2", "FS1", "NFL", "NFLREDZONE", "NBATV", "NHL", "MLB", "CNN", "FOXNEWS", "MSNBC", "CNBC", "HBO", "HBOEAST", "AMC", "TNT", "TBS", "USANETWORK", "FX", "DISCOVERY", "HISTORY", "NATIONALGEOGRAPHIC", "DISNEY", "NICKELODEON", "CARTOON", "FOODNETWORK", "HGTV", "MTV"];
function tvcPop(o) { var i = TVC_POP.indexOf(o.key); return i < 0 ? 999 : i; }
function tvcSort(list) {
  return list.slice().sort(function (a, b) { var x = tvcOf(a), y = tvcOf(b); return (x.rank - y.rank) || (tvcPop(x) - tvcPop(y)) || (learnScore("ch", String(b.id)) - learnScore("ch", String(a.id))) || (x.base < y.base ? -1 : x.base > y.base ? 1 : 0); });
}
function tvcAlpha(list) { return list.slice().sort(function (a, b) { var x = tvcOf(a).base, y = tvcOf(b).base; return x < y ? -1 : x > y ? 1 : 0; }); }
function tvcSubList(code, sub) {
  var l = tvcVisible(code).filter(function (ch) { return tvcOf(ch).sub === sub; });
  if (sub === "PPV & Events") return l.filter(function (ch) { return !tvcOf(ch).empty; });
  return tvcDedupe(l);
}
/* rows of a long A-Z list, ~30 per row, titled by letter range */
function tvcAZRows(list, label) {
  var a = tvcAlpha(list), rows = [];
  for (var i = 0; i < a.length; i += 30) (function (chunk) {
    var f = tvcOf(chunk[0]).base.charAt(0), l = tvcOf(chunk[chunk.length - 1]).base.charAt(0);
    rows.push({ title: label + (a.length > 30 ? " \u00B7 " + (f === l ? f : f + "\u2013" + l) : ""), kind: "l", local: true, epg: true, load: function () { return Promise.resolve(chunk); } });
  })(a.slice(i, i + 30));
  return rows;
}
var TVC_ADJ = { UK: "British", US: "American", CA: "Canadian" };
var TVC_NETS = {
  UK: [["BBC", /^(BBC|CBBC|CBEEBIES)\b/, "#1a1a1a"], ["ITV", /^(ITV|CITV)/, "#00a99d"], ["Channel 4", /^(CHANNEL 4|E4|MORE ?4|FILM ?4|4 ?SEVEN)\b/, "#6c2c91"], ["Channel 5", /^(CHANNEL 5|5 ?(USA|STAR|ACTION|SELECT))\b/, "#e3002b"], ["Sky", /^SKY\b/, "#0b3fa8"]],
  US: [["ABC", /\bABC\b/, "#111111", 1], ["CBS", /\bCBS\b/, "#1a1a6e", 1], ["NBC", /\bNBC\b/, "#6b2b9e", 1], ["FOX", /\bFOX\b/, "#003a70", 1], ["PBS", /\bPBS\b/, "#2638c4", 1], ["CW & other locals", null, "#3a3a46", 1]]
};
function tvcNetList(code, net) {
  var l = tvcVisible(code).filter(function (ch) {
    var o = tvcOf(ch);
    if (net[3]) { if (!o.local) return false; if (!net[1]) return !TVC_NETS.US.some(function (n) { return n[1] && n[1].test(o.cl); }); return net[1].test(o.cl); }
    return !o.slot && net[1].test(o.base);
  });
  return tvcDedupe(l);
}
var TVC_FLAG = { UK: "\uD83C\uDDEC\uD83C\uDDE7 ", US: "\uD83C\uDDFA\uD83C\uDDF8 " };
var TVC_SUBLBL = { Documentary: "documentary & factual", Lifestyle: "lifestyle & food", Local: "local & regional", "24/7": "24/7 non-stop", "PPV & Events": "live event channels" };
function tvcSubLbl(sub) { return TVC_SUBLBL[sub] || sub.toLowerCase(); }
/* v4.2: country page = only that country's channels, one row per category (no generic genre tiles) */
function tvcCountrySpecs(code) {
  if (!CH.all) return loadingSpec("c:" + code, TVC_ADJ[code] + " channels");
  var adj = TVC_ADJ[code], fl = TVC_FLAG[code] || "", rows = [], mx = learnMax("sub") || 1, cats = [];
  var pop = tvcSort(tvcDedupe(tvcVisible(code).filter(function (ch) { var o = tvcOf(ch); return o.brand && !o.slot && !o.local; }))).slice(0, 30);
  if (pop.length) rows.push({ title: fl + "Popular " + adj + " channels", kind: "l", epg: true, local: true, load: function () { return Promise.resolve(pop); } });
  SUBS.forEach(function (s, i) {
    var all = tvcSubList(code, s[0]); if (!all.length) return;
    if (s[0] === "24/7") return;   // generic looping feeds are not British/American channels
    var tail = s[0] === "PPV & Events";
    cats.push({ s: s, all: all, score: (tail ? -100 : 0) + 20 - i + 15 * learnScore("sub", s[0]) / mx });
  });
  cats.sort(function (a, b) { return b.score - a.score; });
  cats.forEach(function (c) {
    var sub = c.s[0], n = c.all.length, lbl = tvcSubLbl(sub), id = "sub:" + code + ":" + sub;
    XT[id] = { label: adj + " \u203A " + (c.s[2] || sub) };
    var main = c.all.filter(function (ch) { return !tvcOf(ch).team; });
    var top = sub === "PPV & Events" || sub === "Local" ? tvcAlpha(c.all).slice(0, 24) : tvcSort(main.length ? main : c.all).slice(0, 24);
    rows.push({ title: adj + " " + lbl + " \u00B7 " + n + (n === 1 ? " channel" : " channels"), kind: "l", epg: true, local: true, load: function () {
      var l = top.slice();
      if (n > l.length || sub === "PPV & Events" || sub === "Local") l.push({ t: "tile", id: id, n: "See all " + n, sub: adj + " " + lbl + " \u203A", col: "#2a3a8c" });
      return Promise.resolve(l);
    } });
  });
  var nets = [];
  (TVC_NETS[code] || []).forEach(function (net) { var k = tvcNetList(code, net).length; if (k) { var t = netTile(code, net, k); t.n = net[0]; nets.push(t); } });
  if (nets.length) rows = rows.concat(tileRows(nets, code === "US" ? adj + " local stations by network" : adj + " networks"));
  if (!rows.length) rows.push({ title: "No " + adj + " channels match your filters", kind: "l", local: true, load: function () { return Promise.resolve([]); } });
  return rows;
}
function tvcSubSpecs(code, sub) {
  if (!CH.all) return loadingSpec("sub:" + code + ":" + sub, "channels");
  learnAdd("sub", sub, 0.3);
  var adj = TVC_ADJ[code], lbl = sub === "Documentary" ? "documentary & factual" : sub === "Lifestyle" ? "lifestyle & food" : sub.toLowerCase();
  var all = tvcSubList(code, sub), rows = [];
  if (!all.length) return [{ title: "No " + adj + " " + lbl + " channels match your filters", kind: "l", local: true, load: function () { return Promise.resolve([]); } }];
  if (sub === "PPV & Events") {
    var gs = {};
    all.forEach(function (ch) { (gs[ch.c] = gs[ch.c] || []).push(ch); });
    Object.keys(gs).sort(function (a, b) { return gs[b].length - gs[a].length; }).forEach(function (gid) {
      var c = catById["live:" + gid];
      rows.push({ title: c.title, count: true, kind: "l", local: true, epg: true, load: function () { return Promise.resolve(gs[gid]); } });
    });
    return rows;
  }
  if (sub === "Local" && code === "US") {
    TVC_NETS.US.forEach(function (net) { var l = tvcNetList(code, net); if (l.length) rows.push({ title: net[0] + " stations", count: true, kind: "l", local: true, epg: true, load: function () { return Promise.resolve(tvcAlpha(l)); } }); });
    return rows;
  }
  var team = all.filter(function (ch) { return tvcOf(ch).team; }), main = all.filter(function (ch) { return !tvcOf(ch).team; });
  var feat = tvcSort(main.filter(function (ch) { return tvcOf(ch).brand; })).slice(0, 30);
  if (feat.length) rows.push({ title: "Top " + adj + " " + lbl + " channels", kind: "l", local: true, epg: true, load: function () { return Promise.resolve(feat); } });
  rows = rows.concat(tvcAZRows(main, "All " + adj + " " + lbl + " A\u2013Z"));
  if (team.length) rows = rows.concat(tvcAZRows(team, "Team & club channels"));
  return rows;
}
function tvcNetSpecs(code, name) {
  if (!CH.all) return loadingSpec("net:" + code + ":" + name, "channels");
  var net = null; (TVC_NETS[code] || []).forEach(function (n) { if (n[0] === name) net = n; });
  if (!net) return [];
  var l = tvcNetList(code, net);
  var rows = [{ title: "Main " + name + " channels", kind: "l", local: true, epg: true, load: function () { return Promise.resolve(tvcSort(l.filter(function (ch) { return !tvcOf(ch).local && tvcOf(ch).sub !== "Local"; })).slice(0, 30)); } }];
  return rows.concat(tvcAZRows(l, "All " + name + " channels"));
}
/* route British / American pages through the new classifier; Canada keeps v4 behaviour */
var _pageSpecsV4 = pageSpecs;
pageSpecs = function (pg) {
  var id = pg.id, m;
  if (id === "c:UK" || id === "c:US") return tvcCountrySpecs(id.slice(2));
  if ((m = /^sub:(UK|US):(.+)$/.exec(id))) return tvcSubSpecs(m[1], m[2]);
  if ((m = /^net:(UK|US):(.+)$/.exec(id))) return tvcNetSpecs(m[1], m[2]);
  return _pageSpecsV4(pg);
};
