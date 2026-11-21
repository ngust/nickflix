#!/usr/bin/env python3
"""NickFlix 4.14 test: taste seed for "Nick", people affinity, rating buttons (details + player), News on Live TV,
daily mix + rotating themed rows.  Uses a small synthetic catalogue with real-world titles (no provider data):
    python3 tools/build.py --config tests/config.test.js --out /tmp/nf414
    python3 tests/t414.py --fixtures /tmp/nf_fx414 --app /tmp/nf414/app       # writes the fixtures + poster images
    NF_APP=/tmp/nf414/app NF_FIXTURES=/tmp/nf_fx414 python3 tools/mock.py &
    python3 tests/t414.py                       # screenshots -> $NF_SHOTS (default /tmp/nf_shots), v414_*.png
"""
import time, json, os, sys, random, hashlib
SHOTS = os.environ.get('NF_SHOTS', '/tmp/nf_shots'); os.makedirs(SHOTS, exist_ok=True)
NOW = int(time.time())
BASE = os.environ.get('NF_BASE', 'http://localhost:8099')
ICON = BASE + '/img/fx/%s.png'
def slug(s): return hashlib.md5(s.encode()).hexdigest()[:10]
# ---------------------------------------------------------------- fixtures
LIVE_CATS = ['CA| NEWS', 'US| NEWS', 'UK| NEWS', 'CA| SPORTS', 'UK| ENTERTAINMENT', 'CA| ENTERTAINMENT', 'EN| NEWS', 'US| SPORTS']
LIVE = {1: ['CA: CBC NEWS NETWORK HD', 'CA: CTV NEWS CHANNEL HD', 'CA: GLOBAL NEWS TORONTO', 'CA: CP24 HD', 'CA: CITYNEWS 24/7 TORONTO', 'CA: CPAC', 'CA: BNN BLOOMBERG HD', 'CA: CBC NEWS EXPLORE'],
        2: ['US: CNN HD', 'US: FOX NEWS CHANNEL HD', 'US: MSNBC HD', 'US: CNBC HD', 'US: ABC NEWS LIVE', 'US: NEWSNATION', 'US: NEWSMAX', 'US: C-SPAN', 'US: FOX BUSINESS', 'US: CBS NEWS 24/7', 'US: THE WEATHER CHANNEL'],
        3: ['UK: BBC NEWS HD', 'UK: SKY NEWS HD', 'UK: GB NEWS', 'UK: AL JAZEERA ENGLISH HD', 'UK: BBC WORLD NEWS'],
        4: ['CA: TSN 1 HD', 'CA: SPORTSNET ONTARIO', 'CA: SPORTSNET ONE'], 5: ['UK: BBC ONE HD', 'UK: ITV 1 HD', 'UK: DAVE'], 6: ['CA: CBC TORONTO HD', 'CA: CTV TORONTO', 'CA: CITY TV'],
        7: ['EN: DW ENGLISH', 'EN: FRANCE 24 ENGLISH', 'EN: EURONEWS ENGLISH', 'EN: NHK WORLD JAPAN', 'EN: CNN INTERNATIONAL'], 8: ['US: ESPN HD', 'US: NHL NETWORK']}
