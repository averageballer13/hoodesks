/* ==========================================================================
   HOODESKS — contact sheet
   --------------------------------------------------------------------------
   One PNG showing many desks at once, for a reveal post or a quick eyeball
   of the whole set.

     node tools/sheet.mjs                      # 96 desks, evenly spread
     node tools/sheet.mjs --count 240 --cols 20
     node tools/sheet.mjs --from 1 --count 64  # the first 64 serials
     node tools/sheet.mjs --rare 48            # the 48 rarest
   ========================================================================== */

import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import {
  buildDesks, rankCollection, renderDesk, DESK_PALETTE, SIZE,
} from '../assets/js/desks.js';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const COUNT = Number(arg('count', 96));
const COLS = Number(arg('cols', 12));
const CELL = Number(arg('cell', 64));
const GAP = Number(arg('gap', 4));
const FROM = arg('from', null);
const RARE = arg('rare', null);
const OUT = arg('out', 'hoodesks-sheet.png');
const BG = arg('bg', '#000000');

/* -- png ------------------------------------------------------------------ */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, w, h) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

/* -- pick ----------------------------------------------------------------- */

const { tokens } = buildDesks();
rankCollection(tokens);

let picks;
if (RARE) {
  picks = [...tokens].sort((a, b) => a.rank - b.rank).slice(0, Number(RARE));
} else if (FROM) {
  picks = tokens.slice(Number(FROM) - 1, Number(FROM) - 1 + COUNT);
} else {
  const step = Math.max(1, Math.floor(tokens.length / COUNT));
  picks = Array.from({ length: COUNT }, (_, i) => tokens[i * step]).filter(Boolean);
}

/* -- compose -------------------------------------------------------------- */

const rows = Math.ceil(picks.length / COLS);
const W = COLS * CELL + (COLS + 1) * GAP;
const H = rows * CELL + (rows + 1) * GAP;
const scale = Math.max(1, Math.floor(CELL / SIZE));
const inner = SIZE * scale;
const pad = Math.floor((CELL - inner) / 2);

const buf = Buffer.alloc(W * H * 4);
const [br, bg, bb] = rgb(BG);
for (let i = 0; i < W * H; i++) {
  buf[i * 4] = br; buf[i * 4 + 1] = bg; buf[i * 4 + 2] = bb; buf[i * 4 + 3] = 255;
}

picks.forEach((token, i) => {
  const grid = renderDesk(token);
  const ox = GAP + (i % COLS) * (CELL + GAP) + pad;
  const oy = GAP + Math.floor(i / COLS) * (CELL + GAP) + pad;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const key = grid[y][x];
      if (key === '.') continue;
      const [r, g, b] = rgb(DESK_PALETTE[key] ?? '#ff00ff');
      for (let dy = 0; dy < scale; dy++) {
        let o = ((oy + y * scale + dy) * W + ox + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++) {
          buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
          o += 4;
        }
      }
    }
  }
});

await writeFile(OUT, encodePng(buf, W, H));
console.log(`${OUT} — ${picks.length} desks, ${W}x${H}`);
