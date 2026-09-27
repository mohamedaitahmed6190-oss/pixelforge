// Cloudflare Pages Function — /api/generate-hf
// Fallback provider using Hugging Face Inference API with an authenticated token,
// which is far more reliable than the anonymous (no-token) HF calls used to trip
// rate limits quickly.

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.HF_TOKEN) {
    return new Response(JSON.stringify({
      error: 'HF_TOKEN not configured. Add it in Cloudflare Pages → Settings → Environment variables.'
    }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const url = new URL(request.url);
  const prompt = (url.searchParams.get('prompt') || '').slice(0, 800);

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  }

  const HF_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';

  try {
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.HF_TOKEN}`
        },
        body: JSON.stringify({ inputs: prompt })
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '(no body)');
      return new Response(JSON.stringify({ error: `HF failed: ${res.status} — ${errText}` }), {
        status: 502, headers: { 'content-type': 'application/json' }
      });
    }

    const blob = await res.arrayBuffer();
    return new Response(blob, {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'HF generation failed' }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
