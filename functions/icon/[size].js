// Draws the PixelForge icon (pixel "PF" on blue) as a PNG, no image files needed.
const BLUE = [47, 75, 255], WHITE = [255, 255, 255];
const GLYPH = [
  'XXXX..XXXXX',
  'X...X.X....',
  'X...X.X....',
  'XXXX..XXXX.',
  'X.....X....',
  'X.....X....',
  'X.....X....'
];

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(bytes) {
  const cs = new CompressionStream('deflate');
  const w = cs.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function makePng(size) {
  const unit = Math.floor(size * 0.055);
  const gw = 11 * unit, gh = 7 * unit;
  const ox = Math.floor((size - gw) / 2), oy = Math.floor((size - gh) / 2);
  const stride = size * 3 + 1;
  const raw = new Uint8Array(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    for (let x = 0; x < size; x++) {
      let c = BLUE;
      const gx = Math.floor((x - ox) / unit), gy = Math.floor((y - oy) / unit);
      if (x >= ox && y >= oy && gx < 11 && gy < 7 && GLYPH[gy][gx] === 'X') c = WHITE;
      const i = row + 1 + x * 3;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2];
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size); dv.setUint32(4, size);
  ihdr[8] = 8; ihdr[9] = 2;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array(0))
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export async function onRequestGet({ params }) {
  const size = Number(params.size);
  if (![180, 192, 512].includes(size)) return new Response('Not found', { status: 404 });
  return new Response(await makePng(size), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }
  });
    }
