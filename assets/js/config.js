/* ==========================================================================
   HOODESKS — protocol configuration
   --------------------------------------------------------------------------
   Single source of truth. Every number, address, ticker and label the UI
   renders is read from here, so re-pointing the front end at a real
   deployment is a one-file edit.
   ========================================================================== */

/** The launch token's ticker. Referenced everywhere rather than repeated. */
export const TOKEN_SYMBOL = 'DESKS';

export const CHAIN = {
  name: 'Robinhood Chain',
  short: 'Robinhood Chain',
  currency: 'ETH',
  launchpad: 'Pons',
  launchpadUrl: 'https://docs.ponsfamily.com/v2',
  explorer: 'https://robinhoodchain.blockscout.com',
  explorerAccount: (a) => `${CHAIN.explorer}/address/${a}`,
  explorerToken: (a) => `${CHAIN.explorer}/token/${a}`,
  explorerTx: (h) => `${CHAIN.explorer}/tx/${h}`,
  // Canonical wrapped ETH and Global Dollar, from the Robinhood Chain docs.
  weth: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
};

export const BRAND = {
  name: 'HOODESKS',
  wordmark: 'HOODESKS',
  domain: 'hoodesks.fun',
  ticker: TOKEN_SYMBOL,
  x: 'https://x.com/hoodesks',
  tagline:
    'Every desk runs its own book, held on chain in a vault only it can own. ' +
    'Mint one, it accumulates round after round, and the whole book transfers when it sells.',
};

/* --- economics -----------------------------------------------------------
   Ratios are held identical to the model this is based on:
   protocol take = 10% of the surcharge, round threshold = 20% of it.
   ------------------------------------------------------------------------ */
export const ECON = {
  supply: 5000,               // desks that can ever exist
  deposit: 100_000,           // burned per mint — see the supply check below
  surcharge: 0.01,            // ETH, charged by the mint instruction
  surchargeToPot: 0.009,      // ETH
  surchargeToProtocol: 0.001, // ETH
  royaltyPct: 5,              // EIP-2981, declared on the collection
  roundThreshold: 0.002,      // ETH — pot fires the moment it clears this
  activationGas: 0.0009,      // ETH, one-time vault deployment
  sweepMinutes: 2,            // Pons creator-fee sweep cadence
};

/* --- the rotation --------------------------------------------------------
   Ten tokenised assets. A round spends the whole pot on whichever is next.

   Every address below is a canonical Robinhood Stock Token, taken from the
   live on-chain asset registry at docs.robinhood.com/chain/contracts.
   A token with a matching ticker at a different address is NOT one of them.

   Note on what is NOT here: Robinhood Chain's registry carries no HOOD,
   ANTHROPIC, POLYMARKET or KALSHI token. Of the pre-IPO names only a handful
   are tokenised — SPCX, FLY, CBRS, INFQ, NAVN. GME stands in for HOOD, which
   is the better joke anyway.
   ------------------------------------------------------------------------ */