VOD_CATS = ['|EN| \u272a ACTION', '|EN| \u272a COMEDY', '|EN| \u272a GANGSTER', '|EN| \u272a SCIENCE FICTION', '|EN| \u272a DOCUMENTARY', '|EN| \u272a CLASSIC', '|EN| \u272a NEW RELEASES 2026', '|EN| \u272a DRAMA']
M = {  # cat index -> [(title, year, rating, tmdb)]
 0: [('Die Hard', 1988, 7.8, 562), ('Heat', 1995, 7.9, 949), ('Baby Driver', 2017, 7.5, 0), ('Mad Max: Fury Road', 2015, 7.6, 0), ('John Wick', 2014, 7.4, 0), ('Point Break', 1991, 7.1, 0), ('Ronin', 1998, 7.0, 0), ('Ford v Ferrari', 2019, 8.0, 0), ('Rush', 2013, 7.7, 0), ('Top Gun: Maverick', 2022, 8.2, 0), ('The Italian Job', 2003, 6.9, 0), ('Gone in Sixty Seconds', 2000, 6.5, 0), ('Bullitt', 1968, 7.3, 0), ('Drive', 2011, 7.5, 0)],
 1: [('The Big Lebowski', 1998, 7.8, 115), ('Super Troopers', 2001, 7.0, 39939), ('Pineapple Express', 2008, 6.9, 0), ('Half Baked', 1998, 6.4, 0), ('Dazed and Confused', 1993, 7.4, 0), ('In Bruges', 2008, 7.6, 0), ('Burn After Reading', 2008, 6.9, 0), ('The Nice Guys', 2016, 7.4, 0), ('Thank You for Smoking', 2005, 7.5, 0), ('The Death of Stalin', 2017, 7.2, 0), ('Office Space', 1999, 7.6, 0), ('Superbad', 2007, 7.6, 0), ('Beerfest', 2006, 6.2, 0), ('Strange Brew', 1983, 6.6, 0), ('Grandma\'s Boy', 2006, 6.9, 0), ('Zoolander', 2001, 6.5, 0), ('Anchorman', 2004, 7.2, 0), ('Idiocracy', 2006, 6.6, 0), ('Rushmore', 1998, 7.6, 0), ('The Royal Tenenbaums', 2001, 7.6, 0), ('Seven Psychopaths', 2012, 7.2, 0), ('Vicky Cristina Barcelona', 2008, 7.1, 5038), ('Rom Com Generic', 2024, 5.6, 0), ('Holiday Love Story', 2025, 5.2, 0)],
 2: [('Pulp Fiction', 1994, 8.5, 680), ('Goodfellas', 1990, 8.5, 0), ('Casino', 1995, 8.2, 0), ('Scarface', 1983, 8.2, 0), ('The Departed', 2006, 8.2, 0), ('Snatch', 2000, 7.8, 0), ('Reservoir Dogs', 1992, 8.1, 0), ('The Town', 2010, 7.5, 0), ('Inside Man', 2006, 7.6, 0), ('American Gangster', 2007, 7.5, 0), ('Sicario', 2015, 7.6, 0), ('Blow', 2001, 7.5, 4133), ('The Irishman', 2019, 7.8, 0), ('Lock, Stock and Two Smoking Barrels', 1998, 8.1, 0), ('Den of Thieves', 2018, 7.0, 0), ('Hell or High Water', 2016, 7.6, 0), ('The Wolf of Wall Street', 2013, 8.0, 106646), ('Mr. Brooks', 2007, 7.2, 3432)],
 3: [('Inception', 2010, 8.4, 0), ('Interstellar', 2014, 8.4, 0), ('Arrival', 2016, 7.6, 0), ('Annihilation', 2018, 6.9, 0), ('Ex Machina', 2015, 7.6, 0), ('The Matrix', 1999, 8.2, 0), ('Primer', 2004, 6.8, 0), ('Tenet', 2020, 7.2, 0), ('Moon', 2009, 7.6, 0), ('Looper', 2012, 7.0, 0), ('Dune', 2021, 7.8, 0), ('Rogue One: A Star Wars Story', 2016, 7.5, 0), ('Solo: A Star Wars Story', 2018, 6.6, 0), ('Serenity', 2005, 7.4, 0), ('The Martian', 2015, 7.7, 0), ('Blade Runner 2049', 2017, 7.5, 0), ('A Scanner Darkly', 2006, 7.0, 3509), ('Donnie Darko', 2001, 7.8, 0), ('Edge of Tomorrow', 2014, 7.6, 0), ('Guardians of the Galaxy', 2014, 7.9, 0)],
 4: [('Fahrenheit 9/11', 2004, 7.4, 0), ('Inside Job', 2010, 7.8, 0), ('Citizenfour', 2014, 7.5, 0), ('The Social Dilemma', 2020, 7.6, 0), ('Icarus', 2017, 7.9, 0), ('Man on Wire', 2008, 7.7, 0), ('Senna', 2010, 8.5, 0), ('Free Solo', 2018, 8.1, 0), ('The Fog of War', 2003, 8.1, 0), ('102 Minutes That Changed America', 2008, 8.4, 0), ('Apollo 11', 2019, 8.1, 0), ('The Great Hack', 2019, 7.0, 0), ('Knock Down the House', 2019, 7.2, 0), ('Navalny', 2022, 7.8, 0), ('Blackfish', 2013, 8.0, 0)],
 5: [('Fight Club', 1999, 8.8, 550), ('Fear and Loathing in Las Vegas', 1998, 7.6, 1878), ('The Life Aquatic with Steve Zissou', 2004, 7.3, 421), ('Raising Arizona', 1987, 7.3, 0), ('Brazil', 1985, 7.8, 0), ('12 Monkeys', 1995, 8.0, 0), ('The Warriors', 1979, 7.6, 0), ('They Live', 1988, 7.2, 0), ('Escape from New York', 1981, 7.1, 0), ('Big Trouble in Little China', 1986, 7.3, 0), ('Repo Man', 1984, 6.9, 0), ('True Romance', 1993, 7.9, 0), ('Trainspotting', 1996, 8.1, 0), ('Easy Rider', 1969, 7.3, 0), ('Smokey and the Bandit', 1977, 6.9, 0), ('Caddyshack', 1980, 7.2, 0)],
 6: [('One Battle After Another', 2025, 8.1, 1054867), ('New Action Film 2026', 2026, 6.1, 0), ('Space Cowboys Return', 2026, 6.4, 0), ('Heist Night', 2026, 6.6, 0), ('Teen Romance 2', 2026, 5.4, 0), ('Kids Adventure Movie', 2026, 6.0, 0), ('Cartel Kingpin', 2026, 6.5, 0), ('The Garage', 2026, 6.3, 0)],
 7: [('The Shawshank Redemption', 1994, 9.3, 0), ('Forrest Gump', 1994, 8.8, 0), ('Period Drama', 2023, 6.1, 0), ('Courtroom Story', 2022, 6.4, 0)]}
