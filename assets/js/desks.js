/* ==========================================================================
   HOODESKS — deterministic desk collection
   --------------------------------------------------------------------------
   5,000 unique 32x32 pixel trading terminals, generated from a fixed seed.
   Nothing is stored: the same seed always yields the same collection in the
   same order, on any machine, forever. Change DESK_SEED and you get a
   different — but statistically identical — collection.
   ========================================================================== */

export const SIZE = 32;
export const DESK_SEED = 'hoodesks-v1';
export const DESK_SUPPLY = 5000;

/* -- palette --------------------------------------------------------------
   `$name` entries are aliases resolved at the end of a render, so one rect
   definition can paint eight different case colours.
   ------------------------------------------------------------------------ */
export const DESK_PALETTE = {
  '.': 'transparent',
  $case: '#ff00ff', $top: '#ff00ff', $side: '#ff00ff', $trim: '#ff00ff',
  $bezel: '#ff00ff', $glass: '#ff00ff', $phos: '#ff00ff',

  fieldBone: '#e9e3d0', fieldSage: '#d2dac7', fieldDusk: '#c8cbd8',
  fieldClay: '#e2d0c0', fieldSlate: '#bcbfbe', fieldRose: '#e8d0d0',
  fieldMint: '#c9dcd2',

  beige: '#ded3ad', beigeTop: '#efe6c6', beigeSide: '#b6ac8b',
  grey: '#c4c5c1', greyTop: '#dcdcd8', greySide: '#9a9b97',
  cream: '#efe7d2', creamTop: '#fbf6e6', creamSide: '#c6bda6',
  salmon: '#e0917f', salmonTop: '#efb0a0', salmonSide: '#b06d61',
  teal: '#6fb0a8', tealTop: '#8fcdc5', tealSide: '#4c8781',
  ox: '#7a3b3b', oxTop: '#96504e', oxSide: '#5a2a2a',
  ivory: '#f4efe2', ivoryTop: '#fffdf6', ivorySide: '#cfc9b8',
  graphite: '#4d4d4d', graphiteTop: '#666666', graphiteSide: '#333333',

  glassDark: '#16211b', glassBlue: '#141d2c',
  phosGreen: '#5ce07a', phosAmber: '#e8a33f', phosCyan: '#5fd9e0',
  phosWhite: '#e9efe7', phosRose: '#e88fa8',

  key: '#f0eadb', keyTop: '#ffffff', keyShade: '#b8b2a1',
  red: '#c0392b', ink: '#2b2b25', paper: '#f6f3e6',
};

const S = (x, y, w, h, c) => ({ x, y, w, h, c });

/* An extruded box: `depth` stacked highlight rows on top, shade column right. */
function box(x, y, w, h, depth, faceC = '$case', topC = '$top', sideC = '$side') {
  const out = [];
  for (let i = depth; i >= 1; i--) {
    out.push(S(x + i, y - i, w, 1, topC));
    out.push(S(x + w - 1 + i, y - i, 1, h, sideC));
  }
  out.push(S(x, y, w, h, faceC));
  return out;
}

/* Chassis: the monitor body and the keyboard slab beneath it. */
const BASE = [...box(6, 7, 18, 15, 2), ...box(4, 24, 21, 3, 2)];
/* The tube: bezel, then glass inset into it. */
const GLASS = [S(8, 9, 14, 10, '$bezel'), S(9, 10, 12, 8, '$glass')];

/* -- trait layers ---------------------------------------------------------
   Order is paint order. `weight` is relative within its own layer.
   ------------------------------------------------------------------------ */
