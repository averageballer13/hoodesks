/* ==========================================================================
   HOODESKS — data layer
   --------------------------------------------------------------------------
   THIS IS THE SEAM. Everything the UI shows comes from the functions below.
   Right now they return a deterministic pre-launch state so the site is
   fully browsable before the contracts exist. To go live, replace the bodies
   with reads against the indexer / RPC — the shapes are what the pages
   expect, so nothing above this file has to change.
   ========================================================================== */

import { ECON, ROTATION, TOKEN } from './config.js';
import { buildDesks, rankCollection } from './desks.js';

/* -- collection (deterministic, no network) ------------------------------- */

let _collection = null;
export function collection() {
  if (!_collection) {
    const { tokens } = buildDesks();
    const { counts } = rankCollection(tokens);
    _collection = { tokens, counts };
  }
  return _collection;
}

export const deskById = (id) => collection().tokens[Number(id) - 1] ?? null;

/* -- deterministic mock state --------------------------------------------
   Swap `MINTED` for the on-chain counter. Everything else derives from it,
   so the whole site stays internally consistent at any supply.
   ------------------------------------------------------------------------ */

const MINTED = 0;          // desks issued so far — 0 until launch
const LAUNCHED = false;    // flip once the mint is open

function rnd(seed) {
  let h = 2166136261 ^ seed;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Headline protocol numbers for the stats bar. */
export function stats() {
  const burned = MINTED * ECON.deposit;
  const nextIndex = MINTED === 0 ? 0 : MINTED % ROTATION.length;
  return {
    launched: LAUNCHED,
    minted: MINTED,
    supply: ECON.supply,
    liveDesks: MINTED,
    burned,
    burnedPct: (burned / TOKEN.supplyInitial) * 100,
    buysNext: ROTATION[nextIndex].sym,
    paidToHolders: 0,
    potBalance: 0,
    rounds: 0,
    converted: 0,
  };
}

/** Desks ranked by the market value sitting in their vault. */
export function leaderboard() {
  if (!LAUNCHED || MINTED === 0) return [];
  const { tokens } = collection();
  const r = rnd(7);
  return tokens
    .slice(0, MINTED)
    .map((t) => ({ token: t, value: Math.round(r() * 90000) / 100 }))
    .sort((a, b) => b.value - a.value);
}

/** Every round settled, newest first. */
export function rounds() {
  if (!LAUNCHED) return [];
  const r = rnd(19);
  return Array.from({ length: stats().rounds }, (_, i) => {
    const asset = ROTATION[i % ROTATION.length];
    return {
      n: i,
      sym: asset.sym,
      spent: Math.round(r() * 40000) / 10000,
      units: Math.round(r() * 800000) / 10000,
      desks: MINTED,
      at: null,
    };
  }).reverse();
}

/** Mint events, newest first — the burn feed. */
export function burns() {
  if (!LAUNCHED) return [];
  const { tokens } = collection();
  return tokens.slice(0, MINTED).map((t) => ({
    token: t,
    amount: ECON.deposit,
    at: null,
  })).reverse();
}

/** What a single desk currently holds. */
export function holdings(id) {
  if (!LAUNCHED) return ROTATION.map((a) => ({ sym: a.sym, name: a.name, units: 0, value: 0 }));
  const r = rnd(1000 + Number(id));
  return ROTATION.map((a) => {
    const units = Math.round(r() * 40000) / 10000;
    return { sym: a.sym, name: a.name, units, value: Math.round(units * (40 + r() * 400) * 100) / 100 };
  });
}

/** Wallet-scoped view. No wallet is connected in this build. */
export function myDesks() {
  return { connected: false, desks: [] };
}

/* -- changelog ------------------------------------------------------------ */

export function changelog() {
  return [
    {
      title: 'Collection sealed — 5,000 desks generated',
      kind: 'RELEASE',
      at: 'Aug 28, 2026',
      body:
        'The full collection is fixed and reproducible from the seed alone. ' +
        'Traits, rarity and rank are computed in the browser — no metadata server, ' +
        'no pinning, nothing that can go stale.',
    },
    {
      title: 'Rotation set to ten tokenised assets',
      kind: 'PROTOCOL',
      at: 'Aug 27, 2026',
      body:
        'AAPL, MSFT, NVDA, AMZN, HOOD, CRCL, SPCX, ANTHROPIC, POLYMARKET and KALSHI. ' +
        'A round spends the pot in full on whichever is next and splits it equally.',
    },
    {
      title: 'Launching on Pons',
      kind: 'ANNOUNCEMENT',
      at: 'Aug 26, 2026',
      body:
        'DESKS launches on Pons, the launchpad on Robinhood Chain. Creator fees on ' +
        'every trade are swept into the pot, which keeps rounds firing after the ' +
        'last desk is minted.',
    },
  ];
}
