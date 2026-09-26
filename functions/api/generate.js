// Cloudflare Pages Function — /api/generate
// Runs on Cloudflare's own free Workers AI, server-side. No API key, no CORS issues
// (same-origin), and a generous free daily quota since it's billed to the Cloudflare account,
// not to each visitor's browser.
//
// SETUP REQUIRED (one-time, in the Cloudflare dashboard):
//   Pages project → Settings → Functions → Bindings → Add binding → "AI"
//   Variable name: AI   (this makes `env.AI` available below)

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.AI) {
    return new Response(JSON.stringify({
      error: 'Workers AI binding not configured. In Cloudflare Pages: Settings → Functions → Bindings → add an "AI" binding named AI.'
    }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const url = new URL(request.url);
  const prompt = (url.searchParams.get('prompt') || '').slice(0, 800);
  const seedParam = url.searchParams.get('seed');
  const seed = seedParam ? parseInt(seedParam, 10) : undefined;

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  }

  try {
    const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt,
      num_steps: 4,
      ...(seed !== undefined ? { seed } : {})
    });

    // Workers AI image models sometimes return a raw binary stream, sometimes
    // an object like { image: "<base64>" } — handle both.
    if (result && typeof result === 'object' && result.image) {
      const binary = Uint8Array.from(atob(result.image), c => c.charCodeAt(0));
      return new Response(binary, {
        headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }
      });
    }
    return new Response(result, {
      headers: { 'content-type': 'image/png', 'cache-control': 'no-store' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'generation failed' }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
