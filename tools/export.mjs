/* ==========================================================================
   HOODESKS — collection exporter
   --------------------------------------------------------------------------
   Renders the whole collection to PNG + ERC-721 metadata, ready to pin.
   No dependencies: the PNG encoder below uses node:zlib.

     node tools/export.mjs                  # 5,000 desks at 512px
     node tools/export.mjs --size 1024      # bigger
     node tools/export.mjs --limit 20       # a sample, for eyeballing
     node tools/export.mjs --out ./dist     # somewhere else

   Output:
     <out>/images/<id>.png
     <out>/metadata/<id>.json
     <out>/collection.json      trait counts + rarity ranks
   ========================================================================== */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  buildDesks, rankCollection, renderDesk, traitCounts,
  DESK_PALETTE, DESK_SEED, LAYER_NAMES, SIZE,
} from '../assets/js/desks.js';

/* -- args ----------------------------------------------------------------- */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const OUT = arg('out', join(process.cwd(), 'assets', 'collection'));
const PX = Number(arg('size', 512));
const LIMIT = Number(arg('limit', 0));
const BASE_URI = arg('base', 'ipfs://REPLACE_WITH_CID');

const scale = Math.max(1, Math.round(PX / SIZE));
const DIM = SIZE * scale;

/* -- png encoder ---------------------------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode raw RGBA (width*height*4) as a PNG buffer. */
function encodePng(rgba, width, height) {
  const stride = width * 4;
  // one filter byte (0 = none) per scanline
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hexCache = new Map();
function rgb(hex) {
  if (hexCache.has(hex)) return hexCache.get(hex);
  const v = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  hexCache.set(hex, v);
  return v;
}

/** Nearest-neighbour upscale of a 32x32 grid into an RGBA buffer. */
function gridToRgba(grid) {
  const buf = Buffer.alloc(DIM * DIM * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const key = grid[y][x];
      let r = 0, g = 0, b = 0, a = 0;
      if (key !== '.') {
        [r, g, b] = rgb(DESK_PALETTE[key] ?? '#ff00ff');
        a = 255;
      }
      for (let dy = 0; dy < scale; dy++) {
        let o = ((y * scale + dy) * DIM + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++) {
          buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = a;
          o += 4;
        }
      }
    }
  }
  return buf;
}

/* -- run ------------------------------------------------------------------ */

const { tokens } = buildDesks();
rankCollection(tokens);
const counts = traitCounts(tokens);
const total = tokens.length;
const list = LIMIT ? tokens.slice(0, LIMIT) : tokens;

await mkdir(join(OUT, 'images'), { recursive: true });
await mkdir(join(OUT, 'metadata'), { recursive: true });

console.log(`HOODESKS export · seed "${DESK_SEED}" · ${list.length} desks · ${DIM}x${DIM}px`);
console.log(`out: ${OUT}`);

const t0 = Date.now();
let done = 0;

for (const token of list) {
  const png = encodePng(gridToRgba(renderDesk(token)), DIM, DIM);
  await writeFile(join(OUT, 'images', `${token.id}.png`), png);

  const metadata = {
    name: `HOODESK #${token.id}`,
    description:
      'A desk that owns a vault. The vault fills with tokenised stock round after ' +
      'round, and whoever holds this token owns whatever is in it.',
    image: `${BASE_URI}/${token.id}.png`,
    external_url: `https://hoodesks.fun/desk.html?id=${token.id}`,
    attributes: [
      ...LAYER_NAMES.map((layer) => ({
        trait_type: layer,
        value: token.traits[layer],
      })),
      { trait_type: 'Rarity rank', value: token.rank, display_type: 'number', max_value: total },
    ],
  };
  await writeFile(join(OUT, 'metadata', `${token.id}.json`), JSON.stringify(metadata, null, 2));

  if (++done % 500 === 0) console.log(`  ${done}/${list.length}`);
}

const summary = {
  name: 'HOODESKS',
  seed: DESK_SEED,
  supply: total,
  size: DIM,
  generated: list.length,
  traits: Object.fromEntries(
    LAYER_NAMES.map((layer) => [
      layer,
      Object.fromEntries(
        Object.entries(counts[layer])
          .sort((a, b) => b[1] - a[1])
          .map(([name, n]) => [name, { count: n, pct: Number(((n / total) * 100).toFixed(2)) }]),
      ),
    ]),
  ),
  ranks: Object.fromEntries(tokens.map((t) => [t.id, t.rank])),
};
await writeFile(join(OUT, 'collection.json'), JSON.stringify(summary, null, 2));

console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
