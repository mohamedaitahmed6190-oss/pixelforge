const $ = s => document.querySelector(s);

/* ---------- daily image counter (kept in this browser, survives refresh) ---------- */
const DAILY_LIMIT = 150;          // keep equal to the limit in the server file
const USAGE_KEY = 'pf_usage';
function utcDay(){ return new Date().toISOString().slice(0, 10); }
function loadUsage(){
  try { const u = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}'); return (u && u.days) ? u : { days:{} }; } catch(e){ return { days:{} }; }
}
function saveUsage(u){
  Object.keys(u.days).sort().slice(0, -60).forEach(k => delete u.days[k]);   // keep 60 days
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch(e){}
  renderUsage();
}
function todayCount(){ return loadUsage().days[utcDay()] || 0; }
function setToday(n){ const u = loadUsage(); u.days[utcDay()] = Math.max(0, Math.round(n)); saveUsage(u); }
function countImage(){ setToday(todayCount() + 1); }
function markFull(){ if(todayCount() < DAILY_LIMIT) setToday(DAILY_LIMIT); }
function renderUsage(){
  const u = loadUsage(), day = utcDay(), today = u.days[day] || 0;
  const month = Object.entries(u.days).filter(([d]) => d.slice(0, 7) === day.slice(0, 7)).reduce((a, [, n]) => a + n, 0);
  const el = $('#usage');
  el.textContent = `Today ${today}/${DAILY_LIMIT} · Month ${month}`;
  el.className = 'usage' + (today >= DAILY_LIMIT ? ' over' : today >= DAILY_LIMIT * 0.8 ? ' warn' : '');
}
$('#usage').onclick = () => {
  const v = prompt('How many images did you generate today? (UTC day, resets at 00:00 UTC)', todayCount());
  if(v !== null && v.trim() !== '' && !isNaN(+v)) setToday(+v);
};
renderUsage();

