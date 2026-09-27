// Cloudflare Pages Function — /api/generate-deepai
// DeepAI's public demo key allows limited free, no-signup image generation.
// No account needed, but shared across all anonymous users worldwide — can
// get rate-limited under heavy global traffic, same risk as Pollinations.

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const prompt = (url.searchParams.get('prompt') || '').slice(0, 800);

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const form = new FormData();
    form.append('text', prompt);

    const res = await fetch('https://api.deepai.org/api/text2img', {
      method: 'POST',
      headers: { 'api-key': 'tryit-demo-key' },
      body: form
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '(no body)');
      return new Response(JSON.stringify({ error: `DeepAI failed: ${res.status} — ${errText}` }), {
        status: 502, headers: { 'content-type': 'application/json' }
      });
    }

    const data = await res.json();
    if (!data.output_url) {
      return new Response(JSON.stringify({ error: 'No image URL from DeepAI' }), {
        status: 502, headers: { 'content-type': 'application/json' }
      });
    }

    const imgRes = await fetch(data.output_url);
    const blob = await imgRes.arrayBuffer();
    return new Response(blob, {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'DeepAI generation failed' }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
