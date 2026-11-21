/* NickFlix 4.14 - daily mix + rotating Netflix-style themed rows (Movies / Shows, Curated mode).
   - Themes rotate every day (seeded by date + profile, Settings time zone like Today's picks): 4 per section, drawn
     with weights from the taste model (genre affinity, seed theme preferences, ratings), never the same set twice
     in a row. Inside a theme, titles are matched by well-known titles, keywords in title/plot/genre, provider
     categories and genres, then ranked by taste + quality + a small daily jitter. Watched and "Not for me" titles
     are left out, at most 2 of the seed favourites per row, rows with fewer than 6 titles are hidden.
   - "Because you loved X" (most recent Love it) and "More with <person>" (strongest cast/director affinity with
     at least 6 titles that carry cast data) join the themed rows.
   - The other curated rows keep their order at the top (personal rows, Top Picks, Today's picks) and the rest
     is shuffled a little each day; inside rows curated.js applies tsMix (taste.js). */
"use strict";
var TH_N = 4, TH_MIN = 6, TH_MAX = 24, PP_MIN = 5;
var THEMES = [
  { id: "crime", title: "\uD83D\uDD2B Crime & heists", types: "ms", g: ["Thriller & Crime", "Crime"], src: /GANGSTER|CRIME|MAFIA|THRILLER|KRIMI/,
    allow: /^(heat|the town|inside man|ocean'?s (eleven|twelve|thirteen|8)|baby driver|sicario|the departed|goodfellas|casino|scarface|the irishman|snatch|lock,? stock.*|reservoir dogs|the usual suspects|dog day afternoon|the italian job|logan lucky|hell or high water|den of thieves|widows|american gangster|the godfather.*|narcos.*|ozark|the sopranos|the wire|peaky blinders|money heist|la casa de papel|fargo|boardwalk empire|gomorrah|the gentlemen|white collar|lupin|kingpin|griselda)$/i,
    kw: /heist|robber|bank job|\bthie(f|ves)\b|con (man|artist)|cartel|narco|drug (lord|dealer)|kingpin|\bmob\b|mafia|gangster|organi[sz]ed crime|money launder/i },
  { id: "cult", title: "\uD83D\uDCFC Cult classics", types: "m", g: ["Comedy", "Thriller & Crime", "Sci-Fi & Fantasy"], src: /CLASSIC|CULT|80S|90S|RETRO/, old: 2010,
    allow: /^(donnie darko|office space|the warriors|repo man|blade runner|the princess bride|dazed and confused|clerks|mallrats|trainspotting|reservoir dogs|true romance|the boondock saints|snatch|lock,? stock.*|being john malkovich|eternal sunshine.*|memento|the matrix|brazil|12 monkeys|twelve monkeys|requiem for a dream|american psycho|oldboy|evil dead.*|they live|escape from new york|big trouble in little china|the rocky horror picture show|zoolander|anchorman.*|idiocracy|harold (and|&) kumar.*|half baked|friday|up in smoke|strange brew|wayne'?s world|bill (and|&) ted.*|heathers|the crow|point break|road house|fast times at ridgemont high|rushmore|the royal tenenbaums|raising arizona|o brother,? where art thou\??|fargo|barton fink|drive|natural born killers|seven psychopaths|in bruges|hot fuzz|shaun of the dead|the fifth element|robocop|total recall|akira|the thing|videodrome|naked lunch|run lola run|the big lebowski|pulp fiction|fight club|a scanner darkly|fear and loathing in las vegas|super troopers|the life aquatic.*|beerfest|grandma'?s boy|old school|tommy boy|happy gilmore|caddyshack|ghostbusters|back to the future|the goonies|army of darkness|withnail (and|&) i|pineapple express|superbad|hot tub time machine)$/i,
    kw: /cult (classic|favourite|favorite)/i },
  { id: "scifi", title: "\uD83C\uDF00 Mind-bending sci-fi", types: "ms", g: ["Sci-Fi & Fantasy", "Sci-Fi", "Science Fiction"], src: /SCI.?FI|SCIENCE FICTION|FANTAS/,
    allow: /^(inception|interstellar|arrival|annihilation|ex machina|the matrix|primer|tenet|moon|predestination|coherence|looper|minority report|blade runner( 2049)?|dark city|the prestige|source code|edge of tomorrow|her|gattaca|12 monkeys|westworld|dark|devs|3 body problem|fringe|the leftovers|altered carbon|silo|foundation|upload|maniac|legion|black mirror|severance|stranger things|the x-files|the outer limits|the twilight zone|counterpart|travelers|orphan black|humans|the peripheral|paradise|the 100|lost|from|loki|everything everywhere all at once|eternal sunshine.*|being john malkovich|donnie darko)$/i,
    kw: /time travel|time loop|parallel (world|universe)|dimension|simulation|clone|memory|dystopi|alien|artificial intelligence|\bai\b|android|multiverse|conspirac/i },
  { id: "darkcom", title: "\uD83D\uDE08 Dark comedies", types: "ms", g: ["Comedy"], both: ["Thriller & Crime", "Crime", "Drama"], src: /COMED/,
    allow: /^(in bruges|burn after reading|fargo|the big lebowski|seven psychopaths|the nice guys|thank you for smoking|the death of stalin|four lions|dr\.? strangelove.*|very bad things|death at a funeral|the lobster|the banshees of inisherin|triangle of sadness|the menu|barry|veep|archer|rick and morty|south park|it'?s always sunny in philadelphia|curb your enthusiasm|the league|succession|the boys|dead to me|russian doll|search party|what we do in the shadows|after life|killing it|the afterparty|bad sisters|in the loop|the thick of it|arrested development|bojack horseman|fleabag|the righteous gemstones|eastbound (and|&) down|vice principals|the white lotus|the end of the f\*+ing world|dexter)$/i,
    kw: /dark comedy|black comedy|satir|darkly comic|deadpan/i },
  { id: "docthink", title: "\uD83E\uDDE0 Documentaries that make you think", types: "ms", g: ["Documentary"], need: "Documentary", src: /DOCU|DOKU/,
    allow: /^(the social dilemma|icarus|inside job|the big short|citizenfour|13th|the act of killing|blackfish|super size me|an inconvenient truth|bowling for columbine|fahrenheit 9\/11|the corporation|the fog of war|jiro dreams of sushi|man on wire|the imposter|three identical strangers|wild wild country|making a murderer|the jinx|don'?t f\*+ with cats|the vietnam war|cosmos.*|our planet|planet earth.*|the great hack|american factory|knock down the house|the dissident|navalny|fyre.*|bad vegan|dirty money|explained|connected|turning point.*|the trials of gabriel fernandez)$/i,
    kw: /politic|election|democracy|9\/11|conspirac|science|cosmos|universe|economy|corporat|propaganda|investigat|war\b|surveillance|climate|psycholog|brain|history/i },
  { id: "polit", title: "\uD83C\uDFDB Politics, power & 9/11", types: "ms", g: ["War & History", "Politics", "Documentary"], src: /DOCU|POLITI|HISTOR/,
    allow: /^(house of cards|the west wing|veep|the newsroom|the looming tower|vice|the big short|all the president'?s men|zero dark thirty|united 93|world trade center|the report|w\.?|frost\/nixon|the post|spotlight|the comey rule|the 9\/11 commission report|9\/11|turning point: 9\/11.*|fahrenheit 9\/11|loose change|102 minutes that changed america|the path to 9\/11|the mauritanian|worth|reign of terror|the war on terror|bush|obama|the thick of it|in the loop|the death of stalin|chernobyl|the americans|homeland|madam secretary|designated survivor|the diplomat|borgen|scandal|the crown|darkest hour|lincoln|jfk|thirteen days|argo|munich)$/i,
    kw: /9\/11|september 11|twin towers|world trade center|ground zero|al.?qaeda|bin laden|war on terror|politic|election|president|white house|congress|senate|parliament|prime minister|watergate|\bcia\b|pentagon|coup|dictator|propaganda/i },
  { id: "cars", title: "\uD83C\uDFCE Car culture", types: "ms", g: [], src: /MOTOR|AUTO|CAR\b|RACING/,
    allow: /^(top gear.*|the grand tour.*|car sos|wheeler dealers|fast (and|&) furious.*|the fast and the furious.*|2 fast 2 furious|ford v ferrari|le mans.*|rush|senna|gone in (60|sixty) seconds|bullitt|baby driver|drive|initial d|fast n'? loud|overhaulin'?|street outlaws|jay leno'?s garage|counting cars|car masters.*|formula 1: drive to survive|drive to survive|the italian job|ronin|smokey and the bandit|vanishing point|death proof|grand prix|days of thunder|talladega nights.*|cannonball run|mad max.*|need for speed|tokyo drift|hot wheels.*|chasing classic cars|bitchin'? rides|graveyard carz|the car show|unique whips|pimp my ride|west coast customs|american chopper|gas monkey garage|diesel brothers|edd china'?s garage revival|top gear america|the grand tour presents.*)$/i,
    kw: /\bcars?\b|supercar|motor|racing|\brally|nascar|formula (1|one)|\bf1\b|drag race|garage|mechanic|horsepower|hot rod|muscle car|street race|diesel|truck|off.?road|4x4/i },
  { id: "space", title: "\uD83D\uDE80 Space westerns & galaxy adventures", types: "ms", g: ["Sci-Fi & Fantasy", "Western"], src: /SCI.?FI|SCIENCE FICTION|STAR WARS|DISNEY/,
    allow: /^(the mandalorian|andor|the book of boba fett|ahsoka|obi-wan kenobi|rogue one.*|solo.*|star wars.*|skeleton crew|star wars: skeleton crew|the acolyte|the bad batch|the clone wars|firefly|serenity|the expanse|dune.*|cowboy bebop|guardians of the galaxy.*|star trek.*|battlestar galactica|the orville|for all mankind|interstellar|the martian|killjoys|dark matter|farscape|outlaw star|westworld|logan|the dark tower|cowboys (and|&) aliens|space cowboys|avatar.*|prometheus|alien.*|ad astra|gravity|passengers|the 5th element|the fifth element|treasure planet|jupiter ascending|valerian.*|riddick.*|pitch black|elysium|district 9|edge of tomorrow|oblivion|lost in space|halo|foundation|silo|murderbot|raised by wolves|invasion|night sky|3 body problem)$/i,
    kw: /star wars|mandalorian|jedi|bounty hunter|space western|galax|starship|spaceship|outer space|\bplanets?\b|interstellar|frontier|outlaw|gunslinger/i },
  { id: "stoner", title: "\uD83C\uDF04 Stoner & psychedelic trips", types: "m", g: ["Comedy"], src: /COMED|CULT/,
    allow: /^(fear and loathing in las vegas|a scanner darkly|the big lebowski|pineapple express|half baked|dazed and confused|inherent vice|harold (and|&) kumar.*|up in smoke|cheech (and|&) chong.*|friday|next friday|how high|waking life|enter the void|jay and silent bob.*|clerks.*|strange brew|this is the end|super troopers.*|the beach bum|grandma'?s boy|smiley face|mandy|altered states|easy rider|across the universe|yellow submarine|naked lunch|trainspotting|blow|the beach|limitless|lucy|bill (and|&) ted.*|wayne'?s world|dude,? where'?s my car\??|your highness|the stoned age|reefer madness|kid cannabis|weeds|disjointed|high maintenance|broad city|beerfest|club dread|puff,? puff,? pass|mid90s|spun|the doors|midsommar|climax|beyond the black rainbow|color out of space|being john malkovich|everything everywhere all at once)$/i,
    kw: /stoner|\bweed\b|marijuana|cannabis|\blsd\b|psychedelic|hallucinat|mushrooms|\bacid trip/i },
  { id: "canuck", title: "\uD83C\uDF41 Mockumentaries & Canadian comedy", types: "ms", g: ["Comedy"], src: /CANAD|\bCA\b|CRAVE|CBC/,
    allow: /^(trailer park boys.*|letterkenny|shoresy|corner gas.*|kim'?s convenience|schitt'?s creek|workin'? moms|the kids in the hall|still standing|the red green show|due south|fubar.*|goon.*|super troopers.*|the office|parks and recreation|what we do in the shadows|abbott elementary|modern family|reno 911!?.*|summer heights high|people just do nothing|the trip|documentary now!?|american vandal|best in show|this is spinal tap|borat.*|waiting for guffman|a mighty wind|for your consideration|mockingbird lane|nathan for you|how to with john wilson|strange brew|bon cop,? bad cop|son of a critch|the trailer park boys movie|swearnet.*|bob'?s burgers|sunnyside|the grand seduction|men with brooms|the tournament|hiccups|little mosque on the prairie|the newsroom \(1996\)|twitch city|this hour has 22 minutes|rick mercer report|mr\.? d|run the burbs|late bloomer|jann|tallboyz|second jen|letterkenny problems)$/i,
    kw: /mockumentary|canadian|canada|\bnova scotia|toronto|saskatchewan|newfoundland/i },
  { id: "how", title: "\u2699\uFE0F How things work & big engineering", types: "s", g: ["Documentary", "Reality"], need: "Documentary", src: /DOCU|DISCOVERY|SCIENCE|DOKU/,
    allow: /^(how it'?s made.*|modern marvels|megafactories|mega ?factories|megastructures|engineering (connections|disasters)|mythbusters|dirty jobs|deadliest catch|gold rush.*|ice road truckers|mighty ships|impossible engineering|strip the city|unbuilt|inside the factory|how do they do it\??|how stuff works|food factory|the toys that made us|the food that built america|the machines that built america|the men who built america|unwrapped|extreme engineering|big, bigger, biggest|superstructures|world'?s toughest fixes|secrets of the underground|what on earth\??|the secret life of machines|james may'?s man lab|the planets|wonders of the universe|street science|outrageous acts of science)$/i,
    kw: /how it'?s made|how .{1,25} (works|made|built)|engineering|factory|megastructure|machines?|invention|inventor|manufactur|built|build/i },
  { id: "prestige", title: "\uD83C\uDFC6 Binge-worthy prestige drama", types: "s", g: ["Drama", "Crime"], src: /HBO|AMC|NETFLIX|APPLE|MAX\b|SHOWTIME|FX/,
    allow: /^(breaking bad|better call saul|the sopranos|the wire|mad men|ozark|succession|true detective|fargo|the bear|boardwalk empire|house of the dragon|the last of us|yellowstone|westworld|dexter|sons of anarchy|peaky blinders|narcos.*|the shield|the americans|justified|the boys|band of brothers|chernobyl|the night of|mindhunter|halt and catch fire|game of thrones|severance|slow horses|shogun|the penguin|landman|1883|1923|tulsa king|mayor of kingstown|the white lotus|the leftovers|six feet under|deadwood|rome|the crown|the morning show|bloodline|damages|homeland|billions|the expanse|mr\. robot|barry|the night manager|black bird|mare of easttown|the outsider|sharp objects|big little lies|gangs of london|top boy|happy valley|line of duty)$/i,
    kw: /emmy|acclaimed|award.?winning/i }
];
var TH_BY = {}; THEMES.forEach(function (t) { TH_BY[t.id] = t; });
function thTypeOK(t, type) { return t.types.indexOf(type === "movies" ? "m" : "s") >= 0; }
/* today's themes for a section: weighted draw, stable all day, avoids yesterday's exact set */
function thDaily(type) {
  var box = dpBox(); box.th = box.th || {};
  if (box.th[type]) return box.th[type].map(function (id) { return TH_BY[id]; }).filter(Boolean);
  var rnd = dpRng(dpToday() + "|" + PF.id + "|themes|" + type), aff = affinity(), tp = PD.tp || {}, R = rtBox();
  var yday = {}; ((box.past && box.past[0] && box.past[0].th && box.past[0].th[type]) || []).forEach(function (id) { yday[id] = 1; });
  var amax = 0; for (var g in aff) amax = Math.max(amax, aff[g]);
  var cand = THEMES.filter(function (t) { return thTypeOK(t, type); }).map(function (t) {
    var a = 0; t.g.forEach(function (x) { a = Math.max(a, amax > 0 ? Math.max(0, aff[x] || 0) / amax : 0); });
    var w = 0.6 + 1.4 * a + 1.2 * ((tp.th && tp.th[t.id]) || 0);
    for (var k in R) if (R[k].v > 0 && t.allow.test(String(R[k].it.n || "").trim())) w += 0.5 * R[k].v;
    if (yday[t.id]) w *= 0.45;
    return { t: t, w: w };
  });
  var out = [];
  while (out.length < TH_N && cand.length) {
    var sum = 0, i; for (i = 0; i < cand.length; i++) sum += cand[i].w;
    var x = rnd() * sum; for (i = 0; i < cand.length - 1 && x > cand[i].w; i++) x -= cand[i].w;
    out.push(cand.splice(i, 1)[0].t);
  }
  box.th[type] = out.map(function (t) { return t.id; }); savePD();
  return out;
}
/* dpBox keeps 3 days of history: carry the theme ids along so tomorrow avoids today's set */
var _dpBox414 = dpBox;
dpBox = function () {
  var old = PD.dp, b = _dpBox414();
  if (old && old !== b && old.th && b.past && b.past[0] && b.past[0].d === old.d) b.past[0].th = old.th;
  return b;
};
function thSources(t, type) {
  var en = cats[type].filter(catVisibleV), out = [], seen = {};
  function add(c) { if (c && !seen[c.id] && out.length < 5) { seen[c.id] = 1; out.push(c); } }
  if (t.src) en.filter(function (c) { return t.src.test(c.up); }).slice(0, 3).forEach(add);
  if (t.g.length) en.filter(function (c) { return c.genres.some(function (g) { return t.g.indexOf(g) >= 0; }); }).slice(0, 2).forEach(add);
  return out;
}
function thMatch(t, it) {
  var n = String(it.n || "").trim(), gs = itemGenres(it), s = 0, text = String(it.genre || "") + " " + String(it.plot || "").slice(0, 500);
  if (t.need && gs.indexOf(t.need) < 0 && !/documentar/i.test(it.genre || "")) return 0;
  if (t.allow.test(n)) s += 4;
  if (t.kw.test(n)) s += 2; else if (text.length > 2 && t.kw.test(text)) s += 1;
  var gm = gs.some(function (g) { return t.g.indexOf(g) >= 0; });
  if (gm) s += 0.8;
  if (t.both && gm && gs.some(function (g) { return t.both.indexOf(g) >= 0; })) s += 0.8;
  if (t.old && +it.y && +it.y > t.old && !t.allow.test(n)) return 0;
  return s;
}
function thItems(t, type) {
  var en = cats[type].filter(catVisibleV); if (!en.length) return Promise.resolve([]);
  var src = thSources(t, type), rnd = dpRng(dpToday() + "|" + PF.id + "|th|" + t.id + "|" + type), seen = dpSeen();
  return Promise.all([settle(loadPool(type, poolFor(type, en)))].concat(src.map(function (c) { return settle(loadCat(c)); }))).then(function (ls) {
    var aff = affinity(), by = {}, c = [];
    ls.forEach(function (l, li) {
      (l || []).forEach(function (it) {
        if (!itemOK(it) || seen[itemKey(it)] || rtDisliked(it)) return;
        var m = thMatch(t, it); if (li > 0 && src[li - 1] && t.src && t.src.test(src[li - 1].up)) m += 0.6;
        if (m < 1.2) return;
        var k = normTitle(it); if (by[k] && (by[k].it.ic || !it.ic)) return;
        var g = 0; itemGenres(it).forEach(function (x) { g += aff[x] || 0; });
        var r = parseFloat(it.r) || 0; if (r > 10) r /= 10;
        var s = 2 * m + Math.min(4, g / 6) + tasteBoost(it) / 2 + (ratingOK(it) ? (r - 5) / 1.5 : 0) + (it.ic ? 1 : -2) + rnd() * 1.6;
        var o = { it: it, s: s, fav: !!tsIsSeedTitle(it) }; if (by[k]) c[c.indexOf(by[k])] = o; else c.push(o); by[k] = o;
      });
    });
    c.sort(function (a, b) { return b.s - a.s; });
    var out = [], favs = 0;
    c.forEach(function (o) { if (out.length >= TH_MAX) return; if (o.fav) { if (favs >= 2) return; favs++; } out.push(o.it); });
    return out.length >= TH_MIN ? out : [];
  });
}
function thSpec(t, type) { return { title: t.title, tag: "Today", theme: t.id, load: function () { return thItems(t, type); } }; }
/* Because you loved X: most recent Love it of this type */
function lovedSpec(type) {
  var R = rtBox(), best = null;
  for (var k in R) { var e = R[k]; if (e.v === 2 && e.it && e.it.t === type && e.it.c && (!best || e.ts > best.ts)) best = e; }
  if (!best || typeof whVodSimilar !== "function") return null;
  var anchor = { it: best.it, k: itemKey(best.it), cats: (best.g || []).concat([type === "movies" ? "Movies" : "Shows"]) };
  return { title: "\u2764\uFE0F Because you loved " + best.it.n, load: function () { return whVodSimilar(anchor).then(function (l) { return l.filter(function (x) { return !rtDisliked(x) && normTitle(x) !== best.nt; }); }); } };
}
/* More with <person>: the strongest person affinities (daily rotation among the top 3 first) - the first one with at
   least 5 titles that carry cast data gets the row; the row title is set once the person is known */
function personSpec(type) {
  var top = ppTop(8).filter(function (x) { return x[1] >= 2; }); if (!top.length) return null;
  var en = cats[type].filter(catVisibleV); if (!en.length) return null;
  var rnd = dpRng(dpToday() + "|" + PF.id + "|pp|" + type), k = Math.floor(rnd() * Math.min(3, top.length));
  var order = top.slice(k).concat(top.slice(0, k)).map(function (x) { return x[0]; });
  var spec = { title: "\uD83C\uDFAC More with\u2026", load: function () {
    var seen = dpSeen();
    return settle(loadPool(type, poolFor(type, en))).then(function (pool) {
      var by = {};
      pool.forEach(function (it) {
        if (!itemOK(it) || rtDisliked(it)) return;
        ppOf(it).forEach(function (p) {
          if (order.indexOf(p.n) < 0) return; var l = by[p.n] || (by[p.n] = { l: [], nt: {} }), nt = normTitle(it); if (l.nt[nt]) return; l.nt[nt] = 1;
          l.l.push({ it: it, s: (seen[itemKey(it)] ? -3 : 0) + (p.dir ? 1 : p.w) + (parseFloat(it.r) || 0) / 3 + tsJit(it, "pp") });
        });
      });
      for (var i = 0; i < order.length; i++) {
        var b = by[order[i]]; if (!b || b.l.length < PP_MIN) continue;
        var disp = ""; b.l[0].it && ppOf(b.l[0].it).forEach(function (p) { if (p.n === order[i] && !disp) disp = p.d; });
        spec.title = "\uD83C\uDFAC More with " + (disp || order[i].replace(/\b\w/g, function (m) { return m.toUpperCase(); })); spec.person = order[i];
        try { V.rows.forEach(function (r) { if (r.spec === spec) { var t = r.el.querySelector(".rtitle"); if (t && t.firstChild) t.firstChild.nodeValue = spec.title; } }); } catch (e) {}
        b.l.sort(function (x, y) { return y.s - x.s; });
        return b.l.slice(0, TH_MAX).map(function (x) { return x.it; });
      }
      return [];
    });
  } };
  return spec;
}
/* ---------- wire into Curated Movies / Shows ---------- */
var _curatedRows414 = curatedRows;
curatedRows = function (type) {
  var rows = _curatedRows414(type);
  if ((type !== "movies" && type !== "series") || !PF || !rows.length) return rows;
  try {
    // everything up to Top Picks / Popular (+ Because you watched) keeps its 4.11-4.13 place:
    // personal rows, collections, Today's picks, Top Picks. Themes start right after; the rest is shuffled a little.
    var h = -1; for (var i = 0; i < rows.length; i++) if (rows[i].hero) { h = i; break; }
    if (h < 0) { h = 0; while (h < rows.length && rows[h].local) h++; h--; }
    var j = h + 1; while (j < rows.length && /^Because You Watched/.test(rows[j].title)) j++;
    var head = rows.slice(0, j), rest = rows.slice(j), top = [];
    var rnd = dpRng(dpToday() + "|" + PF.id + "|rows|" + type);
    var sc = rest.map(function (r, j) { return { r: r, k: j + rnd() * 3.2 }; }); sc.sort(function (a, b) { return a.k - b.k; });
    rest = sc.map(function (x) { return x.r; });
    var th = thDaily(type).map(function (t) { return thSpec(t, type); }), lv = lovedSpec(type), ps = personSpec(type);
    var mid = [];
    if (th[0]) mid.push(th[0]); if (lv) mid.push(lv);
    var out = head.concat(top, mid), slots = [1, 3, 5, 7], extra = th.slice(1); if (ps) extra.splice(1, 0, ps);
    rest.forEach(function (r, j) { out.push(r); if (slots.indexOf(j) >= 0 && extra.length) out.push(extra.shift()); });
    return out.concat(extra);
  } catch (e) { return rows; }
};
/* ---------- Today's picks (4.11) use the same taste: people / keywords / ratings, no "Not for me" ---------- */
var _dpVodFeat414 = dpVodFeat;
dpVodFeat = function (it, M) { var f = _dpVodFeat414(it, M), b = tasteBoost(it); if (b > 0) f.taste = Math.min(1.5, f.taste + Math.min(0.6, b / 10)); return f; };
var _dpVodPool414 = dpVodPool;
dpVodPool = function (type) { return _dpVodPool414(type).then(function (l) { return l.filter(function (it) { return !rtDisliked(it); }); }); };
