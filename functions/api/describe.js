const PROMPT = 'Describe this illustration in one detailed paragraph of 40 to 60 words for an image generator. Say what the subject really is, including any monster, creature or character-like features, not only its basic object type. Cover its shape and pose, face, mouth, teeth and tongue, main colors, and the objects and decorations around it (rings, stars, drips, sticks, splashes). Use generic wording: never name any character, brand, sports team, band, celebrity or logo. Do not describe any text, letters or lettering, and do not mention the t-shirt or the background.';

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
      max_tokens: 170
    });
    const description = String(out.description || out.response || '').trim();
    if (!description) return json({ error: 'empty' }, 502);
    return json({ description });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