/* ---------- niches: [description, text on design] ---------- */
const NICHES = [
  { name:'Halloween', hot:true, ideas:[
    ['cute french bulldog ghost with its tongue out','Spooky Snorts'],
    ['black cat sitting on a carved pumpkin, spooky night','Stay Spooky'],
    ['vintage witch hat with crescent moon and bats','Resting Witch Face'],
    ['skeleton holding a coffee cup','Dead Inside But Caffeinated'],
    ['cute retro ghost wearing sunglasses','Boo Crew'],
    ['haunted house under a full moon',''],
    ['cute ghost reading a book','Booooks'],
    ['retro candy corn and pumpkins badge','Trick or Treat'],
    ['black cat in a witch hat',''] ]},
  { name:'Fall & autumn', hot:true, ideas:[
    ['pumpkin spice latte surrounded by autumn leaves','Pumpkin Spice Season'],
    ['cozy bonfire in the mountains with pine trees','Sweater Weather'],
    ['autumn leaves wreath','Hello Fall'],
    ['vintage pickup truck carrying pumpkins','Fall Vibes'],
    ['retro sunset over an autumn forest','Cozy Season'],
    ['hay bales, sunflowers and pumpkins on a farm','Harvest Season'],
    ['highland cow wearing a knitted scarf with fall leaves',''],
    ['mushrooms and acorns on a forest floor',''] ]},
  { name:'Thanksgiving', hot:true, ideas:[
    ['funny turkey wearing a pilgrim hat','Gobble Gobble'],
    ['slice of pumpkin pie with whipped cream','Here For The Pie'],
    ['wheat and autumn leaves wreath','Thankful Grateful Blessed'],
    ['funny turkey running in sneakers','Turkey Trot'],
    ['retro pumpkin pie badge','Pie Squad'],
    ['autumn harvest table with pumpkins','Thankful'] ]},
  { name:'Christmas', hot:true, ideas:[
    ['cozy cabin in a snowy pine forest','Merry & Bright'],
    ['vintage red truck carrying a Christmas tree','Merry Christmas'],
    ['gingerbread man cookie with a bite missing','Oh Snap'],
    ['cat tangled in Christmas lights','Meowy Christmas'],
    ['snowman wearing a scarf',''],
    ['nutcracker soldier',''],
    ['dog wearing a Santa hat','Dear Santa, Define Good'],
    ['hot cocoa mug with marshmallows','Cocoa Season'] ]},
  { name:'Fishing', ideas:[
    ['largemouth bass jumping out of the water','Reel Cool Dad'],
    ['collection of vintage fishing lures','Hooked On Fishing'],
    ['man fishing from a boat on a lake at sunrise','Lake Life'],
    ['rainbow trout',''],
    ['fishing rod and tackle box',"I'd Rather Be Fishing"],
    ['retro fishing boat on calm water','Weekend Forecast: Fishing'],
    ['fly fisherman in a mountain river',''],
    ['grandpa and grandson fishing on a dock','Fishing Buddies'] ]},
  { name:'Hunting & outdoors', ideas:[
    ['whitetail buck with big antlers in front of mountains','Buck Wild'],
    ['mallard ducks flying over a marsh','Duck Season'],
    ['bull elk bugling in a forest','Wild And Free'],
    ['black bear walking through pine trees','Go Outside'],
    ['vintage compass with mountain range','Adventure Awaits'],
    ['wild turkey strutting',''] ]},
  { name:'Camping & hiking', ideas:[
    ['campfire under a starry night sky','Camp Life'],
    ['tent in front of mountains','Happy Camper'],
    ['retro RV camper at sunset','Home Is Where We Park It'],
    ['hiking boots on a mountain trail','Take A Hike'],
    ['mountain range with a full moon','The Mountains Are Calling'],
    ['camper van on a desert road at sunset','Van Life'],
    ['bear drinking coffee by a campfire',''],
    ['marshmallow roasting on a campfire, cute',''] ]},
  { name:'Dog lovers', ideas:[
    ['golden retriever portrait with flowers','Dog Mom'],
    ['dachshund wearing a cozy sweater',''],
    ['paw print inside a heart','Dog Mama'],
    ['dog holding a coffee cup','Dogs And Coffee'],
    ['pit bull wearing a flower crown','Pittie Mom'],
    ['corgi from behind, cute',''],
    ['bearded man hugging his dog','Dog Dad'],
    ['rescue dog with a heart',"Adopt Don't Shop"] ]},
  { name:'Cat lovers', ideas:[
    ['black cat sitting in front of the moon',''],
    ['cat drinking coffee','Cats & Coffee'],
    ['cat reading a book','Cat Lady'],
    ['kitten sitting in a teacup',''],
    ['grumpy cat sitting','Nope'],
    ['cat surrounded by flowers','Cat Mom'],
    ['cat astronaut floating in space',''],
    ['cat sleeping on a stack of books','Nap Queen'] ]},
  { name:'Nurse & healthcare', ideas:[
    ['stethoscope forming a heart','Nurse Life'],
    ['coffee cup with an IV bag','Powered By Coffee'],
    ['stethoscope with flowers','Registered Nurse'],
    ['heartbeat line','ER Nurse'],
    ['nurse with a cape, strong pose','Nurse Strong'],
    ['tiny baby footprints with a heart','L&D Nurse'] ]},
  { name:'Teacher', ideas:[
    ['red apple and pencil','Teach Love Inspire'],
    ['retro yellow school bus','Teacher Life'],
    ['stack of books and coffee','Coffee Teach Repeat'],
    ['chalkboard with flowers','Teaching Is My Superpower'],
    ['rainbow made of pencils','Kindergarten Teacher'],
    ['backpack and apple','Back To School'] ]},
  { name:'Mom life', ideas:[
    ['coffee mug and messy bun','Mom Life'],
    ['wildflowers bouquet','Mama'],
    ['tired mom with coffee, funny','Running On Coffee'],
    ['sports balls and a heart','Boy Mom'],
    ['bows and flowers','Girl Mom'],
    ['retro sunset badge','Blessed Mama'] ]},
  { name:'Dad life', ideas:[
    ['barbecue grill with flames','Grill Master'],
    ['funny dad with a beer belly','Dad Bod'],
    ['crossed wrenches and tools','Dad Can Fix It'],
    ['lawn mower, funny','Lawn Enforcement'],
    ['loading bar, funny','Dad Joke Loading'],
    ['vintage badge with mountains','Best Dad Ever'] ]},
  { name:'Coffee lovers', ideas:[
    ['vintage coffee cup with steam','But First Coffee'],
    ['skull made of coffee beans','Death Before Decaf'],
    ['iced coffee cup','Iced Coffee Addict'],
    ['vintage espresso machine',''],
    ['coffee cup with flowers','Coffee & Kindness'],
    ['sleepy sloth holding coffee',''] ]},
  { name:'Gaming', ideas:[
    ['retro game controller','Game On'],
    ['pixel art heart','Player 1'],
    ['skull wearing a gaming headset',''],
    ['retro arcade machine','Retro Gamer'],
    ['game controller with lightning','Gamer Mode'],
    ['pixel art sword',''] ]},
  { name:'Gym & fitness', ideas:[
    ['dumbbell with flames','Lift Heavy'],
    ['barbell and skull',''],
    ['running shoes','Miles And Smiles'],
    ['kettlebell','Strong Is Beautiful'],
    ['yoga pose silhouette with flowers','Namaste'],
    ['muscular gorilla lifting weights','Leg Day'] ]},
  { name:'Faith', ideas:[
    ['cross with flowers','Faith Over Fear'],
    ['mountains at sunrise','Blessed'],
    ['dove with olive branch',''],
    ['lion and lamb together',''],
    ['mustard seed and mountains','Faith Can Move Mountains'],
    ['praying hands','Pray More Worry Less'] ]},
  { name:'Mental health', ideas:[
    ['brain with flowers growing','Be Kind To Your Mind'],
    ['sunflower','You Are Enough'],
    ['butterfly','Grow Through It'],
    ['small plant growing from a pot',"It's Okay Not To Be Okay"],
    ['hands forming a heart','Choose Kindness'],
    ['moon and stars','Rest Is Productive'] ]},
  { name:'Bookish', ideas:[
    ['stack of books with flowers','Just One More Chapter'],
    ['cat reading a book','Bookworm'],
    ['old library, dark academia',''],
    ['coffee and an open book','Books & Coffee'],
    ['book with flowers growing out','Book Lover'],
    ['dragon reading a book',''] ]},
  { name:'Plants & garden', ideas:[
    ['monstera leaves','Plant Lady'],
    ['succulents in pots','Plant Mom'],
    ['vegetable garden','Grow Your Own'],
    ['watering can with flowers','Garden Therapy'],
    ['vintage botanical flowers',''],
    ['bee and wildflowers','Save The Bees'] ]},
  { name:'Retro & vintage', ideas:[
    ['retro sunset over mountains',''],
    ['vintage motorcycle','Ride Free'],
    ['classic muscle car','Old School'],
    ['retro 70s waves and sun','Good Vibes'],
    ['vintage desert travel poster',''],
    ['retro cassette tape',''] ]},
  { name:'Western', ideas:[
    ['cowboy boots with flowers','Howdy'],
    ['desert cactus at sunset','Wild West'],
    ['horse running','Cowgirl'],
    ['cowboy hat and lasso','Rodeo'],
    ['bull skull with flowers',''],
    ['cowboy riding a horse','Giddy Up'] ]},
  { name:'Cottagecore & witchy', ideas:[
    ['mushroom forest',''],
    ['frog wearing a mushroom hat',''],
    ['moth and crescent moon',''],
    ['crystal ball with stars','Witchy Vibes'],
    ['herb jars and dried flowers',''],
    ['snail on a mushroom',''] ]},
  { name:'Celestial & zodiac', ideas:[
    ['sun and moon faces',''],
    ['zodiac constellation wheel',''],
    ['moon phases',''],
    ['celestial hand with an eye',''],
    ['astronaut floating among planets',''],
    ['tarot card with the sun',''] ]},
  { name:'Sports', ideas:[
    ['crossed pickleball paddles','Pickleball Addict'],
    ['retro pickleball badge','Dink Responsibly'],
    ['golf ball and clubs','Golf Dad'],
    ['baseball with a heart','Baseball Mom'],
    ['soccer ball','Soccer Mom'],
    ['basketball going through a hoop',''] ]},
  { name:'Trucker & mechanic', ideas:[
    ['semi truck on a highway at sunset','Trucker Life'],
    ['wrench and gear','Mechanic'],
    ['vintage pickup truck',''],
    ['crossed pistons and wrenches','Grease Monkey'],
    ['v8 engine',''],
    ['tow truck',''] ]},
  { name:'Sports fan culture (NFL & MLB)', hot:true, ideas:[
    ['angry buffalo wearing a football helmet, charging forward, blue and red team colors, mascot parody, no logos','Game Day Beast'],
    ['brown dog bone crossed with an orange football helmet, underdog fan spirit, no logos','Underdog Forever'],
    ['pirate skull with crossed swords wearing a football helmet, silver and black colors, no logos','Silver And Black Life'],
    ['growling bear holding a football, navy and orange colors, mascot parody, no logos','Sunday Beast Mode'],
    ['bucking bronco horse with football helmet, orange and navy colors, no logos','Mile High Energy'],
    ['gold rush prospector with a pickaxe and a football, red and gold colors, no logos','Gold Rush Sundays'],
    ['vintage baseball with crossed bats, black and white pinstripes, retro badge, no logos','Baseball Season'],
    ['baseball pitcher mid throw silhouette, retro badge, no logos','Heat From The Mound'],
    ['football stadium at night under bright lights, vintage illustration','Sunday Ritual'],
    ['vintage football helmet and football laces, distressed retro badge','Die Hard Fan'] ]},
  { name:'True crime & mystery', hot:true, ideas:[
    ['detective evidence board with photos, red string and pushpins, grunge classified file aesthetic','Obsessed With True Crime'],
    ['vintage manila case file folder stamped CLASSIFIED with a magnifying glass, grunge','Case Closed'],
    ['dark silhouette of a woman with a question mark, vintage police file style','Every Jane Doe Has A Name'],
    ['dark silhouette figure under a streetlamp in fog, noir style','Stay Curious'],
    ['true crime podcast microphone with coffee cup and magnifying glass','True Crime And Chill'],
    ['crime scene tape and magnifying glass, grunge texture','Sorry, Podcast Night'],
    ['detective trench coat and fedora silhouette, vintage noir',''],
    ['old typewriter with case files and red string, dark academia',''] ]},
  { name:'Metal & alternative music', hot:true, ideas:[
    ['burning skull with flames and horns, rough metal style','Born To Thrash'],
    ['spiked leather gauntlet fist holding a flaming skull, heavy metal','No Mercy'],
    ['goat skull with candles and an inverted pentagram, occult woodcut style','Dark Ritual'],
    ['black metal forest with a crow and a full moon, gritty','Into The Night'],
    ['skull with bullet belt and lightning, rough metal style','Heavy Metal Forever'],
    ['demonic horned skull with flames, rough hand-drawn metal lettering style',''] ]},
  { name:'Southern gothic & Americana', ideas:[
    ['abandoned wooden church in a foggy field at dusk, sepia tones','Southern Gothic'],
    ['vintage 1950s pickup truck on an empty dusty highway, sepia tones','Back Road Ghosts'],
    ['magnolia tree with spanish moss and an old farmhouse, sepia tones',''],
    ['crow on a barbed wire fence at sunset, sepia tones','Dust And Faith'],
    ['vintage Americana roadside motel sign at dusk, faded sepia',''],
    ['old cemetery with weeping willow and iron gate, sepia tones',''] ]},
  { name:'80s Miami neon & synthwave', hot:true, ideas:[
    ['neon pink and cyan sunset behind palm trees, 80s Miami style','Neon Nights'],
    ['80s sports car driving on a neon beach road at sunset with palm trees','Ocean Drive'],
    ['flamingo wearing sunglasses with neon palm trees',''],
    ['retro 80s cassette tape with palm trees and sunset','Rewind To 1986'],
    ['pastel art-deco hotel with neon sign and palm trees','Sunset Strip'],
    ['sports car silhouette with grid horizon and big sun','Midnight Cruiser'] ]}
];

