/* HOODESKS — one-click deploy
   Builds the creation transaction and hands it to the browser wallet. No key
   is read, typed or stored: the wallet signs, this page only encodes. */

import { ACCOUNTS, CHAIN, ECON, ROTATION, TOKEN, fmt } from '../config.js';
import { BUILD, CONSTRUCTOR, HOODESKS_BYTECODE } from '../contract.js';
import { deployData, toUnits } from '../abi.js';
import { boot, el, $, tokenMark } from '../ui.js';

boot('');

const NETWORKS = {
  4663: {
    hex: '0x1237',
    name: 'Robinhood Chain',
    rpc: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robinhoodchain.blockscout.com',
    live: true,
  },
  46630: {
    hex: '0xb626',
    name: 'Robinhood Chain Testnet',
    rpc: 'https://rpc.testnet.chain.robinhood.com',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
    live: false,
  },
};

const eth = () => window.ethereum;
const rpc = (method, params = []) => eth().request({ method, params });

let account = null;
let chainId = null;

/* -- prefill ------------------------------------------------------------- */

$('#build-pill').textContent = `build ${BUILD.slice(0, 8)}`;
$('#p-amount').value = String(ECON.deposit);
$('#p-protocol').value = ACCOUNTS[0].addr ?? '';
$('#p-token').value = TOKEN.address ?? '';

$('#rotation').replaceChildren(...ROTATION.map((a) =>
  el('span', { class: 'chip', title: a.addr },
    el('span', { class: 'i' }, String(a.i).padStart(2, '0')),
    tokenMark(a.sym, 'xs'),
    a.sym)));

/* -- wallet -------------------------------------------------------------- */

function paintWallet() {
  const pill = $('#net-pill');
  const info = $('#wallet-info');

  if (!account) {
    pill.textContent = 'Not connected';
    pill.className = 'pill';
    info.className = 'note';
    info.textContent = eth() ? 'No wallet connected.' : 'No browser wallet found. Install MetaMask.';
    return refresh();
  }

  const net = NETWORKS[chainId];
  pill.textContent = net ? net.name : `Unsupported chain ${chainId}`;
  pill.className = net ? (net.live ? 'pill pill--gold' : 'pill pill--brand') : 'pill';

  info.className = net ? 'note' : 'note note--alert';
  info.replaceChildren(
    el('div', {}, el('b', {}, 'Account '), account),
    el('div', { style: 'margin-top:4px' },
      el('b', {}, 'Chain '), net ? `${net.name} · ${chainId}` : `${chainId} — not Robinhood Chain`),
  );
  refresh();
}

async function connect() {
  if (!eth()) return paintWallet();
  const accounts = await rpc('eth_requestAccounts');
  account = accounts[0];
  chainId = Number(await rpc('eth_chainId'));
  if (!$('#p-owner').value) $('#p-owner').placeholder = account;
  paintWallet();
}

async function switchTo(id) {
  const net = NETWORKS[id];
  try {
    await rpc('wallet_switchEthereumChain', [{ chainId: net.hex }]);
  } catch (err) {
    // 4902: the wallet does not know this chain yet.
    if (err?.code !== 4902) throw err;
    await rpc('wallet_addEthereumChain', [{
      chainId: net.hex,
      chainName: net.name,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: [net.rpc],
      blockExplorerUrls: [net.explorer],
    }]);
  }
  chainId = Number(await rpc('eth_chainId'));
  paintWallet();
}

$('#connect').addEventListener('click', () => connect().catch(fail));
$('#to-testnet').addEventListener('click', () => switchTo(46630).catch(fail));
$('#to-mainnet').addEventListener('click', () => switchTo(4663).catch(fail));

if (eth()) {
  eth().on?.('accountsChanged', (a) => { account = a[0] ?? null; paintWallet(); });
  eth().on?.('chainChanged', (c) => { chainId = Number(c); paintWallet(); });
}

/* -- args ---------------------------------------------------------------- */

function readArgs() {
  const owner = $('#p-owner').value.trim() || account;
  return [
    $('#p-token').value.trim(),
    toUnits($('#p-amount').value.trim() || '0'),
    $('#p-protocol').value.trim(),
    ROTATION.map((r) => r.addr),
    $('#p-uri').value.trim(),
    owner,
  ];
}

/* -- preflight ----------------------------------------------------------- */

async function hasCode(addr) {
  const code = await rpc('eth_getCode', [addr, 'latest']);
  return code && code !== '0x';
}

