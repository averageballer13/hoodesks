/* ==========================================================================
   HOODESKS — animated GIF of the collection
   --------------------------------------------------------------------------
   The desk art uses about forty flat colours, which is exactly what GIF wants:
   the whole palette fits a global colour table with no quantisation, so the
   output is colour-exact rather than approximated.

     node tools/gif.mjs                        # all three, default sizes
     node tools/gif.mjs --mode flip            # one desk, cycling fast
     node tools/gif.mjs --mode scroll          # a strip scrolling sideways
     node tools/gif.mjs --mode grid            # a wall of desks re-rolling
     node tools/gif.mjs --mode flip --delay 8 --end 60 --power 4

   Frames do not run at a constant rate: each one holds a little longer than
   the last, so the loop spins at speed and eases to a near-stop on its final
   desk before snapping back. --delay is the opening hold, --end the closing
   one, --power how abruptly it decelerates (1 is linear, higher stays fast
   longer then drops off a cliff).

   All three are in hundredths of a second, the unit GIF itself uses. Below 2
   most browsers clamp to 10, so 3 is the practical floor.
   ========================================================================== */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDesks, renderDesk, DESK_PALETTE, SIZE } from '../assets/js/desks.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1];
};

const BG = '#000000';

/* -- palette --------------------------------------------------------------
   One global colour table for every frame, built once from the art palette.
   ------------------------------------------------------------------------ */

const HEX = [];
const INDEX = new Map();

function colorIndex(hex) {
  if (INDEX.has(hex)) return INDEX.get(hex);
  const i = HEX.length;
  if (i > 255) throw new Error('more than 256 colours');
  HEX.push(hex);
  INDEX.set(hex, i);
  return i;
}

colorIndex(BG); // index 0, so any untouched pixel is background
for (const [key, hex] of Object.entries(DESK_PALETTE)) {
  if (key === '.' || key.startsWith('$')) continue; // aliases never reach a frame
  colorIndex(hex);
}

/** Round the table up to the power of two GIF requires. */
function paletteBytes() {
  let bits = 1;
  while (1 << bits < HEX.length) bits++;
  const size = 1 << bits;
  const buf = Buffer.alloc(size * 3);
  HEX.forEach((hex, i) => {
    buf[i * 3] = parseInt(hex.slice(1, 3), 16);
    buf[i * 3 + 1] = parseInt(hex.slice(3, 5), 16);
    buf[i * 3 + 2] = parseInt(hex.slice(5, 7), 16);
  });
  return { buf, bits };
}

/* -- lzw ------------------------------------------------------------------ */

function lzwEncode(indices, minCodeSize) {
  const CLEAR = 1 << minCodeSize;
  const EOI = CLEAR + 1;

  let codeSize = minCodeSize + 1;
  let next = EOI + 1;
  let dict = new Map();

  const out = [];
  let acc = 0, accBits = 0;

  const emit = (code) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      out.push(acc & 0xff);
      acc >>= 8;
      accBits -= 8;
    }
  };

  emit(CLEAR);
  let prefix = indices[0];

  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }

    emit(prefix);
    dict.set(key, next);
    next++;

    if (next === 4096) {
      emit(CLEAR);
      dict = new Map();
      next = EOI + 1;
      codeSize = minCodeSize + 1;
    } else if (next > (1 << codeSize)) {
      codeSize++;
    }
    prefix = k;
  }

  emit(prefix);
  emit(EOI);
  if (accBits > 0) out.push(acc & 0xff);

  return Buffer.from(out);
}

/** LZW output is carried in sub-blocks of at most 255 bytes. */
function subBlocks(data) {
  const parts = [];
  for (let i = 0; i < data.length; i += 255) {
    const slice = data.subarray(i, i + 255);
    parts.push(Buffer.from([slice.length]), slice);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

/* -- gif ------------------------------------------------------------------ */

const u16 = (n) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);

/**
 * Ease-out ramp of per-frame delays: `start` hundredths on the first frame,
 * `end` on the last, `power` shaping how late the slowdown arrives.
 */
function delayRamp(n, start, end, power) {
  return Array.from({ length: n }, (_, i) => {
    const t = n < 2 ? 1 : i / (n - 1);
    return Math.max(2, Math.round(start + (end - start) * Math.pow(t, power)));
  });
}

/** Assemble frames (Uint8Array of palette indices, w*h) into a looping GIF89a. */
function encodeGif(frames, w, h, delays) {
  const { buf: table, bits } = paletteBytes();
  const minCodeSize = Math.max(2, bits);

  const parts = [
    Buffer.from('GIF89a', 'ascii'),
    u16(w), u16(h),
    // global table present, 8-bit colour resolution, table size = bits-1
    Buffer.from([0x80 | 0x70 | (bits - 1), 0, 0]),
    table,
    // Netscape extension: loop forever
    Buffer.from([0x21, 0xff, 0x0b]),
    Buffer.from('NETSCAPE2.0', 'ascii'),
    Buffer.from([0x03, 0x01]), u16(0), Buffer.from([0x00]),
  ];

  frames.forEach((frame, i) => {
    parts.push(
      // graphic control: no disposal, no transparency, this frame's own hold
      Buffer.from([0x21, 0xf9, 0x04, 0x00]), u16(delays[i]), Buffer.from([0x00, 0x00]),
      Buffer.from([0x2c]), u16(0), u16(0), u16(w), u16(h), Buffer.from([0x00]),
      Buffer.from([minCodeSize]),
      subBlocks(lzwEncode(frame, minCodeSize)),
    );
  });

  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

/* -- drawing -------------------------------------------------------------- */

const { tokens } = buildDesks();

/** Cache each desk as a flat 32x32 index array; renderDesk is the slow part. */
const cache = new Map();
function deskIndices(token) {
  let flat = cache.get(token.id);
  if (!flat) {
    const grid = renderDesk(token);
    flat = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const key = grid[y][x];
        flat[y * SIZE + x] = key === '.' ? 0 : colorIndex(DESK_PALETTE[key]);
      }
    }
    cache.set(token.id, flat);
  }
  return flat;
}