export const LAYERS = [
  {
    name: 'Field',
    traits: [
      { name: 'Bone',  weight: 22, rects: [S(0, 0, 32, 32, 'fieldBone')] },
      { name: 'Sage',  weight: 18, rects: [S(0, 0, 32, 32, 'fieldSage')] },
      { name: 'Dusk',  weight: 16, rects: [S(0, 0, 32, 32, 'fieldDusk')] },
      { name: 'Clay',  weight: 14, rects: [S(0, 0, 32, 32, 'fieldClay')] },
      { name: 'Slate', weight: 12, rects: [S(0, 0, 32, 32, 'fieldSlate')] },
      { name: 'Mint',  weight: 10, rects: [S(0, 0, 32, 32, 'fieldMint')] },
      { name: 'Rose',  weight:  8, rects: [S(0, 0, 32, 32, 'fieldRose')] },
    ],
  },
  {
    name: 'Case',
    traits: [
      { name: 'Office beige', weight: 26, rects: [], swap: { $case: 'beige',    $top: 'beigeTop',    $side: 'beigeSide',    $trim: 'ink' } },
      { name: 'Floor grey',   weight: 22, rects: [], swap: { $case: 'grey',     $top: 'greyTop',     $side: 'greySide',     $trim: 'ink' } },
      { name: 'Bone',         weight: 18, rects: [], swap: { $case: 'cream',    $top: 'creamTop',    $side: 'creamSide',    $trim: 'ink' } },
      { name: 'Salmon',       weight: 14, rects: [], swap: { $case: 'salmon',   $top: 'salmonTop',   $side: 'salmonSide',   $trim: 'ink' } },
      { name: 'Teal',         weight: 10, rects: [], swap: { $case: 'teal',     $top: 'tealTop',     $side: 'tealSide',     $trim: 'paper' } },
      { name: 'Graphite',     weight:  6, rects: [], swap: { $case: 'graphite', $top: 'graphiteTop', $side: 'graphiteSide', $trim: 'paper' } },
      { name: 'Oxblood',      weight:  2, rects: [], swap: { $case: 'ox',       $top: 'oxTop',       $side: 'oxSide',       $trim: 'paper' } },
      { name: 'Ivory',        weight:  2, rects: [], swap: { $case: 'ivory',    $top: 'ivoryTop',    $side: 'ivorySide',    $trim: 'ink' } },
    ],
  },
  {
    name: 'Bezel',
    traits: [
      { name: 'Recessed', weight: 52, rects: [], swap: { $bezel: '$side' } },
      { name: 'Flush',    weight: 30, rects: [], swap: { $bezel: '$case' } },
      { name: 'Blackout', weight: 18, rects: [], swap: { $bezel: 'ink' } },
    ],
  },
  {
    name: 'Tube',
    traits: [
      { name: 'Green phosphor', weight: 38, rects: [], swap: { $glass: 'glassDark', $phos: 'phosGreen' } },
      { name: 'Amber phosphor', weight: 24, rects: [], swap: { $glass: 'glassDark', $phos: 'phosAmber' } },
      { name: 'Cyan phosphor',  weight: 18, rects: [], swap: { $glass: 'glassBlue', $phos: 'phosCyan' } },
      { name: 'Paper white',    weight: 14, rects: [], swap: { $glass: 'glassBlue', $phos: 'phosWhite' } },
      { name: 'Rose phosphor',  weight:  6, rects: [], swap: { $glass: 'glassDark', $phos: 'phosRose' } },
    ],
  },
  {
    name: 'Screen',
    traits: [
      { name: 'Rising', weight: 20, rects: [
        S(10, 15, 2, 1, '$phos'), S(12, 14, 2, 1, '$phos'), S(14, 12, 2, 1, '$phos'),
        S(16, 13, 2, 1, '$phos'), S(18, 11, 2, 1, '$phos'), S(10, 16, 10, 1, '$phos')] },
      { name: 'Falling', weight: 12, rects: [
        S(10, 11, 2, 1, '$phos'), S(12, 12, 2, 1, '$phos'), S(14, 14, 2, 1, '$phos'),
        S(16, 13, 2, 1, '$phos'), S(18, 15, 2, 1, '$phos'), S(10, 16, 10, 1, '$phos')] },
      { name: 'Quote board', weight: 18, rects: [
        S(10, 11, 10, 1, '$phos'), S(10, 13, 6, 1, '$phos'), S(17, 13, 3, 1, '$phos'),
        S(10, 15, 7, 1, '$phos'), S(18, 15, 2, 1, '$phos')] },
      { name: 'Ledger', weight: 14, rects: [
        S(10, 11, 10, 1, '$phos'), S(10, 13, 10, 1, '$phos'), S(10, 15, 6, 1, '$phos')] },
      { name: 'Depth', weight: 12, rects: [
        S(10, 14, 1, 3, '$phos'), S(12, 12, 1, 5, '$phos'), S(14, 15, 1, 2, '$phos'),
        S(16, 11, 1, 6, '$phos'), S(18, 13, 1, 4, '$phos')] },
      { name: 'Grid', weight: 10, rects: [
        S(10, 11, 10, 1, '$phos'), S(10, 14, 10, 1, '$phos'),
        S(13, 11, 1, 6, '$phos'), S(17, 11, 1, 6, '$phos')] },
      { name: 'Prompt', weight: 8, rects: [S(10, 13, 3, 1, '$phos'), S(14, 13, 1, 1, '$phos')] },
      { name: 'Dark',   weight: 6, rects: [] },
    ],
  },
  {
    name: 'Keys',
    traits: [
      { name: 'Full stroke', weight: 40, rects: [
        ...Array.from({ length: 6 }, (_, i) => S(7 + 3 * i, 22, 2, 1, 'key')),
        ...Array.from({ length: 6 }, (_, i) => S(6 + 3 * i, 23, 2, 1, 'key')),
        ...Array.from({ length: 5 }, (_, i) => S(5 + 3 * i, 25, 2, 1, 'keyShade')),
        S(20, 25, 3, 1, 'red')] },
      { name: 'Wide pitch', weight: 24, rects: [
        ...Array.from({ length: 4 }, (_, i) => S(7 + 4 * i, 22, 3, 1, 'key')),
        ...Array.from({ length: 4 }, (_, i) => S(6 + 4 * i, 23, 3, 1, 'key')),
        S(20, 25, 3, 1, 'red')] },
      { name: 'Short deck', weight: 18, rects: [
        ...Array.from({ length: 6 }, (_, i) => S(6 + 3 * i, 23, 2, 1, 'key')),
        S(20, 25, 3, 1, 'red')] },
      { name: 'Twin function', weight: 12, rects: [
        ...Array.from({ length: 6 }, (_, i) => S(7 + 3 * i, 22, 2, 1, 'key')),
        ...Array.from({ length: 6 }, (_, i) => S(6 + 3 * i, 23, 2, 1, 'key')),
        ...Array.from({ length: 4 }, (_, i) => S(5 + 3 * i, 25, 2, 1, 'keyShade')),
        S(17, 25, 2, 1, 'red'), S(20, 25, 3, 1, 'red')] },
      { name: 'Blank deck', weight: 6, rects: [S(20, 25, 3, 1, 'red')] },
    ],
  },
  {
    name: 'Lamp',
    traits: [
      { name: 'Live',    weight: 44, rects: [S(20, 20, 1, 1, '$phos')] },
      { name: 'Standby', weight: 26, rects: [S(20, 20, 1, 1, 'phosAmber')] },
      { name: 'Fault',   weight: 18, rects: [S(20, 20, 1, 1, 'red')] },
      { name: 'Dark',    weight: 12, rects: [] },
    ],
  },
  {
    name: 'Plate',
    traits: [
      { name: 'Plated',   weight: 68, rects: [S(9, 20, 8, 1, '$trim')] },
      { name: 'Unbadged', weight: 32, rects: [] },
    ],
  },
];

