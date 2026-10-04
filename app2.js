/* ---------- vectorizer engine (Image Trace) ---------- */
// default trace settings (the Vector panel and the quick buttons both use these)
const DEFAULT_T = {
  mode:'color',      // color | gray | bw
  palette:'limited', // limited | auto (color mode)
  colors:16, thr:128,
  paths:60, corners:60, noise:12,
  method:'abutting', // abutting | overlap
  fills:true, strokes:false, strokeW:2,
  snap:true, ignoreWhite:false,
  res:1200           // working size of the trace
};
// quick buttons (⬇ Vector SVG / HD PNG vectorized)
const QUICK = {
  detailed: Object.assign({}, DEFAULT_T, { colors:24, paths:80, corners:50, noise:6,  res:1600 }),
  balanced: Object.assign({}, DEFAULT_T, { colors:16, paths:65, corners:60, noise:12, res:1400 }),
  clean:    Object.assign({}, DEFAULT_T, { colors:10, paths:50, corners:70, noise:24, res:1200 })
};

// running-sum box blur (in place on `a`, `t` is scratch), edges clamped
function boxBlur(a, w, h, r, t){
  const inv = 1 / (2*r + 1);
  for(let y = 0; y < h; y++){
    const o = y*w; let s = a[o]*r;
    for(let x = 0; x <= r; x++) s += a[o + Math.min(x, w-1)];
    for(let x = 0; x < w; x++){
      t[o + x] = s*inv;
      s += a[o + Math.min(w-1, x + r + 1)] - a[o + Math.max(0, x - r)];
    }
  }
  for(let x = 0; x < w; x++){
    let s = t[x]*r;
    for(let y = 0; y <= r; y++) s += t[Math.min(y, h-1)*w + x];
    for(let y = 0; y < h; y++){
      a[y*w + x] = s*inv;
      s += t[Math.min(h-1, y + r + 1)*w + x] - t[Math.max(0, y - r)*w + x];
    }
  }
}

// absorbs isolated patches smaller than minArea into their biggest neighbour (labels: 255 = transparent)
function removeSmallRegions(cur, w, h, minArea){
  const n = w*h, seen = new Uint8Array(n), stack = new Int32Array(n), comp = new Int32Array(n), hist = new Int32Array(256);
  for(let s = 0; s < n; s++){
    if(seen[s]) continue;
    const l = cur[s];
    if(l === 255){ seen[s] = 1; continue; }
    let top = 0, cnt = 0;
    stack[top++] = s; seen[s] = 1;
    while(top){
      const p = stack[--top]; comp[cnt++] = p;
      const x = p % w, y = (p / w) | 0;
      if(x > 0     && !seen[p-1] && cur[p-1] === l){ seen[p-1] = 1; stack[top++] = p-1; }
      if(x < w-1   && !seen[p+1] && cur[p+1] === l){ seen[p+1] = 1; stack[top++] = p+1; }
      if(y > 0     && !seen[p-w] && cur[p-w] === l){ seen[p-w] = 1; stack[top++] = p-w; }
      if(y < h-1   && !seen[p+w] && cur[p+w] === l){ seen[p+w] = 1; stack[top++] = p+w; }
    }
    if(cnt >= minArea) continue;
    hist.fill(0);
    for(let i = 0; i < cnt; i++){
      const p = comp[i], x = p % w, y = (p / w) | 0;
      if(x > 0   && cur[p-1] !== l) hist[cur[p-1]]++;
      if(x < w-1 && cur[p+1] !== l) hist[cur[p+1]]++;
      if(y > 0   && cur[p-w] !== l) hist[cur[p-w]]++;
      if(y < h-1 && cur[p+w] !== l) hist[cur[p+w]]++;
    }
    let best = -1, bc = 0;
    for(let k = 0; k < 256; k++) if(hist[k] > bc){ bc = hist[k]; best = k; }
    if(best >= 0) for(let i = 0; i < cnt; i++) cur[comp[i]] = best;
  }
}

