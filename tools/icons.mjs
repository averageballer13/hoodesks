/* ==========================================================================
   HOODESKS — brand icon builder
   --------------------------------------------------------------------------
   Turns the master logo and banner into the sizes the site actually serves.
   Dependency-free: PNG decode on node:zlib, box-filter downscale, PNG encode.

     node tools/icons.mjs                     # rebuild everything
     node tools/icons.mjs --logo path.png     # different master

   Reads   brand/logo.png     square mark, any size
           brand/banner.png   wide banner, any size
   Writes  assets/img/mark-64.png      header mark (26px slot, retina)
           assets/img/favicon-32.png   browser tab
           assets/img/favicon-180.png  apple-touch-icon
           assets/img/logo-512.png     share / press
           assets/img/og.png           1200x630 open graph card
   ========================================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1];
};

/* -- png decode ----------------------------------------------------------- */

const PAETH = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode a non-interlaced 8-bit greyscale/RGB/RGBA PNG into {w,h,rgba}. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

  let pos = 8, ihdr = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0),
        h: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;

    pos += 12 + len;
  }

  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8) throw new Error(`unsupported bit depth ${ihdr.depth}`);
  if (ihdr.interlace) throw new Error('interlaced PNG not supported');

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.color];
  if (!channels) throw new Error(`unsupported colour type ${ihdr.color}`);

  const raw = inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr;
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);

  let sp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[sp++];
    const line = raw.subarray(sp, sp + stride);
    sp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      const v = line[x];
      cur[x] =
        filter === 0 ? v :
        filter === 1 ? (v + a) & 0xff :
        filter === 2 ? (v + b) & 0xff :
        filter === 3 ? (v + ((a + b) >> 1)) & 0xff :
        filter === 4 ? (v + PAETH(a, b, c)) & 0xff :
        (() => { throw new Error(`bad filter ${filter}`); })();
    }
  }

  // normalise to RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * bpp, d = i * 4;
    if (channels === 1) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255;
    } else if (channels === 2) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1];
    } else if (channels === 3) {
      rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255;
    } else {
      out.copy(rgba, d, s, s + 4);
    }
  }
  return { w, h, rgba };
}

/* -- png encode ----------------------------------------------------------- */

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
function encodePng({ w, h, rgba }) {
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

/* -- ops ------------------------------------------------------------------ */

function crop(img, x0, y0, cw, ch) {
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const s = ((y0 + y) * img.w + x0) * 4;
    img.rgba.copy(out, y * cw * 4, s, s + cw * 4);
  }
  return { w: cw, h: ch, rgba: out };
}

/** Box-filter resample. Averages every source pixel that lands in a target cell. */
function resize(img, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  const sx = img.w / tw, sy = img.h / th;

  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < img.h; yy++) {
        for (let xx = x0; xx < x1 && xx < img.w; xx++) {
          const s = (yy * img.w + xx) * 4;
          const al = img.rgba[s + 3];
          // premultiply so transparent pixels do not drag colour in
          r += img.rgba[s] * al; g += img.rgba[s + 1] * al; b += img.rgba[s + 2] * al;
          a += al; n++;
        }
      }
      const d = (y * tw + x) * 4;
      if (a === 0) { out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0; continue; }
      out[d] = Math.round(r / a);
      out[d + 1] = Math.round(g / a);
      out[d + 2] = Math.round(b / a);
      out[d + 3] = Math.round(a / n);
    }
  }
  return { w: tw, h: th, rgba: out };
}

/** Bounding box of everything that is not within `tol` of the corner colour. */
function contentBox(img, tol = 26) {
  const bg = [img.rgba[0], img.rgba[1], img.rgba[2]];
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      if (img.rgba[s + 3] < 8) continue;
      const d = Math.abs(img.rgba[s] - bg[0]) + Math.abs(img.rgba[s + 1] - bg[1]) +
                Math.abs(img.rgba[s + 2] - bg[2]);
      if (d > tol) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Centre `img` on a `w`x`h` canvas of `bg`, scaled to fit inside. */
function contain(img, w, h, bg = [0, 0, 0, 255]) {
  const scale = Math.min(w / img.w, h / img.h);
  const iw = Math.max(1, Math.round(img.w * scale));
  const ih = Math.max(1, Math.round(img.h * scale));
  const small = resize(img, iw, ih);

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = bg[3];
  }
  const ox = Math.floor((w - iw) / 2), oy = Math.floor((h - ih) / 2);
  for (let y = 0; y < ih; y++) {
    small.rgba.copy(out, ((oy + y) * w + ox) * 4, y * iw * 4, (y + 1) * iw * 4);
  }
  return { w, h, rgba: out };
}

/* -- run ------------------------------------------------------------------ */

const BRAND = join(ROOT, 'brand');
const IMG = join(ROOT, 'assets', 'img');
await mkdir(IMG, { recursive: true });

const logoPath = arg('logo', join(BRAND, 'logo.png'));
const master = decodePng(await readFile(logoPath));
console.log(`logo   ${master.w}x${master.h}`);

// Trim the master's dead margin so the mark fills a favicon, then re-pad it
// slightly — a tab icon that touches its own edges reads as cramped.
const box = contentBox(master);
let square = master;
if (box) {
  const pad = Math.round(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.06);
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const half = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2 + pad;
  const x0 = Math.max(0, Math.round(cx - half));
  const y0 = Math.max(0, Math.round(cy - half));
  const size = Math.min(Math.round(half * 2), master.w - x0, master.h - y0);
  square = crop(master, x0, y0, size, size);
  console.log(`trim   ${master.w}x${master.h} -> ${size}x${size}`);
}

const targets = [
  ['mark-64.png', 64],
  ['favicon-32.png', 32],
  ['favicon-180.png', 180],
  ['logo-512.png', 512],
];

for (const [name, size] of targets) {
  const png = encodePng(resize(square, size, size));
  await writeFile(join(IMG, name), png);
  console.log(`  ${name.padEnd(18)} ${size}x${size}  ${png.length} bytes`);
}

// Open Graph card: the banner letterboxed onto 1200x630 so nothing is cut.
try {
  const banner = decodePng(await readFile(join(BRAND, 'banner.png')));
  const og = encodePng(contain(banner, 1200, 630));
  await writeFile(join(IMG, 'og.png'), og);
  console.log(`  og.png             1200x630  ${og.length} bytes  (from ${banner.w}x${banner.h})`);
} catch (err) {
  console.warn(`  og.png skipped: ${err.message}`);
}
