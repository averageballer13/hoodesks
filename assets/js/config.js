/* ==========================================================================
   HOODESKS — protocol configuration
   --------------------------------------------------------------------------
   Single source of truth. Every number, address, ticker and label the UI
   renders is read from here, so re-pointing the front end at a real
   deployment is a one-file edit.
   ========================================================================== */

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
  ticker: 'DESKS',
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
  deposit: 1_000_000,         // $DESKS burned per mint
  surcharge: 0.05,            // ETH, charged by the mint instruction
  surchargeToPot: 0.045,      // ETH
  surchargeToProtocol: 0.005, // ETH
  royaltyPct: 5,              // EIP-2981, declared on the collection
  roundThreshold: 0.01,       // ETH — pot fires the moment it clears this
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
   Placeholders until the contracts are live. The `pot` and `config`
   addresses are deterministic (CREATE2), the rest are read off `config`.
   ------------------------------------------------------------------------ */
export const ACCOUNTS = [
  { label: 'Protocol',        addr: '0x9E4b7C210aD8f635B01cE97a24Df8560B3aC1e79' },
  { label: 'Pot',             addr: '0x2C81eF05a736B9d4C0a18E63F5b207Da49C6E831' },
  { label: 'Treasury',        addr: '0x64Da39C7bE015f82A4c9D06B738E1a5C20F4b9D6' },
  { label: 'Config',          addr: '0xB157aC03D9e64F82b5a107C6E238D40915Fa7C2E' },
  { label: 'Collection',      addr: '0x0dE85F3a41C79b620Da4c1E85736F029A8bC4D51' },
  { label: 'Vault implementation', addr: '0x7B2f90cE614aD3508b7eA1C96D247F350aE8B1C3' },
];

export const TOKEN = {
  symbol: 'DESKS',
  address: '0xD3E5k...pending',
  supplyInitial: 1_000_000_000,
  pons: 'https://pons.xyz',
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
