/* HOODESKS — mint */

import { CHAIN, ECON, TOKEN, ROTATION, fmt } from '../config.js';
import * as api from '../data.js';
import { collection } from '../data.js';
import { boot, el, $, deskCanvas } from '../ui.js';

boot('mint.html');

const s = api.stats();
const next = collection().tokens[s.minted] ?? collection().tokens[0];

/* -- remaining ------------------------------------------------------------ */
$('#mint-remaining').textContent =
  `${fmt.int(ECON.supply - s.minted)} of ${fmt.int(ECON.supply)} left`;

/* -- cost ----------------------------------------------------------------- */
$('#mint-cost').replaceChildren(
  el('div', { class: 'mint__cell' },
    el('div', { class: 'k' }, TOKEN.symbol),
    el('div', { class: 'v' }, fmt.int(ECON.deposit))),
  el('div', { class: 'mint__cell' },
    el('div', { class: 'k' }, CHAIN.currency),
    el('div', { class: 'v' }, String(ECON.surcharge))),
);

/* -- preview -------------------------------------------------------------- */
$('#mint-preview').replaceChildren(
  el('span', { class: 'mint__art' }, deskCanvas(next)),
  el('div', {},
    el('div', { style: 'font-size:15px;font-weight:700' }, `Desk #${next.id}`),
    el('div', { style: 'margin-top:4px;font-size:11.5px;color:var(--muted)' },
      `Its own vault, earning across ${ROTATION.length} assets`),
    el('div', { style: 'margin-top:6px;font-size:10.5px;color:var(--muted-2);line-height:1.6' },
      next.traits.Field + ' · ' + next.traits.Case + ' · ' + next.traits.Tube + ' · ' + next.traits.Screen)),
);

/* -- action --------------------------------------------------------------- */
const btn = $('#mint-btn');
if (s.launched) {
  btn.textContent = 'Connect a wallet';
  btn.disabled = false;
  btn.addEventListener('click', () => {
    // Wallet flow goes here — see assets/js/data.js for the seam.
    btn.textContent = 'Wallet connector not wired yet';
    btn.disabled = true;
  });
} else {
  btn.textContent = 'Mint opens at launch';
}

$('#mint-note').textContent =
  `${ECON.activationGas} ${CHAIN.currency} of gas to deploy the vault, once. ` +
  `The ${fmt.int(ECON.deposit)} ${TOKEN.symbol} deposit is burned inside the mint call — ` +
  `there is no version of this where a desk exists and the supply did not go down.`;

/* -- your desks ----------------------------------------------------------- */
{
  const mine = api.myDesks();
  $('#my-desks').replaceChildren(
    mine.connected && mine.desks.length
      ? el('div', {}, ...mine.desks.map((d) =>
          el('a', { class: 'row', href: `desk.html?id=${d.token.id}` },
            el('span', { class: 'row__art' }, deskCanvas(d.token)),
            el('span', { class: 'row__main' },
              el('span', { class: 'row__t' }, `Desk #${d.token.id}`),
              el('span', { class: 'row__s' }, d.active ? 'Active' : 'Needs activation')),
            el('span', { class: 'row__v' }, fmt.usd(d.value)))))
      : el('div', { class: 'rows__empty', style: 'padding:28px 16px' },
          'Connect a wallet to view your desks.'),
  );
}

/* -- steps ---------------------------------------------------------------- */
const STEPS = [
  ['01', 'Mint',
   `The deposit is burned and an NFT is issued with a vault derived from it. ` +
   `Transferring the NFT transfers everything that vault holds.`],
  ['02', 'Activate',
   `The desk deploys its own vault contract. Until it exists there is nowhere ` +
   `for a round to deliver to.`],
  ['03', 'Earn',
   `Each round buys the next asset and credits every active desk an equal ` +
   `share, delivered into its own vault.`],
];

$('#steps').replaceChildren(
  ...STEPS.map(([n, t, b]) =>
    el('div', { class: 'step' },
      el('div', { class: 'step__n' }, n),
      el('div', { class: 'step__t' }, t),
      el('div', { class: 'step__b' }, b))),
);
