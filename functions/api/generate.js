// Cloudflare Pages Function — /api/generate
// Workers AI (flux-1-schnell) + KV image cache + per-IP daily limit. No R2, no card needed.
//
// SETUP (Pages project → Settings → Bindings):
//   AI → Workers AI
//   KV → KV namespace (e.g. "pixelforge-kv")
//
// How the cache works: each prompt has POOL_SIZE "slots" in KV.
// Every request picks a random slot: filled → served free (0 neurons, 0 writes);
// empty → generate once and fill it. Pools fill up fast, then cost nothing.
// KV free tier: 100k reads/day, 1k writes/day → each new image = 2 writes (~500/day max).

const POOL_SIZE = 6;     // cached images per prompt
const DAILY_LIMIT = 20;  // new AI generations per IP per day
const TTL = 60 * 60 * 24 * 30; // cached images live 30 days (keeps storage under 1GB)

const json = (o, status) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

const img = (body, source) =>
  new Response(body, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'x-source': source }
  });

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Look for any filled slot (used when quota/limit blocks generation)
async function anyCached(env, hash) {
  for (let i = 0; i < POOL_SIZE; i++) {
    const v = await env.KV.get(`img:${hash}:${i}`, { type: 'arrayBuffer' });
    if (v) return v;
  }
  return null;
}

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  if (!env.AI) return json({ error: 'Workers AI binding "AI" not configured' }, 500);
  if (!env.KV) return json({ error: 'KV binding "KV" not configured' }, 500);

  const url = new URL(request.url);
  const prompt = (url.searchParams.get('prompt') || '').slice(0, 800);
  if (!prompt) return json({ error: 'Missing prompt' }, 400);
  const seed = (parseInt(url.searchParams.get('seed') || '0', 10) || 0) % 2147483647;

  const hash = await sha(prompt);
  const slot = Math.floor(Math.random() * POOL_SIZE);
  const slotKey = `img:${hash}:${slot}`;

  // 1) Random slot already filled → free
  const hit = await env.KV.get(slotKey, { type: 'arrayBuffer' });
  if (hit) return img(hit, 'cache');

  // 2) Per-IP daily limit
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const limKey = `lim:${ip}:${new Date().toISOString().slice(0, 10)}`;
  const used = parseInt((await env.KV.get(limKey)) || '0', 10);
  if (used >= DAILY_LIMIT) {
    const c = await anyCached(env, hash);
    return c
      ? img(c, 'cache')
      : json({ error: 'daily_limit', message: 'Daily limit reached — come back tomorrow.' }, 429);
  }

  // 3) Generate and fill the slot
  try {
    const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4, seed });
    if (!result || !result.image) throw new Error('No image returned');
    const bytes = Uint8Array.from(atob(result.image), c => c.charCodeAt(0));
    waitUntil(Promise.all([
      env.KV.put(slotKey, bytes, { expirationTtl: TTL }),
      env.KV.put(limKey, String(used + 1), { expirationTtl: 90000 })
    ]));
    return img(bytes, 'ai');
  } catch (e) {
    // Quota exhausted / AI error → serve any cached image for this prompt
    const c = await anyCached(env, hash);
    if (c) return img(c, 'cache');
    return json({ error: 'quota_or_ai_error', message: String(e.message || e) }, 503);
  }
}