/* ---------- niche & idea selects (+ your own saved ideas) ---------- */
const CUSTOM_KEY = 'pf_custom_ideas';
function loadCustom(){ try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}'); } catch(e){ return {}; } }
function saveCustom(o){ try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(o)); } catch(e){} }

const nicheSel = $('#niche'), sugSel = $('#suggest');
const gMine = document.createElement('optgroup'); gMine.label = 'Yours';
const mine = document.createElement('option'); mine.value = 'mine'; mine.textContent = '✏️ My own ideas';
gMine.appendChild(mine);
const gHot = document.createElement('optgroup'); gHot.label = 'Trending this season';
const gAll = document.createElement('optgroup'); gAll.label = 'Evergreen';
NICHES.forEach((n, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = (n.hot ? '🔥 ' : '') + n.name;
  (n.hot ? gHot : gAll).appendChild(o);
});
nicheSel.append(gMine, gHot, gAll);
nicheSel.value = '0';

function nicheName(){ return nicheSel.value === 'mine' ? 'My own ideas' : NICHES[nicheSel.value].name; }
function customList(){ return loadCustom()[nicheName()] || []; }
function builtinList(){ return nicheSel.value === 'mine' ? [] : NICHES[nicheSel.value].ideas; }

function fillIdeas(selectValue){
  sugSel.innerHTML = '';
  const add = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; sugSel.appendChild(o); };
  add('new', '✏️ Write my own idea');
  customList().forEach(([d, t], i) => add('c' + i, '⭐ ' + (t ? `${d} — "${t}"` : `${d} (no text)`)));
  builtinList().forEach(([d, t], i) => add('b' + i, t ? `${d} — "${t}"` : `${d} (no text)`));
  sugSel.value = selectValue || (sugSel.options.length > 1 ? sugSel.options[1].value : 'new');
  applyIdea();
}
function applyIdea(){
  const v = sugSel.value;
  if(v === 'new'){
    $('#idea').value = ''; $('#exactText').value = '';
    $('#idea').placeholder = 'Describe your design, e.g. bulldog wearing sunglasses';
    $('#idea').focus();
    return;
  }
  const [d, t] = (v[0] === 'c' ? customList() : builtinList())[+v.slice(1)];
  $('#idea').value = d;
  $('#exactText').value = t;
}
nicheSel.onchange = () => fillIdeas();
sugSel.onchange = applyIdea;

