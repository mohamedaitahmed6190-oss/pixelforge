export async function onRequestPost({ request, env }) {
  try {
    const { image, prompt, strength } = await request.json();
    if (!image || !prompt) {
      return new Response(JSON.stringify({ error: 'missing' }), { status: 400 });
    }
    const out = await env.AI.run('@cf/runwayml/stable-diffusion-v1-5-img2img', {
      prompt,
      negative_prompt: 'text, letters, watermark, blurry, deformed, extra limbs',
      image_b64: image,
      strength: Math.min(0.9, Math.max(0.1, Number(strength) || 0.45)),
      guidance: 7.5,
      num_steps: 20
    });
    return new Response(out, { headers: { 'content-type': 'image/png' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