/** Blit one desk into `frame` at (ox, oy), magnified `scale` times. */
function blit(frame, fw, fh, token, ox, oy, scale) {
  const src = deskIndices(token);
  for (let y = 0; y < SIZE; y++) {
    const py = oy + y * scale;
    for (let x = 0; x < SIZE; x++) {
      const v = src[y * SIZE + x];
      const px = ox + x * scale;
      for (let dy = 0; dy < scale; dy++) {
        const ry = py + dy;
        if (ry < 0 || ry >= fh) continue;
        let o = ry * fw + px;
        for (let dx = 0; dx < scale; dx++) {
          const rx = px + dx;
          if (rx >= 0 && rx < fw) frame[o] = v;
          o++;
        }
      }
    }
  }
}

/* Evenly spread picks across the whole collection, so a short loop still
   shows the range of the art rather than one corner of it. */
const spread = (n, offset = 0) => {
  const step = Math.max(1, Math.floor(tokens.length / n));
  return Array.from({ length: n }, (_, i) => tokens[(offset + i * step) % tokens.length]);
};

/* -- modes ---------------------------------------------------------------- */

function flip({ frames = 40, scale = 8, pad = 16 }) {
  const tile = SIZE * scale;
  const w = tile + pad * 2, h = tile + pad * 2;
  const picks = spread(frames);
  return {
    w, h,
    frames: picks.map((t) => {
      const f = new Uint8Array(w * h); // 0 = background
      blit(f, w, h, t, pad, pad, scale);
      return f;
    }),
  };
}

function scroll({ scale = 3, gap = 8, cells = 6, strip = 12, step = 26, pad = 8 }) {
  const tile = SIZE * scale;
  const cell = tile + gap;
  const total = strip * cell;
  const w = cells * cell;
  const h = tile + pad * 2;

  if (total % step !== 0) throw new Error(`strip ${total}px is not divisible by step ${step}`);
  const count = total / step;
  const picks = spread(strip);

  // Draw the whole strip once, then take a moving window of it. The window
  // wraps modulo the strip width, so the last frame meets the first exactly.
  const band = new Uint8Array(total * h);
  picks.forEach((t, i) => blit(band, total, h, t, i * cell + Math.floor(gap / 2), pad, scale));

  const frames = [];
  for (let n = 0; n < count; n++) {
    const off = (n * step) % total;
    const f = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const srow = y * total, drow = y * w;
      for (let x = 0; x < w; x++) f[drow + x] = band[srow + ((off + x) % total)];
    }
    frames.push(f);
  }
  return { w, h, frames };
}

function grid({ cols = 8, rows = 5, scale = 2, gap = 4, frames = 40, pad = 6 }) {
  const tile = SIZE * scale;
  const cell = tile + gap;
  const w = cols * cell - gap + pad * 2;
  const h = rows * cell - gap + pad * 2;
  const per = cols * rows;

  const out = [];
  for (let n = 0; n < frames; n++) {
    const f = new Uint8Array(w * h);
    // Each frame advances the whole wall by one desk.
    const picks = spread(per, n * per);
    picks.forEach((t, i) => {
      const cx = pad + (i % cols) * cell;
      const cy = pad + Math.floor(i / cols) * cell;
      blit(f, w, h, t, cx, cy, scale);
    });
    out.push(f);
  }
  return { w, h, frames: out };
}

/* -- run ------------------------------------------------------------------ */

await mkdir(join(ROOT, 'brand'), { recursive: true });

const MODES = { flip, scroll, grid };
const startDelay = Number(arg('delay', 8));
const endDelay = Number(arg('end', 60));
const power = Number(arg('power', 4));
const only = arg('mode', null);
const overrides = {};
for (const k of ['frames', 'scale', 'gap', 'cells', 'strip', 'step', 'cols', 'rows', 'pad']) {
  const v = arg(k, null);
  if (v != null) overrides[k] = Number(v);
}

for (const [name, fn] of Object.entries(MODES)) {
  if (only && only !== name) continue;
  const t0 = Date.now();
  const { w, h, frames } = fn(overrides);
  const delays = delayRamp(frames.length, startDelay, endDelay, power);
  const gif = encodeGif(frames, w, h, delays);
  const seconds = delays.reduce((a, b) => a + b, 0) / 100;
  const out = join(ROOT, 'brand', `hoodesks-${name}.gif`);
  await writeFile(out, gif);
  console.log(
    `hoodesks-${name}.gif  ${w}x${h}  ${frames.length} frames  ` +
    `${delays[0] * 10}ms -> ${delays[delays.length - 1] * 10}ms  ` +
    `${seconds.toFixed(1)}s loop  ${(gif.length / 1024).toFixed(0)} KB  ${Date.now() - t0}ms`,
  );
}

console.log(`palette: ${HEX.length} colours`);