$('#saveIdea').onclick = () => {
  const d = $('#idea').value.trim(), t = $('#exactText').value.trim();
  if(!d){ toast('Write a description first', true); $('#idea').focus(); return; }
  const all = loadCustom(), name = nicheName();
  const list = all[name] || [];
  let i = list.findIndex(x => x[0] === d && x[1] === t);
  if(i === -1){ list.unshift([d, t]); i = 0; }
  all[name] = list; saveCustom(all);
  fillIdeas('c' + i);
  toast(`Saved to ${name}`);
};
fillIdeas();

/* ---------- prompt builder ---------- */
function isDark(){ return $('#style').selectedOptions[0].dataset.dark === '1'; }
function isUniversal(){ return $('#style').selectedOptions[0].dataset.universal === '1'; }
// thickness of the white sticker border, as a fraction of the picture width (0.005 = thin, 0.012 = thick)
const HALO_FRAC = 0.005;
// adds a white sticker border around the artwork so it also shows on black shirts
function haloCanvas(c, r){
  const sil = document.createElement('canvas'); sil.width = c.width; sil.height = c.height;
  const sx = sil.getContext('2d'); sx.drawImage(c, 0, 0);
  sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#FFFFFF'; sx.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
  const o = out.getContext('2d');
  [r, r * 0.5].forEach(rad => {
    for(let a = 0; a < 36; a++){ const t = a / 36 * Math.PI * 2; o.drawImage(sil, Math.cos(t) * rad, Math.sin(t) * rad); }
  });
  o.drawImage(c, 0, 0);
  return out;
}
function addHalo(url){
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        haloCanvas(c, Math.max(2, Math.round(c.width * HALO_FRAC))).toBlob(b => resolve(b ? URL.createObjectURL(b) : url), 'image/png');
      } catch(e){ resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}
