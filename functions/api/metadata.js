// Cloudflare Pages Function — /api/metadata
// Generates an SEO-ready Etsy/Printify listing (title, description, main tag,
// supporting tags, keywords) for a design, using Cloudflare's own free Workers AI
// text model. Same binding as /api/generate — no extra setup needed.

const SYSTEM_PROMPT = `You are an SEO copywriter for a print-on-demand shop (Etsy/Printify style listings).
Given a product type, an art style and a design theme, write listing metadata.

STRICT RULES:
- Never mention, reference, or imply any real brand, celebrity, sports team, movie/TV franchise, or copyrighted or trademarked name or character. Describe only generic, original concepts.
- "title": under 140 characters, natural and keyword-rich, no ALL CAPS, no emojis, no brand names.
- "description": 2-3 natural sentences, keyword-rich, no copyright or trademark terms.
- "main_tag": the single most important tag, 1-3 words.
- "supporting_tags": an array of exactly 12 short SEO tags (each under 20 characters, Etsy-tag style), no duplicates, no copyrighted or trademarked terms.
- "seo_keywords": an array of 8 broader search keyword phrases (2-4 words each), no copyrighted or trademarked terms.

Respond with ONLY valid JSON, no markdown fences, no extra commentary, in exactly this shape:
{"title":"...","description":"...","main_tag":"...","supporting_tags":["...","...","...","...","...","...","...","...","...","...","...","..."],"seo_keywords":["...","...","...","...","...","...","...","..."]}`;

function extractJson(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw e;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.AI) {
    return new Response(JSON.stringify({
      error: 'Workers AI binding not configured. In Cloudflare Pages: Settings → Functions → Bindings → add an "AI" binding named AI.'
    }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const url = new URL(request.url);
  const idea = (url.searchParams.get('idea') || '').slice(0, 200);
  const product = (url.searchParams.get('product') || 'product').slice(0, 100);
  const style = (url.searchParams.get('style') || '').slice(0, 200);

  if (!idea) {
    return new Response(JSON.stringify({ error: 'Missing idea' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Product: ${product}\nArt style: ${style}\nDesign theme: ${idea}` }
      ]
    });

    const raw = (result && typeof result.response === 'string') ? result.response : JSON.stringify(result);
    const parsed = extractJson(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'metadata generation failed' }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
