/* NickFlix v4.5 - curated Documentary and British collections on Movies and Shows.
   Driven by the profile's favourite categories (Documentary / British). Only real titles from the
   provider's VOD catalogue are used: documentary = documentary category or series genre "Documentary"
   (+ a short list of well-known documentaries); British = BritBox/UK categories, "(GB)/(UK)" tags,
   British settings in the plot, or well-known British titles. Rows with fewer than 4 titles are hidden. */
"use strict";
var COLL_MIN = 4;
var DOC_ALLOW = /^(senna|making senna|free solo|14 peaks.*|the social dilemma|icarus|fyre.*|apollo 11|enron.*|amy|man on wire|blackfish|super size me|bowling for columbine|fahrenheit 9\/11|an inconvenient truth|the cove|searching for sugar man|meru|the alpinist|the dawn wall|valley uprising|they shall not grow old|my octopus teacher|the rescue|navalny|20 days in mariupol|citizenfour|schumacher|the last dance|david attenborough.*|our planet.*|jiro dreams of sushi|march of the penguins|the tinder swindler|bad vegan.*|the great hack|american factory|knock down the house|the act of killing|won'?t you be my neighbou?r\??|o\.?j\.?:? made in america|the jinx.*|wild wild country)$/i;
var COLLS = [
  // id, group, title, title/plot regex, types
  ["d911", "doc", "9/11 & Modern History", /\b9\/11\b|(^|[^\w])911([^\w]|$)(?!.*porsche)|september 11|twin towers|ground zero|world trade center|afghanistan|\biraq\b|cold war|vietnam|chernobyl|gulf war|bin laden|al.?qaeda|taliban|berlin wall|soviet|iron curtain|cuban missile|fall of saigon/i, null, /\b9\/11\b|september 11|twin towers|ground zero|world trade center|chernobyl|cold war|vietnam war|iraq war|war in afghanistan|fall of the soviet|berlin wall/i],
  ["dpol", "doc", "Politics & Power", /\belections?\b|\bpresident|\btrump\b|\bobama\b|\bclinton|\bputin\b|\bcongress\b|watergate|\bcia\b|\bfbi\b|\bspy\b|\bspies\b|espionage|propaganda|white house|\bpolitic|dictator|kremlin|\bkgb\b|supreme court|democracy|kennedy|nixon|\bbiden\b|brexit|parliament|prime minister|regime|whistleblow|\bcoup\b/i, null, /\b(presidential|presidency|election campaign|white house|kremlin|watergate|the cia|the kgb|propaganda|dictator|politicians?|political (power|scandal|dynasty))\b/i],
  ["dsport", "doc", "Sports Legends", /\bsenna\b|schumacher|muhammad ali|last dance|michael jordan|gretzky|maradona|\btyson\b|\bf1\b|formula (1|one)|drive to survive|free solo|14 peaks|\bpel[eé]\b|messi|ronaldo|beckham|federer|serena|tiger woods|kobe|lebron|tom brady|\bboxing\b|\bboxer|\bsoccer\b|football|olympi|\bnba\b|\bnfl\b|\bnhl\b|hockey|tour de france|cycling|mountain bik|\bmtb\b|marathon|wrestl|\bufc\b|\bathlete|champion|\bteam\b.*\b(season|cup)|world cup|grand prix|racing driver/i, null, /\b(formula (1|one)|\bf1\b|the nhl|the nba|the nfl|olympic|world cup|boxing (legend|champion)|footballer|athletes?|grand prix|tour de france|mountain bik|racing driver|legendary (coach|player))/i],
  ["dmade", "doc", "How It's Made & Engineering", /how it'?s made|mega ?factor|megastructure|modern marvels|engineering|\binside (the )?(factory|plant|machine|world'?s|the ultimate|airbus|boeing|ferrari|lamborghini|royal|mega)|unbuilt|how .{1,30} (works|is built|was built|are made)|built (from|to last)|monster (machines|builds|trucks)|impossible engineering|factor(y|ies)\b|construction|skyscraper|bridge build|aircraft carrier|super ?ships?|super ?structures?|machines\b|mega (projects|builds)|big,? bigger,? biggest|car (build|factory)|production line|assembly line/i, null, /how (things|everyday (items|objects)|products|it'?s) .{0,20}(are )?made|engineering|megastructures?|factor(y|ies)|manufactur|construction of|engineers? (build|design)/i],
  ["dcrime", "doc", "True Crime", /making a murderer|tiger king|serial killer|\bkillers?\b|\bcults?\b|\bheist|\bscam|\bcon (man|men|artist|job)|conman|murder|true crime|\bcrimes?\b|criminal|cartel|mafia|\bmobsters?\b|\bkill(ed|ing|s)?\b|homicide|detective|forensic|fraud|swindl|prison|\bjail|kidnap|missing|cold case|interrogat|manhunt|\bfbi\b|gangster|smuggl|\bnarco/i, null, /\b(murders?|serial killers?|true crime|homicides?|\bcults?\b|heists?|con artists?|scams?|fraud|cartels?|kidnapp)/i],
  ["dwar", "doc", "War & WWII", /world war|\bwwii\b|\bww2\b|\bwwi\b|\bww1\b|\bnazis?\b|hitler|d-?day|apocalypse|world at war|holocaust|third reich|battle of|\bwar\b|\bwars\b|blitz|normandy|pearl harbou?r|military|navy seals?|soldiers?|warfare|\barmy\b|commando|warship|u-?boat|resistance fighters?/i, null, /world war|\bwwii\b|\bnazis?\b|hitler|d-day|holocaust|battle of|military history|the war in/i],
  ["dnat", "doc", "Nature & Planet", /attenborough|planet earth|blue planet|our planet|frozen planet|seven worlds|wildlife|\bwild\b|animals?\b|nature|\bocean|\bsea\b|\bsharks?\b|whales?|safari|jungle|rainforest|\bearth'?s\b|planet earth|predators?|\blions?\b|\bbears?\b|\bbirds?\b|dinosaur|climate|volcano|national parks?|penguin|elephant|gorilla|octopus|coral|reef|migration|kingdom of/i, null, /\b(wildlife|wild animals|natural world|attenborough|ocean life|planet earth|nature documentary|animal kingdom|ecosystems?)\b/i],
  ["dsci", "doc", "Science & Space", /cosmos|\bspace\b|\bnasa\b|apollo|universe|\bplanets\b|\bmars\b|\bmoon\b|galax|astronaut|science|scientist|quantum|physics|artificial intelligence|\bai\b|\bbrain\b|einstein|hubble|black holes?|\brockets?\b|spacex|outer space|solar system|\bstars\b|telescope|\bdna\b|genetic|\bevolution\b|medicine|virus|pandemic|invention|inventor/i, null, /\b(outer space|nasa|the universe|scientists?|astronauts?|cosmos|physics|space exploration|space race)\b/i],
  ["dadv", "doc", "Adventure & Extreme", /everest|climb|summit|\bsurvival\b|survivor|\balone\b|expedition|explor|extreme|adventure|mountain|arctic|antarctic|polar|kayak|\bsail|wingsuit|\bbike|skydiv|\bsurf|base jump|free ?dive|ski(ing)?\b|snowboard|deadliest|\bwilderness|\btrek/i, null, /\b(everest|expeditions?|survival|climbers?|climbing|explorers?|extreme (sports|adventure)|wilderness)\b/i],
  ["dmus", "doc", "Music & Culture", /\bmusic|\bband\b|concert|\brock\b|hip.?hop|\brap(per)?\b|\bjazz|beatles|rolling stones|\bqueen\b|taylor swift|beyonc|eminem|elvis|\bprince\b|madonna|\bon tour\b|festival|woodstock|\bart\b|\bartists?\b|fashion|\bfood\b|\bchefs?\b|culture|comedian|stand.?up|hollywood|film ?making|\bmovies?\b|celebrit|\bpop\b|singer|songwriter|guitar|\bdance|ballet|opera|broadway/i, null, /\b(musicians?|the band|singer|rapper|concert|music (legend|icon|industry)|chefs?|cuisine|fashion designer|artists? (life|career))\b/i],
  ["dbiz", "doc", "Business & Tech", /steve jobs|enron|theranos|wework|social dilemma|silicon valley|\btech(nology)?\b|google|tesla|\bmusk\b|bitcoin|crypto|wall street|billion|business|start.?up|\bcompany\b|corporat|inventor|\bbanks?\b|stock market|\bbrands?\b|\bftx\b|madoff|\bceo\b|entrepreneur|internet|social media|\bdata\b|hack(er|ing)/i, null, /\b(billionaires?|business empire|entrepreneurs?|tech giant|start-?ups?|silicon valley|wall street|crypto(currency)?|corporate)\b/i],
  ["ukcrime", "uk", "British Crime & Mystery", /midsomer|\bvera\b|line of duty|broadchurch|sherlock|luther|happy valley|shetland|\bmorse\b|endeavour|inspector|poirot|marple|father brown|death in paradise|silent witness|unforgotten|grantchester|whitechapel|the bill\b|taggart|rebus|dci banks|foyle|wycliffe|\bfrost\b|cracker|prime suspect|the fall\b|bancroft|trigger point|the tourist|ridley|karen pirie|annika|the chelsea detective|mcdonald (&|and) dodds|harry wild|agatha raisin|murdoch|wire in the blood|waking the dead|new tricks|dalgliesh|the long call|the sixth commandment|time\b.*\(?2021|tin star|the jury|top boy|blue lights|the responder/i, null, /\b(detective|murder|inspector|police|crime|investigat)/i],
  ["ukperiod", "uk", "Period & Costume Drama", /downton|bridgerton|the crown|peaky blinders|call the midwife|poldark|\bvictoria\b|pride and prejudice|sanditon|the durrells|wolf hall|cranford|north (and|&) south|jane austen|\bemma\b|persuasion|upstairs,? downstairs|belgravia|the last kingdom|the buccaneers|mr selfridge|the paradise|war and peace|vanity fair|little dorrit|bleak house|great expectations|oliver twist|jamaica inn|the forsyte saga|gentleman jack|the gilded|harlots|the luminaries|dickensian|lark rise|the white queen|the white princess|the spanish princess|the tudors|house of the dragon|outlander/i, null, /\b(victorian|edwardian|regency|tudor|georgian|1[6-9]\d0s|period drama|aristocra|nineteenth|18th century|19th century)\b/i],
  ["ukcom", "uk", "British Comedy", /fawlty towers|only fools|the office \((uk|gb)\)|gavin (and|&) stacey|ted lasso|blackadder|mr\.? bean|red dwarf|inbetweeners|peep show|absolutely fabulous|vicar of dibley|father ted|derry girls|^ghosts|fleabag|after life|the it crowd|black books|\bspaced\b|men behaving badly|keeping up appearances|dad'?s army|porridge|yes,? (prime )?minister|alan partridge|^extras$|toast of london|motherland|detectorists|stath lets|friday night dinner|the thick of it|this country|car share|mrs\.? brown|benidorm|not going out|miranda|outnumbered|the young ones|ghosts \(uk\)|starstruck|man like mobeen|people just do nothing|we are lady parts|taskmaster|would i lie to you|qi\b|8 out of 10|the royle family|phoenix nights|early doors|the vicar|still game|rab c|w1a|twenty twelve|uncle\b.*bbc|catastrophe|stag|year of the rabbit|the windsors|plebs|upstart crow|cuckoo|mum\b.*bbc|ghosts/i, null, null, /comedy|sitcom/i],
  ["ukcosy", "uk", "Cosy British", /escape to the (country|chateau)|great british (bake off|menu|sewing bee|railway|garden)|bake off|grand designs|repair shop|all creatures|countryfile|gardeners'? world|location,? location|homes under the hammer|a place in the sun|antiques roadshow|bargain hunt|clarkson'?s farm|yorkshire (vet|farm)|kirstie|george clarke|sarah beeny|james martin|jamie oliver|jamie'?s|nigella|gordon ramsay|rick stein|hairy bikers|top gear|the grand tour|portillo|doc martin|heartbeat|last of the summer wine|amazing spaces|the cotswolds|springwatch|narrowboat/i, null, /\b(baking|bakers|gardening|antiques?|renovat\w*|countryside|dream home)\b/i],
  ["ukclassic", "uk", "British Classics & BBC/ITV favourites", /doctor who|eastenders|coronation street|emmerdale|the bill\b|heartbeat|last of the summer wine|dad'?s army|porridge|only fools|fawlty|yes,? minister|blackadder|upstairs,? downstairs|brideshead|i,? claudius|the good life|open all hours|one foot in the grave|keeping up appearances|are you being served|two ronnies|morecambe|monty python|the avengers|the prisoner|the saint\b|thunderbirds|minder|the sweeney|bergerac|lovejoy|all creatures|the darling buds|poirot|inspector morse|a touch of frost|midsomer|cracker|prime suspect|men behaving badly|red dwarf|absolutely fabulous|the royle family|auf wiedersehen|boys from the blackstuff|tenko|howards'? way|casualty|holby|the onedin line|blake'?s 7/i],
  ["ukspy", "uk", "British Thrillers & Spy", /^bodyguard$|the night manager|slow horses|spooks|\bmi-?[56]\b|killing eve|the capture|little drummer girl|tinker tailor|smiley|the honourable woman|collateral|undeclared war|\bstrike\b|day of the jackal|hijack|the diplomat|vigil|informer|the stranger|^safe$|the missing|^liar$|the split|marcella|the bay|the responder|in the line of fire|the agency|ipcress|the game\b|deep state|london spy|the state|the crow|rogue heroes|the gold|the sixth|baptiste|the widow|the serpent queen|stonehouse|the following events|the pact|the suspect|showtrial|the tower|unforgivable/i, null, /\b(spy|mi5|mi6|espionage|conspiracy|thriller|undercover|terror)/i],
  ["ukmov", "uk", "British Movies", /\bdr\.? no\b|goldfinger|skyfall|spectre|casino royale|no time to die|quantum of solace|from russia with love|thunderball|you only live twice|on her majesty|diamonds are forever|live and let die|man with the golden gun|spy who loved me|moonraker|for your eyes only|octopussy|a view to a kill|living daylights|licen[cs]e to kill|goldeneye|tomorrow never dies|world is not enough|die another day|james bond|\b007\b|harry potter|fantastic beasts|love actually|notting hill|four weddings|about time|bridget jones|the boat that rocked|^yesterday$|lock,? stock|^snatch$|rocknrolla|the gentlemen|sherlock holmes|wrath of man|the covenant|operation fortune|ungentlemanly warfare|paddington|kingsman|hot fuzz|shaun of the dead|the world'?s end|trainspotting|billy elliot|the full monty|the king'?s speech|darkest hour|^1917$|dunkirk|theory of everything|the imitation game|layer cake|in bruges|sexy beast|the italian job|wallace (and|&) gromit|chicken run|withnail|brassed off|calendar girls|johnny english|the history boys|atonement|sense and sensibility|shakespeare in love|the holiday|the englishman who|educating rita|gandhi|chariots of fire|a fish called wanda|the remains of the day|howards end|a room with a view|zulu|the dam busters|the lady ?killers|kind hearts|lawrence of arabia|the bridge on the river kwai|enola holmes|belfast|aftersun|the banshees of inisherin|saltburn|how to have sex|rye lane|wonka|the lost king\b|living\b.*2022|the duke|operation mincemeat|empire of light|the railway children|downton abbey|mrs\.? harris|the father|the dig|ammonite|military wives|the personal history of david copperfield|emma\.?|rocketman|bohemian rhapsody|yesterday/i, ["movies"]],
  ["ukdoc", "uk", "British Documentaries & Nature", /attenborough|planet earth|blue planet|frozen planet|seven worlds|dynasties|life on earth|the hunt\b|perfect planet|wild isles|springwatch|bbc earth|louis theroux|stacey dooley|ross kemp|simon reeve|michael palin|joanna lumley|david starkey|lucy worsley|mary beard|brian cox|stephen fry|billy connolly|ray mears|bear grylls|clarkson|the green planet|a perfect planet|our planet|life in colou?r|earth\b.*bbc|britain'?s/i, null, null, /documentary/i],
  ["ukroyal", "uk", "Royals & History", /\broyals?\b|the crown|\bqueen (elizabeth|victoria|mary|anne|of scots)|king (charles|henry|george|edward|richard|arthur)|prince (harry|william|philip|charles|andrew)|princess (diana|margaret|anne)|\bdiana\b|windsors?\b|\btudors?\b|henry viii|wolf hall|monarch|buckingham|\bvictoria\b|elizabeth i\b|plantagenet|spencer|the white (queen|princess)|the spanish princess|the king'?s speech|victoria (&|and) abdul|mary queen|the young victoria|the favourite|history of (britain|england)|churchill|the last kingdom|anne boleyn|harry (&|and) meghan|the lost king\b|the gunpowder/i]
];
var COLL_BY = {}; COLLS.forEach(function (c) { COLL_BY[c[0]] = c; });
var COLL_GROUPS = { doc: { title: "Documentaries", icon: "\uD83C\uDF0D ", fav: ["subs", "Documentary"], col: "#2a4f8a" }, uk: { title: "British", icon: "\uD83C\uDDEC\uD83C\uDDE7 ", fav: ["cc", "UK"], col: "#7a1a2a" } };
var UK_PLOT = /\b(british|britain|england|english (village|countryside|seaside|town)|london|londoners?|scotland|scottish|wales|welsh|yorkshire|cornwall|cornish|cotswolds|oxford|cambridge|\bbbc\b|itv|channel 4|northern ireland|belfast|manchester|liverpool|birmingham|glasgow|edinburgh|newcastle|bristol|royal family|buckingham|scotland yard|mi5|mi6)\b/i;
var UK_STRONG = /midsomer|\bvera\b|line of duty|broadchurch|sherlock|luther|happy valley|shetland|endeavour|inspector morse|\blewis\b|poirot|marple|father brown|death in paradise|silent witness|unforgotten|grantchester|whitechapel|taggart|rebus|dci banks|foyle|downton|bridgerton|the crown|peaky blinders|call the midwife|poldark|the durrells|wolf hall|cranford|fawlty|only fools|gavin (and|&) stacey|blackadder|mr\.? bean|red dwarf|inbetweeners|peep show|absolutely fabulous|vicar of dibley|father ted|derry girls|fleabag|after life|it crowd|black books|dad'?s army|yes,? (prime )?minister|alan partridge|detectorists|friday night dinner|thick of it|taskmaster|great british|bake off|grand designs|repair shop|all creatures great|clarkson'?s farm|top gear|the grand tour|doctor who|eastenders|coronation street|emmerdale|night manager|slow horses|spooks|killing eve|the capture|ted lasso|doc martin|heartbeat|attenborough|planet earth|blue planet|louis theroux|the tudors|the last kingdom|harry potter|james bond|\b007\b|paddington|kingsman|wallace (and|&) gromit|the windsors|gentleman jack|top boy|the bill\b|monty python|agatha christie/i;
var UK_TAG = /\((gb|uk)\)|[_ -]uk$|\bbritbox\b/i;
function collGroupsOn() { if (!PF) return []; var f = favOf(PF), o = []; for (var g in COLL_GROUPS) { var k = COLL_GROUPS[g].fav; if (f[k[0]].indexOf(k[1]) >= 0) o.push(g); } return o; }
/* categories to read for a group (visible ones; BritBox is English with subtitles, so it is read for British too) */
function collSources(type, g) {
  var res = [];
  (cats[type] || []).forEach(function (c) {
    if (c.adult) return; var up = c.up, vis = catVisibleV(c);
    if (g === "doc") {
      if (vis && /DOCU|DOKU/.test(up) && /^(EN|US|UK|CA|MULTI)$/.test(c.code || "")) res.push(c);
      else if (vis && type === "series" && /ORIGINAL (MAX|NETFLIX|DISNEY|AMAZON|APPLE)|ENGLISH MULTISUB|\|EN\| ✪ (SERIES|NETFLIX|HBO|AMAZON|SPORT TV SHOWS|NEW RELEASE|ORIGINAL VIAPLAY|REALITY)/.test(up)) res.push(c);
      else if (vis && type === "movies" && /\|EN\| ✪ (4K ULTRA|NETFLIX MULTI SUB)|ORIGINAL HBO MAX MULTI|ORIGINAL NETFLIX  ?(4K )?MULTI/.test(up)) res.push(c);
    } else {
      if (/BRITBOX|\|UK\||BRITISH/.test(up)) res.push(c);
      else if (vis && type === "series" && /\|EN\| ✪ (SERIES|CRIME|COMEDY|MULTISUB|NETFLIX|HBO|AMAZON|SERIES 4K|NEW RELEASE|DOCUMENTARY|REALITY|ORIGINAL VIAPLAY)|ENGLISH MULTISUB|ORIGINAL (MAX|NETFLIX|AMAZON|APPLE)/.test(up)) res.push(c);
      else if (vis && type === "movies" && /\|EN\| ✪ (4K ULTRA|\s*CLASSIC|COMEDY|NETFLIX MULTI SUB|KIDS|ACTION|GANGSTER|SCIENCE FICTION|DOCUMENTARY)|ORIGINAL HBO MAX MULTI|TOP WATCH BLURAY|CRAVE MOVIES|ORIGINAL NETFLIX DOCUMENTARY/.test(up)) res.push(c);
    }
  });
  return res;
}
function collIsDoc(it, c) { if (it.t === "series" && it.genre && !/documentar/i.test(it.genre)) return false; return /DOCU|DOKU/.test(c.up) || /documentar/i.test(it.genre || "") || DOC_ALLOW.test(String(it.n).trim()) && (!/^senna$/i.test(String(it.n).trim()) || !it.y || it.y === "2010"); }
function collIsUK(it, c) { return /BRITBOX|\|UK\||BRITISH/.test(c.up) || UK_TAG.test(it.n) || (it.t === "series" && UK_PLOT.test(it.plot || "")); }
function collText(it) { return String(it.n || "") + (it.t === "series" ? " \u2016 " + (it.plot || "") : ""); }
var COLLC = {};
function collCompute(type, g) {
  var key = type + ":" + g + ":" + (PF ? PF.id : "") + ":" + (adultOk() ? 1 : 0);
  if (COLLC[key]) return COLLC[key];
  var src = collSources(type, g);
  var p = Promise.all(src.map(function (c) { return settle(loadCat(c)).then(function (l) { return { c: c, l: l }; }); })).then(function (res) {
    var out = {}, seen = {};
    COLLS.forEach(function (cd) { if (cd[1] === g && (!cd[4] || cd[4].indexOf(type) >= 0)) out[cd[0]] = []; });
    res.forEach(function (r) {
      r.l.forEach(function (it) {
        if (!itemOK(it) || !it.ic) return;
        var k = normTitle(it), name = String(it.n || ""), txt = collText(it);
        if (g === "doc") {
          if (!collIsDoc(it, r.c)) return;
          COLLS.forEach(function (cd) { if (cd[1] !== "doc" || !out[cd[0]]) return; var re = cd[3]; var hit = re.test(name) || (it.t === "series" && cd[5] && cd[5].test(it.plot || "")); if (hit) add(cd[0], it, k); });
        } else {
          var uk = UK_STRONG.test(name) || (type === "movies" && COLL_BY.ukmov[3].test(name)) || collIsUK(it, r.c); if (!uk) return;
          COLLS.forEach(function (cd) {
            if (cd[1] !== "uk" || !out[cd[0]]) return;
            var hit = cd[3].test(name);
            // a British title can also join by its plot / genre (series only), never by plot alone for non-British items
            if (!hit && it.t === "series" && cd[5] && cd[5].test(it.plot || "")) hit = true;
            if (!hit && it.t === "series" && cd[6] && cd[6].test(it.genre || "")) hit = true;
            if (!hit && cd[0] === "ukdoc" && /documentar/i.test(it.genre || "") ) hit = true;
            if (!hit && cd[0] === "ukclassic" && it.y && +it.y > 1950 && +it.y <= 2000 && it.t === "series" && /BRITBOX/.test(r.c.up)) hit = true;
            if (hit) add(cd[0], it, k);
          });
        }
      });
    });
    function add(id, it, k) { var s = seen[id] = seen[id] || {}; if (s[k]) return; s[k] = 1; out[id].push(it); }
    for (var id in out) {
      out[id].sort(function (a, b) { return (b.r || 0) - (a.r || 0) + ((b.a || 0) - (a.a || 0)) / 3e8; });
      out[id].forEach(function (it) { COLLIDX[itemKey(it)] = id; });
    }
    return out;
  });
  COLLC[key] = p; return p;
}
var COLLIDX = {};
/* learning: watching a title from a collection lifts that collection */
var _addWatchTimeV44 = addWatchTime;
addWatchTime = function (it, sec) { _addWatchTimeV44(it, sec); try { var id = COLLIDX[itemKey(it)]; if (id) learnAdd("coll", id, sec / 60); } catch (e) {} };
function collOrder(type, g, out) {
  var ids = COLLS.filter(function (c) { return c[1] === g && out[c[0]] && out[c[0]].length >= COLL_MIN; }).map(function (c, i) { return { id: c[0], s: -i + 4 * learnScore("coll", c[0]) / (learnMax("coll") || 1) }; });
  ids.sort(function (a, b) { return b.s - a.s; });
  return ids.map(function (x) { return x.id; });
}
function collRowSpec(type, g, id, idx) {
  // the row asks for the collection; it shows nothing (and is skipped) if the collection is too small
  return { title: COLL_GROUPS[g].icon + COLL_BY[id][2], coll: id, load: function () { return collCompute(type, g).then(function (out) { var l = out[id] || []; return l.length >= COLL_MIN ? l.slice(0, 40) : []; }); } };
}
/* rows go right after Continue Watching; order: learned collections first, then the default list order */
function collRowsFor(type) {
  var groups = collGroupsOn(); if (!groups.length || (type !== "movies" && type !== "series")) return [];
  var rows = [], tiles = [];
  groups.forEach(function (g) {
    var gd = COLL_GROUPS[g]; XT["coll:" + type + ":" + g] = { label: gd.title };
    tiles.push({ t: "tile", id: "coll:" + type + ":" + g, n: gd.title, sub: (type === "movies" ? "Movie" : "Show") + " collections", col: gd.col });
  });
  rows.push({ title: "Collections for " + PF.name, kind: "t", local: true, load: function () { return Promise.resolve(tiles); } });
  groups.forEach(function (g) {
    var known = COLLC[type + ":" + g + ":" + PF.id + ":" + (adultOk() ? 1 : 0)];
    var ids = COLLS.filter(function (c) { return c[1] === g && (!c[4] || c[4].indexOf(type) >= 0); }).map(function (c) { return c[0]; });
    ids.sort(function (a, b) { return learnScore("coll", b) - learnScore("coll", a); });
    ids.forEach(function (id, i) { rows.push(collRowSpec(type, g, id, i)); });
  });
  return rows;
}
var _curatedRowsV44 = curatedRows;
curatedRows = function (type) {
  var rows = _curatedRowsV44(type), add = collRowsFor(type); if (!add.length) return rows;
  var i = rows.length && rows[0].title === "Continue Watching" ? 1 : 0;
  return rows.slice(0, i).concat(add, rows.slice(i));
};
/* pages: group page = subcategory tiles + every row; collection page = all titles */
function collPageSpecs(type, id) {
  var m = /^coll:(movies|series):(doc|uk)(?::(\w+))?$/.exec(id); if (!m) return [];
  var g = m[2], one = m[3];
  if (one) return [{ title: COLL_GROUPS[g].icon + COLL_BY[one][2], load: function () { return collCompute(type, g).then(function (out) { return out[one] || []; }); } }];
  var rows = [{ title: COLL_GROUPS[g].title + " \u00B7 collections", kind: "t", local: false, load: function () {
    return collCompute(type, g).then(function (out) {
      return collOrder(type, g, out).map(function (cid) { var pid = "coll:" + type + ":" + g + ":" + cid; XT[pid] = { label: COLL_GROUPS[g].title + " \u203A " + COLL_BY[cid][2] }; return { t: "tile", id: pid, n: COLL_BY[cid][2], sub: out[cid].length + " titles", col: COLL_GROUPS[g].col }; });
    });
  } }];
  COLLS.forEach(function (c) { if (c[1] === g && (!c[4] || c[4].indexOf(type) >= 0)) rows.push(collRowSpec(type, g, c[0])); });
  return rows;
}
var _openLivePageV44 = openLivePage;
openLivePage = function (id) {
  if (String(id).indexOf("coll:") !== 0) return _openLivePageV44(id);
  learnAdd("tile", id, 0.3);
  V.vstack = V.vstack || []; V.vstack.push({ vpage: V.vpage, r: V.r, col: V.rows[V.r] ? V.rows[V.r].col : 0 });
  V.vpage = { view: V.view, id: id }; buildView(V.view); V.zone = "rows"; V.r = 0; applyFocus();
};
function closeVodPage() {
  var s = (V.vstack || []).pop(); V.vpage = s ? s.vpage : null; buildView(V.view); V.zone = "rows";
  if (s && V.rows.length) { V.r = Math.min(s.r, V.rows.length - 1); var row = V.rows[V.r]; row.col = s.col; row.off = Math.max(0, Math.min(s.col - 1, (row.items ? row.items.length : 99) - row.K.vis + 1)); }
  applyFocus();
}
var _allRowsV44 = allRows;
allRows = function (type) {   // "Every category" mode gets the same curated collections after Continue Watching
  var rows = _allRowsV44(type), add = collRowsFor(type); if (!add.length) return rows;
  var i = rows.length && rows[0].title === "Continue Watching" ? 1 : 0;
  return rows.slice(0, i).concat(add, rows.slice(i));
};
var _specsForV44 = specsFor;
specsFor = function (view) {
  if (V.vpage && V.vpage.view !== view) { V.vpage = null; V.vstack = []; }
  if (V.vpage && (view === "movies" || view === "series")) return collPageSpecs(view, V.vpage.id);
  return _specsForV44(view);
};
/* box/debug: counts and samples */
function collReport(type, g) { return collCompute(type, g).then(function (out) { var o = {}; for (var k in out) o[COLL_BY[k][2]] = [out[k].length].concat(out[k].slice(0, 3).map(function (x) { return x.n + (x.y ? " (" + x.y + ")" : ""); })); return o; }); }