SERIES_CATS = ['|EN| \u272a SERIES', '|EN| \u272a COMEDY SERIES', '|EN| \u272a DOCUMENTARY SERIES', '|EN| \u272a CRIME SERIES', '|EN| \u272a SCI-FI SERIES']
S = {  # (title, year, genre, cast, director, plot, tmdb)
 0: [('Breaking Bad', 2008, 'Drama / Crime', 'Bryan Cranston, Aaron Paul, Anna Gunn, Dean Norris', 'Vince Gilligan', 'A chemistry teacher turns to making meth.', 1396), ('Better Call Saul', 2015, 'Crime / Drama', 'Bob Odenkirk, Rhea Seehorn, Jonathan Banks', 'Vince Gilligan', 'A lawyer\'s transformation.', 60059),
     ('Game of Thrones', 2011, 'Sci-Fi & Fantasy / Drama', 'Peter Dinklage, Emilia Clarke, Kit Harington, Pedro Pascal', '', 'Noble families fight for the throne.', 1399), ('The Mandalorian', 2019, 'Sci-Fi & Fantasy / Action & Adventure / Western', 'Pedro Pascal, Katee Sackhoff', 'Jon Favreau', 'A lone bounty hunter in the outer reaches of the galaxy.', 82856),
     ('The Book of Boba Fett', 2021, 'Sci-Fi & Fantasy / Action & Adventure / Western', 'Temuera Morrison, Ming-Na Wen, Pedro Pascal', 'Jon Favreau', 'Boba Fett takes over the underworld.', 0),
     ('Andor', 2022, 'Sci-Fi & Fantasy / Action & Adventure', 'Diego Luna, Stellan Skarsgard', 'Tony Gilroy', 'A Star Wars spy thriller.', 0), ('The Last of Us', 2023, 'Drama', 'Pedro Pascal, Bella Ramsey', 'Craig Mazin', 'Survivors cross a ruined America.', 0),
     ('Succession', 2018, 'Drama', 'Brian Cox, Jeremy Strong', '', 'A media dynasty fights over control.', 0), ('Ozark', 2017, 'Crime / Drama', 'Jason Bateman, Laura Linney', '', 'A financial planner launders money for a cartel.', 0),
     ('The Sopranos', 1999, 'Crime / Drama', 'James Gandolfini, Edie Falco', 'David Chase', 'A mob boss in therapy.', 0), ('Slow Horses', 2022, 'Drama / Crime', 'Gary Oldman, Jack Lowden', '', 'Disgraced spies.', 0),
     ('Yellowstone', 2018, 'Drama / Western', 'Kevin Costner, Kelly Reilly', 'Taylor Sheridan', 'A ranching family in Montana.', 0), ('The Bear', 2022, 'Comedy / Drama', 'Jeremy Allen White', '', 'A chef runs a sandwich shop.', 0),
     ('Generic Hospital', 2021, 'Drama', 'Jane Doe', '', 'Doctors and nurses.', 0), ('Teen Drama High', 2023, 'Drama', 'John Roe', '', 'High school life.', 0)],
 1: [('Seinfeld', 1989, 'Comedy', 'Jerry Seinfeld, Julia Louis-Dreyfus, Jason Alexander, Michael Richards', 'Larry David', 'A show about nothing.', 1400), ('Trailer Park Boys', 2001, 'Comedy / Crime', 'Robb Wells, John Paul Tremblay, Mike Smith', 'Mike Clattenburg', 'Mockumentary about Nova Scotia trailer park residents.', 3796),
     ('Letterkenny', 2016, 'Comedy', 'Jared Keeso, Nathan Dales', 'Jacob Tierney', 'Canadian small-town life.', 0), ('Corner Gas', 2004, 'Comedy', 'Brent Butt', '', 'Life in Dog River, Saskatchewan.', 0), ('Schitt\'s Creek', 2015, 'Comedy', 'Eugene Levy, Dan Levy', '', 'A rich family loses everything.', 0),
     ('Kim\'s Convenience', 2016, 'Comedy', 'Paul Sun-Hyung Lee', '', 'A Korean-Canadian family store in Toronto.', 0), ('Shoresy', 2022, 'Comedy', 'Jared Keeso', '', 'Hockey in Sudbury.', 0), ('What We Do in the Shadows', 2019, 'Comedy', 'Kayvan Novak, Matt Berry', '', 'Vampire flatmates mockumentary.', 0),
     ('The Office', 2005, 'Comedy', 'Steve Carell, Rainn Wilson', '', 'A mockumentary on office workers.', 0), ('Parks and Recreation', 2009, 'Comedy', 'Amy Poehler', '', 'Small-town government.', 0), ('Archer', 2009, 'Animation / Comedy / Action & Adventure', 'H. Jon Benjamin, Aisha Tyler', 'Adam Reed', 'A spy agency.', 10283),
     ('Rick and Morty', 2013, 'Animation / Comedy / Sci-Fi & Fantasy', 'Justin Roiland, Chris Parnell', 'Dan Harmon', 'A mad scientist and his grandson.', 60625), ('South Park', 1997, 'Animation / Comedy', 'Trey Parker, Matt Stone', '', 'Four boys in a Colorado town.', 2190), ('Barry', 2018, 'Comedy / Crime / Drama', 'Bill Hader', '', 'A hitman takes acting classes.', 0),
     ('Curb Your Enthusiasm', 2000, 'Comedy', 'Larry David', '', 'Larry David plays himself.', 0), ('It\'s Always Sunny in Philadelphia', 2005, 'Comedy', 'Charlie Day', '', 'Five friends run a bar.', 0), ('Veep', 2012, 'Comedy', 'Julia Louis-Dreyfus', '', 'A vice president.', 0)],
 2: [('How It\'s Made', 2001, 'Documentary', '', '', 'How everyday objects are manufactured.', 1749), ('Top Gear', 2002, 'Documentary / Reality', 'Jeremy Clarkson, Richard Hammond, James May', '', 'Cars, challenges and power laps.', 45), ('The Grand Tour', 2016, 'Documentary / Reality', 'Jeremy Clarkson, Richard Hammond, James May', '', 'Three men travel the world in cars.', 0),
     ('Formula 1: Drive to Survive', 2019, 'Documentary', '', '', 'Behind the scenes of F1 racing.', 0), ('Megafactories', 2006, 'Documentary', '', '', 'Inside the world\'s biggest factories.', 0), ('Modern Marvels', 1993, 'Documentary', '', '', 'Engineering and inventions.', 0), ('MythBusters', 2003, 'Documentary', 'Adam Savage, Jamie Hyneman', '', 'Testing myths with science.', 0),
     ('Car SOS', 2013, 'Documentary / Reality', 'Tim Shaw, Fuzz Townshend', '', 'Restoring classic cars.', 0), ('Wheeler Dealers', 2003, 'Documentary / Reality', 'Mike Brewer', '', 'Buying and fixing cars.', 0), ('Cosmos: A Spacetime Odyssey', 2014, 'Documentary', 'Neil deGrasse Tyson', '', 'The universe explained.', 0),
     ('The Vietnam War', 2017, 'Documentary / War & Politics', '', 'Ken Burns', 'The history of the war.', 0), ('Turning Point: 9/11 and the War on Terror', 2021, 'Documentary / War & Politics', '', '', 'The September 11 attacks and two decades of war.', 0),
     ('Dirty Money', 2018, 'Documentary', '', '', 'Corporate greed and corruption investigated.', 0), ('Wild Wild Country', 2018, 'Documentary', '', '', 'A cult in Oregon.', 0), ('Making a Murderer', 2015, 'Documentary / Crime', '', '', 'A true crime case.', 0), ('Planet Earth', 2006, 'Documentary', 'David Attenborough', '', 'Nature on our planet.', 0),
     ('Street Outlaws', 2013, 'Reality', '', '', 'Street racing.', 0), ('Gold Rush', 2010, 'Reality', '', '', 'Gold miners in the Yukon.', 0)],
 3: [('Mr. Robot', 2015, 'Crime / Drama / Mystery', 'Rami Malek, Christian Slater, Carly Chaikin', 'Sam Esmail', 'A hacker joins a group of cyber vigilantes.', 62560), ('Narcos', 2015, 'Crime / Drama', 'Wagner Moura, Pedro Pascal, Boyd Holbrook', '', 'The rise of drug cartels in Colombia.', 0),
     ('Peaky Blinders', 2013, 'Crime / Drama', 'Cillian Murphy', '', 'A gangster family in Birmingham.', 0), ('Money Heist', 2017, 'Crime / Action & Adventure', 'Ursula Corbero', '', 'A heist on the Royal Mint.', 0), ('The Wire', 2002, 'Crime / Drama', 'Dominic West, Idris Elba', 'David Simon', 'Drugs and the police in Baltimore.', 0),
     ('Fargo', 2014, 'Crime / Drama / Comedy', 'Billy Bob Thornton', '', 'Crime in the Midwest; darkly comic.', 0), ('True Detective', 2014, 'Crime / Drama / Mystery', 'Matthew McConaughey, Woody Harrelson', '', 'Detectives hunt a killer.', 0), ('Mindhunter', 2017, 'Crime / Drama', 'Jonathan Groff', 'David Fincher', 'FBI agents interview serial killers.', 0),
     ('Boardwalk Empire', 2010, 'Crime / Drama', 'Steve Buscemi', 'Martin Scorsese', 'Prohibition-era Atlantic City.', 0), ('Griselda', 2024, 'Crime / Drama', 'Sofia Vergara', '', 'A cocaine kingpin.', 0), ('Police Procedural', 2022, 'Crime', 'Jane Cop', '', 'Cops solve cases.', 0)],
 4: [('Black Mirror', 2011, 'Sci-Fi & Fantasy / Drama / Mystery', 'Various', 'Charlie Brooker', 'Technology turns dark.', 42009), ('Stranger Things', 2016, 'Sci-Fi & Fantasy / Drama / Mystery', 'Millie Bobby Brown, David Harbour, Winona Ryder', '', 'Kids face supernatural forces.', 66732),
     ('Severance', 2022, 'Sci-Fi & Fantasy / Drama / Mystery', 'Adam Scott, Britt Lower, John Turturro', 'Ben Stiller', 'Office workers have their memories split.', 95396), ('The X-Files', 1993, 'Sci-Fi & Fantasy / Mystery / Drama', 'David Duchovny, Gillian Anderson', 'Chris Carter', 'FBI agents investigate the paranormal and a government conspiracy.', 4087),
     ('Westworld', 2016, 'Sci-Fi & Fantasy / Western', 'Evan Rachel Wood, Jeffrey Wright', '', 'An android theme park.', 0), ('Dark', 2017, 'Sci-Fi & Fantasy / Mystery', 'Louis Hofmann', '', 'Time travel in a German town.', 0), ('Devs', 2020, 'Sci-Fi & Fantasy / Drama', 'Sonoya Mizuno, Nick Offerman', 'Alex Garland', 'A tech company and a simulation.', 0),
     ('Silo', 2023, 'Sci-Fi & Fantasy / Drama', 'Rebecca Ferguson', '', 'A dystopian underground city.', 0), ('Foundation', 2021, 'Sci-Fi & Fantasy', 'Jared Harris', '', 'A galaxy-spanning empire falls.', 0), ('The Expanse', 2015, 'Sci-Fi & Fantasy / Drama', 'Steven Strait', '', 'Humanity colonised the solar system; a spaceship crew.', 0),
     ('Firefly', 2002, 'Sci-Fi & Fantasy / Western', 'Nathan Fillion', 'Joss Whedon', 'A space western about a smuggler crew.', 0), ('Star Trek: Strange New Worlds', 2022, 'Sci-Fi & Fantasy', 'Anson Mount', '', 'Starship Enterprise.', 0), ('Fringe', 2008, 'Sci-Fi & Fantasy / Mystery', 'Anna Torv', '', 'Parallel universes.', 0),
     ('Upload', 2020, 'Sci-Fi & Fantasy / Comedy', 'Robbie Amell', '', 'Digital afterlife.', 0), ('Kids Space Cartoon', 2022, 'Animation / Kids', '', '', 'Cartoon.', 0)]}
