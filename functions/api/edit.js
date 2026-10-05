const MODELS = [
  { id: '@cf/lykon/dreamshaper-8-lcm', steps: 8, guidance: 2 },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', steps: 20, guidance: 7.5 },
  { id: '@cf/runwayml/stable-diffusion-v1-5-img2img', steps: 20, guidance: 7.5 }
];

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) return json({ error: 'AI binding missing' }, 500);
    const { image, prompt, strength } = await request.json();
    if (!image || !prompt) return json({ error: 'missing' }, 400);
    const s = Math.min(0.9, Math.max(0.1, Number(strength) || 0.45));
    let lastErr = '';
    for (const m of MODELS) {
      try {
        const out = await env.AI.run(m.id, {
          prompt,
          negative_prompt: 'text, letters, watermark, blurry, deformed, extra limbs',
          image_b64: image,
          strength: s,
          guidance: m.guidance,
          num_steps: m.steps
        });
        return new Response(out, { headers: { 'content-type': 'image/png' } });
      } catch (e) {
        lastErr = m.id + ': ' + String(e);
      }
    }
    return json({ error: lastErr }, 500);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