export const ROTATION = [
  { i: 1,  sym: 'AAPL', name: 'Apple',      addr: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9' },
  { i: 2,  sym: 'MSFT', name: 'Microsoft',  addr: '0xe93237C50D904957Cf27E7B1133b510C669c2e74' },
  { i: 3,  sym: 'NVDA', name: 'Nvidia',     addr: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC' },
  { i: 4,  sym: 'AMZN', name: 'Amazon',     addr: '0x12f190a9F9d7D37a250758b26824B97CE941bF54' },
  { i: 5,  sym: 'GME',  name: 'GameStop',   addr: '0x1b0E319c6A659F002271B69dB8A7df2F911c153E' },
  { i: 6,  sym: 'CRCL', name: 'Circle',     addr: '0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5' },
  { i: 7,  sym: 'SPCX', name: 'SpaceX',     addr: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa' },
  { i: 8,  sym: 'CRWV', name: 'CoreWeave',  addr: '0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3' },
  { i: 9,  sym: 'PLTR', name: 'Palantir',   addr: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A' },
  { i: 10, sym: 'TSLA', name: 'Tesla',      addr: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d' },
];

/* --- deployed accounts ---------------------------------------------------
   Only the protocol wallet exists so far. The rest are marked pending rather
   than filled with plausible-looking placeholders: a fake address on a live
   page is worse than an empty one, because somebody will send funds to it.
   Fill `addr` and drop `pending` as each contract is deployed.
   ------------------------------------------------------------------------ */
export const ACCOUNTS = [
  { label: 'Protocol wallet', addr: '0x70a273Bb8225b0788c8C6970195871841d01959E' },
  { label: 'Collection · pot', addr: null, pending: true },
  { label: 'Vault implementation', addr: null, pending: true },
  { label: 'Swap adapter', addr: null, pending: true },
  { label: `$${TOKEN_SYMBOL} token`, addr: null, pending: true },
];

/**
 * Where tokenURI points. The collection's 5,000 metadata files and images are
 * generated into this repo and served by the site itself, so there is nothing
 * to pin and nothing to pay for. It is centralised — if the host goes down the
 * metadata goes with it — and `setBaseURI` can move it to IPFS later without
 * redeploying anything.
 */
export const BASE_URI = `https://${'hoodesks.fun'}/assets/collection/metadata/`;

/**
 * Where the collection can land. A contract from a plain wallet takes an
 * address derived from the deployer and its nonce alone, so these are
 * knowable before it exists — which is what lets the site find the
 * deployment on its own instead of waiting for someone to paste an address
 * in. The browser confirms the right one by calling MAX_SUPPLY() on it, so
 * picking a wrong contract is impossible rather than unlikely.
 *
 * Regenerate with: node tools/predict.mjs
 * Deployer: 0x70a273Bb8225b0788c8C6970195871841d01959E
 */
export const COLLECTION_CANDIDATES = [
  '0x5223367bfCEEEA94eFC14CAF17289f29830AC012',
  '0x8379b6a0F69540b701e73A6bE6d6b305d169DC76',
  '0x22a1ecAfd3dC7E31beaE1e3bdB31D35EDA73F0f0',
  '0xD226F0CD12a0c55F1fF19d6D64D0b78D726E2E87',
  '0x8381bA3Ff7De61140F638192D055cacD772a5454',
  '0xF6c2685Bef5A827866B444e211a4e0a8D3f717a3',
  '0x5EdC478ada2F634bF71d82A6d85253CA47D77152',
  '0xe9f04c1c127000a4db53D09A4699C9c00f440f9F',
  '0xe99CAfE7AcA22A1Cf70E561B64ac6aC1da629011',
  '0x00F390da35845cfD314Af68FceF14bA501b91e3a',
  '0x6aEA8857E1b4ad90F916cE8Ee982efA941072526',
  '0xd74B13c42aD8D0Be540fe61411CD980CBE8A4267',
  '0xE42DDeD81Ec9Ed33A0159fe6e936A1A38bdDE8Fd',
  '0x4DE8E7e7A65b4D3Dd8EEc0a889be6Bb00cd334CD',
  '0x5d25f253B1b62A8824f760D06754f4903A019217',
  '0xC695addAD3fC80b0F3b5920c4D19f076e9Fb2048',
  '0x7dd7a031Ab743991e4613563f6C1688AC6C09A28',
  '0x01632b71d095A95D826D278B479A414782FC64A2',
  '0x8618f4437eA764118664249Cc33161aB771a7D6D',
  '0x8defAd111F053Ad8d7db16577629ba5d12446888',
  '0x90B7BF0796ACCE68ab35657563A71da4f2AC13c6',
  '0x64f2Da44AA3Eb0EeCC053c032d711D4F26e2fCa9',
  '0x41b7C0aE3D5E9Fea38488c79af14f391399b53f3',
  '0x16474404aeF6A4932E09c543097E2fcb73f9FcE5',
];

export const TOKEN = {
  symbol: TOKEN_SYMBOL,
  address: null,
  // Fixed at creation on the launchpad and immutable afterwards, so the
  // deposit has to be sized against it before the token exists.
  // supply x deposit must leave room: 5,000 x 100,000 burns 500M, half of it.
  supplyInitial: 1_000_000_000,
  pons: 'https://www.ponsfamily.com/launchpad/create',
};

/**
 * Brand mark for a stock token, served from this repo rather than hotlinked.
 * Each file is the company's own tile, background included, so it sits on
 * either theme without help. Refresh them with `node tools/logos.mjs`.
 */
export const tokenLogo = (sym) => `assets/img/tokens/${sym}.png`;

/* --- formatting helpers -------------------------------------------------- */
export const fmt = {
  int: (n) => Number(n).toLocaleString('en-US'),
  eth: (n, d = 4) => `${Number(n).toFixed(d)} ${CHAIN.currency}`,
  usd: (n) =>
    `$${Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  addr: (a, n = 4) => (a && a.length > 12 ? `${a.slice(0, n + 2)}…${a.slice(-n)}` : a),
  pct: (n, d = 1) => `${Number(n).toFixed(d)}%`,
};