def write_fixtures(d, app):
    os.makedirs(d, exist_ok=True)
    lc = [{'category_id': str(i + 1), 'category_name': n} for i, n in enumerate(LIVE_CATS)]
    ls = []
    for c, names in LIVE.items():
        for i, n in enumerate(names): ls.append({'name': n, 'stream_id': c * 1000 + i, 'stream_icon': '', 'category_id': str(c), 'epg_channel_id': 'x%d' % (c * 1000 + i)})
    vc = [{'category_id': str(100 + i), 'category_name': n} for i, n in enumerate(VOD_CATS)]
    vs, titles = [], []
    for ci, lst in M.items():
        for i, (t, y, r, tm) in enumerate(lst):
            sid = (100 + ci) * 1000 + i; titles.append(t)
            vs.append({'name': '%s (%d)' % (t, y), 'stream_id': sid, 'stream_icon': ICON % slug(t), 'rating': str(r), 'added': str(NOW - ((i * 37 + ci * 11) % 300) * 86400 - (0 if y < 2026 else -1)), 'tmdb': str(tm or 700000 + sid), 'container_extension': 'mp4', 'category_id': str(100 + ci)})
    sc = [{'category_id': str(200 + i), 'category_name': n} for i, n in enumerate(SERIES_CATS)]
    ss = []
    for ci, lst in S.items():
        for i, (t, y, g, cast, dr, plot, tm) in enumerate(lst):
            sid = (200 + ci) * 1000 + i; titles.append(t)
            ss.append({'name': t, 'series_id': sid, 'cover': ICON % slug(t), 'plot': plot, 'genre': g, 'cast': cast, 'director': dr, 'releaseDate': '%d-01-01' % y, 'rating': str(round(6.5 + (i * 7 + ci) % 25 / 10, 1)), 'last_modified': str(NOW - ((i * 17 + ci) % 200) * 43200), 'tmdb': str(tm or 800000 + sid), 'category_id': str(200 + ci), 'backdrop_path': []})
    for name, data in [('live_cats.json', lc), ('live_streams.json', ls), ('vod_cats.json', vc), ('vod_streams.json', vs), ('series_cats.json', sc), ('series.json', ss)]:
        json.dump(data, open(os.path.join(d, name), 'w'))
    if app:   # simple poster art so the screenshots look like a catalogue
        from PIL import Image, ImageDraw, ImageFont
        out = os.path.join(app, 'img', 'fx'); os.makedirs(out, exist_ok=True)
        font = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools', 'fonts', 'Anton-Regular.ttf')
        for t in set(titles):
            h = int(hashlib.md5(t.encode()).hexdigest(), 16); c1 = ((h >> 8) % 160 + 40, (h >> 16) % 120 + 20, (h >> 24) % 160 + 50); c2 = (c1[0] // 4, c1[1] // 4, c1[2] // 4)
            im = Image.new('RGB', (300, 450), c2); dr = ImageDraw.Draw(im)
            for yy in range(450): dr.line([(0, yy), (300, yy)], fill=tuple(int(c1[k] + (c2[k] - c1[k]) * yy / 450) for k in range(3)))
            words, lines, cur = t.upper().split(), [], ''
            for w in words:
                if len(cur + ' ' + w) > 12 and cur: lines.append(cur); cur = w
                else: cur = (cur + ' ' + w).strip()
            lines.append(cur); f = ImageFont.truetype(font, 46)
            y0 = 300 - len(lines) * 26
            for ln in lines:
                wdt = dr.textlength(ln, font=f); dr.text(((300 - wdt) / 2, y0), ln, font=f, fill=(255, 255, 255)); y0 += 52
            im.save(os.path.join(out, slug(t) + '.png'))
    print('fixtures written to', d, '(%d movies, %d shows, %d channels)' % (len(vs), len(ss), len(ls)))
if '--fixtures' in sys.argv:
    a = sys.argv; write_fixtures(a[a.index('--fixtures') + 1], a[a.index('--app') + 1] if '--app' in a else None); sys.exit(0)
# ---------------------------------------------------------------- test
from playwright.sync_api import sync_playwright
FAKE = r'''
(function(){
  var st="NONE",L=null,t=0,timer=null,url="";
  window.webapis={avplay:{
    open:function(u){url=u;st="IDLE";t=0;}, close:function(){st="NONE";clearInterval(timer);}, stop:function(){if(st!=="NONE")st="IDLE";},
    setListener:function(l){L=l;}, setDisplayRect:function(){}, setDisplayMethod:function(){}, setBufferingParam:function(){}, setTimeoutForBuffering:function(){},
    setStreamingProperty:function(){}, getStreamingProperty:function(){return "";},
    prepareAsync:function(ok){var u=url;setTimeout(function(){if(u!==url||st!=="IDLE")return;st="READY";ok();},200);},
    play:function(){st="PLAYING";clearInterval(timer);timer=setInterval(function(){if(st==="PLAYING")t+=500;},500);},
    pause:function(){st="PAUSED";}, getState:function(){return st;}, getCurrentTime:function(){return t;}, getDuration:function(){return 7200000;},
    seekTo:function(ms,ok){t=ms;ok&&ok();}, jumpForward:function(){}, jumpBackward:function(){},
    getTotalTrackInfo:function(){return [];}, getCurrentStreamInfo:function(){return [];}, setSelectTrack:function(){}
  }};
})();
'''
R = {}; ok = True
import atexit
_done = [False]
atexit.register(lambda: None if _done[0] else print('PARTIAL', json.dumps(R, indent=1)))
def chk(name, cond, info=None):
    global ok; R[name] = bool(cond) if info is None else [bool(cond), info]; ok = ok and bool(cond)
HIST = {"st": {}, "hist": [{"k": "movies:999001", "it": {"t": "movies", "id": 999001, "n": "Old Movie", "c": "107"}, "ts": NOW * 1000 - 86400000}], "pos": {}, "list": [],
        "wl": [{"k": "movies:999001", "t": "movie", "n": "Old Movie", "cats": ["Drama", "Movies"], "cc": "", "min": 80, "fr": 1, "ts": NOW * 1000 - 86400000, "st": NOW * 1000 - 90000000, "it": {"t": "movies", "id": 999001, "n": "Old Movie", "c": "107"}}],
        "stats": {"sec": 4800, "titles": {}, "gen": {}, "ch": {}, "chn": {}, "types": {}}}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome')); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(FAKE); ev = pg.evaluate
    # storage is prepared before the app's scripts run (a reload would let the old page save its blank profile on unload)
    pg.add_init_script('''if(!sessionStorage.getItem("__t414")){sessionStorage.setItem("__t414","1");localStorage.clear();localStorage.setItem("nf_intro","0");localStorage.setItem("nf_mini","0");
      localStorage.setItem("nf_profiles",JSON.stringify({list:[{id:"p1",name:"Nick",av:0},{id:"p2",name:"Celia",av:5}],last:"p1",seq:2}));
      localStorage.setItem("nf_p_p1",%s);}''' % json.dumps(json.dumps(HIST)))
    pg.goto(BASE + '/index.html'); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(4)
    # ---- 1. seed
    tp = ev('()=>PD.tp && {seed:PD.tp.seed,v:PD.tp.v,ts:PD.tp.ts,g:PD.tp.gen["Thriller & Crime"],sf:PD.tp.gen["Sci-Fi & Fantasy"],mando:PD.tp.tm["series:82856"],pp:PD.tp.pp["pedro pascal"],n:Object.keys(PD.tp.tl).length}')
    R['seed'] = tp
    chk('seed_applied', tp and tp['seed'] == 'nick-2026-11' and tp['n'] == 30 and tp['mando'] == 2)
    mg = ev('()=>[PD.hist.length, PD.wl.length, PD.stats.sec, PD.hist[0]&&PD.hist[0].k]')
    chk('seed_merges_history', mg[1] == 1 and mg[2] >= 4800 and 'movies:999001' in [mg[3]] , mg)
    chk('affinity_has_seed', ev('()=>affinity()["Thriller & Crime"]>3 && affinity()["Comedy"]>2'))
    chk('backup_still_counts_history_only', ev('()=>{var i=bkInfo(bkCollect());return i.score>=3}'))
    ts0 = tp['ts'] if tp else 0
    pg.reload(); time.sleep(6); pg.keyboard.press('Enter'); time.sleep(3)
    chk('seed_runs_once', ev('()=>PD.tp.ts') == ts0)
    chk('other_profile_not_seeded', ev('()=>{var d=JSON.parse(localStorage.getItem("nf_p_p2")||"{}");return !d.tp}'))
    chk('blank_seeded_profile_is_default', ev('''()=>{var k={nf_profiles:JSON.stringify({list:[{id:"p1",name:"Nick",av:0}]}),nf_p_p1:JSON.stringify({st:{},hist:[],pos:{},list:[],tp:{seed:"x",gen:{a:1}},stats:{sec:0}})};return bkInfo(k).def}'''))
    # ---- 2. Movies home: Top Picks + themed rows, no favourites row
    ev('()=>{poolMem={};localStorage.removeItem("nf_pool_movies");localStorage.removeItem("nf_pool_series");V.navIdx=TAB_VIEWS.indexOf("movies");buildView("movies")}'); time.sleep(8)
    titles = ev('()=>V.rows.map(r=>r.spec.title)'); R['movie_rows'] = titles
    chk('no_favourites_row', not any('favourite' in t.lower() for t in titles))
    th = ev('()=>V.rows.filter(r=>r.spec.theme).map(r=>[r.spec.title,(r.items||[]).length])'); R['themes_movies'] = th
    chk('themed_rows_present', len(th) >= 2 and all(n >= 6 for _, n in th if n), th)
    top = ev('()=>{var r=V.rows.filter(r=>r.spec.hero)[0];return r&&r.items?r.items.slice(0,10).map(i=>i.n):[]}'); R['top_picks'] = top
    junk = {'Rom Com Generic', 'Holiday Love Story', 'Teen Romance 2', 'Kids Adventure Movie', 'Period Drama', 'Courtroom Story'}
    chk('top_picks_taste', len(top) >= 8 and not (set(top[:8]) & junk), top)
    chk('top_picks_title', any(t.startswith('Top Picks for Nick') for t in titles))
    seeds = {'Fight Club', 'Heat', 'The Big Lebowski', 'Die Hard', 'A Scanner Darkly', 'Fear and Loathing in Las Vegas', 'Mr. Brooks', 'One Battle After Another', 'The Wolf of Wall Street', 'Blow', 'Pulp Fiction', 'Vicky Cristina Barcelona', 'The Life Aquatic with Steve Zissou', 'Super Troopers'}
    chk('favourites_not_dominating', len(set(top[:10]) & seeds) <= 3, sorted(set(top[:10]) & seeds))
    # screenshot: scroll to the first themed row
    ev('()=>{var i=V.rows.findIndex(r=>r.spec.theme);V.zone="rows";V.r=Math.max(0,i-1);applyFocus()}'); time.sleep(2.5)
    pg.screenshot(path=SHOTS + '/v414_home_themes.png')
    ev('()=>{var i=V.rows.findIndex(r=>r.spec.theme);var j=V.rows.findIndex((r,k)=>k>i&&r.spec.theme);V.r=Math.max(0,(j>0?j:i)-1);applyFocus()}'); time.sleep(2.5)
    pg.screenshot(path=SHOTS + '/v414_home_themes2.png')
    # ---- 3. daily stability / rotation
    d1 = ev('()=>JSON.stringify(PD.dp.th)')
    ev('()=>buildView("movies")'); time.sleep(3)
    chk('themes_stable_same_day', ev('()=>JSON.stringify(PD.dp.th)') == d1)
    rot = ev('''()=>{var real=Date.now, out=[], cur=PD.dp.th.movies.join(",");
       for(var d=1;d<=4;d++){Date.now=function(){return real()+d*86400000;}; var s=thDaily("movies").map(t=>t.id).join(","); out.push(s);}
       Date.now=real; delete PD.dp; return [cur].concat(out);}''')
    R['theme_rotation'] = rot
    chk('themes_rotate_daily', len(set(rot)) >= 3 and all(rot[i] != rot[i + 1] for i in range(len(rot) - 1)), rot)
    mix = ev('''()=>{var l=[];for(var i=0;i<40;i++)l.push({t:"movies",id:i,n:"T"+i});var a=tsMix(l,"x").map(x=>x.id),b=tsMix(l,"x").map(x=>x.id);
       var real=Date.now;Date.now=function(){return real()+86400000};var c=tsMix(l,"x").map(x=>x.id);Date.now=real;return [a,b,c]}''')
    chk('mix_same_day_stable', mix[0] == mix[1])
    chk('mix_next_day_differs_keeps_top', mix[0] != mix[2] and mix[0][:2] == [0, 1] and mix[2][:2] == [0, 1] and set(mix[0][:10]) <= set(range(18)), mix)
    # ---- 4. details page rating buttons
    ev('()=>{var it=null;cache["movies:102"].forEach(x=>{if(x.n==="Goodfellas")it=x});openDetails(it)}'); time.sleep(2.5)
    chk('rate_buttons_on_details', ev('()=>document.querySelectorAll("#d-body .btn.rate").length') == 3)
    nb = ev('()=>D.ln.lines[0].items.length')
    for _ in range(nb - 2): pg.keyboard.press('ArrowRight'); time.sleep(0.15)   # Play, My List, 3 rating buttons, Back -> on Love it
    pg.keyboard.press('ArrowLeft'); time.sleep(0.2)  # -> I like this
    pg.keyboard.press('Enter'); time.sleep(0.5)
    chk('like_saved', ev('()=>rtGet(D.item)') == 1)
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('Enter'); time.sleep(0.6)
    chk('love_replaces_like', ev('()=>rtGet(D.item)===2 && Object.keys(PD.rt).length===1'))
    pg.screenshot(path=SHOTS + '/v414_details_rating.png')
    pg.keyboard.press('Enter'); time.sleep(0.4)
    chk('toggle_clears', ev('()=>rtGet(D.item)') == 0)
    pg.keyboard.press('Enter'); time.sleep(0.3)   # love again for the rest
    b_love = ev('()=>tasteBoost(D.item)')
    chk('love_boosts', b_love >= 6, b_love)
    pg.keyboard.press('Escape'); time.sleep(0.5)
    # dislike: Top Picks first item -> gone after rebuild, its genres a bit lower
    first = ev('()=>{var r=V.rows.filter(r=>r.spec.hero)[0];return r.items.filter(i=>!rtGet(i))[0]}')
    a0 = ev('(g)=>affinity()[g]||0', 'Thriller & Crime')
    ev('(it)=>rtSet(it,-1)', first)
    chk('dislike_lowers_genre', ev('(g)=>affinity()[g]||0', 'Thriller & Crime') <= a0 + 5)   # Goodfellas love (+5) and the dislike (-1.5)
    ev('()=>{poolMem={};buildView("movies")}'); time.sleep(6)
    top2 = ev('()=>{var r=V.rows.filter(r=>r.spec.hero)[0];return r&&r.items?r.items.map(i=>i.n):[]}')
    allrows = ev('()=>V.rows.filter(r=>!r.spec.local&&r.items).map(r=>r.items.map(i=>i.n)).reduce((a,b)=>a.concat(b),[])')
    chk('dislike_hidden', first['n'] not in top2 and first['n'] not in allrows, first['n'])
    chk('loved_row', any(t.startswith('\u2764') for t in ev('()=>V.rows.map(r=>r.spec.title)')))
    # ---- 5. player rating panel
    ev('()=>{var it=null;cache["movies:103"].forEach(x=>{if(x.n==="Inception")it=x});playItem(it,null,0)}'); time.sleep(4)
    pg.keyboard.press('ArrowDown'); time.sleep(0.4)
    chk('player_down_opens_rate', ev('()=>RP.open'))
    pg.screenshot(path=SHOTS + '/v414_player_rate.png')
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('Enter'); time.sleep(0.4)
    chk('player_love_saved', ev('()=>!RP.open && rtGet(P.item)===2'))
    ev('()=>window.dispatchEvent(new KeyboardEvent("keydown",{keyCode:404,bubbles:true}))'); time.sleep(0.3)
    chk('green_opens_rate', ev('()=>RP.open'))
    pg.keyboard.press('Escape'); time.sleep(0.3)
    chk('back_closes_panel_only', ev('()=>!RP.open && P.open'))
    pg.keyboard.press('ArrowLeft'); time.sleep(0.3)
    chk('scrub_still_works', ev('()=>SC.on'))
    ev('()=>{scCancel();closePlayer()}'); time.sleep(1)
    # ---- 6. people affinity
    ev('async()=>{await loadCat(catById["series:200"]);return 1}')
    pp = ev('''()=>{var bb=null,gh=null,ff=null;cache["series:200"].forEach(x=>{if(x.n==="Breaking Bad")bb=x;if(x.n==="Generic Hospital")gh=x;});
       var m={t:"movies",id:4242,n:"Unknown Movie",c:"107"}; var before=ppBonus(m); mergeInfo(m,{cast:"Al Pacino, Someone",director:"Michael Mann"});
       var m2={t:"movies",id:4242,n:"Unknown Movie",c:"107"};
       return {bb:ppBonus(bb),gh:ppBonus(gh),before:before,cached:ppBonus(m2),top:ppTop(3)}}''')
    R['people'] = pp
    chk('people_bonus', pp['bb'] > 1 and pp['gh'] == 0 and pp['before'] == 0 and pp['cached'] > 1)
    ev('()=>{var it={t:"series",id:5555,n:"Pascal Show",cast:"Pedro Pascal",c:"200"};var b=ppBonus(it);for(var i=0;i<30;i++)addWatchTime(it,10);TSC.v=null;window.__pp=[b,ppBonus(it)]}')
    chk('watching_feeds_people', ev('()=>__pp[1]>__pp[0]'), ev('()=>__pp'))
    ev('()=>{poolMem={};V.navIdx=TAB_VIEWS.indexOf("series");buildView("series")}'); time.sleep(8)
    st = ev('()=>V.rows.map(r=>[r.spec.title,(r.items||[]).length])'); R['series_rows'] = st
    sth = ev('async()=>{var out=[];for(const r of V.rows.filter(r=>r.spec.theme)){var l=await r.spec.load.call(r.spec);out.push([r.spec.title,l.length,l.slice(0,8).map(i=>i.n)])}return out}')
    R['themes_series'] = sth
    chk('series_themes', len([1 for t, n, _ in sth if n >= 6]) >= 3, sth)
    mw = ev('async()=>{var r=V.rows.find(r=>/More with/.test(r.spec.title));if(!r)return null;var l=await r.spec.load.call(r.spec);return [r.spec.title,l.map(i=>i.n)]}')
    R['more_with'] = mw
    chk('more_with_person_row', mw and len(mw[1]) >= 5 and mw[0] != '\U0001F3AC More with\u2026', mw)
    # ---- 7. backup includes ratings
    chk('backup_has_ratings', ev('()=>{var k=bkCollect();var d=JSON.parse(k.nf_p_p1);return Object.keys(d.rt||{}).length>=2}'))
    # ---- 8. Live TV news
    ev('()=>{V.page=null;V.navIdx=TAB_VIEWS.indexOf("live");buildView("live")}'); time.sleep(7)
    hub = ev('()=>V.rows.map(r=>[r.spec.title,(r.items||[]).map(i=>i.n)])'); R['hub'] = [[t, n[:6]] for t, n in hub]
    ni = next((i for i, (t, n) in enumerate(hub) if t.startswith('\U0001F4F0 News')), -1)
    chk('hub_news_row_top', 0 <= ni <= 1 and len(hub[ni][1]) == 4, ni)
    ln = next((n for t, n in hub if 'Live news now' in t), [])
    chk('live_news_now', any('CBC' in x for x in ln) and any('CNN' in x for x in ln) and any('BBC' in x or 'AL JAZEERA' in x.upper() for x in ln), ln)
    ev('()=>{var i=V.rows.findIndex(r=>r.spec.news);V.zone="rows";V.r=i;V.rows[i].col=0;applyFocus()}'); time.sleep(2)
    pg.screenshot(path=SHOTS + '/v414_tv_hub_news.png')
    pg.keyboard.press('Enter'); time.sleep(5)   # first tile = Canada (two clicks from the hub: down/OK)
    ca = ev('()=>[pageTitle(),V.rows.map(r=>[r.spec.title,(r.items||[]).map(i=>i.n)])]'); R['news_ca'] = [ca[0], [[t, n[:8]] for t, n in ca[1]]]
    feat = ca[1][0][1] if ca[1] else []
    chk('news_canada', ca[0] == 'News \u203a Canada' and sum(1 for k in ['CBC NEWS', 'CTV NEWS', 'GLOBAL NEWS', 'CP24'] if any(k in x.upper() for x in feat)) == 4, feat)
    pg.screenshot(path=SHOTS + '/v414_news_canada.png')
    ev('()=>{closeLivePage()}'); time.sleep(1)
    ev('()=>openLivePage("news:WORLD")'); time.sleep(5)
    w = ev('()=>V.rows.map(r=>[r.spec.title,(r.items||[]).map(i=>i.n)])'); wf = w[0][1] if w else []
    R['news_world'] = [[t, n[:10]] for t, n in w]
    chk('news_world', all(any(k in x.upper() for x in wf) for k in ['BBC WORLD', 'AL JAZEERA', 'DW', 'FRANCE 24', 'SKY NEWS']), wf)
    ev('()=>{closeLivePage();openLivePage("news:US")}'); time.sleep(5)
    u = ev('()=>V.rows.map(r=>[r.spec.title,(r.items||[]).map(i=>i.n)])'); uf = u[0][1] if u else []
    chk('news_us', all(any(k in x.upper() for x in uf) for k in ['CNN', 'FOX NEWS', 'MSNBC', 'NEWSNATION']) and not any('CNN INTERNATIONAL' in x.upper() for x in uf), uf)
    ev('()=>{closeLivePage();openLivePage("news")}'); time.sleep(5)
    nn = ev('()=>V.rows.map(r=>r.spec.title)'); R['news_page'] = nn
    chk('news_page_sections', len(nn) >= 3 and 'Canada' in nn[0] and 'US' in nn[1] and 'World' in nn[2])
    pg.screenshot(path=SHOTS + '/v414_news_page.png')
    ev('()=>closeLivePage()'); time.sleep(1)
    R['errors'] = errs; chk('no_page_errors', not errs)
    b.close()
_done[0] = True
print(json.dumps(R, indent=1)); print('PASS' if ok else 'FAIL')
