const PROMPT = 'Describe the main subject of this image in under 25 words for an illustration generator. Start with the exact type of animal, person or object and its breed or kind (for example highland cow, french bulldog, black cat), then its key features, main colors, pose and props. Use generic wording: never name any character, brand, sports team, band, celebrity or logo, describe their look generically instead. Do not mention text, letters, art style or background.';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) return json({ error: 'AI binding missing' }, 500);
    const { image } = await request.json();
    if (!image) return json({ error: 'missing image' }, 400);
    const bin = atob(image);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const out = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...bytes],
      prompt: PROMPT,
      max_tokens: 80
    });
    const description = String(out.description || out.response || '').trim();
    if (!description) return json({ error: 'empty' }, 502);
    return json({ description });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
