/* app4.js — tabs, theme, persistent Library (IndexedDB), ZIP export, tee mockup */
(function(){
  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];

  /* ---------- theme (light / dark) ---------- */
  const THEME_KEY = 'pf_theme';
  function applyTheme(t){
    document.documentElement.dataset.theme = t;
    const b = q('#themeBtn'); if(b) b.textContent = t === 'dark' ? '☀️' : '🌙';
    const m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = t === 'dark' ? '#0B0D10' : '#16181D';
  }
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  q('#themeBtn').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(t);
    try { localStorage.setItem(THEME_KEY, t); } catch(e){}
  };

  /* ---------- tabs (Create / Results / Library / Tools) ---------- */
  const layout = q('.layout');
  const tabState = { left:'create', right:'results', mobile:'create' };
  function setTab(name){
    if(name === 'create' || name === 'tools') tabState.left = name; else tabState.right = name;
    tabState.mobile = name;
    layout.dataset.left = tabState.left; layout.dataset.right = tabState.right; layout.dataset.mobile = tabState.mobile;
    qa('[data-tab]').forEach(b => {
      const t = b.dataset.tab;
      const on = b.classList.contains('nb') ? t === tabState.mobile : (t === tabState.left || t === tabState.right);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if(name === 'library') renderLib();
    if(window.matchMedia('(max-width:900px)').matches) window.scrollTo({ top:0 });
  }
  window.setTab = setTab;
  qa('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  setTab('create');

  // show the results as soon as a generation starts
  q('#genBtn').addEventListener('click', () => { setTab('results'); });
  // "Use" on a concept → go back to the form
  q('#concepts').addEventListener('click', e => {
    if(e.target.closest('[data-use]')){ setTab('create'); setTimeout(() => q('#idea').scrollIntoView({ behavior:'smooth', block:'center' }), 60); }
  });

  // badge on the Results tab
  function updateBadge(){
    const n = qa('#results .card').length;
    const b = q('#resBadge'); if(b){ b.textContent = n; b.hidden = !n; }
  }
  new MutationObserver(updateBadge).observe(q('#results'), { childList:true });
  updateBadge();

  /* ---------- number of designs per click (2 or 4) ---------- */
  const gc = q('#genCount');
  try { const v = localStorage.getItem('pf_gen_count'); if(v === '2' || v === '4') gc.value = v; } catch(e){}
  function syncGenLabel(){ if(!generating) q('#genBtn').textContent = genLabel(); }
  gc.onchange = () => { try { localStorage.setItem('pf_gen_count', gc.value); } catch(e){} syncGenLabel(); };
  syncGenLabel();

  // the old "This session" strip is replaced by the Library
  window.renderHistory = function(){};

  /* ---------- helpers ---------- */
  function slug(s){ return String(s || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'design'; }
  function loadJs(src){
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script ' + src));
      document.head.appendChild(s);
    });
  }
  async function getZip(){
    if(!window.JSZip) await loadJs('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    return new window.JSZip();
  }
  // print-ready PNG blob (same export as "Download PNG": margins cropped, >= 6000x6500)
  async function printBlob(url){
    if(RAW_URLS.has(url)) return (await fetch(url)).blob();
    const img = await loadImageEl(url);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const out = fillExport(c);
    return new Promise(r => out.toBlob(r, 'image/png'));
  }
  async function makeZip(items, zipName, btn){
    if(!items.length){ toast('Nothing to export yet', true); return; }
    const old = btn.textContent; btn.disabled = true;
    try {
      const zip = await getZip();
      for(let i = 0; i < items.length; i++){
        btn.innerHTML = `<span class="spin"></span> ${i + 1}/${items.length}`;
        const b = await printBlob(items[i].url);
        if(!b) throw new Error('export failed');
        zip.file(items[i].name, b);
      }
      btn.innerHTML = '<span class="spin"></span> Zipping…';
      const blob = await zip.generateAsync({ type:'blob', compression:'STORE' });
      saveBlob(blob, zipName);
      toast(`ZIP saved (${items.length} designs) ✓`);
    } catch(e){
      console.warn(e); toast('ZIP failed — try fewer designs', true);
    }
    btn.disabled = false; btn.textContent = old;
  }

  q('#zipResults').onclick = () => {
    const cards = qa('#results .card').filter(c => c._url);
    const items = cards.map((c, i) => ({ url:c._url, name:`${String(i + 1).padStart(2, '0')}-${slug(c._idea)}.png` }));
    if(items.length > 12 && !confirm(`Export ${items.length} designs at print size? This can take a while.`)) return;
    makeZip(items, `pixelforge-results-${Date.now()}.zip`, q('#zipResults'));
  };

  /* ---------- Library (IndexedDB, survives refresh) ---------- */
  const DB_NAME = 'pixelforge', STORE = 'designs', MAX_KEEP = 200;
  let dbp = null;
  function db(){
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if(!window.indexedDB) return rej(new Error('no indexedDB'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath:'id', autoIncrement:true }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function run(mode, fn){
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      let out; try { out = fn(s); } catch(e){ rej(e); return; }
      t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  const getAll = () => run('readonly', s => s.getAll());

  async function trim(){
    const n = await run('readonly', s => s.count());
    if(n <= MAX_KEEP) return;
    let extra = n - MAX_KEEP;
    await db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, 'readwrite'), s = t.objectStore(STORE);
      s.openCursor().onsuccess = e => {
        const c = e.target.result;
        if(!c || extra <= 0) return;
        if(!c.value.fav){ c.delete(); extra--; }
        c.continue();
      };
      t.oncomplete = res; t.onerror = () => rej(t.error);
    }));
  }

  window.libSave = async function(slot){
    try {
      const url = slot._base || slot._url; if(!url) return;
      const blob = await (await fetch(url)).blob();
      await run('readwrite', s => s.add({
        ts: Date.now(), blob, fav: 0,
        idea: slot._idea || '', product: slot._prod || '', style: slot._style || '',
        dark: slot.dataset.dark === '1'
      }));
      await trim();
      if(tabState.right === 'library') renderLib();
    } catch(e){ console.warn('library save failed', e); }
  };

  let libFav = false, libUrls = [];
  const libGrid = q('#libGrid'), libEmpty = q('#libEmpty'), libCount = q('#libCount');

  async function renderLib(){
    let all = [];
    try { all = await getAll(); } catch(e){ console.warn(e); }
    libUrls.forEach(u => URL.revokeObjectURL(u)); libUrls = [];
    all.sort((a, b) => b.ts - a.ts);
    const shown = libFav ? all.filter(r => r.fav) : all;
    libCount.textContent = `${all.length} saved · ${all.filter(r => r.fav).length} ⭐`;
    libGrid.innerHTML = '';
    libEmpty.hidden = shown.length > 0;
    libEmpty.querySelector('strong').textContent = libFav ? 'No favorites yet' : 'Library is empty';
    shown.forEach(rec => {
      const url = URL.createObjectURL(rec.blob); libUrls.push(url);
      rec._url = url;
      const d = document.createElement('div'); d.className = 'card lib-item';
      d.innerHTML = `<div class="img-box${rec.dark ? ' dark' : ''}"><img alt="Saved design"></div>
        <p class="lib-meta"></p>
        <button class="btn-sec" data-a="fav"></button>
        <button class="btn-sec" data-a="mk">👕 Mockup</button>
        <button class="btn-sec btn-main" data-a="dl">⬇ PNG</button>
        <button class="btn-sec" data-a="del">🗑 Delete</button>`;
      d.querySelector('img').src = url;
      d.querySelector('.lib-meta').textContent = (rec.idea || 'Design').slice(0, 70);
      const favB = d.querySelector('[data-a=fav]');
      favB.textContent = rec.fav ? '⭐ Favorite' : '☆ Favorite';
      favB.onclick = async () => {
        await run('readwrite', s => { const r = s.get(rec.id); r.onsuccess = () => { const v = r.result; if(v){ v.fav = v.fav ? 0 : 1; s.put(v); } }; return r; });
        renderLib();
      };
      d.querySelector('[data-a=mk]').onclick = () => openMockup(url, rec.dark);
      d.querySelector('[data-a=dl]').onclick = () => download(url, 0, `${slug(rec.idea)}-${rec.id}-print.png`);
      d.querySelector('[data-a=del]').onclick = async () => {
        if(!confirm('Delete this design from the Library?')) return;
        await run('readwrite', s => s.delete(rec.id));
        renderLib();
      };
      libGrid.appendChild(d);
    });
  }
  window.renderLib = renderLib;

  q('#libAll').onclick = () => { libFav = false; q('#libAll').classList.add('on'); q('#libFavs').classList.remove('on'); renderLib(); };
  q('#libFavs').onclick = () => { libFav = true; q('#libFavs').classList.add('on'); q('#libAll').classList.remove('on'); renderLib(); };
  q('#zipLib').onclick = async () => {
    let all = []; try { all = await getAll(); } catch(e){}
    all.sort((a, b) => b.ts - a.ts);
    if(libFav) all = all.filter(r => r.fav);
    const urls = [];
    const items = all.map((r, i) => { const u = URL.createObjectURL(r.blob); urls.push(u); return { url:u, name:`${String(i + 1).padStart(2, '0')}-${slug(r.idea)}-${r.id}.png` }; });
    if(items.length > 12 && !confirm(`Export ${items.length} designs at print size? This can take a while.`)){ urls.forEach(u => URL.revokeObjectURL(u)); return; }
    await makeZip(items, `pixelforge-${libFav ? 'favorites' : 'library'}-${Date.now()}.zip`, q('#zipLib'));
    urls.forEach(u => URL.revokeObjectURL(u));
  };
  renderLib();

  /* ---------- tee mockup ---------- */
  const MK = { img:null, color:'#F5F5F4', size:60, y:200 };
  const MK_COLORS = [['White','#F5F5F4'], ['Black','#17181B'], ['Navy','#1E2A47'], ['Red','#B3262E'], ['Heather','#AEB2BB'], ['Forest','#2F4B3A']];
  const mkCanvas = q('#mkCanvas'), mkx = mkCanvas.getContext('2d');
  const TEE = new Path2D();
  [[290, 90], null, [650, 140], [760, 290], [665, 350], [620, 300], [620, 820], [180, 820], [180, 300], [135, 350], [40, 290], [150, 140]].forEach((p, i) => {
    if(i === 0) TEE.moveTo(p[0], p[1]);
    else if(p === null) TEE.quadraticCurveTo(400, 170, 510, 90);
    else TEE.lineTo(p[0], p[1]);
  });
  TEE.closePath();

  function shade(hex, amt){
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, v + amt));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
  function drawMockup(){
    const W = mkCanvas.width, H = mkCanvas.height;
    mkx.clearRect(0, 0, W, H);
    mkx.fillStyle = '#E4E7ED'; mkx.fillRect(0, 0, W, H);
    // soft ground shadow
    mkx.save(); mkx.filter = 'blur(14px)'; mkx.fillStyle = 'rgba(0,0,0,.18)';
    mkx.translate(6, 14); mkx.fill(TEE); mkx.restore();
    // shirt
    mkx.fillStyle = MK.color; mkx.fill(TEE);
    const g = mkx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.14)');
    mkx.save(); mkx.clip(TEE); mkx.fillStyle = g; mkx.fillRect(0, 0, W, H);
    // sleeve seams
    mkx.strokeStyle = 'rgba(0,0,0,.12)'; mkx.lineWidth = 3;
    mkx.beginPath(); mkx.moveTo(150, 140); mkx.lineTo(180, 300); mkx.moveTo(650, 140); mkx.lineTo(620, 300); mkx.stroke();
    mkx.restore();
    // collar
    mkx.save(); mkx.beginPath(); mkx.moveTo(290, 90); mkx.quadraticCurveTo(400, 170, 510, 90); mkx.quadraticCurveTo(400, 40, 290, 90); mkx.closePath();
    mkx.fillStyle = shade(MK.color, -38); mkx.fill();
    mkx.lineWidth = 7; mkx.strokeStyle = shade(MK.color, -16); mkx.beginPath(); mkx.moveTo(290, 90); mkx.quadraticCurveTo(400, 170, 510, 90); mkx.stroke();
    mkx.restore();
    // design on the chest
    if(MK.img){
      const bw = 440 * MK.size / 100, ar = MK.img.width / MK.img.height;
      let w = bw, h = bw / ar; if(h > bw * 1.15){ h = bw * 1.15; w = h * ar; }
      mkx.drawImage(MK.img, 400 - w / 2, MK.y, w, h);
    }
  }
  const mkSw = q('#mkSw');
  MK_COLORS.forEach(([name, hex]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = hex; b.title = name; b.setAttribute('aria-label', name + ' tee');
    b.onclick = () => { MK.color = hex; markSw(); drawMockup(); };
    mkSw.appendChild(b);
  });
  function markSw(){ [...mkSw.children].forEach((b, i) => { b.style.borderColor = MK_COLORS[i][1] === MK.color ? 'var(--accent)' : ''; b.style.boxShadow = MK_COLORS[i][1] === MK.color ? '0 0 0 2px var(--accent)' : ''; }); }
  q('#mkSize').oninput = e => { MK.size = +e.target.value; drawMockup(); };
  q('#mkY').oninput = e => { MK.y = +e.target.value; drawMockup(); };
  q('#mkClose').onclick = () => { q('#mk').hidden = true; };
  q('#mkDl').onclick = () => mkCanvas.toBlob(b => { if(b) saveBlob(b, `mockup-${Date.now()}.png`); }, 'image/png');

  window.openMockup = async function(url, dark){
    if(!url){ toast('No design to preview', true); return; }
    try {
      const img = await loadImageEl(url);
      const src = document.createElement('canvas'); src.width = img.naturalWidth; src.height = img.naturalHeight;
      src.getContext('2d').drawImage(img, 0, 0);
      const bb = alphaBox(src);   // crop transparent margins so "print size" matches the visible artwork
      const crop = document.createElement('canvas'); crop.width = bb.w; crop.height = bb.h;
      crop.getContext('2d').drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
      MK.img = crop;
      MK.color = dark ? '#17181B' : '#F5F5F4'; MK.size = 55; MK.y = 200;
      q('#mkSize').value = MK.size; q('#mkY').value = MK.y;
      markSw(); drawMockup();
      q('#mk').hidden = false;
    } catch(e){ console.warn(e); toast('Could not load this design', true); }
  };
})();
