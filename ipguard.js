/* IP guard — warns before generating anything that names a trademarked character, brand, team or band.
   POD sites (TeePublic, Redbubble, Etsy, Fourthwall…) remove such listings and can ban the account.
   It never sends anything anywhere: the check runs in the browser. Users can still choose "Generate anyway". */
(function(){
  // [term, owner / note]. Matching is case-insensitive, on whole words.
  const L = [
    // Disney / Pixar
    ['mickey mouse','Disney'],['minnie mouse','Disney'],['donald duck','Disney'],['goofy','Disney'],['pluto the dog','Disney'],
    ['frozen elsa','Disney'],['elsa and anna','Disney'],['olaf','Disney'],['moana','Disney'],['lilo and stitch','Disney'],['stitch','Disney'],
    ['winnie the pooh','Disney'],['tigger','Disney'],['eeyore','Disney'],['simba','Disney'],['lion king','Disney'],['toy story','Disney/Pixar'],
    ['buzz lightyear','Disney/Pixar'],['woody toy story','Disney/Pixar'],['finding nemo','Disney/Pixar'],['cinderella','Disney'],['ariel little mermaid','Disney'],
    ['little mermaid','Disney'],['princess jasmine','Disney'],['aladdin','Disney'],['mulan','Disney'],['encanto','Disney'],['bambi','Disney'],['dumbo','Disney'],
    ['jack skellington','Disney'],['nightmare before christmas','Disney'],['hocus pocus','Disney'],['sanderson sisters','Disney'],['disney','Disney'],['pixar','Disney/Pixar'],['mandalorian','Lucasfilm/Disney'],
    // Star Wars / Marvel / DC
    ['star wars','Lucasfilm'],['darth vader','Lucasfilm'],['baby yoda','Lucasfilm'],['grogu','Lucasfilm'],['yoda','Lucasfilm'],['stormtrooper','Lucasfilm'],['death star','Lucasfilm'],
    ['spider-man','Marvel'],['spiderman','Marvel'],['iron man','Marvel'],['captain america','Marvel'],['avengers','Marvel'],['deadpool','Marvel'],['wolverine','Marvel'],
    ['x-men','Marvel'],['black panther','Marvel'],['guardians of the galaxy','Marvel'],['marvel','Marvel'],
    ['batman','DC'],['superman','DC'],['wonder woman','DC'],['harley quinn','DC'],['the joker','DC'],['justice league','DC'],['aquaman','DC'],['green lantern','DC'],
    // Peanuts / classic cartoons / kids
    ['snoopy','Peanuts / WildBrain'],['charlie brown','Peanuts / WildBrain'],['woodstock peanuts','Peanuts / WildBrain'],['peanuts gang','Peanuts / WildBrain'],['lucy van pelt','Peanuts / WildBrain'],
    ['bugs bunny','Warner Bros'],['looney tunes','Warner Bros'],['tweety','Warner Bros'],['daffy duck','Warner Bros'],['tasmanian devil taz','Warner Bros'],['scooby-doo','Warner Bros'],['scooby doo','Warner Bros'],
    ['tom and jerry','Warner Bros'],['flintstones','Warner Bros'],['spongebob','Nickelodeon'],['patrick star','Nickelodeon'],['dora the explorer','Nickelodeon'],['paw patrol','Spin Master'],
    ['peppa pig','Hasbro'],['bluey','BBC / Ludo'],['cocomelon','Moonbug'],['care bears','Cloudco'],['my little pony','Hasbro'],['transformers','Hasbro'],['teletubbies','WildBrain'],
    ['hello kitty','Sanrio'],['kuromi','Sanrio'],['my melody','Sanrio'],['cinnamoroll','Sanrio'],['sanrio','Sanrio'],['minions','Universal'],['despicable me','Universal'],['shrek','DreamWorks'],
    ['kung fu panda','DreamWorks'],['grinch','Dr. Seuss Enterprises'],['dr seuss','Dr. Seuss Enterprises'],['cat in the hat','Dr. Seuss Enterprises'],['elf on the shelf','CCA & B'],['rudolph the red-nosed','Character Arts'],
    ['barbie','Mattel'],['hot wheels','Mattel'],['lego','LEGO'],['funko','Funko'],['fisher-price','Mattel'],
    // Games / anime
    ['pokemon','Nintendo / TPC'],['pokémon','Nintendo / TPC'],['pikachu','Nintendo / TPC'],['charizard','Nintendo / TPC'],['super mario','Nintendo'],['luigi','Nintendo'],['legend of zelda','Nintendo'],
    ['kirby','Nintendo'],['yoshi','Nintendo'],['animal crossing','Nintendo'],['nintendo','Nintendo'],['sonic the hedgehog','Sega'],['minecraft','Microsoft/Mojang'],['roblox','Roblox'],
    ['fortnite','Epic Games'],['among us','Innersloth'],['pac-man','Bandai Namco'],['playstation','Sony'],['xbox','Microsoft'],['call of duty','Activision'],['world of warcraft','Blizzard'],['league of legends','Riot'],
    ['naruto','Shueisha'],['dragon ball','Toei'],['goku','Toei'],['one piece','Shueisha'],['luffy','Shueisha'],['attack on titan','Kodansha'],['demon slayer','Shueisha'],['studio ghibli','Ghibli'],['totoro','Ghibli'],['sailor moon','Toei'],['jujutsu kaisen','Shueisha'],['my hero academia','Shueisha'],
    // Film / TV / books
    ['harry potter','Warner Bros'],['hogwarts','Warner Bros'],['gryffindor','Warner Bros'],['slytherin','Warner Bros'],['hufflepuff','Warner Bros'],['ravenclaw','Warner Bros'],['lord of the rings','Tolkien Estate'],['hobbit','Tolkien Estate'],
    ['game of thrones','HBO'],['house of the dragon','HBO'],['stranger things','Netflix'],['squid game','Netflix'],['wednesday addams','MGM'],['addams family','MGM'],['the office dunder mifflin','NBC'],['dunder mifflin','NBC'],
    ['friends tv show','Warner Bros'],['the simpsons','Fox'],['bart simpson','Fox'],['homer simpson','Fox'],['family guy','Fox'],['south park','Comedy Central'],['rick and morty','Adult Swim'],['bob\'s burgers','Fox'],['golden girls','Disney'],
    ['beetlejuice','Warner Bros'],['ghostbusters','Sony'],['stay puft','Sony'],['gremlins','Warner Bros'],['jaws','Universal'],['et the extra','Universal'],['back to the future','Universal'],['jurassic park','Universal'],
    ['friday the 13th','Horror franchise'],['jason voorhees','Horror franchise'],['freddy krueger','Horror franchise'],['nightmare on elm street','Horror franchise'],['michael myers','Horror franchise'],['halloween movie michael','Horror franchise'],
    ['pennywise','Horror franchise'],['chucky','Horror franchise'],['ghostface','Horror franchise'],['scream movie','Horror franchise'],['texas chain saw','Horror franchise'],['leatherface','Horror franchise'],['it movie clown','Horror franchise'],['the nun conjuring','Horror franchise'],
    // Brands
    ['nike','Nike'],['just do it','Nike'],['adidas','Adidas'],['jordan jumpman','Nike'],['puma','Puma'],['under armour','Under Armour'],['gucci','Gucci'],['louis vuitton','LVMH'],['chanel','Chanel'],['prada','Prada'],['supreme','Supreme'],['yeti','YETI'],
    ['coca-cola','Coca-Cola'],['coca cola','Coca-Cola'],['pepsi','PepsiCo'],['starbucks','Starbucks'],['dunkin','Dunkin'],['mcdonald','McDonald\'s'],['burger king','Burger King'],['harley-davidson','Harley-Davidson'],['harley davidson','Harley-Davidson'],
    ['jack daniel','Brown-Forman'],['budweiser','AB InBev'],['bud light','AB InBev'],['corona beer','Constellation'],['jim beam','Beam Suntory'],['jagermeister','Mast-Jägermeister'],['red bull','Red Bull'],['monster energy','Monster'],['carhartt','Carhartt'],
    ['john deere','Deere & Co'],['ford mustang','Ford'],['chevrolet','GM'],['dodge','Stellantis'],['jeep','Stellantis'],['ferrari','Ferrari'],['lamborghini','Lamborghini'],['porsche','Porsche'],['tesla','Tesla'],['land rover','JLR'],
    ['netflix','Netflix'],['youtube','Google'],['tiktok','ByteDance'],['instagram','Meta'],['facebook','Meta'],['twitter','X Corp'],['google','Google'],['apple logo','Apple'],['amazon prime','Amazon'],
    // Sports leagues & teams
    ['nfl','NFL'],['nba','NBA'],['mlb','MLB'],['nhl','NHL'],['fifa','FIFA'],['world cup','FIFA'],['super bowl','NFL'],['ufc','UFC'],['wwe','WWE'],['nascar','NASCAR'],
    ['dallas cowboys','NFL'],['green bay packers','NFL'],['pittsburgh steelers','NFL'],['new england patriots','NFL'],['kansas city chiefs','NFL'],['philadelphia eagles','NFL'],['san francisco 49ers','NFL'],['chicago bears','NFL'],
    ['new york yankees','MLB'],['boston red sox','MLB'],['los angeles dodgers','MLB'],['chicago cubs','MLB'],['atlanta braves','MLB'],['los angeles lakers','NBA'],['boston celtics','NBA'],['golden state warriors','NBA'],['chicago bulls','NBA'],
    ['real madrid','Club'],['fc barcelona','Club'],['manchester united','Club'],['liverpool fc','Club'],['arsenal fc','Club'],['juventus','Club'],['paris saint-germain','Club'],
    // Music artists / bands
    ['taylor swift','Artist'],['eras tour','Artist'],['beyonce','Artist'],['beyoncé','Artist'],['bts','Artist'],['blackpink','Artist'],['harry styles','Artist'],['billie eilish','Artist'],['drake','Artist'],['kanye','Artist'],['elvis presley','Estate'],['michael jackson','Estate'],['bob marley','Estate'],
    ['metallica','Band'],['ac/dc','Band'],['acdc','Band'],['nirvana','Band'],['pink floyd','Band'],['rolling stones','Band'],['led zeppelin','Band'],['misfits','Band'],['iron maiden','Band'],['slayer','Band'],['megadeth','Band'],['black sabbath','Band'],['ozzy osbourne','Band'],['guns n roses','Band'],['guns n\' roses','Band'],['grateful dead','Band'],['the beatles','Band'],['queen band','Band'],['kiss band','Band'],['ramones','Band'],['pantera','Band'],['linkin park','Band'],['my chemical romance','Band'],['green day','Band'],['foo fighters','Band'],['system of a down','Band'],['tool band','Band'],['motley crue','Band'],['mötley crüe','Band'],['def leppard','Band'],['van halen','Band']
  ];
  const norm = s => ' ' + String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ'/\- ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RX = L.map(([t, o]) => ({ t, o, re: new RegExp('(^|[^a-z0-9])' + esc(t.toLowerCase()) + '(?![a-z0-9])', 'i') }));

  window.ipCheck = function(text){
    const n = norm(text), seen = new Set(), out = [];
    for(const r of RX){ if(r.re.test(n) && !seen.has(r.t)){ seen.add(r.t); out.push({ term: r.t, owner: r.o }); } }
    return out;
  };

  let modal;
  function build(){
    modal = document.createElement('div');
    modal.className = 'ed ipg'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'ipgT');
    modal.innerHTML = '<div class="ed-box" style="max-width:460px"><div class="ed-head"><h3 id="ipgT">Possible trademark / copyright</h3></div>' +
      '<p class="note" id="ipgMsg" style="margin:6px 0 10px"></p><ul id="ipgList" style="margin:0 0 12px;padding-left:18px;font-size:14px"></ul>' +
      '<p class="note" style="margin:0 0 14px">Print-on-demand sites remove listings that use protected names or characters, and repeated strikes can close the account. Use an original idea instead (describe the style, not the name).</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="gen" id="ipgEdit" type="button" style="flex:1">Edit my idea</button><button class="btn-sec" id="ipgGo" type="button" style="flex:1;margin:0">Generate anyway</button></div></div>';
    document.body.appendChild(modal);
  }
  // resolves true = go on, false = stop. Warns once per exact text (so "Generate anyway" is not asked again for the same idea).
  const okTexts = new Set();
  window.ipConfirm = function(text){
    const hits = window.ipCheck(text);
    const key = norm(text);
    if(!hits.length || okTexts.has(key)) return Promise.resolve(true);
    if(!modal) build();
    modal.querySelector('#ipgMsg').textContent = hits.length > 1 ? 'Your text mentions protected names:' : 'Your text mentions a protected name:';
    modal.querySelector('#ipgList').innerHTML = hits.slice(0, 6).map(h => '<li><strong>' + h.term.replace(/</g, '&lt;') + '</strong> — ' + h.owner.replace(/</g, '&lt;') + '</li>').join('');
    modal.hidden = false;
    const edit = modal.querySelector('#ipgEdit'), go = modal.querySelector('#ipgGo');
    edit.focus();
    return new Promise(res => {
      const done = v => { modal.hidden = true; edit.onclick = go.onclick = null; document.removeEventListener('keydown', esc2); if(v) okTexts.add(key); res(v); };
      const esc2 = e => { if(e.key === 'Escape') done(false); };
      document.addEventListener('keydown', esc2);
      edit.onclick = () => done(false);
      go.onclick = () => done(true);
    });
  };
})();
