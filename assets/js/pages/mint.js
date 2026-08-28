/* HOODESKS — mint */

import { CHAIN, ECON, ROTATION, TOKEN, fmt } from '../config.js';
import * as api from '../data.js';
import { collection } from '../data.js';
import * as chain from '../chain.js';
import { boot, el, $, deskCanvas } from '../ui.js';

boot('mint.html');

const btn = $('#mint-btn');
const note = $('#mint-note');

let account = null;
let state = null;

/* -- static bits ---------------------------------------------------------- */

$('#mint-cost').replaceChildren(
  el('div', { class: 'mint__cell' },
    el('div', { class: 'k' }, TOKEN.symbol),
    el('div', { class: 'v' }, fmt.int(ECON.deposit))),
  el('div', { class: 'mint__cell' },
    el('div', { class: 'k' }, CHAIN.currency),
    el('div', { class: 'v' }, String(ECON.surcharge))),
);

const STEPS = [
  ['01', 'Mint',
   'The deposit is burned and an NFT is issued with a vault derived from it. ' +
   'Transferring the NFT transfers everything that vault holds.'],
  ['02', 'Earn',
   'Every round buys the next asset and credits your desk an equal share. ' +
   'This happens whether you do anything or not.'],
  ['03', 'Claim',
   "Pull everything owed into your desk's vault, all ten assets in one call. " +
   'Anyone can trigger it, and it deploys the vault the first time.'],
];

$('#steps').replaceChildren(...STEPS.map(([n, t, b]) =>
  el('div', { class: 'step' },
    el('div', { class: 'step__n' }, n),
    el('div', { class: 'step__t' }, t),
    el('div', { class: 'step__b' }, b))));

/* -- render --------------------------------------------------------------- */

function renderPreview(s) {
  const next = collection().tokens[s.minted] ?? collection().tokens[0];
  $('#mint-remaining').textContent =
    `${fmt.int(ECON.supply - s.minted)} of ${fmt.int(ECON.supply)} left`;
  $('#mint-preview').replaceChildren(
    el('span', { class: 'mint__art' }, deskCanvas(next)),
    el('div', {},
      el('div', { style: 'font-size:15px;font-weight:700' }, `Desk #${next.id}`),
      el('div', { style: 'margin-top:4px;font-size:11.5px;color:var(--muted)' },
        `Its own vault, earning across ${ROTATION.length} assets`),
      el('div', { style: 'margin-top:6px;font-size:10.5px;color:var(--muted-2);line-height:1.6' },
        [next.traits.Field, next.traits.Case, next.traits.Tube, next.traits.Screen].join(' · '))),
  );
}

function renderSteps(launch) {
  const host = $('#mint-steps');
  if (launch.live || !launch.steps.length) return host.replaceChildren();
  host.replaceChildren(
    el('div', { class: 'frame__head', style: 'margin:14px 0 8px' },
      el('h2', { class: 'frame__title' }, el('span', {}, 'Before it opens'))),
    el('ol', { class: 'todo' }, ...launch.steps.map((t) => el('li', {}, t))),
  );
}

function say(text, tone = '') {
  note.className = `note${tone ? ` note--${tone}` : ''}`;
  note.textContent = text;
}

function link(text, hash) {
  note.className = 'note note--gold';
  note.replaceChildren(`${text} `,
    el('a', { class: 'addr', href: chain.txUrl(hash), target: '_blank', rel: 'noreferrer' }, 'view'));
}

/* -- flow ----------------------------------------------------------------- */

