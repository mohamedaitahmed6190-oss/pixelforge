/* Seasonal planner: upcoming occasions with a "publish by" date, extra seasonal niches, and dynamic "Trending this season".
   Loaded BEFORE app1.js (app1 calls SEASON.extend(NICHES)); the planner card is built by SEASON.mount() from app4.js. */
(function(){
  const DAY = 86400000;
  const nth = (y, m, wd, n) => { const d = new Date(Date.UTC(y, m, 1)); const off = (wd - d.getUTCDay() + 7) % 7; return new Date(Date.UTC(y, m, 1 + off + (n - 1) * 7)); };
  const lastMon = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY); };
  function easter(y){ // Western Easter (Meeus/Jones/Butcher)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31) - 1, da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(y, mo, da));
  }
  // niche = name of the niche in NICHES; lead = days before the date a listing should already be live
  const EVENTS = [
    { name:"New Year's Eve",  niche:"New Year's Eve",       lead:45, date: y => new Date(Date.UTC(y, 11, 31)) },
    { name:"Valentine's Day", niche:"Valentine's Day",      lead:50, date: y => new Date(Date.UTC(y, 1, 14)) },
    { name:"St. Patrick's Day", niche:"St. Patrick's Day",  lead:40, date: y => new Date(Date.UTC(y, 2, 17)) },
    { name:'Easter',          niche:'Easter & spring',      lead:45, date: y => easter(y) },
    { name:"Mother's Day",    niche:"Mother's Day",         lead:45, date: y => nth(y, 4, 0, 2) },
    { name:'Memorial Day',    niche:'Veterans & military',  lead:35, date: y => lastMon(y, 4) },
    { name:"Father's Day",    niche:"Father's Day",         lead:45, date: y => nth(y, 5, 0, 3) },
    { name:'4th of July',     niche:'4th of July',          lead:40, date: y => new Date(Date.UTC(y, 6, 4)) },
    { name:'Back to school',  niche:'Back to school',       lead:45, date: y => new Date(Date.UTC(y, 7, 20)) },
    { name:'Halloween',       niche:'Halloween',            lead:60, date: y => new Date(Date.UTC(y, 9, 31)) },
    { name:'Veterans Day',    niche:'Veterans & military',  lead:35, date: y => new Date(Date.UTC(y, 10, 11)) },
    { name:'Thanksgiving',    niche:'Thanksgiving',         lead:50, date: y => nth(y, 10, 4, 4) },
    { name:'Christmas',       niche:'Christmas',            lead:60, date: y => new Date(Date.UTC(y, 11, 25)) }
  ];
  const today = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };

  // next occurrence of each event (this year, or next year if already past)
  function upcoming(now){
    now = now || today();
    const out = [];
    EVENTS.forEach(ev => {
      let d = ev.date(now.getUTCFullYear());
      if(d < now) d = ev.date(now.getUTCFullYear() + 1);
      const daysTo = Math.round((d - now) / DAY), publishBy = new Date(d.getTime() - ev.lead * DAY), daysToPublish = Math.round((publishBy - now) / DAY);
      out.push({ ev, date: d, daysTo, publishBy, daysToPublish });
    });
    return out.sort((a, b) => a.daysTo - b.daysTo);
  }
  // state: late = already inside the lead window (publish NOW), soon = window opens within 3 weeks, later = plan ahead
  function state(u){ return u.daysToPublish <= 0 ? 'now' : u.daysToPublish <= 21 ? 'soon' : 'later'; }
  const fmt = d => d.toLocaleDateString('en', { month:'short', day:'numeric', timeZone:'UTC' });

  // seasonal niches that did not exist yet — ideas are original (no brands / characters)
  const EXTRA = [
    { name:"Valentine's Day", ideas:[
      ['retro heart-shaped sunglasses with sparkles','Love Is In The Air'],['two cute ghosts holding hands with a small heart',''],['vintage candy hearts with funny phrases','Be Mine'],
      ['cute avocado couple holding hands','You Guac My World'],['sloth hugging a heart-shaped branch','Slow Love'],['anti-valentine broken heart with a bandage','Single And Thriving'],['cat and dog sharing a milkshake with two straws','Paw-fect Match'] ]},
    { name:"St. Patrick's Day", ideas:[
      ['cute lucky frog wearing a clover hat','Lucky Charm'],['rainbow with a pot of gold and shamrocks','Pot Of Gold'],['vintage Irish pub sign with shamrocks','Sláinte'],
      ['highland cow with a four-leaf clover','Lucky Moo'],['retro shamrock badge','Lucky Me'],['gnome with a green hat holding a clover','Feeling Lucky'],['pint glass with clovers and bubbles','Drink Up'] ]},
    { name:'Easter & spring', ideas:[
      ['cute bunny holding a basket of painted eggs','Hoppy Easter'],['pastel chicks hatching from decorated eggs','Spring Chicks'],['vintage carrot patch with a peeking bunny','Some Bunny Loves You'],
      ['cozy cottage garden with tulips and a watering can','Hello Spring'],['bunny wearing sunglasses on a flower field','Hip Hop'],['bees and wildflowers in a retro badge','Bloom Where You Are Planted'],['lamb in a flower crown','Spring Vibes'] ]},
    { name:"Mother's Day", ideas:[
      ['floral bouquet with a vintage ribbon','Best Mom Ever'],['mama bear with two cubs under a rainbow','Mama Bear'],['coffee cup with flowers growing out of it','Mama Needs Coffee'],
      ['retro sunset with wildflowers and a heart','Mom Life'],['cat mom holding a kitten with a heart','Cat Mom'],['dog mom silhouette with paw prints and flowers','Dog Mom'],['bold typography badge with daisies','Proud Mama'] ]},
    { name:"Father's Day", ideas:[
      ['retro grill with flames and a spatula','Grill Father'],['bear with sunglasses holding a fishing rod','Best Dad By Par'],['vintage tool belt with hammer and wrench','Dad Of All Trades'],
      ['dad joke speech bubble with a pun cartoon','Dad Joke Loading'],['golf ball and clubs in a retro badge','Par-Fect Dad'],['mountain sunrise with a pine forest','Adventure Dad'],['pickup truck at sunset','Like Father Like Son'] ]},
    { name:'4th of July', ideas:[
      ['retro eagle with stars and stripes burst','Land Of The Free'],['firework burst over a lake in a vintage badge','Fireworks & Freedom'],['grilling hot dog with sunglasses and a flag','Hot Dog Summer'],
      ['liberty torch in a distressed badge','Home Of The Brave'],['stars and stripes lightning bolt','Made In The USA'],['cowboy boot with stars','Born Free'],['retro watermelon with stars','Red White & Brew'] ]},
    { name:'Back to school', ideas:[
      ['smiling pencil with a backpack','Ready To Learn'],['retro school bus with stars','First Day Vibes'],['stack of books with an apple and glasses','Teach Love Inspire'],
      ['cute robot holding a notebook','Smart Cookie'],['chalkboard with doodles and a ruler','Class Is In Session'],['owl wearing a graduation cap','Wise Little Owl'],['crayons in a rainbow burst','Color Your World'] ]},
    { name:'Veterans & military', ideas:[
      ['bald eagle with a folded flag and stars','Honor Them'],['dog tags with a poppy flower','Lest We Forget'],['distressed flag badge with a salute silhouette','Proud Veteran'],
      ['combat boots and a rifle silhouette at sunset (monochrome)','Home Of The Brave'],['vintage star and wings emblem','Served With Pride'],['military helmet with a poppy','Never Forget'],['soldier silhouette against a sunrise','Duty Honor Country'] ]},
    { name:"New Year's Eve", ideas:[
      ['champagne glasses clinking with sparkles','Cheers To The New Year'],['retro disco ball with confetti','Party Like Its Midnight'],['clock striking midnight with fireworks','Midnight Kiss'],
      ['cute cat wearing a party hat','New Year Same Cat'],['gold glitter number with stars','Hello New Year'],['cozy mug with confetti and snow','Cheers'],['fireworks over a city skyline','Fresh Start'] ]}
  ];
  EXTRA.forEach(n => { n.seasonal = true; });

  // extends the niche list and recomputes which seasonal niches are "hot" (their publish window is open or opens within 3 weeks)
  function extend(NICHES){
    const have = new Set(NICHES.map(n => n.name));
    EXTRA.forEach(n => { if(!have.has(n.name)) NICHES.push(n); });
    const up = upcoming();
    const hotNames = new Set(up.filter(u => state(u) !== 'later' && u.daysTo >= 0).map(u => u.ev.niche));
    const linked = new Set(EVENTS.map(e => e.niche));
    NICHES.forEach(n => { if(linked.has(n.name)) n.hot = hotNames.has(n.name); });
  }

  // renders the "Plan ahead" card (called once after the page is built). onPick(nicheName) selects that niche.
  function mount(box, onPick){
    const list = upcoming().filter(u => u.daysTo <= 150 || state(u) === 'now').slice(0, 4);
    box.innerHTML = '<div class="opts-t">Plan ahead — list 6–8 weeks before the date</div>' + list.map((u, i) => {
      const st = state(u);
      const when = st === 'now' ? 'List now' : 'Start in ' + u.daysToPublish + ' days';
      return '<div class="plan-row"><div><strong>' + u.ev.name + '</strong><div class="hint">' + fmt(u.date) + ' · list by ' + fmt(u.publishBy) + '</div></div>' +
        '<button type="button" class="plan-b plan-' + st + '" data-niche="' + u.ev.niche.replace(/"/g, '&quot;') + '">' + when + '</button></div>';
    }).join('');
    box.onclick = e => { const b = e.target.closest('[data-niche]'); if(b) onPick(b.dataset.niche); };
  }
  window.SEASON = { extend, mount, upcoming, state, EVENTS };
})();