export const LAYER_NAMES = LAYERS.map((l) => l.name);

/* -- rng ------------------------------------------------------------------
   String hash into a 128-bit xorshift. Deterministic across engines.
   ------------------------------------------------------------------------ */
function makeRng(seed) {
  let h = 0x6a09e667 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0xcc9e2d51);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  let b = (0x6d2b79f5 ^ a) >>> 0;
  let c = (0x9e3779b9 ^ b) >>> 0;
  let d = (0x85ebca6b ^ c) >>> 0;
  return () => {
    const t = a ^ (a << 11);
    a = b; b = c; c = d;
    d = (d ^ (d >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return d / 0x100000000;
  };
}

function pickWeighted(traits, roll) {
  let x = roll * traits.reduce((sum, t) => sum + t.weight, 0);
  for (const t of traits) if ((x -= t.weight) <= 0) return t;
  return traits[traits.length - 1];
}

/**
 * Build `count` unique desks. Duplicate trait combinations are rejected and
 * re-rolled, so serials stay contiguous and every desk is one of a kind.
 */
export function buildDesks(count = DESK_SUPPLY, seed = DESK_SEED) {
  const rand = makeRng(seed);
  const seen = new Set();
  const tokens = [];
  let attempts = 0;
  const cap = count * 20;

  while (tokens.length < count && attempts < cap) {
    attempts++;
    const traits = {};
    for (const layer of LAYERS) traits[layer.name] = pickWeighted(layer.traits, rand()).name;
    const key = LAYER_NAMES.map((n) => traits[n]).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push({ serial: tokens.length, id: tokens.length + 1, traits });
  }
  return { tokens, attempts };
}

/** Render a desk to a 32x32 grid of resolved palette keys. */
export function renderDesk(token) {
  const grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '.'));
  const swaps = {};

  const paint = (rects) => {
    for (const r of rects) {
      for (let y = Math.max(0, r.y); y < Math.min(SIZE, r.y + r.h); y++) {
        for (let x = Math.max(0, r.x); x < Math.min(SIZE, r.x + r.w); x++) grid[y][x] = r.c;
      }
    }
  };

  for (const layer of LAYERS) {
    if (layer.name === 'Bezel') { paint(BASE); paint(GLASS); }
    const chosen = layer.traits.find((t) => t.name === token.traits[layer.name]);
    if (!chosen) throw new Error(`no trait "${token.traits[layer.name]}" in layer ${layer.name}`);
    if (chosen.swap) Object.assign(swaps, chosen.swap);
    paint(chosen.rects);
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let c = grid[y][x];
      for (let i = 0; i < 8 && c in swaps; i++) {
        const next = swaps[c];
        if (next === c) break;
        c = next;
      }
      grid[y][x] = c;
    }
  }
  return grid;
}