// blurs each color's mask and keeps the strongest -> smooth flowing borders, thick lines survive
async function smoothLabels(cur, w, h, r){
  const n = w*h, best = new Float32Array(n).fill(-1), lab = new Uint8Array(n);
  const a = new Float32Array(n), t = new Float32Array(n);
  const cnt = new Uint32Array(256);
  for(let p = 0; p < n; p++) cnt[cur[p]]++;
  for(let id = 0; id < 256; id++){
    if(!cnt[id]) continue;
    for(let p = 0; p < n; p++) a[p] = cur[p] === id ? 1 : 0;
    boxBlur(a, w, h, r, t); boxBlur(a, w, h, r, t);
    for(let p = 0; p < n; p++) if(a[p] > best[p]){ best[p] = a[p]; lab[p] = id; }
    await sleep(0);
  }
  cur.set(lab);
}

// builds the flat palette (color / gray / black-white), snaps pixels, cleans + smooths,
// writes the flat result back into `id` and returns the palette for the tracer
async function cleanQuantize(id, T, size){
  const w = id.width, h = id.height, d = id.data, n = w * h, kk = size / 1200;
  const mode = T.mode, p = T.paths / 100;
  const P = {
    colors: (mode === 'color' && T.palette === 'auto') ? 28 : T.colors,
    merge: mode === 'gray' ? Math.max(6, Math.round(200 / T.colors))
         : (mode === 'color' && T.palette === 'auto') ? 30 : Math.max(18, 70 - T.colors * 2),
    dark: mode === 'color' ? 60 : 0,
    minArea: Math.max(3, Math.round(T.noise * 4 * kk * kk)),
    smooth: Math.max(1, Math.round((p < 0.35 ? 3 : p < 0.7 ? 2 : 1) * kk))
  };
  const d2 = (a, b) => (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2]);
  const lum = c => 0.3*c[0] + 0.59*c[1] + 0.11*c[2];

  if(mode === 'gray'){
    for(let i = 0; i < d.length; i += 4){
      if(d[i+3] >= 128){ const g = Math.round(0.3*d[i] + 0.59*d[i+1] + 0.11*d[i+2]); d[i] = d[i+1] = d[i+2] = g; }
    }
  }

  let Ci;
  if(mode === 'bw'){
    Ci = [[0, 0, 0], [255, 255, 255]];
  } else {
    const S = [], step = Math.max(1, Math.floor(n / 20000));
    for(let q = 0; q < n; q += step){ const i = q*4; if(d[i+3] >= 128) S.push([d[i], d[i+1], d[i+2]]); }
    if(!S.length) return [{ r:0, g:0, b:0, a:0 }];
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    // k-means++ start
    let C = [S[Math.floor(rnd() * S.length)].slice()];
    const md = new Float64Array(S.length).fill(Infinity);
    while(C.length < P.colors){
      const last = C[C.length - 1]; let sum = 0;
      for(let i = 0; i < S.length; i++){ const v = d2(S[i], last); if(v < md[i]) md[i] = v; sum += md[i]; }
      if(sum === 0) break;
      let r = rnd() * sum, pick = 0;
      for(let i = 0; i < S.length; i++){ r -= md[i]; if(r <= 0){ pick = i; break; } }
      C.push(S[pick].slice());
    }
    // k-means rounds
    let cnt = new Array(C.length).fill(0);
    for(let it = 0; it < 8; it++){
      const sums = C.map(() => [0, 0, 0, 0]);
      for(const s of S){
        let b = 0, bd = Infinity;
        for(let k = 0; k < C.length; k++){ const v = d2(s, C[k]); if(v < bd){ bd = v; b = k; } }
        const a = sums[b]; a[0] += s[0]; a[1] += s[1]; a[2] += s[2]; a[3]++;
      }
      C = C.map((c, k) => sums[k][3] ? [sums[k][0]/sums[k][3], sums[k][1]/sums[k][3], sums[k][2]/sums[k][3]] : c);
      cnt = sums.map(s => s[3]);
    }
    await sleep(0);

    // merge near-identical shades + absorb tiny noise colors
    const mergeInto = (keep, drop) => {
      const t = cnt[keep] + cnt[drop] || 1;
      C[keep] = [0, 1, 2].map(j => (C[keep][j]*cnt[keep] + C[drop][j]*cnt[drop]) / t);
      cnt[keep] = t;
      C.splice(drop, 1); cnt.splice(drop, 1);
    };
    const minCnt = S.length * 0.0015, M2 = P.merge * P.merge;
    let again = true;
    while(again && C.length > 1){
      again = false;
      let bi = -1, bj = -1, bd = Infinity;
      for(let i = 0; i < C.length; i++) for(let j = i + 1; j < C.length; j++){
        const v = d2(C[i], C[j]); if(v < bd){ bd = v; bi = i; bj = j; }
      }
      if(bd < M2){ mergeInto(cnt[bi] >= cnt[bj] ? bi : bj, cnt[bi] >= cnt[bj] ? bj : bi); again = true; continue; }
      let t = -1;
      for(let k = 0; k < C.length; k++) if(cnt[k] < minCnt && (t < 0 || cnt[k] < cnt[t])) t = k;
      if(t >= 0){
        let nj = -1, nd = Infinity;
        for(let k = 0; k < C.length; k++) if(k !== t){ const v = d2(C[t], C[k]); if(v < nd){ nd = v; nj = k; } }
        mergeInto(nj, t); again = true;
      }
    }
    // (color mode) all very dark shades fall into ONE black -> outlines stay continuous
    let di = 0;
    for(let k = 1; k < C.length; k++) if(lum(C[k]) < lum(C[di])) di = k;
    Ci = C.filter((c, k) => k === di || lum(c) >= P.dark).map(c => c.map(v => Math.round(v)));
  }
  const K = Ci.length;

  // "Ignore White": palette colors that are (nearly) white become transparent
  const ign = new Set();
  if(T.ignoreWhite) Ci.forEach((c, k) => { if(c[0] >= 235 && c[1] >= 235 && c[2] >= 235) ign.add(k); });

  // snap every pixel to a palette color (255 = transparent)
  let cur = new Uint8Array(n);
  for(let q = 0; q < n; q++){
    const i = q*4;
    if(d[i+3] < 128){ cur[q] = 255; continue; }
    let b = 0;
    if(mode === 'bw'){
      b = (0.3*d[i] + 0.59*d[i+1] + 0.11*d[i+2]) < T.thr ? 0 : 1;
    } else {
      let bd = Infinity;
      for(let k = 0; k < K; k++){
        const c = Ci[k], dr = d[i]-c[0], dg = d[i+1]-c[1], db = d[i+2]-c[2], v = dr*dr + dg*dg + db*db;
        if(v < bd){ bd = v; b = k; }
      }
    }
    cur[q] = ign.has(b) ? 255 : b;
  }
  await sleep(0);

  removeSmallRegions(cur, w, h, P.minArea);                    // 1) kill specks / broken bits
  await sleep(0);
  await smoothLabels(cur, w, h, P.smooth);                     // 2) round + smooth every border
  removeSmallRegions(cur, w, h, Math.round(P.minArea / 2));    // 3) clean what smoothing left

  // write the flat result back
  for(let q = 0; q < n; q++){
    const i = q*4, l = cur[q];
    if(l === 255){ d[i] = d[i+1] = d[i+2] = 0; d[i+3] = 0; }
    else { const c = Ci[l]; d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; d[i+3] = 255; }
  }
  return Ci.map(c => ({ r:c[0], g:c[1], b:c[2], a:255 })).concat([{ r:0, g:0, b:0, a:0 }]);
}

