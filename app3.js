/* ---------- Text editor: real fonts, always spelled right ---------- */
const FONTS = [
  ['Luckiest Guy',400],['Bebas Neue',400],['Anton',400],['Oswald',700],['Bangers',400],
  ['Permanent Marker',400],['Righteous',400],['Shrikhand',400],['Fredoka',600],
  ['Pacifico',400],['Lobster',400],['Satisfy',400],['Great Vibes',400],
  ['Cinzel',800],['Playfair Display',800],['Rye',400],['Creepster',400]
];
const EW = 1000, EH = 1100;            // editor space (same ratio as 5000x5500)
const ED = { slot:null, img:null, cur:'top', s:null, bg:'checker' };
const edCv = $('#edCanvas'), edCtx = edCv.getContext('2d');
FONTS.forEach(([f]) => { const o = document.createElement('option'); o.value = f; o.textContent = f; o.style.fontFamily = `"${f}"`; $('#edFont').appendChild(o); });
let fontsReady = null;
function loadFonts(){
  if(!fontsReady) fontsReady = Promise.all(FONTS.map(([f,w]) => document.fonts.load(`${w} 40px "${f}"`).catch(()=>{})));
  return fontsReady;
}
function fontWeight(name){ const f = FONTS.find(x => x[0] === name); return f ? f[1] : 400; }

function defaultState(slot){
  const dark = slot.dataset.dark === '1';
  const words = (slot.dataset.text || '').trim().split(/\s+/).filter(Boolean);
  let top = words.join(' '), bottom = '';
  if(words.length > 2){ const k = Math.ceil(words.length / 2); top = words.slice(0, k).join(' '); bottom = words.slice(k).join(' '); }
  const uni = slot.dataset.universal === '1';
  return {
    top:    { text: top,    font:'Luckiest Guy', size:120, arc:35, y:140, x:0, color: uni ? '#16181D' : (dark ? '#FFFFFF' : '#16181D') },
    bottom: { text: bottom, font:'Pacifico',     size:110, arc:0,  y:975, x:0, color: uni ? '#E4572E' : (dark ? '#FFD23F' : '#E4572E') },
    stroke: uni ? '#FFFFFF' : (dark ? '#000000' : '#FFFFFF'), sw: uni ? 8 : 0, imgS: 70, imgX: 0, imgY: 0
  };
}

function drawLine(ctx, L, sw, stroke){
  const text = (L.text || '').trim();
  if(!text) return;
  const X = EW/2 + (L.x || 0);   // horizontal position (left / right)
  ctx.font = `${fontWeight(L.font)} ${L.size}px "${L.font}"`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  const paint = (t, x, y) => {
    if(sw > 0){ ctx.lineWidth = sw * 2; ctx.strokeStyle = stroke; ctx.strokeText(t, x, y); }
    ctx.fillStyle = L.color; ctx.fillText(t, x, y);
  };
  if(!L.arc){ paint(text, X, L.y); return; }
  const R = 40000 / Math.abs(L.arc), up = L.arc > 0;
  const chars = [...text], widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a,b) => a+b, 0);
  const cx = X, cy = up ? L.y + R : L.y - R;
  let acc = 0;
  chars.forEach((c, i) => {
    const a = (acc + widths[i]/2 - total/2) / R;
    acc += widths[i];
    ctx.save();
    if(up){ ctx.translate(cx + R*Math.sin(a), cy - R*Math.cos(a)); ctx.rotate(a); }
    else  { ctx.translate(cx + R*Math.sin(a), cy + R*Math.cos(a)); ctx.rotate(-a); }
    paint(c, 0, 0);
    ctx.restore();
  });
}

// k = scale, tx/ty = offset (used by the export to crop to the real artwork)
function renderText(ctx, k, tx = 0, ty = 0){
  const S = ED.s, img = ED.img;
  ctx.setTransform(k, 0, 0, k, tx, ty);
  ctx.clearRect(-tx / k, -ty / k, ctx.canvas.width / k, ctx.canvas.height / k);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const side = EW * S.imgS / 100;
  const r = Math.min(side / img.naturalWidth, side / img.naturalHeight);
  const w = img.naturalWidth * r, h = img.naturalHeight * r;
  ctx.drawImage(img, (EW - w)/2 + (S.imgX || 0), (EH - h)/2 + S.imgY, w, h);
  drawLine(ctx, S.top, S.sw, S.stroke);
  drawLine(ctx, S.bottom, S.sw, S.stroke);
}

