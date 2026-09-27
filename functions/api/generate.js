// Cloudflare Pages Function — /api/generate
// Workers AI with model fallback + KV image cache + per-IP daily limit.
//
// SETUP (Pages project → Settings → Bindings):
//   AI → Workers AI
//   KV → KV namespace ("pixelforge-kv")

const POOL_SIZE = 6;     // cached images per prompt
const DAILY_LIMIT = 20;  // new AI generations per IP per day
const TTL = 60 * 60 * 24 * 30; // cached images live 30 days

// Tried in order. If one fails (quota 4006, error...), the next is used.
const MODELS = [
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0'
];

const json = (o, status) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

// Detect PNG vs JPEG from the first bytes
const ctype = b => (b[0] === 0x89 && b[1] === 0x50) ? 'image/png' : 'image/jpeg';

const img = (buf, source, model = '') => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return new Response(bytes, {
    headers: {
      'content-type': ctype(bytes),
      'cache-control': 'no-store',
      'x-source': source,
      'x-model': model
    }
  });
};

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function anyCached(env, hash) {
  for (let i = 0; i < POOL_SIZE; i++) {
    const v = await env.KV.get(`img:${hash}:${i}`, { type: 'arrayBuffer' });
    if (v) return v;
  }
  return null;
}

// Runs one model and normalizes its output to bytes
async function runModel(env, model, prompt) {
  const input = model.includes('flux') ? { prompt, steps: 4 } : { prompt };
  const r = await env.AI.run(model, input);
  if (r && typeof r === 'object' && r.image) {
    return Uint8Array.from(atob(r.image), c => c.charCodeAt(0));
  }
  if (r instanceof ReadableStream) return new Uint8Array(await new Response(r).arrayBuffer());
  if (r instanceof ArrayBuffer) return new Uint8Array(r);
  if (r instanceof Uint8Array) return r;
  throw new Error('Unknown output format');
}

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  if (!env.AI) return json({ error: 'Workers AI binding "AI" not configured' }, 500);
  if (!env.KV) return json({ error: 'KV binding "KV" not configured' }, 500);

  const url = new URL(request.url);
  const prompt = (url.searchParams.get('prompt') || '').slice(0, 800);
  if (!prompt) return json({ error: 'Missing prompt' }, 400);

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

  // 3) Try each model until one works
  const errors = [];
  for (const model of MODELS) {
    try {
      const bytes = await runModel(env, model, prompt);
      if (!bytes || bytes.length < 500) throw new Error('Empty image');
      waitUntil(Promise.all([
        env.KV.put(slotKey, bytes, { expirationTtl: TTL }),
        env.KV.put(limKey, String(used + 1), { expirationTtl: 90000 })
      ]));
      return img(bytes, 'ai', model);
    } catch (e) {
      errors.push(`${model.split('/').pop()}: ${String(e.message || e).slice(0, 120)}`);
    }
  }

  // 4) All models failed → serve any cached image for this prompt
  const c = await anyCached(env, hash);
  if (c) return img(c, 'cache');
  return json({ error: 'quota_or_ai_error', message: errors.join(' | ') }, 503);
}
