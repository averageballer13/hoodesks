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
  launchpadUrl: 'https://pons.xyz',
  explorer: 'https://explorer.robinhood.com',
  explorerAccount: (a) => `${CHAIN.explorer}/address/${a}`,
  explorerTx: (h) => `${CHAIN.explorer}/tx/${h}`,
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
   ------------------------------------------------------------------------ */
export const ROTATION = [
  { i: 1,  sym: 'AAPL',       name: 'Apple',       addr: '0x7A1c9E4bD2f83A05C6eE1b74F9d0aB35c2E8F410' },
  { i: 2,  sym: 'MSFT',       name: 'Microsoft',   addr: '0x3F82Db6C15aE9047bB2c8E5d13F76A0e94C1D2b8' },
  { i: 3,  sym: 'NVDA',       name: 'Nvidia',      addr: '0xB4e07C93a2D1f65E8c40Ab7219dF3E5a86C0b7D2' },
  { i: 4,  sym: 'AMZN',       name: 'Amazon',      addr: '0x91Ac53E7b8D0f24C6a13eB9F507D2c84A1e6F3B0' },
  { i: 5,  sym: 'HOOD',       name: 'Robinhood',   addr: '0x00C8052Ef4a91D7b36C05eA8B1f92D473Ac6E815' },
  { i: 6,  sym: 'CRCL',       name: 'Circle',      addr: '0x5D3bA209cE71f48B6a0dC93E2f815B7a04E9C6D1' },
  { i: 7,  sym: 'SPCX',       name: 'SpaceX',      addr: '0xE28f4C71bD905A63e1c7F02aB84D9635C0a1E7B4' },
  { i: 8,  sym: 'ANTHROPIC',  name: 'Anthropic',   addr: '0xA1b73E0cF925D64a8B1e05C7D2f9386Ea40C5B71' },
  { i: 9,  sym: 'POLYMARKET', name: 'Polymarket',  addr: '0xC70eB1a4D5f823906Ac1eF74B0d29A63E85C0f12' },
  { i: 10, sym: 'KALSHI',     name: 'Kalshi',      addr: '0xF6019dA3bC48e725D0a3F91cB27E64085Ba2C9E3' },
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