// loads the CURRENT design (with added text if any), crops margins, scales to `size`, light blur (kills AI grain)
async function prepareSource(slot, size){
  const img = await loadImageEl(slot._url);
  const sc = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  const c0 = document.createElement('canvas');
  c0.width = Math.max(1, Math.round(img.naturalWidth * sc)); c0.height = Math.max(1, Math.round(img.naturalHeight * sc));
  const x0 = c0.getContext('2d', { willReadFrequently:true });
  x0.imageSmoothingQuality = 'high'; x0.drawImage(img, 0, 0, c0.width, c0.height);
  const bb = alphaBox(c0);
  const k = size / Math.max(bb.w, bb.h);
  const w = Math.max(1, Math.round(bb.w * k)), h = Math.max(1, Math.round(bb.h * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  try { ctx.filter = `blur(${(0.6 * size / 1200).toFixed(2)}px)`; } catch(e){}
  ctx.drawImage(c0, bb.x, bb.y, bb.w, bb.h, 0, 0, w, h);
  try { ctx.filter = 'none'; } catch(e){}
  return { c, ctx, w, h, url:null };
}
function srcUrl(S){ return S.url || (S.url = S.c.toDataURL('image/png')); }

// quantize + trace one image -> { svg, w, h, stats }
async function traceCore(id, w, h, T, size){
  const pal = await cleanQuantize(id, T, size);
  await sleep(0);
  const kk = size / 1200, p = T.paths / 100, c = T.corners / 100;
  const L = 0.3 * Math.pow(12, 1 - p);                         // fit tolerance: Paths High = tight
  const snap = T.snap ? 1.3 : 1;
  const sw = T.strokes ? Math.max(0.5, T.strokeW * kk) : (T.method === 'overlap' ? 3 * kk : 1 * kk);
  let svg = ImageTracer.imagedataToSVG(id, {
    pal, colorsampling: 0, numberofcolors: pal.length, colorquantcycles: 1, mincolorratio: 0,
    ltres: L * (0.5 + c * 1.5) * snap, qtres: L * (1.6 - c),
    pathomit: Math.max(1, Math.round(T.noise * 1.1 * kk)),
    rightangleenhance: c >= 0.8, blurradius: 0,
    strokewidth: sw, roundcoords: 2, viewbox: true, desc: false
  });
  svg = svg.replace(/<path[^>]*opacity="0"[^>]*\/>/g, '')      // drop the transparent "color"
           .replace('<svg ', `<svg width="${w}" height="${h}" `);
  if(T.strokes && !T.fills) svg = svg.replace(/fill="rgb\([^)]*\)"/g, 'fill="none"');
  // stats (like Illustrator: Paths / Anchors / Colors)
  const paths = (svg.match(/<path/g) || []).length;
  let anchors = 0, m;
  const dre = /\sd="([^"]*)"/g;
  while((m = dre.exec(svg))) anchors += (m[1].match(/[MLQ]/g) || []).length;
  const cols = new Set((svg.match(/fill="rgb\([^)]*\)"/g) || []));
  if(T.strokes && !T.fills) (svg.match(/stroke="rgb\([^)]*\)"/g) || []).forEach(s => cols.add(s));
  return { svg, w, h, stats:{ paths, anchors, colors:cols.size } };
}