/** Paint a desk onto a 32x32 canvas (scale it with CSS, image-rendering: pixelated). */
export function drawDesk(canvas, token) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const grid = renderDesk(token);
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = grid[y][x];
      if (c === '.') continue;
      ctx.fillStyle = DESK_PALETTE[c] ?? '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** "Slate · Bone · Flush · Amber phosphor · …" */
export const traitLine = (token) => LAYER_NAMES.map((n) => token.traits[n]).join(' · ');

/** Trait counts across a set, for rarity. */
export function traitCounts(tokens) {
  const counts = {};
  for (const n of LAYER_NAMES) counts[n] = {};
  for (const t of tokens) {
    for (const n of LAYER_NAMES) {
      counts[n][t.traits[n]] = (counts[n][t.traits[n]] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Additive rarity: sum of (total / trait count) across the eight layers.
 * Higher is rarer. Readable, stable, and independent of collection size.
 */
export function rarityScore(token, counts, total) {
  let score = 0;
  for (const n of LAYER_NAMES) {
    const c = counts[n][token.traits[n]] || 1;
    score += total / c;
  }
  return score;
}

/** Attach `rarity` and `rank` (1 = rarest) to every token, in place. */
export function rankCollection(tokens) {
  const counts = traitCounts(tokens);
  const total = tokens.length;
  for (const t of tokens) t.rarity = rarityScore(t, counts, total);
  const sorted = [...tokens].sort((a, b) => b.rarity - a.rarity);
  sorted.forEach((t, i) => { t.rank = i + 1; });
  return { counts, total };
}