// finds the real content box (picture + text) in editor space, ignoring empty margins
function fitBox(){
  const W = 500, H = 550;
  const t = document.createElement('canvas'); t.width = W; t.height = H;
  const x = t.getContext('2d', { willReadFrequently:true });
  renderText(x, W / EW);
  const d = x.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for(let y = 0; y < H; y++){
    for(let i = 0; i < W; i++){
      if(d[(y*W + i)*4 + 3] > 10){
        if(i < minX) minX = i; if(i > maxX) maxX = i;
        if(y < minY) minY = y; if(y > maxY) maxY = y;
      }
    }
  }
  if(maxX < 0) return null;
  const s = EW / W;   // back to editor space
  return { x:minX*s, y:minY*s, w:(maxX-minX+1)*s, h:(maxY-minY+1)*s };
}

let edRaf = 0;
function drawGuides(){
  const k = edCv.width / EW;
  edCtx.save(); edCtx.setTransform(k, 0, 0, k, 0, 0);
  edCtx.strokeStyle = 'rgba(255,45,149,.9)'; edCtx.lineWidth = 2.5; edCtx.setLineDash([14, 10]);
  edCtx.beginPath();
  edCtx.moveTo(EW/2, 0); edCtx.lineTo(EW/2, EH);
  edCtx.moveTo(0, EH/2); edCtx.lineTo(EW, EH/2);
  edCtx.stroke(); edCtx.restore();
}
function edDraw(){
  cancelAnimationFrame(edRaf);
  edRaf = requestAnimationFrame(() => { renderText(edCtx, edCv.width / EW); if($('#edGuides').checked) drawGuides(); });
}
// crops the empty margins of the picture so it is as big as its real content
async function trimToContent(img){
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  const bb = alphaBox(c), pad = 6;
  const x = Math.max(0, bb.x - pad), y = Math.max(0, bb.y - pad);
  const w = Math.min(c.width - x, bb.w + pad * 2), h = Math.min(c.height - y, bb.h + pad * 2);
  if(w >= c.width - 4 && h >= c.height - 4) return img;
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  t.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
  const url = await new Promise(res => t.toBlob(b => res(URL.createObjectURL(b)), 'image/png'));
  return loadImageEl(url);
}
function setEdBg(mode){
  ED.bg = mode;
  document.querySelectorAll('#edBgSeg button').forEach(b => b.classList.toggle('on', b.dataset.bg === mode));
  edCv.style.background = mode === 'white' ? '#FFFFFF' : mode === 'black' ? '#111111' : '';
}
document.querySelectorAll('#edBgSeg button').forEach(b => b.onclick = () => setEdBg(b.dataset.bg));
$('#edGuides').addEventListener('change', edDraw);
$('#edCenter').onclick = () => {
  ED.s.imgX = 0; ED.s.imgY = 0;   // the picture is trimmed to its content, so 0 / 0 = centered
  $('#edImgX').value = 0; $('#edImgY').value = 0; edDraw();
};

