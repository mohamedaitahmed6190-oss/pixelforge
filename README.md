# PixelForge Studio

Personal AI print-on-demand design studio, hosted on Cloudflare Pages.

- **Create**: pick product, style, niche and idea, then generate 2 or 4 transparent PNG designs.
- **Results**: add text, AI edit, re-roll one design, tee mockup, vectorize (SVG / HD PNG), upscale, TeePublic kit, listing writer, ZIP export.
- **Library**: every design is saved in the browser (IndexedDB) with favorites and ZIP export.
- **Tools**: similar image, concept generator, resize to 6000x6500, AI upscale, remove background.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page layout, styles, tabs, dark mode, small tools |
| `app1.js` | Niches, prompt builder, generation, re-roll, print export |
| `app2.js` | Vectorizer, upscaler, TeePublic kit, listing writer |
| `app3.js` | Text editor, similar image, vector panel, concepts |
| `app4.js` | Tabs, theme, Library, ZIP export, mockup |
| `sw.js`, `manifest.json` | PWA (network-first service worker) |
| `functions/api/*` | Cloudflare Pages Functions (Workers AI, daily limit, budget cap) |

## Notes

- Daily limit is `DAILY_LIMIT` in `app1.js` and `functions/api/generate.js` (keep both equal).
- The server ignores seeds, so "Re-roll" draws a new variation instead of reusing a seed.
- After changing a JS file, bump the `?v=` number in `index.html`.