// used by the quick buttons
async function vectorize(slot){
  if(!window.ImageTracer) throw new Error('Vector tool not loaded — refresh the page');
  const T = Object.assign({}, QUICK[$('#vecLevel').value] || QUICK.balanced);
  const S = await prepareSource(slot, T.res);
  const id = S.ctx.getImageData(0, 0, S.w, S.h);
  await sleep(30);
  return traceCore(id, S.w, S.h, T, T.res);
}
function saveBlob(blob, name){
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
// vector -> razor-sharp canvas at print size
async function svgToPrintCanvas(svg, w, h){
  const svgUrl = URL.createObjectURL(new Blob([svg], { type:'image/svg+xml' }));
  const vec = await loadImageEl(svgUrl);
  const k = printScale(w, h);
  const out = document.createElement('canvas'); out.width = Math.round(w * k); out.height = Math.round(h * k);
  const o = out.getContext('2d'); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
  o.drawImage(vec, 0, 0, out.width, out.height);
  URL.revokeObjectURL(svgUrl);
  return out;
}
async function downloadSVG(slot, idx, btn){
  const old = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Vectorizing…';
  try {
    const { svg } = await vectorize(slot);
    saveBlob(new Blob([svg], { type:'image/svg+xml' }), `pod-design-${Date.now()}-${idx+1}.svg`);
    toast(`SVG saved (${Math.round(svg.length/1024)} KB)`);
  } catch(e){
    console.warn(e); toast(e.message || 'Vectorizing failed — try Clean level', true);
  }
  btn.disabled = false; btn.textContent = old;
}
async function downloadVectorPNG(slot, idx, btn){
  const old = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Vectorizing…';
  try {
    const { svg, w, h } = await vectorize(slot);
    const out = await svgToPrintCanvas(svg, w, h);
    await new Promise(res => out.toBlob(b => {
      if(!b){ toast('Export failed — try again', true); return res(); }
      saveBlob(b, `pod-design-${Date.now()}-${idx+1}-HD-print.png`);
      res();
    }, 'image/png'));
  } catch(e){
    console.warn(e); toast(e.message || 'Vectorizing failed — use the normal PNG', true);
  }
  btn.disabled = false; btn.textContent = old;
}

/* ---------- AI upscale (ESRGAN in the browser, free) ---------- */
const UPSCALE_LIBS = [
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@upscalerjs/default-model@1.0.0/dist/umd/index.min.js',
  'https://cdn.jsdelivr.net/npm/upscaler@1.0.0/dist/browser/umd/upscaler.min.js',
  'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/dist/umd/models/esrgan-slim/src/x2/index.min.js'
];
let upscaler = null;
function loadScript(src){
  return new Promise((res, rej) => {
    if(document.querySelector(`script[src="${src}"]`)) return res();
    const sc = document.createElement('script');
    sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('Could not load ' + src));
    document.head.appendChild(sc);
  });
}
async function getUpscaler(){
  if(upscaler) return upscaler;
  for(const src of UPSCALE_LIBS) await loadScript(src);
  upscaler = new Upscaler({ model: ESRGANSlim2x });
  return upscaler;
}
// originalUrl = the image BEFORE background removal (AI needs the white background)
async function downloadUpscaled(originalUrl, idx, btn, dark, halo){
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Loading AI…';
  try {
    const up = await getUpscaler();
    const img = await loadImageEl(originalUrl);
    btn.innerHTML = '<span class="spin"></span> Upscaling 0%';
    const src = await up.upscale(img, {
      patchSize: 64, padding: 6,
      progress: p => { btn.innerHTML = `<span class="spin"></span> Upscaling ${Math.round(p*100)}%`; }
    });
    btn.innerHTML = '<span class="spin"></span> Finishing…';
    const big = await loadImageEl(src);

    // remove white background at the upscaled size
    const c = document.createElement('canvas');
    c.width = big.naturalWidth; c.height = big.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(big, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    removeBg(data, dark, halo);
    ctx.putImageData(data, 0, 0);

    // crop margins + scale to print size
    const out = fillExport(halo ? haloCanvas(c, Math.max(2, Math.round(c.width * HALO_FRAC))) : c);

    await new Promise(res => out.toBlob(b => {
      if(!b){ toast('Export failed — try again', true); return res(); }
      const u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = `pod-design-${Date.now()}-${idx+1}-AI-upscaled-print.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
      res();
    }, 'image/png'));
  } catch(e){
    console.warn(e);
    toast('Upscale failed — try again or use HD PNG (vectorized)', true);
  }
  btn.disabled = false; btn.textContent = 'AI upscale (HD)';
}

/* ---------- SEO listing ---------- */
async function getMeta(slot, idea, product, style){
  if(slot._meta) return slot._meta;
  const r = await fetch(`/api/metadata?idea=${encodeURIComponent(idea)}&text=${encodeURIComponent(slot.dataset.text || '')}&niche=${encodeURIComponent(slot.dataset.niche || '')}&product=${encodeURIComponent(product)}&style=${encodeURIComponent(style)}`, { cache:'no-store' });
  const d = await r.json();
  if(d.error) throw new Error(d.error);
  slot._meta = d;
  return d;
}
async function loadMetadata(slot, idea, product, style){
  const btn = slot.querySelector('.metaBtn'), box = slot.querySelector('.meta');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Writing…';
  try {
    const d = await getMeta(slot, idea, product, style);
    box.innerHTML = renderMetadata(d);
    box.classList.add('show');
    box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyText(b.dataset.copy, b));
    const all = `${d.title||''}\n\n${d.description||''}\n\nMain tag: ${d.main_tag||''}\nTags: ${(d.supporting_tags||[]).join(', ')}\nKeywords: ${(d.seo_keywords||[]).join(', ')}`;
    box.querySelector('[data-all]').onclick = e => copyText(all, e.target);
    btn.remove();
  } catch(e){
    toast('Could not write listing — try again', true);
    btn.disabled = false; btn.textContent = 'Write listing';
  }
}
/* ---------- TeePublic kit: PNG + listing fields + upload page ---------- */
const TEEPUBLIC_UPLOAD_URL = 'https://www.teepublic.com/design/quick_create';
async function teepublicKit(slot, finalUrl, idx, idea, product, style){
  const btn = slot.querySelector('.kitBtn'), panel = slot.querySelector('.kit');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Preparing kit…';
  try {
    const d = await getMeta(slot, idea, product, style);
    const slug = (d.title || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'design';
    const file = `${slug}.png`;
    download(finalUrl, idx, file);
    const fields = [
      ['Title', d.title || ''],
      ['Description', d.description || ''],
      ['Main tag', d.main_tag || ''],
      ['Supporting tags', (d.supporting_tags || []).join(', ')]
    ];
    panel.innerHTML =
      `<p>✓ <strong>${esc(file)}</strong> downloading</p>
       <p><strong>Title:</strong> ${esc(d.title || '')}</p>` +
      fields.map(([k], i) => `<button class="btn-sec" data-kit="${i}">Copy ${k}</button>`).join('') +
      `<a class="btn-sec" href="${TEEPUBLIC_UPLOAD_URL}" target="_blank" rel="noopener">Open TeePublic upload ↗</a>
       <button class="btn-sec" data-redl="1">Download PNG again</button>`;
    panel.classList.add('show');
    panel.querySelectorAll('[data-kit]').forEach(b => b.onclick = () => copyText(fields[b.dataset.kit][1], b));
    panel.querySelector('[data-redl]').onclick = () => download(finalUrl, idx, file);
    btn.textContent = '🚀 TeePublic kit ready';
  } catch(e){
    console.warn(e);
    toast('Could not prepare the kit — try again', true);
    btn.textContent = '🚀 TeePublic kit';
  }
  btn.disabled = false;
}

function renderMetadata(d){
  const tags = (d.supporting_tags||[]).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const kws = (d.seo_keywords||[]).map(k => `<span class="tag">${esc(k)}</span>`).join('');
  return `<div class="copy-row"><span class="t">${esc(d.title||'')}</span><button class="mini" data-copy="${esc(d.title||'')}">Copy</button></div>
    <div class="copy-row"><p>${esc(d.description||'')}</p><button class="mini" data-copy="${esc(d.description||'')}">Copy</button></div>
    <p><strong>Main tag:</strong> ${esc(d.main_tag||'')}</p>
    <div class="tags">${tags}</div><div class="tags">${kws}</div>
    <button class="btn-sec" data-all="1">Copy full listing</button>`;
}
async function copyText(text, btn){
  try { await navigator.clipboard.writeText(text); const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(()=>btn.textContent=o, 1500); }
  catch(e){ toast('Copy failed — select the text manually', true); }
}

function renderHistory(){
  if(!history.length) return;
  $('#historyWrap').hidden = false;
  const h = $('#history'); h.innerHTML = '';
  history.slice(0,18).forEach((it,i) => {
    const im = document.createElement('img');
    im.src = it.url; im.alt = 'Previous design'; im.title = 'Download';
    im.onclick = () => download(it.url, i);
    h.appendChild(im);
  });
}

/* ---------- settings kept in this browser ---------- */
try { $('#textLater').checked = localStorage.getItem('pf_text_later') === '1'; } catch(e){}
$('#textLater').onchange = e => { try { localStorage.setItem('pf_text_later', e.target.checked ? '1' : '0'); } catch(_){} };
try { const v = localStorage.getItem('pf_vec_level'); if(v && QUICK[v]) $('#vecLevel').value = v; } catch(e){}
$('#vecLevel').onchange = e => { try { localStorage.setItem('pf_vec_level', e.target.value); } catch(_){} };