// true when a pixel is background: near-white (light designs) or near-black (dark-shirt designs)
function isBgPixel(d, i, dark){
  return dark ? (d[i] < 28 && d[i+1] < 28 && d[i+2] < 28) : (d[i] > 235 && d[i+1] > 235 && d[i+2] > 235);
}
// finds the flat background color the AI drew; null if the background is white / not flat
function detectBgColor(d, w, h){
  const rs = [], gs = [], bs = [];
  const add = p => { const i = p*4; rs.push(d[i]); gs.push(d[i+1]); bs.push(d[i+2]); };
  for(let x=0;x<w;x+=4){ add(x); add((h-1)*w + x); }
  for(let y=0;y<h;y+=4){ add(y*w); add(y*w + w - 1); }
  const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const c = [med(rs), med(gs), med(bs)];
  if(c[0] > 235 && c[1] > 235 && c[2] > 235) return null;   // white background → normal method
  let ok = 0;
  for(let k=0;k<rs.length;k++){
    const dr = rs[k] - c[0], dg = gs[k] - c[1], db = bs[k] - c[2];
    if(dr*dr + dg*dg + db*db < 48*48) ok++;
  }
  return ok / rs.length > 0.6 ? c : null;
}
// color-key removal: every pixel close to the background color goes (outside AND enclosed holes),
// white parts of the subject are a different color so they stay
function removeColor(d, w, h, c){
  const n = w*h, T2 = 48*48, F2 = 150*150, bg = new Uint8Array(n);
  const dist2 = i => { const dr = d[i] - c[0], dg = d[i+1] - c[1], db = d[i+2] - c[2]; return dr*dr + dg*dg + db*db; };
  for(let p=0;p<n;p++) if(dist2(p*4) < T2) bg[p] = 1;
  for(let pass=0; pass<2; pass++){   // eat the 1-2px antialiased fringe next to the removed area
    const add = [];
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const p = y*w + x;
        if(bg[p]) continue;
        const near = (x > 0 && bg[p-1]) || (x < w-1 && bg[p+1]) || (y > 0 && bg[p-w]) || (y < h-1 && bg[p+w]);
        if(near && dist2(p*4) < F2) add.push(p);
      }
    }
    for(const p of add) bg[p] = 1;
  }
  for(let p=0;p<n;p++) if(bg[p]) d[p*4 + 3] = 0;
}
// removes the background. chroma = Universal style: the AI draws on a flat color (hot pink), so white
// parts INSIDE the design (ghost sheet, white fur, teeth) are kept. White background → classic method.
function removeBg(imgData, dark, chroma){
  const d = imgData.data, w = imgData.width, h = imgData.height;
  if(chroma && !dark){
    const c = detectBgColor(d, w, h);
    if(c){ removeColor(d, w, h, c); return; }
  }
  for(let i=0;i<d.length;i+=4){ if(isBgPixel(d, i, dark)) d[i+3]=0; }
}
function buildPrompt(){
  const product = $('#product').value, style = $('#style').value;
  const idea = $('#idea').value.trim() || 'retro sunset over mountains';
  const text = $('#exactText').value.trim();
  const later = $('#textLater').checked && text;
  const textRule = later
    ? `No text, no letters, no words anywhere in the design. The subject is centered and fills only the middle 60% of the canvas, leaving clean empty space above and below it. `
    : text
    ? `The design must contain ONLY this exact text: "${text}". Spell it exactly as written, correct spelling, every letter present, no missing letters, no extra words, no other text. `
    : `No text, no letters, no words anywhere in the design. `;
  const bg = isDark()
    ? `subject isolated on a solid pure black background with no shadows and no background scenery; the artwork itself uses NO black: all outlines, shading and text are white, cream or bright colors so it prints on a black shirt, `
    : isUniversal()
    ? `subject isolated on a solid flat vivid saturated hot pink background (#FF1493, not pastel) filling the whole canvas edge to edge, no gradient, no vignette, no shadows, no background scenery; the subject itself contains NO hot pink and NO magenta; the subject stays centered; white parts of the subject (ghost sheets, white fur, teeth, eyes, snow) stay white with a clear thick dark outline, `
    : `subject isolated on a solid plain white background with no shadows and no background scenery; the subject stays centered; NO pure white and NO near-white anywhere INSIDE the subject: every object that is normally white (ghost sheets, white fur, teeth, snow, clouds, paper, bandages) must be painted in a clearly different soft color such as pastel light blue, lavender or warm beige (about #C3D3EA or #D9C8B0) with visible shading, and fully enclosed by a thick dark outline; the ONLY pure white in the whole image is the plain background, `;
  return `${textRule}Create a print-on-demand ${product}. Subject: ${idea}. Style: ${style}. ` +
    `Requirements: high contrast, no watermark, clean crisp edges, ` + bg +
    `professional illustration quality. Square 1:1 composition.`;
}

