// Cloudflare Pages Function — /api/metadata
// TeePublic SEO listing (title, description, main tag, 15 tags, long-tail keywords)
// built from the design description + text on design + niche.
// Trademark-safe: the prompt forbids brands, and a blocklist removes risky tags anyway.

const SYSTEM_PROMPT = `You are a TeePublic SEO expert who writes listings that rank in TeePublic search and Google.
You get a print-on-demand design: its text, what it shows, its niche and its art style.

Write:
- "title": 40-70 characters. Start with the design text if there is one, then the main buyer keyword and a humor/gift word, e.g. "Code Brown Survivor Funny ER Nurse". Do NOT use the words t-shirt, tee, shirt, apparel, merch (TeePublic adds products itself). Title Case. No emojis.
- "description": 2-3 natural sentences, 150-300 characters, written to the buyer. Include the main keyword, 2-3 supporting keywords and 1-2 gift occasions (birthday, graduation, appreciation week, Christmas...). No keyword stuffing.
- "main_tag": the single broadest high-traffic keyword that describes WHO buys it, 1-2 words (e.g. "Nurse", "Fishing", "Teacher", "Halloween", "Dog Mom"). Never an art style.
- "supporting_tags": exactly 15 lowercase tags, 1-3 words each, that real buyers type into search: the niche identity and job titles, related roles, the key phrase of the design text, humor type (e.g. "nurse humor"), gift phrases (e.g. "nurse gift"), occasions, and the season if relevant. No filler words (quirky, awesome, cool, tee, shirt, apparel, design). No art-style words unless buyers search them (e.g. "vintage" is ok, "cartoon" is not).
- "seo_keywords": exactly 8 long-tail search phrases of 3-5 words that buyers google (e.g. "funny er nurse gift").

Trademark and copyright safety (strict):
- NEVER use brand or company names, sports teams or leagues, movies, TV shows, video games, characters, celebrities, musicians, song lyrics, book titles, or trademarked slogans.
- NEVER use words like official, licensed, authentic, inspired by, parody of.
- Use only generic descriptive words.

Respond with ONLY valid JSON, no markdown, no commentary:
{"title":"...","description":"...","main_tag":"...","supporting_tags":["..."],"seo_keywords":["..."]}`;

const MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast'
];

// Terms that commonly trigger IP takedowns on POD sites — removed from tags/keywords.
const BLOCKLIST = [
  'disney','marvel','pixar','star wars','harry potter','hogwarts','pokemon','nintendo','mario','zelda',
  'nfl','nba','mlb','nhl','ncaa','fifa','super bowl','world series','olympic',
  'nike','adidas','starbucks','stanley','barbie','hello kitty','lego','hot wheels','coca cola','pepsi','mcdonald',
  'jeep','harley','ford','chevy','john deere','peloton','crossfit','zumba','yeti',
  'taylor swift','swiftie','eras tour','grinch','peanuts','snoopy','sesame street','scooby','looney',
  'stranger things','the office','friends tv','grey','yellowstone','hocus pocus','nightmare before',
  'beetlejuice','halloweentown','minecraft','fortnite','roblox','among us',
  'beast mode','just do it','hakuna matata','official','licensed','parody','inspired by'
];
const isSafe = s => !BLOCKLIST.some(b => s.toLowerCase().includes(b));

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function extractJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(text); } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('No JSON in model output');
}

function responseText(result) {
  if (!result) return '';
  if (result.response !== undefined) return result.response;
  if (Array.isArray(result.choices) && result.choices[0]?.message?.content) return result.choices[0].message.content;
  return result;
}

function cleanList(list, max, maxWords) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(t => String(t).toLowerCase().replace(/[#"]/g, '').replace(/\s+/g, ' ').trim())
    .filter(t => t && t.split(' ').length <= maxWords && isSafe(t) && !seen.has(t) && seen.add(t))
    .slice(0, max);
}

function stripProductWords(title) {
  return String(title || '')
    .replace(/\b(t-?shirts?|tees?|shirts?|apparel|merch)\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim();
}

export async function onRequestGet({ request, env }) {
  if (!env.AI) return json({ error: 'Workers AI binding "AI" not configured' }, 500);

  const url = new URL(request.url);
  const idea    = (url.searchParams.get('idea') || '').slice(0, 300);
  const text    = (url.searchParams.get('text') || '').slice(0, 80);
  const niche   = (url.searchParams.get('niche') || '').slice(0, 100);
  const product = (url.searchParams.get('product') || 'T-shirt').slice(0, 50);
  const style   = (url.searchParams.get('style') || '').slice(0, 100);
  if (!idea && !text) return json({ error: 'Missing idea' }, 400);

  const userMsg =
    `Design text: ${text || '(no text)'}\n` +
    `What it shows: ${idea}\n` +
    `Niche / buyer: ${niche || '(guess from the design)'}\n` +
    `Art style: ${style}\n` +
    `First product: ${product}`;

  const errors = [];
  for (const model of MODELS) {
    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMsg }
        ],
        max_tokens: 1200,
        temperature: 0.4
      });
      const d = extractJson(responseText(result));
      const out = {
        title: stripProductWords(d.title).slice(0, 80),
        description: String(d.description || '').trim(),
        main_tag: String(d.main_tag || '').trim(),
        supporting_tags: cleanList(d.supporting_tags, 15, 3),
        seo_keywords: cleanList(d.seo_keywords, 8, 5)
      };
      if (!isSafe(out.main_tag)) out.main_tag = out.supporting_tags[0] || '';
      if (!out.title || out.supporting_tags.length < 5) throw new Error('Incomplete listing');
      return json(out);
    } catch (e) {
      errors.push(`${model.split('/').pop()}: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  return json({ error: 'metadata generation failed', message: errors.join(' | ') }, 503);
}