function edFill(){
  const L = ED.s[ED.cur];
  $('#edText').value = L.text; $('#edFont').value = L.font; $('#edColor').value = L.color;
  $('#edSize').value = L.size; $('#edArc').value = L.arc; $('#edY').value = L.y;
  $('#edX').value = L.x || 0;
  $('#edStroke').value = ED.s.stroke; $('#edSW').value = ED.s.sw;
  $('#edHex').value = L.color.toUpperCase(); $('#edStrokeHex').value = ED.s.stroke.toUpperCase();
  $('#edImgS').value = ED.s.imgS; $('#edImgY').value = ED.s.imgY; $('#edImgX').value = ED.s.imgX || 0;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.line === ED.cur));
}
const lineBind = { edText:'text', edFont:'font', edColor:'color', edSize:'size', edArc:'arc', edY:'y', edX:'x' };
Object.entries(lineBind).forEach(([id, key]) => {
  $('#' + id).addEventListener('input', e => {
    const v = e.target.value;
    ED.s[ED.cur][key] = (key === 'text' || key === 'font' || key === 'color') ? v : +v;
    if(key === 'font') document.fonts.load(`${fontWeight(v)} 40px "${v}"`).then(edDraw); else edDraw();
  });
});
[['edStroke','stroke',false],['edSW','sw',true],['edImgS','imgS',true],['edImgX','imgX',true],['edImgY','imgY',true]].forEach(([id, key, num]) => {
  $('#' + id).addEventListener('input', e => { ED.s[key] = num ? +e.target.value : e.target.value; edDraw(); });
});
/* color codes + quick swatches */
const SWATCHES = ['#FFFFFF','#F4E9D0','#FFD23F','#FF8C42','#E63946','#FF4FA3','#B388FF','#4CC9F0','#2EC4B6','#7BC950','#8B5A2B','#16181D'];
function normHex(v){
  v = (v || '').trim(); if(!v.startsWith('#')) v = '#' + v;
  if(/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map(c => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
}
function setLineColor(v){ ED.s[ED.cur].color = v; $('#edColor').value = v; $('#edHex').value = v; edDraw(); }
function setStrokeColor(v){
  ED.s.stroke = v; $('#edStroke').value = v; $('#edStrokeHex').value = v;
  if(!ED.s.sw){ ED.s.sw = 6; $('#edSW').value = 6; }   // picking an outline color turns the outline on
  edDraw();
}
[['swLine', setLineColor], ['swStroke', setStrokeColor]].forEach(([id, fn]) => {
  SWATCHES.forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw';
    b.style.background = c; b.title = c; b.setAttribute('aria-label', c);
    b.onclick = () => fn(c);
    $('#' + id).appendChild(b);
  });
});
$('#edHex').addEventListener('input', e => { const v = normHex(e.target.value); if(v){ ED.s[ED.cur].color = v; $('#edColor').value = v; edDraw(); } });
$('#edColor').addEventListener('input', e => { $('#edHex').value = e.target.value.toUpperCase(); });
$('#edStrokeHex').addEventListener('input', e => { const v = normHex(e.target.value); if(v){ ED.s.stroke = v; $('#edStroke').value = v; edDraw(); } });
$('#edStroke').addEventListener('input', e => { $('#edStrokeHex').value = e.target.value.toUpperCase(); });

document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { ED.cur = b.dataset.line; edFill(); });

