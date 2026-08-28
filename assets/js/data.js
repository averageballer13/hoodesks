/* ==========================================================================
   HOODESKS — data layer
   --------------------------------------------------------------------------
   One seam between the pages and the chain.

   `sync()` looks for a deployed collection and reads its state. Until one
   exists it returns null and every function below falls back to a pre-launch
   view, so the site is browsable before there is anything to read. Once the
   contract is deployed the same functions serve live numbers, with nobody
   editing a file in between.

   Pages call `await sync()` once, then render. Nothing else here is async.
   ========================================================================== */

import { CHAIN, ECON, ROTATION, TOKEN } from './config.js';
import { buildDesks, rankCollection } from './desks.js';
import { readState } from './chain.js';

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

/* -- live state ----------------------------------------------------------- */

let live = null;
let synced = false;

/** Read the chain once. Safe to call from every page; failures stay quiet. */
export async function sync() {
  if (synced) return live;
  try {
    live = await readState();
  } catch (err) {
    console.warn('chain read failed, showing pre-launch state', err);
    live = null;
  }
  synced = true;
  return live;
}

export const chainState = () => live;

/** True once minting is actually open on chain. */
const isLive = () => Boolean(live);

/* -- launch status -------------------------------------------------------- */

/**
 * Where the launch stands. The order is forced rather than chosen: the
 * collection's constructor takes the token address, so the token has to exist
 * on the launchpad before anything can be deployed.
 */
export function launchStatus() {
  if (!isLive()) {
    return {
      live: false,
      label: 'Not live yet',
      note:
        `${TOKEN.symbol} launches on ${CHAIN.launchpad} first. The collection is ` +
        `deployed against its address straight after, and this page opens by itself ` +
        `the moment it is — it watches the chain rather than waiting to be edited.`,
      steps: [
        `Launch ${TOKEN.symbol} on ${CHAIN.launchpad}`,
        'Deploy the collection against the token address',
        'Point the launchpad creator fees at the pot',
      ],
    };
  }

  if (live.minted >= ECON.supply) {
    return { live: false, label: 'Sold out', note: 'Every desk has been minted.', steps: [] };
  }

  return {
    live: true,
    label: 'Mint a desk',
    // Minting works without an adapter; only rounds need one. Worth saying,
    // because the pot will visibly fill while nothing buys anything yet.
    note: live.adapter
      ? null
      : 'Rounds are paused until a swap adapter is set — the pot fills but buys nothing yet.',
    steps: [],
  };
}

/* -- reads ---------------------------------------------------------------- */

/** Headline protocol numbers for the stats bar. */
export function stats() {
  if (!isLive()) {
    return {
      launched: false, minted: 0, supply: ECON.supply, liveDesks: 0,
      burned: 0, buysNext: ROTATION[0].sym, paidToHolders: 0,
      potBalance: 0, rounds: 0, converted: 0,
    };
  }
  return {
    launched: true,
    minted: live.minted,
    supply: ECON.supply,
    liveDesks: live.minted,
    burned: live.minted * ECON.deposit,
    buysNext: ROTATION[live.nextAsset % ROTATION.length].sym,
    paidToHolders: 0, // needs a price feed; the vaults are readable on chain
    potBalance: live.pot,
    rounds: live.rounds,
    converted: live.converted,
  };
}

/** Desks ranked by what is in their vault. Needs an indexer to be meaningful. */
export function leaderboard() {
  if (!isLive() || live.minted === 0) return [];
  const { tokens } = collection();
  return tokens.slice(0, live.minted).map((t) => ({ token: t, value: 0 }));
}

/** Every round settled. Full history needs log indexing; this is the count. */
export function rounds() {
  if (!isLive() || live.rounds === 0) return [];
  return Array.from({ length: live.rounds }, (_, i) => ({
    n: i,
    sym: ROTATION[i % ROTATION.length].sym,
    spent: 0,
    units: 0,
    desks: live.minted,
    at: null,
  })).reverse();
}

/** Mint events, newest first — the burn feed. */
export function burns() {
  if (!isLive() || live.minted === 0) return [];
  const { tokens } = collection();
  return tokens.slice(0, live.minted)
    .map((t) => ({ token: t, amount: ECON.deposit, at: null }))
    .reverse();
}

/** What a single desk holds. Zero until its vault is read directly. */
export function holdings() {
  return ROTATION.map((a) => ({ sym: a.sym, name: a.name, units: 0, value: 0 }));
}

/** Wallet-scoped view. The mint page fills this in once connected. */
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
        'AAPL, MSFT, NVDA, AMZN, GME, CRCL, SPCX, CRWV, PLTR and TSLA — every one a ' +
        'canonical Robinhood Stock Token, checked against the live on-chain registry. ' +
        'A round spends the pot in full on whichever is next and splits it equally.',
    },
    {
      title: `Launching on ${CHAIN.launchpad}`,
      kind: 'ANNOUNCEMENT',
      at: 'Aug 26, 2026',
      body:
        `${TOKEN.symbol} launches on ${CHAIN.launchpad}, the launchpad on ${CHAIN.name}. ` +
        'Creator fees on every trade are claimed into the pot, which keeps rounds ' +
        'firing after the last desk is minted.',
    },
  ];
}