async function refresh() {
  renderPreview(api.stats());
  const launch = api.launchStatus();
  renderSteps(launch);

  if (!launch.live) {
    btn.textContent = launch.label;
    btn.disabled = true;
    say(launch.note);
    return;
  }

  if (!chain.hasWallet()) {
    btn.textContent = 'No wallet found';
    btn.disabled = true;
    say('Install MetaMask to mint.');
    return;
  }

  if (!account) {
    btn.textContent = 'Connect wallet';
    btn.disabled = false;
    btn.onclick = doConnect;
    say(launch.note ?? `${fmt.int(ECON.deposit)} ${TOKEN.symbol} is burned inside the mint call.`);
    return;
  }

  const wallet = await chain.readWallet(account, state);
  const needed = state.depositAmount;

  if (wallet.balance < needed) {
    btn.textContent = `Not enough ${TOKEN.symbol}`;
    btn.disabled = true;
    say(`You hold ${fmt.int(wallet.balance / 10n ** 18n)} ${TOKEN.symbol}. A mint burns ` +
        `${fmt.int(ECON.deposit)}. Buy some on ${CHAIN.launchpad} first.`);
    return;
  }

  btn.disabled = false;
  if (wallet.allowance < needed) {
    btn.textContent = `Approve ${TOKEN.symbol}`;
    btn.onclick = doApprove;
    say(`One approval, then the mint. ${fmt.int(ECON.deposit)} ${TOKEN.symbol} is burned ` +
        'inside the mint call — there is no version of this where a desk exists and the ' +
        'supply did not go down.');
  } else {
    btn.textContent = `Mint for ${ECON.surcharge} ${CHAIN.currency}`;
    btn.onclick = doMint;
    say(launch.note ?? `Approved. Minting burns ${fmt.int(ECON.deposit)} ${TOKEN.symbol}.`);
  }
}

async function guard(label, fn) {
  const before = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    await fn();
  } catch (err) {
    // 4001 is the visitor closing the wallet popup — not an error worth alarm.
    const cancelled = err?.code === 4001;
    say(cancelled ? 'Cancelled in the wallet.' : (err?.message ?? String(err)),
        cancelled ? '' : 'alert');
    btn.textContent = before;
    btn.disabled = false;
  }
}

const doConnect = () => guard('Connecting…', async () => {
  account = await chain.connect();
  await refresh();
  await renderMine();
});

const doApprove = () => guard('Approving…', async () => {
  const hash = await chain.approve(account, state);
  link('Approving —', hash);
  await chain.waitFor(hash);
  await refresh();
});

const doMint = () => guard('Minting…', async () => {
  const hash = await chain.mint(account, state);
  link('Minting —', hash);
  await chain.waitFor(hash);
  state = await chain.readState();
  await refresh();
  say('Minted. Your desk is live and earning from the next round.', 'gold');
  await renderMine();
});

/* -- your desks ----------------------------------------------------------- */

async function renderMine() {
  const host = $('#my-desks');
  const empty = (t) => el('div', { class: 'rows__empty', style: 'padding:28px 16px' }, t);

  if (!state) return host.replaceChildren(empty('Nothing yet — the mint has not opened.'));
  if (!account) return host.replaceChildren(empty('Connect a wallet to view your desks.'));

  host.replaceChildren(empty('Looking…'));
  const ids = await chain.desksOf(account, state);

  host.replaceChildren(
    ids.length
      ? el('div', {}, ...ids.map((id) => {
          const token = collection().tokens[id - 1];
          return el('a', { class: 'row', href: `desk.html?id=${id}` },
            el('span', { class: 'row__art' }, deskCanvas(token)),
            el('span', { class: 'row__main' },
              el('span', { class: 'row__t' }, `Desk #${id}`),
              el('span', { class: 'row__s' },
                `Rank ${fmt.int(token.rank)} of ${fmt.int(ECON.supply)}`)));
        }))
      : empty('No desks in this wallet yet.'),
  );
}

/* -- boot ----------------------------------------------------------------- */

(async () => {
  state = await api.sync();
  await refresh();
  await renderMine();

  window.ethereum?.on?.('accountsChanged', async (a) => {
    account = a[0] ?? null;
    await refresh();
    await renderMine();
  });
})();