/* ---------- generation ---------- */
let generating = false, total = 0;
const history = [];

$('#genBtn').onclick = async () => {
  if(generating) return;
  if(todayCount() >= DAILY_LIMIT){ toast(`Daily limit (${DAILY_LIMIT}) reached — come back tomorrow`, true); return; }
  const prompt = buildPrompt();
  const ideaVal = $('#idea').value.trim();
  const productLabel = $('#product').selectedOptions[0].text;
  const styleLabel = $('#style').selectedOptions[0].text;
  generating = true;
  const btn = $('#genBtn'); btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>Generating…';
  $('#empty').hidden = true;

  const slots = [];
  for(let i=0;i<2;i++){
    const d = document.createElement('div');
    d.className = 'card';
    d.dataset.text = $('#exactText').value.trim();
    d.dataset.dark = isDark() ? '1' : '';
    d.dataset.universal = isUniversal() ? '1' : '';
    d.dataset.niche = [$('#cNiche').value.trim(), nicheSel.value === 'mine' ? '' : nicheName()].filter(Boolean).join(', ');
    d.innerHTML = `<div class="img-box"><span class="spin"></span></div>
      <button class="btn-sec btn-kit kitBtn" disabled>🚀 TeePublic kit</button>
      <div class="kit"></div>
      <button class="btn-sec btn-ai aiBtn" disabled>🪄 AI edit</button>
      <div class="aiPanel">
        <label>What to change? <span class="hint">(short, English)</span></label>
        <input class="aiText" type="text" placeholder="e.g. change the dog to a pug">
        <label>Change strength: <span class="aiStrVal">40</span>% <span class="hint">(low = keeps design)</span></label>
        <input class="aiStr" type="range" min="15" max="75" value="40">
        <button class="gen aiGo" type="button">Apply AI edit</button>
        <button class="btn-sec aiUndo" type="button" hidden>↩ Undo last edit</button>
      </div>
      <button class="btn-sec btn-text txtBtn" disabled>✏️ Add text</button>
      <button class="btn-sec dlBtn" disabled>Download PNG</button>
      <button class="btn-sec btn-vec panBtn" disabled>🎛 Vector panel</button>
      <button class="btn-sec btn-vec vecBtn" disabled>⬇ Vector SVG</button>
      <button class="btn-sec svgBtn" disabled>HD PNG (vectorized)</button>
      <button class="btn-sec upBtn" disabled>AI upscale (HD)</button>
      <button class="btn-sec metaBtn" disabled>Write listing</button>
      <div class="meta"></div>`;
    $('#results').prepend(d);
    slots.push(d);
  }
  const results = [];
  for(let i=0;i<slots.length;i++){
    results.push(await genOne(prompt, slots[i], i, ideaVal, productLabel, styleLabel));
  }
  generating = false; btn.disabled = false; btn.textContent = 'Generate 2 designs';
  const failed = results.filter(r => !r.ok);
  if(failed.some(r => r.limit)) toast('Daily limit reached — come back tomorrow', true);
  else if(failed.length) toast(failed.length + ' design(s) failed — try again', true);
};

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function genOne(prompt, slot, idx, ideaVal, productLabel, styleLabel){
  const box = slot.querySelector('.img-box');
  const dl = slot.querySelector('.dlBtn');
  const seed = Date.now() + idx * 7919;
  const fullPrompt = `${prompt} (variation ${idx+1}: slightly different composition/colors)`;

  const w = await tryWorkersAI(fullPrompt, seed, box);
  if(w && w.url) return finishSlot(w.url, box, dl, idx, prompt, slot, ideaVal, productLabel, styleLabel);

  const poll = await tryPollinations(fullPrompt, seed, box);
  if(poll) return finishSlot(poll, box, dl, idx, prompt, slot, ideaVal, productLabel, styleLabel);

  const limit = !!(w && w.limit);
  box.innerHTML = `<div class="status err">${limit ? 'Daily limit reached. Come back tomorrow.' : 'Generation failed. Try again in a minute.'}</div>`;
  return { ok:false, limit };
}

async function tryWorkersAI(fullPrompt, seed, box){
  try {
    box.innerHTML = '<span class="spin"></span>';
    const r = await fetch(`/api/generate?prompt=${encodeURIComponent(fullPrompt)}&seed=${seed}`, { cache:'no-store' });
    if(r.status === 429){ markFull(); return { limit:true }; }
    if(!r.ok){ console.warn('Workers AI error', r.status, await r.text().catch(()=> '')); return null; }
    const blob = await r.blob();
    if(!blob.type.startsWith('image/') || blob.size < 500) return null;
    countImage();
    return { url: URL.createObjectURL(blob) };
  } catch(e){ return null; }
}

