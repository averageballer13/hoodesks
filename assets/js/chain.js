/* ==========================================================================
   HOODESKS — the chain
   --------------------------------------------------------------------------
   Reads go through the public RPC so anyone sees live numbers without a
   wallet. Writes go through the visitor's wallet.

   The collection is found rather than configured. A contract deployed by a
   plain wallet takes an address derived from the deployer and its nonce, so
   COLLECTION_CANDIDATES holds every address it could occupy; this asks each
   for code and confirms the real one by calling MAX_SUPPLY(). That means the
   site goes live the moment the contract is deployed, with nobody editing a
   file afterwards.
   ========================================================================== */

import { CHAIN, COLLECTION_CANDIDATES, ECON } from './config.js';
import { encodeAddress, encodeUint } from './abi.js';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;
const CHAIN_HEX = '0x1237';
const CACHE_KEY = 'hoodesks-collection';

/* Selectors, precomputed so no keccak has to ship to the browser.
   Regenerate with the one-liner in tools/ if the ABI ever changes. */
const SEL = {
  MAX_SUPPLY: '0x32cb6b0c',
  totalMinted: '0xa2309ff8',
  roundCount: '0x127f0b3f',
  totalConverted: '0x97fd3613',
  nextAsset: '0xb0fdc75b',
  SURCHARGE: '0x37642394',
  depositToken: '0xc89039c5',
  depositAmount: '0x419759f5',
  swapAdapter: '0x77bb1eb9',
  vaultOf: '0xdaa0bfba',
  pendingOf: '0x7e7feaa7',
  ownerOf: '0x6352211e',
  balanceOf: '0x70a08231',
  mint: '0x1249c58b',
  claim: '0x379607f5',
  approve: '0x095ea7b3',
  allowance: '0xdd62ed3e',
};

/* -- transport ------------------------------------------------------------ */

let rpcId = 0;

async function call(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'RPC error');
  return json.result;
}

const ethCall = (to, data) => call('eth_call', [{ to, data }, 'latest']);
const asUint = (hex) => (hex && hex !== '0x' ? BigInt(hex) : 0n);
const asAddress = (hex) => `0x${String(hex).slice(-40)}`;

/* -- discovery ------------------------------------------------------------ */

let found;

/** The deployed collection, or null if it does not exist yet. */
export async function collectionAddress() {
  if (found !== undefined) return found;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      // Still confirm it — a cached address from a wiped testnet would lie.
      if (await isCollection(cached)) return (found = cached);
      localStorage.removeItem(CACHE_KEY);
    }
  } catch { /* private mode */ }

  for (const candidate of COLLECTION_CANDIDATES) {
    try {
      const code = await call('eth_getCode', [candidate, 'latest']);
      if (!code || code === '0x') continue;
      if (!(await isCollection(candidate))) continue;
      try { localStorage.setItem(CACHE_KEY, candidate); } catch { /* private mode */ }
      return (found = candidate);
    } catch { /* keep looking */ }
  }
  return (found = null);
}

/** Confirm a contract really is ours before trusting a number off it. */
async function isCollection(address) {
  try {
    const supply = asUint(await ethCall(address, SEL.MAX_SUPPLY));
    return supply === BigInt(ECON.supply);
  } catch {
    return false;
  }
}

/* -- reads ---------------------------------------------------------------- */

/** Live protocol state, or null if nothing is deployed. */
export async function readState() {
  const address = await collectionAddress();
  if (!address) return null;

  const [minted, rounds, converted, next, surcharge, token, deposit, adapter, pot] =
    await Promise.all([
      ethCall(address, SEL.totalMinted),
      ethCall(address, SEL.roundCount),
      ethCall(address, SEL.totalConverted),
      ethCall(address, SEL.nextAsset),
      ethCall(address, SEL.SURCHARGE),
      ethCall(address, SEL.depositToken),
      ethCall(address, SEL.depositAmount),
      ethCall(address, SEL.swapAdapter),
      call('eth_getBalance', [address, 'latest']),
    ]);

  const adapterAddress = asAddress(adapter);

  return {
    address,
    minted: Number(asUint(minted)),
    rounds: Number(asUint(rounds)),
    converted: Number(asUint(converted)) / 1e18,
    nextAsset: Number(asUint(next)),
    surcharge: asUint(surcharge),
    depositToken: asAddress(token),
    depositAmount: asUint(deposit),
    // Without an adapter the pot fills but no round can fire.
    adapter: adapterAddress === '0x0000000000000000000000000000000000000000' ? null : adapterAddress,
    pot: Number(asUint(pot)) / 1e18,
  };
}

/** The wallet's balance and allowance of the deposit token. */
export async function readWallet(account, state) {
  const [balance, allowance] = await Promise.all([
    ethCall(state.depositToken, SEL.balanceOf + encodeAddress(account)),
    ethCall(state.depositToken, SEL.allowance + encodeAddress(account) + encodeAddress(state.address)),
  ]);
  return { balance: asUint(balance), allowance: asUint(allowance) };
}

/** Which desks an address holds. Walks the minted range; fine at 5,000. */
export async function desksOf(account, state) {
  const owned = [];
  const lower = account.toLowerCase();
  for (let id = 1; id <= state.minted; id++) {
    try {
      const owner = asAddress(await ethCall(state.address, SEL.ownerOf + encodeUint(id)));
      if (owner.toLowerCase() === lower) owned.push(id);
    } catch { /* burned or missing */ }
  }
  return owned;
}

/* -- writes --------------------------------------------------------------- */

const provider = () => window.ethereum;
export const hasWallet = () => Boolean(provider());

const send = (method, params = []) => provider().request({ method, params });

/** Connect, and make sure the wallet is on Robinhood Chain. */
export async function connect() {
  if (!provider()) throw new Error('No wallet found. Install MetaMask.');
  const [account] = await send('eth_requestAccounts');

  if (Number(await send('eth_chainId')) !== CHAIN_ID) {
    try {
      await send('wallet_switchEthereumChain', [{ chainId: CHAIN_HEX }]);
    } catch (err) {
      if (err?.code !== 4902) throw err;
      await send('wallet_addEthereumChain', [{
        chainId: CHAIN_HEX,
        chainName: CHAIN.name,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [RPC],
        blockExplorerUrls: [CHAIN.explorer],
      }]);
    }
  }
  return account;
}

/** Approve the collection to take the deposit. */
export async function approve(account, state) {
  const data = SEL.approve + encodeAddress(state.address) + encodeUint(state.depositAmount);
  return send('eth_sendTransaction', [{ from: account, to: state.depositToken, data }]);
}

/** Mint one desk. The deposit is burned inside this call. */
export async function mint(account, state) {
  return send('eth_sendTransaction', [{
    from: account,
    to: state.address,
    data: SEL.mint,
    value: '0x' + state.surcharge.toString(16),
  }]);
}

/** Deliver everything a desk is owed into its vault. */
export async function claim(account, state, tokenId) {
  const data = SEL.claim + encodeUint(tokenId);
  return send('eth_sendTransaction', [{ from: account, to: state.address, data }]);
}

/** Block until a transaction is mined. */
export async function waitFor(hash, tries = 150) {
  for (let i = 0; i < tries; i++) {
    const receipt = await call('eth_getTransactionReceipt', [hash]);
    if (receipt) {
      if (receipt.status !== '0x1') throw new Error('Transaction reverted');
      return receipt;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for the transaction');
}

export const txUrl = (hash) => `${CHAIN.explorer}/tx/${hash}`;
