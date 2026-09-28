// Cloudflare Pages Function — /api/concepts
// Generates 10 niche t-shirt concepts (insider jokes) with Workers AI.
// Uses the same "AI" binding as /api/generate — no extra setup.

const SYSTEM_PROMPT = `You are a top-selling TeePublic designer who writes niche t-shirt concepts that sell.
Generate exactly 10 t-shirt design concepts for the given niche.

Each concept must have:
- "text": the shirt text, max 6 words, punchy, a pun or a relatable truth, in English.
- "visual": ONE cute or funny character or object that SHOWS the joke, described in one sentence an illustrator can draw. Do not put the shirt text in this field.
- "buyer": who wears it, and why they would buy it for themselves or as a gift.
- "why": why it sells, explaining the insider joke only this niche would get.

Rules:
- Every joke must be an insider joke that only people in this niche would get. No generic phrases such as "Stay Spooky", "Coffee Lover", "Live Laugh Love".
- If a season is given, tie at least 6 of the 10 concepts to that season in a way that still only makes sense for this niche.
- Reject and replace any idea that uses real people, brands, companies, movies, TV shows, games, song lyrics or trademarks; any idea that is already a common saying on shirts; and any idea that could be worn by anyone.
- No offensive, political or adult content.

Respond with ONLY a valid JSON array of 10 objects, no markdown, no commentary, in exactly this shape:
[{"text":"...","visual":"...","buyer":"...","why":"..."}]`;

const MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast'
];

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function extractArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    for (const k of ['concepts', 'items', 'data']) if (Array.isArray(raw[k])) return raw[k];
  }
  const text = String(raw || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  try { return extractArray(JSON.parse(text)); } catch (e) {}
  const m = text.match(/\[[\s\S]*\]/);
  if (m) return JSON.parse(m[0]);
  throw new Error('No JSON array in model output');
}

function responseText(result) {
  if (!result) return '';
  if (result.response !== undefined) return result.response;
  if (Array.isArray(result.choices) && result.choices[0]?.message?.content) return result.choices[0].message.content;
  return result;
}

function clean(list) {
  return list
    .filter(c => c && c.text && c.visual)
    .map(c => ({
      text: String(c.text).trim().replace(/^["']|["']$/g, ''),
      visual: String(c.visual).trim(),
      buyer: String(c.buyer || '').trim(),
      why: String(c.why || '').trim()
    }))
    .filter(c => c.text.split(/\s+/).length <= 6)
    .slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  if (!env.AI) return json({ error: 'Workers AI binding "AI" not configured' }, 500);

  const url = new URL(request.url);
  const niche = (url.searchParams.get('niche') || '').trim().slice(0, 100);
  const season = (url.searchParams.get('season') || '').trim().slice(0, 40);
  if (!niche) return json({ error: 'Missing niche' }, 400);

  const userMsg = `Niche: ${niche}\nSeason: ${season || 'none (evergreen, no season)'}`;
  const errors = [];

  for (const model of MODELS) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg }
        ],
        max_tokens: 2500,
        temperature: 0.9
      });
      const concepts = clean(extractArray(responseText(result)));
      if (concepts.length >= 3) return json({ concepts, model });
      throw new Error('Too few valid concepts');
    } catch (e) {
      errors.push(`${model.split('/').pop()}: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  return json({ error: 'concept_generation_failed', message: errors.join(' | ') }, 503);
}