function loadAsImage(url, timeoutMs){
  return new Promise((resolve) => {
    const img = new Image(); let done = false;
    const finish = ok => { if(!done){ done = true; resolve(ok ? url : null); } };
    img.onload = () => finish(true); img.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
    img.src = url;
  });
}

async function tryPollinations(fullPrompt, seed, box){
  const models = ['flux', 'turbo'];
  for(let a=0; a<models.length; a++){
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&model=${models[a]}&referrer=pixelforge-app`;
    box.innerHTML = `<div class="status">Trying backup generator (${a+1}/${models.length})…</div>`;
    const ok = await loadAsImage(url, 25000);
    if(ok) return ok;
    if(a < models.length-1) await sleep(3000);
  }
  return null;
}

// background → transparent
function makeTransparent(url, dark, sticker){
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        removeBg(data, dark, sticker);
        ctx.putImageData(data, 0, 0);
        c.toBlob(b => resolve(b ? URL.createObjectURL(b) : url), 'image/png');
      } catch(e){ resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

// raw AI picture (with its background) → transparent picture shown in the card
async function applyRaw(slot, rawUrl){
  const dark = slot.dataset.dark === '1', uni = slot.dataset.universal === '1';
  const box = slot.querySelector('.img-box');
  let finalUrl = await makeTransparent(rawUrl, dark, uni);
  if(uni) finalUrl = await addHalo(finalUrl);
  if(dark) box.classList.add('dark');
  box.innerHTML = `<img src="${finalUrl}" alt="Generated design">`;
  slot._raw = rawUrl;      // picture with background (used for AI edit + upscale)
  slot._base = finalUrl;   // transparent picture without added text
  slot._url = finalUrl;    // current print file (with text once applied)
  return finalUrl;
}
// after the picture changed (AI edit / undo) the old added text no longer matches
function resetAfterPictureChange(slot){
  slot._ed = null;
  slot.querySelectorAll('.upBtn').forEach(b => b.hidden = false);
  const kit = slot.querySelector('.kit'); kit.classList.remove('show'); kit.innerHTML = '';
  slot.querySelector('.kitBtn').textContent = '🚀 TeePublic kit';
  slot.querySelector('.txtBtn').textContent = '✏️ Add text';
  slot.querySelector('.aiUndo').hidden = !(slot._hist && slot._hist.length);
}

async function finishSlot(url, box, dl, idx, prompt, slot, ideaVal, productLabel, styleLabel){
  const finalUrl = await applyRaw(slot, url);
  slot._idx = idx;
  slot._hist = [];
  dl.disabled = false;
  dl.onclick = () => download(slot._url, idx);
  const txtBtn = slot.querySelector('.txtBtn');
  txtBtn.disabled = false;
  txtBtn.onclick = () => openEditor(slot);
  const panBtn = slot.querySelector('.panBtn');
  panBtn.disabled = false;
  panBtn.onclick = () => openVectorPanel(slot);
  const vecBtn = slot.querySelector('.vecBtn');
  vecBtn.disabled = false;
  vecBtn.onclick = () => downloadSVG(slot, idx, vecBtn);
  const svgBtn = slot.querySelector('.svgBtn');
  svgBtn.disabled = false;
  svgBtn.onclick = () => downloadVectorPNG(slot, idx, svgBtn);
  const upBtn = slot.querySelector('.upBtn');
  upBtn.disabled = false;
  upBtn.onclick = () => downloadUpscaled(slot._raw, idx, upBtn, slot.dataset.dark === '1', slot.dataset.universal === '1');
  const kitBtn = slot.querySelector('.kitBtn');
  kitBtn.disabled = false;
  kitBtn.onclick = () => teepublicKit(slot, slot._url, idx, ideaVal, productLabel, styleLabel);
  const metaBtn = slot.querySelector('.metaBtn');
  metaBtn.disabled = false;
  metaBtn.onclick = () => loadMetadata(slot, ideaVal, productLabel, styleLabel);

  // AI edit
  const aiBtn = slot.querySelector('.aiBtn'), panel = slot.querySelector('.aiPanel');
  aiBtn.disabled = false;
  aiBtn.onclick = () => panel.classList.toggle('show');
  const range = panel.querySelector('.aiStr');
  range.oninput = () => panel.querySelector('.aiStrVal').textContent = range.value;
  panel.querySelector('.aiGo').onclick = () => runAiEdit(slot);
  panel.querySelector('.aiUndo').onclick = () => undoAiEdit(slot);

  total++; $('#count').textContent = `${total} design${total>1?'s':''} this session`;
  history.unshift({ url: finalUrl, prompt });
  renderHistory();
  return { ok:true };
}

/* ---------- AI edit: change a detail, keep the rest of the design ---------- */
async function runAiEdit(slot){
  const panel = slot.querySelector('.aiPanel'), go = panel.querySelector('.aiGo');
  const instr = panel.querySelector('.aiText').value.trim();
  const strength = (+panel.querySelector('.aiStr').value) / 100;
  if(!instr){ toast('Write what to change first', true); panel.querySelector('.aiText').focus(); return; }
  if(todayCount() >= DAILY_LIMIT){ toast(`Daily limit (${DAILY_LIMIT}) reached — come back tomorrow`, true); return; }
  go.disabled = true; go.innerHTML = '<span class="spin"></span>Editing…';
  try {
    const img = await loadImageEl(slot._raw);
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    c.getContext('2d').drawImage(img, 0, 0, 512, 512);
    const b64 = c.toDataURL('image/png').split(',')[1];
    const bgHint = slot.dataset.dark === '1' ? 'solid pure black background'
                 : slot.dataset.universal === '1' ? 'solid flat hot pink background'
                 : 'solid plain white background';
    const prompt = `${instr}, same design, same style, same colors, same composition, ${bgHint}, no text`;
    const r = await fetch('/api/edit', {
      method:'POST', headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ image: b64, prompt, strength })
    });
    if(r.status === 429){ markFull(); throw new Error('limit'); }
    if(!r.ok) throw new Error('edit ' + r.status);
    const blob = await r.blob();
    if(!blob.type.startsWith('image/') || blob.size < 500) throw new Error('bad image');
    countImage();
    (slot._hist = slot._hist || []).push(slot._raw);
    await applyRaw(slot, URL.createObjectURL(blob));
    resetAfterPictureChange(slot);
    history.unshift({ url: slot._base, prompt:'edit' }); renderHistory();
    toast('Edited ✓ — tap Undo if you prefer the old one');
  } catch(e){
    console.warn(e);
    toast(String(e.message) === 'limit' ? 'Daily limit reached' : 'AI edit failed — try again', true);
  }
  go.disabled = false; go.textContent = 'Apply AI edit';
}
async function undoAiEdit(slot){
  if(!slot._hist || !slot._hist.length) return;
  await applyRaw(slot, slot._hist.pop());
  resetAfterPictureChange(slot);
  toast('Previous version restored');
}

/* ---------- print export (artwork >= 5000 x 5500 without transparent margins) ---------- */
const PRINT_W = 5000, PRINT_H = 5500, MAX_SIDE = 10000;
const RAW_URLS = new Set();   // files that are already print-ready (text added)
// bounding box of the visible (non-transparent) pixels of a canvas
function alphaBox(c){
  const sc = Math.min(1, 800 / Math.max(c.width, c.height));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * sc)); t.height = Math.max(1, Math.round(c.height * sc));
  const x = t.getContext('2d', { willReadFrequently:true }); x.drawImage(c, 0, 0, t.width, t.height);
  const d = x.getImageData(0, 0, t.width, t.height).data;
  let a = t.width, b = t.height, e = -1, f = -1;
  for(let y = 0; y < t.height; y++){
    for(let i = 0; i < t.width; i++){
      if(d[(y*t.width + i)*4 + 3] > 10){
        if(i < a) a = i; if(i > e) e = i;
        if(y < b) b = y; if(y > f) f = y;
      }
    }
  }
  if(e < 0) return { x:0, y:0, w:c.width, h:c.height };
  const x0 = Math.max(0, Math.floor(a / sc)), y0 = Math.max(0, Math.floor(b / sc));
  const x1 = Math.min(c.width, Math.ceil((e + 1) / sc)), y1 = Math.min(c.height, Math.ceil((f + 1) / sc));
  return { x:x0, y:y0, w:x1 - x0, h:y1 - y0 };
}
// TeePublic measures the artwork WITHOUT transparent margins: it must be at least 5000 x 5500
function printScale(bw, bh){
  const need = Math.max(PRINT_W / bw, PRINT_H / bh);
  return Math.min(need, MAX_SIDE / Math.max(bw, bh));
}
// crops the transparent margins and scales the artwork to print size
function fillExport(src){
  const bb = alphaBox(src), k = printScale(bb.w, bb.h);
  const out = document.createElement('canvas'); out.width = Math.round(bb.w * k); out.height = Math.round(bb.h * k);
  const o = out.getContext('2d'); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
  o.drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, out.width, out.height);
  return out;
}
function loadImageEl(url){
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=url; });
}
async function download(url, idx, name){
  const fname = name || `pod-design-${Date.now()}-${idx+1}-print.png`;
  try {
    if(RAW_URLS.has(url)){   // already print-ready (text added) → save as is
      const a = document.createElement('a'); a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const img = await loadImageEl(url);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    fillExport(c).toBlob(b => {
      if(!b){ toast('Export failed — try again', true); return; }
      const u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    }, 'image/png');
  } catch(e){
    toast('Could not export at print size — opening original', true);
    window.open(url, '_blank');
  }
     }