async function openEditor(slot){
  try {
    ED.slot = slot; ED.cur = 'top';
    ED.img = await trimToContent(await loadImageEl(slot._base));
    ED.s = slot._ed ? JSON.parse(JSON.stringify(slot._ed)) : defaultState(slot);
    edCv.classList.toggle('dark', slot.dataset.dark === '1');
    setEdBg('checker');
    edFill();
    $('#ed').hidden = false; document.body.style.overflow = 'hidden';
    renderText(edCtx, edCv.width / EW);
    await loadFonts(); edDraw();
  } catch(e){ console.warn(e); toast('Could not open the text editor', true); }
}
function closeEditor(){ $('#ed').hidden = true; document.body.style.overflow = ''; }
$('#edClose').onclick = closeEditor;
$('#ed').addEventListener('click', e => { if(e.target.id === 'ed') closeEditor(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#ed').hidden) closeEditor(); });

async function applyText(andDownload){
  const slot = ED.slot, btn = $('#edApply');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Rendering print file…';
  try {
    await loadFonts();
    // crop to the real artwork and scale it so it is at least 5000x5500 (TeePublic rule)
    const bb = fitBox() || { x:0, y:0, w:EW, h:EH };
    const k = printScale(bb.w, bb.h);
    const c = document.createElement('canvas'); c.width = Math.round(bb.w * k); c.height = Math.round(bb.h * k);
    renderText(c.getContext('2d'), k, -bb.x * k, -bb.y * k);

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if(!blob) throw new Error('export failed');
    const url = URL.createObjectURL(blob);
    RAW_URLS.add(url);
    slot._url = url;
    slot._ed = JSON.parse(JSON.stringify(ED.s));
    const newText = [ED.s.top.text, ED.s.bottom.text].map(t => t.trim()).filter(Boolean).join(' ');
    if(newText !== slot.dataset.text){ slot.dataset.text = newText; slot._meta = null; }
    slot.querySelector('.img-box').innerHTML = `<img src="${url}" alt="Design with text">`;
    // AI upscale works from the picture without text, so hide it once text is added
    // (Vector panel / Vector SVG / HD PNG vectorized include the text)
    slot.querySelectorAll('.upBtn').forEach(b => b.hidden = true);
    const kit = slot.querySelector('.kit'); kit.classList.remove('show'); kit.innerHTML = '';
    slot.querySelector('.kitBtn').textContent = '🚀 TeePublic kit';
    slot.querySelector('.txtBtn').textContent = '✏️ Edit text';
    history.unshift({ url, prompt:'text' }); renderHistory();
    closeEditor();
    if(andDownload) download(url, slot._idx || 0);
    toast('Text added — TeePublic kit now uses this version');
  } catch(e){
    console.warn(e); toast('Could not render — try again', true);
  }
  btn.disabled = false; btn.textContent = 'Apply to design';
}
$('#edApply').onclick = () => applyText(false);
$('#edApplyDl').onclick = () => applyText(true);

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

let tt;
function toast(msg, err){
  clearTimeout(tt); document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (err?' err':''); t.textContent = msg;
  document.body.appendChild(t); tt = setTimeout(()=>t.remove(), 3500);
}

/* ---------- Similar image: describe (generic) -> generate 2 improved designs ---------- */
const SIM = { b64:null };
const SIM_CLAUSES = {
  close: 'very similar composition and pose, cleaner and sharper detail',
  mid:   'same subject and mood, fresh improved composition, cleaner detail',
  far:   'same theme but a new pose and composition, richer detail'
};
$('#simPick').onclick = () => $('#simFile').click();
$('#simFile').onchange = async e => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  try {
    const img = await loadImageEl(URL.createObjectURL(f));
    const sc = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
    const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height);   // transparent PNGs -> white
    x.drawImage(img, 0, 0, c.width, c.height);
    SIM.b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
    const th = $('#simThumb'); th.src = c.toDataURL('image/jpeg', 0.7); th.hidden = false;
    $('#simGo').disabled = false;
  } catch(err){
    console.warn(err); toast('Could not read this image — try a JPG or PNG', true);
  }
  e.target.value = '';
};
$('#simGo').onclick = async () => {
  if(!SIM.b64 || generating) return;
  const btn = $('#simGo');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Analyzing image…';
  let ok = false;
  try {
    const r = await fetch('/api/describe', {
      method:'POST', headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ image: SIM.b64 })
    });
    const d = await r.json().catch(() => ({}));
    if(!r.ok || d.error || !d.description) throw new Error(d.error || 'no description');
    let desc = String(d.description).replace(/\s+/g, ' ').trim().replace(/[."\s]+$/, '');
    if(desc.length > 450){ desc = desc.slice(0, 450); desc = desc.slice(0, desc.lastIndexOf(' ') > 200 ? desc.lastIndexOf(' ') : 450); }  // the server cuts prompts at 800 chars
    $('#idea').value = `${desc}, ${SIM_CLAUSES[$('#simLevel').value] || SIM_CLAUSES.mid}`;
    $('#exactText').value = '';
    ok = true;
  } catch(err){
    console.warn(err); toast('Could not analyze the image — try again', true);
  }
  btn.disabled = false; btn.textContent = '✨ Create similar designs';
  if(ok){ toast('Description ready — generating 2 designs…'); $('#genBtn').click(); }
};

/* ---------- Vector panel (Image Trace, like Illustrator) ---------- */
const VP_PRESETS = {
  default: { label:'[Default]',            t:{ mode:'bw', thr:128, paths:50, corners:75, noise:25 } },
  hifi:    { label:'High Fidelity Photo',  t:{ mode:'color', palette:'limited', colors:40, paths:90, corners:40, noise:4 } },
  lofi:    { label:'Low Fidelity Photo',   t:{ mode:'color', palette:'limited', colors:20, paths:60, corners:50, noise:12 } },
  c3:      { label:'3 Colors',             t:{ mode:'color', palette:'limited', colors:3,  paths:50, corners:75, noise:25 } },
  c6:      { label:'6 Colors',             t:{ mode:'color', palette:'limited', colors:6,  paths:50, corners:75, noise:20 } },
  c16:     { label:'16 Colors',            t:{ mode:'color', palette:'limited', colors:16, paths:60, corners:60, noise:12 } },
  gray:    { label:'Shades of Gray',       t:{ mode:'gray', colors:16, paths:70, corners:50, noise:10 } },
  bwlogo:  { label:'Black and White Logo', t:{ mode:'bw', thr:128, paths:60, corners:75, noise:8 } },
  sketch:  { label:'Sketched Art',         t:{ mode:'bw', thr:160, fills:false, strokes:true, strokeW:1.5, paths:60, corners:50, noise:6, ignoreWhite:true } },
  silh:    { label:'Silhouettes',          t:{ mode:'bw', thr:128, ignoreWhite:true, paths:50, corners:75, noise:25 } },
  line:    { label:'Line Art',             t:{ mode:'bw', thr:128, fills:false, strokes:true, strokeW:1, paths:80, corners:50, noise:6, ignoreWhite:true } },
  tech:    { label:'Technical Drawing',    t:{ mode:'bw', thr:128, fills:false, strokes:true, strokeW:1, paths:90, corners:80, noise:4, ignoreWhite:true } }
};
function presetT(key, res){ return Object.assign({}, DEFAULT_T, VP_PRESETS[key].t, res ? { res } : {}); }

const VP = { slot:null, T:null, preset:'c16', view:'result', R:null, S:null, token:0, blob:null, timer:0 };

(function buildPresetSelect(){
  const sel = $('#vpPreset');
  const c = document.createElement('option'); c.value = 'custom'; c.textContent = 'Custom'; c.disabled = true; sel.appendChild(c);
  Object.entries(VP_PRESETS).forEach(([k, p]) => { const o = document.createElement('option'); o.value = k; o.textContent = p.label; sel.appendChild(o); });
})();

function loadTraceSettings(){
  try {
    const s = JSON.parse(localStorage.getItem('pf_trace') || 'null');
    if(s && s.T) return { T:Object.assign({}, DEFAULT_T, s.T), preset:s.preset || 'custom' };
  } catch(e){}
  return { T:presetT('c16'), preset:'c16' };
}
function saveTraceSettings(){ try { localStorage.setItem('pf_trace', JSON.stringify({ T:VP.T, preset:VP.preset })); } catch(e){} }

function readControls(){
  const T = VP.T;
  T.mode = $('#vpMode').value; T.palette = $('#vpPalette').value;
  T.colors = +$('#vpColors').value; T.thr = +$('#vpThr').value;
  T.paths = +$('#vpPaths').value; T.corners = +$('#vpCorners').value; T.noise = +$('#vpNoise').value;
  T.fills = $('#vpFills').checked; T.strokes = $('#vpStrokes').checked;
  if(!T.fills && !T.strokes){ T.fills = true; $('#vpFills').checked = true; }
  T.strokeW = +$('#vpStrokeW').value;
  T.snap = $('#vpSnap').checked; T.ignoreWhite = $('#vpIgn').checked;
  T.res = +$('#vpRes').value;
}
function writeControls(){
  const T = VP.T;
  if(T.mode === 'gray' && T.colors > 16) T.colors = 16;
  $('#vpMode').value = T.mode; $('#vpPalette').value = T.palette;
  $('#vpColors').max = T.mode === 'gray' ? 16 : 48; $('#vpColors').value = T.colors;
  $('#vpThr').value = T.thr; $('#vpPaths').value = T.paths; $('#vpCorners').value = T.corners; $('#vpNoise').value = T.noise;
  $('#vpFills').checked = T.fills; $('#vpStrokes').checked = T.strokes; $('#vpStrokeW').value = T.strokeW;
  $('#vpSnap').checked = T.snap; $('#vpIgn').checked = T.ignoreWhite;
  $('#vpRes').value = String(T.res);
  $('#vpColorsL').textContent = T.mode === 'gray' ? 'Grays' : 'Colors';
  $('#vpColorsV').textContent = T.colors; $('#vpThrV').textContent = T.thr;
  $('#vpPathsV').textContent = T.paths + '%'; $('#vpCornersV').textContent = T.corners + '%';
  $('#vpNoiseV').textContent = T.noise + ' px'; $('#vpStrokeWV').textContent = T.strokeW + ' px';
  $('#rowPalette').style.display = T.mode === 'color' ? '' : 'none';
  $('#rowColors').style.display = (T.mode === 'gray' || (T.mode === 'color' && T.palette === 'limited')) ? '' : 'none';
  $('#rowThr').style.display = T.mode === 'bw' ? '' : 'none';
  $('#rowStroke').style.display = T.strokes ? '' : 'none';
  document.querySelectorAll('#vpMethod button').forEach(b => b.classList.toggle('on', b.dataset.m === T.method));
}
function scheduleTrace(){
  if($('#vpAuto').checked){ clearTimeout(VP.timer); VP.timer = setTimeout(vpTrace, 700); }
}
function onCtl(){
  readControls();
  VP.preset = 'custom'; $('#vpPreset').value = 'custom';
  writeControls(); scheduleTrace();
}
['vpColors','vpThr','vpPaths','vpCorners','vpNoise','vpStrokeW'].forEach(id => $('#' + id).addEventListener('input', onCtl));
['vpMode','vpPalette','vpFills','vpStrokes','vpSnap','vpIgn','vpRes'].forEach(id => $('#' + id).addEventListener('change', onCtl));
document.querySelectorAll('#vpMethod button').forEach(b => b.onclick = () => { VP.T.method = b.dataset.m; onCtl(); });
$('#vpPreset').addEventListener('change', e => {
  const k = e.target.value; if(k === 'custom' || !VP_PRESETS[k]) return;
  VP.T = presetT(k, VP.T.res); VP.preset = k; writeControls(); scheduleTrace();
});
$('#vpView').addEventListener('change', e => { VP.view = e.target.value; showView(); });

// ----- views -----
function svgInner(s){ return s.slice(s.indexOf('>') + 1, s.lastIndexOf('</svg>')); }
function outlinesInner(s, w){
  return svgInner(s).replace(/fill="[^"]*"/g, 'fill="none"')
    .replace(/stroke="[^"]*"/g, 'stroke="#E5006A"')
    .replace(/stroke-width="[^"]*"/g, `stroke-width="${(w / 450).toFixed(2)}"`);
}
function viewSvg(R, v){
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${R.w} ${R.h}" width="${R.w}" height="${R.h}">`;
  if(v === 'resultOutlines') return head + svgInner(R.svg) + outlinesInner(R.svg, R.w) + '</svg>';
  if(v === 'outlines') return head + `<rect width="${R.w}" height="${R.h}" fill="#fff"/>` + outlinesInner(R.svg, R.w) + '</svg>';
  if(v === 'outlinesSource') return head + `<image href="${srcUrl(R.S)}" width="${R.w}" height="${R.h}" opacity="0.55"/>` + outlinesInner(R.svg, R.w) + '</svg>';
  return R.svg;
}
function showView(){
  const R = VP.R, img = $('#vpImg');
  if(!R){ img.src = VP.slot._url; return; }
  let url;
  if(VP.view === 'source') url = srcUrl(R.S);
  else url = URL.createObjectURL(new Blob([viewSvg(R, VP.view)], { type:'image/svg+xml' }));
  if(VP.blob){ URL.revokeObjectURL(VP.blob); VP.blob = null; }
  if(VP.view !== 'source') VP.blob = url;
  img.src = url;
}
function showStats(R){
  const s = R.stats;
  $('#vpStats').textContent = `Paths: ${s.paths} · Anchors: ${s.anchors} · Colors: ${s.colors}`;
}

// ----- tracing -----
async function vpTrace(){
  if(!VP.slot) return;
  if(!window.ImageTracer){ toast('Vector tool not loaded — refresh the page', true); return; }
  const token = ++VP.token;
  $('#vpBusy').hidden = false;
  const btn = $('#vpTrace'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Tracing…';
  try {
    const T = Object.assign({}, VP.T), key = VP.slot._url + '|' + T.res;
    if(!VP.S || VP.S.key !== key){ VP.S = await prepareSource(VP.slot, T.res); VP.S.key = key; }
    const S = VP.S;
    const id = S.ctx.getImageData(0, 0, S.w, S.h);
    await sleep(20);
    const R = await traceCore(id, S.w, S.h, T, T.res);
    if(token !== VP.token) return;
    R.S = S; VP.R = R;
    showView(); showStats(R); saveTraceSettings();
  } catch(e){
    console.warn(e);
    if(token === VP.token) toast(e.message || 'Trace failed — try a lower resolution', true);
  } finally {
    if(token === VP.token){ $('#vpBusy').hidden = true; btn.disabled = false; btn.textContent = 'Trace'; }
  }
}
$('#vpTrace').onclick = vpTrace;

async function vpEnsureResult(){
  if(!VP.R) await vpTrace();
  return VP.R;
}
$('#vpSvg').onclick = async () => {
  const R = await vpEnsureResult(); if(!R) return;
  saveBlob(new Blob([R.svg], { type:'image/svg+xml' }), `pod-design-${Date.now()}-${(VP.slot._idx || 0) + 1}.svg`);
  toast(`SVG saved (${Math.round(R.svg.length / 1024)} KB)`);
};
$('#vpPng').onclick = async () => {
  const R = await vpEnsureResult(); if(!R) return;
  const btn = $('#vpPng'), old = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Rendering PNG…';
  try {
    const out = await svgToPrintCanvas(R.svg, R.w, R.h);
    await new Promise(res => out.toBlob(b => {
      if(!b){ toast('Export failed — try again', true); return res(); }
      saveBlob(b, `pod-design-${Date.now()}-${(VP.slot._idx || 0) + 1}-trace-print.png`);
      res();
    }, 'image/png'));
  } catch(e){ console.warn(e); toast('PNG export failed — try the Fast resolution', true); }
  btn.disabled = false; btn.textContent = old;
};

function openVectorPanel(slot){
  if(!window.ImageTracer){ toast('Vector tool not loaded — refresh the page', true); return; }
  const s = loadTraceSettings();
  VP.slot = slot; VP.R = null; VP.S = null; VP.token++; VP.view = 'result';
  VP.T = s.T; VP.preset = (s.preset && (VP_PRESETS[s.preset] || s.preset === 'custom')) ? s.preset : 'custom';
  $('#vpPreset').value = VP.preset;
  $('#vpView').value = 'result';
  writeControls();
  $('#vpPrev').classList.toggle('dark', slot.dataset.dark === '1');
  $('#vpStats').textContent = 'Paths: 0 · Anchors: 0 · Colors: 0';
  $('#vpBusy').hidden = true;
  $('#vpImg').src = slot._url;
  $('#vp').hidden = false; document.body.style.overflow = 'hidden';
}
function closeVectorPanel(){
  VP.token++; clearTimeout(VP.timer);
  $('#vp').hidden = true; document.body.style.overflow = '';
  if(VP.blob){ URL.revokeObjectURL(VP.blob); VP.blob = null; }
}
$('#vpClose').onclick = closeVectorPanel;
$('#vp').addEventListener('click', e => { if(e.target.id === 'vp') closeVectorPanel(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#vp').hidden) closeVectorPanel(); });
/* ---------- popular POD niche library (for the concept generator) ---------- */
const NICHE_LIBRARY = {
  'Healthcare': ['ER nurses','ICU nurses','L&D nurses','NICU nurses','pediatric nurses','travel nurses','night shift nurses','nursing students','CNAs','paramedics and EMTs','respiratory therapists','pharmacists','pharmacy techs','dental hygienists','dental assistants','radiology techs','phlebotomists','physical therapists','occupational therapists','speech therapists','medical assistants','surgeons','anesthesiologists','veterinarians','vet techs'],
  'Education': ['kindergarten teachers','elementary teachers','math teachers','science teachers','English teachers','history teachers','art teachers','music teachers','PE teachers','special education teachers','school counselors','school librarians','principals','teacher aides','school bus drivers','cafeteria workers','homeschool moms','substitute teachers'],
  'Jobs & trades': ['electricians','plumbers','welders','HVAC techs','mechanics','diesel mechanics','carpenters','truck drivers','linemen','construction workers','firefighters','911 dispatchers','accountants','lawyers','paralegals','engineers','software developers','IT support','data analysts','real estate agents','hairstylists','barbers','nail techs','bartenders','baristas','chefs','waitresses','farmers','pilots','flight attendants','social workers','therapists','librarians','military veterans','retail workers','warehouse workers','delivery drivers','customer service reps'],
  'Family': ['dog moms','dog dads','cat moms','cat dads','boy moms','girl dads','new moms','new dads','grandmas','grandpas','aunties','uncles','twin moms','dance moms','soccer moms','baseball moms','football moms','hockey moms','cheer moms','wrestling moms','stepdads','foster parents','retirees'],
  'Pets & animals': ['golden retriever owners','pitbull moms','dachshund lovers','German shepherd owners','French bulldog owners','corgi lovers','husky owners','chihuahua owners','labrador owners','border collie owners','black cat lovers','horse girls','backyard chicken keepers','goat lovers','highland cow lovers','bird watchers','beekeepers','axolotl lovers','reptile keepers','capybara fans','frog lovers','raccoon fans','opossum fans'],
  'Outdoors': ['bass fishing','fly fishing','ice fishing','deer hunting','duck hunting','camping','hiking','RV campers','kayaking','off-roading','overlanding','gardening','homesteaders','astronomy lovers','surfers','skiers','snowboarders'],
  'Hobbies & crafts': ['crocheting','knitting','quilting','sewing','scrapbooking','woodworking','pottery','painters','photographers','sourdough bakers','home bakers','BBQ pitmasters','coffee lovers','tea lovers','craft beer lovers','wine moms','plant lovers','houseplant collectors','thrifters','true crime fans','cryptid hunters','puzzle lovers','vinyl record collectors'],
  'Books & games': ['bookworms','romance readers','fantasy readers','book club members','tabletop RPG players','board gamers','video gamers','retro gamers','chess players','trivia nerds'],
  'Sports & fitness': ['runners','marathon runners','cyclists','weightlifters','powerlifters','yoga lovers','pickleball players','golfers','tennis players','bowlers','disc golfers','archers','swimmers','volleyball players','softball players','rodeo lovers'],
  'Music & arts': ['guitar players','drummers','piano players','band kids','choir singers','theater kids','dancers','DJs','tattoo artists'],
  'Vehicles': ['classic car lovers','car guys','motorcycle riders','truck lovers','tractor lovers','drift racing fans','mechanic dads'],
  'Personality & humor': ['introverts','overthinkers','night owls','sarcastic people','ADHD humor','anxiety humor','mental health awareness','anti-social humor','nap lovers','taco lovers','pizza lovers','spicy food lovers'],
  'Faith & lifestyle': ['Christian faith','church moms','cottagecore','dark academia','goth style','witchy vibes','minimalists','van life','tiny house living'],
  'Life events': ['retirement','40th birthday','50th birthday','60th birthday','bachelorette party','bride squad','groom crew','family reunion','class of 2027','new homeowners','pregnancy announcement','cancer survivors','sobriety milestones']
};
(function(){
  const pick = $('#cPick');
  Object.entries(NICHE_LIBRARY).forEach(([group, list]) => {
    const g = document.createElement('optgroup'); g.label = group;
    list.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; g.appendChild(o); });
    pick.appendChild(g);
  });
  pick.onchange = () => { if(pick.value) $('#cNiche').value = pick.value; };
})();

/* ---------- concept generator (insider-joke ideas) ---------- */
$('#cBtn').onclick = async () => {
  const niche = $('#cNiche').value.trim();
  if(!niche){ toast('Write a niche first', true); $('#cNiche').focus(); return; }
  const btn = $('#cBtn'), box = $('#concepts');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Thinking…'; box.innerHTML = '';
  try {
    const r = await fetch(`/api/concepts?niche=${encodeURIComponent(niche)}&season=${encodeURIComponent($('#cSeason').value)}`, { cache:'no-store' });
    const d = await r.json();
    if(d.error || !d.concepts) throw new Error(d.message || d.error);
    box.innerHTML = d.concepts.map((c, i) => `
      <div class="concept">
        <div class="ct">"${esc(c.text)}"</div>
        <p><strong>Visual:</strong> ${esc(c.visual)}</p>
        <p><strong>Buyer:</strong> ${esc(c.buyer)}</p>
        <p><strong>Why it sells:</strong> ${esc(c.why)}</p>
        <p><strong>Best style:</strong> ${esc(c.style || '')}</p>
        <div class="row">
          <button class="btn-sec" data-use="${i}">Use</button>
          <button class="btn-sec" data-save="${i}">Save</button>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const c = d.concepts[b.dataset.use];
      $('#idea').value = c.visual; $('#exactText').value = c.text;
      const opt = [...$('#style').options].find(o => o.textContent === c.style);
      if(opt) $('#style').value = opt.value;
      $('#idea').scrollIntoView({ behavior:'smooth', block:'center' });
      toast(`Added with ${c.style || 'current'} style — tap Generate`);
    });
    box.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
      const c = d.concepts[b.dataset.save];
      const all = loadCustom(), key = 'My own ideas';
      const list = all[key] || [];
      if(!list.some(x => x[0] === c.visual && x[1] === c.text)) list.unshift([c.visual, c.text]);
      all[key] = list; saveCustom(all);
      if(nicheSel.value === 'mine') fillIdeas();
      b.textContent = 'Saved ✓'; b.disabled = true;
    });
  } catch(e){
    console.warn(e);
    toast('Could not generate concepts — try again', true);
  }
  btn.disabled = false; btn.textContent = 'Generate 10 concepts';
};
