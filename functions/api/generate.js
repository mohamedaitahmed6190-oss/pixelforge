// Cloudflare Pages Function — /api/generate
// Workers AI + KV cache + daily limit + HARD monthly budget cap (~$10 total bill).
//
// Bindings: AI → Workers AI, KV → "pixelforge-kv"

const POOL_SIZE = 6;          // cached images per prompt
const DAILY_LIMIT = 200;      // max new generations per day (personal use)
const TTL = 60 * 60 * 24 * 30;

// ---- Budget cap ----
// Free: 10,000 neurons/day ≈ 170 flux images → we count 160 as free (safety margin).
// Paid: each extra image ≈ $0.00063 → 7,000 paid images ≈ $4.4/month.
// Total bill ≈ $5 plan + max ~$4.4 usage = under $10. Resets on the 1st of each month.
const FREE_PER_DAY = 160;
const PAID_PER_MONTH = 7000;

const MODELS = [
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/lykon/dreamshaper-8-lcm',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0'
];

const json = (o, status) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

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

  // 1) Cache hit → free
  const hit = await env.KV.get(slotKey, { type: 'arrayBuffer' });
  if (hit) return img(hit, 'cache');

  const day = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD (UTC)
  const month = day.slice(0, 7);                        // YYYY-MM

  // 2) Daily limit
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const limKey = `lim:${ip}:${day}`;
  const dayKey = `g:day:${day}`;
  const paidKey = `g:paid:${month}`;

  const [usedRaw, dayRaw, paidRaw] = await Promise.all([
    env.KV.get(limKey), env.KV.get(dayKey), env.KV.get(paidKey)
  ]);
  const used = parseInt(usedRaw || '0', 10);
  const dayCount = parseInt(dayRaw || '0', 10);
  const paidCount = parseInt(paidRaw || '0', 10);

  if (used >= DAILY_LIMIT) {
    const c = await anyCached(env, hash);
    return c
      ? img(c, 'cache')
      : json({ error: 'daily_limit', message: 'Daily limit reached — come back tomorrow.' }, 429);
  }

  // 3) Budget cap: after free quota, only allow until monthly paid budget is used
  const isPaid = dayCount >= FREE_PER_DAY;
  if (isPaid && paidCount >= PAID_PER_MONTH) {
    const c = await anyCached(env, hash);
    return c
      ? img(c, 'cache')
      : json({ error: 'daily_limit', message: 'Free generations are used up for today — come back tomorrow.' }, 429);
  }

  // 4) Generate (model fallback)
  const errors = [];
  for (const model of MODELS) {
    try {
      const bytes = await runModel(env, model, prompt);
      if (!bytes || bytes.length < 500) throw new Error('Empty image');
      const writes = [
        env.KV.put(slotKey, bytes, { expirationTtl: TTL }),
        env.KV.put(limKey, String(used + 1), { expirationTtl: 90000 }),
        env.KV.put(dayKey, String(dayCount + 1), { expirationTtl: 172800 })
      ];
      if (isPaid) writes.push(env.KV.put(paidKey, String(paidCount + 1), { expirationTtl: 60 * 60 * 24 * 40 }));
      waitUntil(Promise.all(writes));
      return img(bytes, 'ai', model);
    } catch (e) {
      errors.push(`${model.split('/').pop()}: ${String(e.message || e).slice(0, 120)}`);
    }
  }

  const c = await anyCached(env, hash);
  if (c) return img(c, 'cache');
  return json({ error: 'quota_or_ai_error', message: errors.join(' | ') }, 503);
}