async function preflight() {
  const host = $('#checks');
  const lines = [];
  const push = (ok, text) => lines.push({ ok, text });

  if (!account) { push(false, 'No wallet connected'); return render(); }
  const net = NETWORKS[chainId];
  if (!net) { push(false, `Chain ${chainId} is not Robinhood Chain`); return render(); }
  push(true, `Connected to ${net.name}`);

  const [token, amount, protocol, rotation, uri, owner] = readArgs();

  const bal = BigInt(await rpc('eth_getBalance', [account, 'latest']));
  push(bal > 0n, bal > 0n
    ? `Deployer holds ${(Number(bal) / 1e18).toFixed(5)} ETH`
    : 'Deployer has no ETH — bridge some first');

  for (const [label, addr] of [['Protocol wallet', protocol], ['Owner', owner]]) {
    push(/^0x[0-9a-fA-F]{40}$/.test(addr), `${label} ${addr || 'missing'}`);
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(token)) {
    push(false, 'Deposit token is not an address');
  } else {
    const ok = await hasCode(token);
    push(ok, ok ? 'Deposit token has code on this chain' : 'Deposit token has NO code on this chain');
  }

  push(amount > 0n, `Deposit ${fmt.int($('#p-amount').value)} per mint`);

  const burned = Number(ECON.supply) * Number($('#p-amount').value || 0);
  const fits = burned <= TOKEN.supplyInitial;
  push(fits, fits
    ? `Sell-out burns ${(burned / 1e6).toFixed(0)}M of a ${(TOKEN.supplyInitial / 1e9).toFixed(1)}B supply`
    : `Sell-out needs ${(burned / 1e6).toFixed(0)}M but supply is only ${(TOKEN.supplyInitial / 1e6).toFixed(0)}M`);

  push(uri.endsWith('/'), uri
    ? (uri.endsWith('/') ? `Base URI ${uri}` : `Base URI must end with a slash: ${uri}`)
    : 'Base URI is empty');

  // The rotation is the slow one: ten round trips.
  let missing = 0;
  for (const addr of rotation) if (!(await hasCode(addr))) missing++;
  push(missing === 0, missing === 0
    ? `All ${rotation.length} rotation tokens have code on this chain`
    : `${missing} of ${rotation.length} rotation tokens have NO code here` +
      (net.live ? '' : ' — expected on testnet, the stock tokens only exist on mainnet'));

  function render() {
    const allOk = lines.every((l) => l.ok);
    host.className = 'note';
    host.replaceChildren(
      el('div', { class: 'checks' }, ...lines.map((l) =>
        el('div', { class: `checks__l ${l.ok ? 'is-ok' : 'is-no'}` },
          el('span', { class: 'checks__m' }, l.ok ? '✓' : '✕'),
          el('span', {}, l.text)))),
    );
    return allOk;
  }
  return render();
}

$('#check').addEventListener('click', () => {
  $('#checks').textContent = 'Checking…';
  preflight().then(refresh).catch(fail);
});

/* -- deploy -------------------------------------------------------------- */

function refresh() {
  const net = NETWORKS[chainId];
  const mainnet = net?.live === true;
  $('#confirm-row').style.display = mainnet ? '' : 'none';
  const confirmed = !mainnet || $('#confirm').checked;
  $('#deploy').disabled = !account || !net || !confirmed;
  $('#deploy').textContent = mainnet ? 'Deploy to mainnet' : 'Deploy to testnet';
}
$('#confirm').addEventListener('change', refresh);

$('#deploy').addEventListener('click', async () => {
  const btn = $('#deploy');
  const out = $('#result');
  try {
    const types = CONSTRUCTOR.map((c) => c.type);
    const values = readArgs();
    const data = deployData(HOODESKS_BYTECODE, types, values);

    btn.disabled = true;
    out.className = 'note';
    out.textContent = 'Waiting for the wallet to sign…';

    const hash = await rpc('eth_sendTransaction', [{ from: account, data }]);
    out.replaceChildren(el('div', {}, 'Submitted ', el('code', {}, hash), ' — waiting for the receipt…'));

    const receipt = await waitForReceipt(hash);
    if (receipt.status !== '0x1') throw new Error('Transaction reverted');

    const address = receipt.contractAddress;
    const net = NETWORKS[chainId];

    out.className = 'note note--gold';
    out.replaceChildren(
      el('div', { style: 'font-weight:700;margin-bottom:8px' }, 'Deployed'),
      el('div', {}, 'Collection ',
        el('a', { class: 'addr', href: `${net.explorer}/address/${address}`, target: '_blank', rel: 'noreferrer' }, address)),
      el('div', { style: 'margin-top:10px' }, 'Paste into assets/js/config.js:'),
      el('pre', { class: 'snippet' },
        `  { label: 'Collection · pot', addr: '${address}' },\n` +
        `  { label: '$${TOKEN.symbol} token', addr: '${values[0]}' },`),
      el('div', { style: 'margin-top:10px' },
        'Still to do: deploy a swap adapter and call setSwapAdapter, repoint the ' +
        'Pons creator-fee wallet here, hand ownership to a multisig, then flip ' +
        'LAUNCHED in data.js.'),
    );
  } catch (err) {
    fail(err);
  } finally {
    refresh();
  }
});

async function waitForReceipt(hash, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const r = await rpc('eth_getTransactionReceipt', [hash]);
    if (r) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error('Timed out waiting for the receipt — check the explorer');
}

function fail(err) {
  const out = $('#result');
  out.className = 'note note--alert';
  // Wallet rejections carry code 4001 and a message worth showing as-is.
  out.textContent = err?.message ?? String(err);
  console.error(err);
}

paintWallet();
