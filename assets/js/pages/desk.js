/* HOODESKS — a single desk */

import { BRAND, CHAIN, ECON, fmt } from '../config.js';
import * as api from '../data.js';
import { collection, deskById } from '../data.js';
import { LAYER_NAMES, traitLine } from '../desks.js';
import { boot, el, $, deskCanvas } from '../ui.js';

boot('collection.html');

const page = $('#page');
const id = Number(new URLSearchParams(location.search).get('id') || 1);
const token = deskById(id);

if (!token) {
  page.replaceChildren(
    el('section', { class: 'frame ptitle' },
      el('div', { class: 'frame__in' },
        el('h1', {}, 'No such desk'),
        el('p', {}, `Desks run from #1 to #${fmt.int(ECON.supply)}.`),
        el('div', { style: 'margin-top:14px' },
          el('a', { class: 'btn btn--primary', href: 'collection.html' }, 'Browse the collection')))),
  );
} else {
  document.title = `Desk #${token.id} · ${BRAND.name}`;
  render();
}

function render() {
  const { counts, tokens } = collection();
  const total = tokens.length;
  const prev = token.id > 1 ? token.id - 1 : null;
  const next = token.id < total ? token.id + 1 : null;

  /* -- title ------------------------------------------------------------- */
  const title = el('section', { class: 'frame ptitle' },
    el('div', { class: 'frame__in' },
      el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap' },
        el('h1', {}, `Desk #${fmt.int(token.id)}`, el('span', { class: 'cursor', 'aria-hidden': true })),
        el('div', { style: 'display:flex;gap:6px' },
          el('a', { class: 'btn btn--ghost btn--sm', href: prev ? `desk.html?id=${prev}` : '#', 'aria-disabled': !prev, style: prev ? '' : 'opacity:.35;pointer-events:none' }, '←'),
          el('a', { class: 'btn btn--ghost btn--sm', href: next ? `desk.html?id=${next}` : '#', 'aria-disabled': !next, style: next ? '' : 'opacity:.35;pointer-events:none' }, '→'))),
      el('p', {}, traitLine(token))));

  /* -- art + facts ------------------------------------------------------- */
  const art = el('div', { class: 'frame' },
    el('div', { class: 'frame__in', style: 'padding:5px' },
      el('div', { class: 'detail__art' }, deskCanvas(token))));

  const status = api.stats();
  const minted = token.id <= status.minted;

  const facts = el('div', { class: 'frame' },
    el('div', { class: 'frame__in' },
      el('div', { class: 'frame__head' },
        el('h2', { class: 'frame__title' },
          minted ? el('span', { class: 'lamp', 'aria-hidden': true }) : null,
          el('span', {}, 'Status')),
        el('span', { class: minted ? 'pill pill--brand' : 'pill' }, minted ? 'Live' : 'Unminted')),
      el('div', {},
        kv('Serial', `#${fmt.int(token.id)} of ${fmt.int(total)}`),
        kv('Rarity rank', `#${fmt.int(token.rank)}`),
        kv('Rarity score', token.rarity.toFixed(1)),
        kv('Deposit', `${fmt.int(ECON.deposit)} ${BRAND.ticker}`),
        kv('Chain', CHAIN.name))));

  /* -- traits ------------------------------------------------------------ */
  const traits = el('section', { class: 'frame' },
    el('div', { class: 'frame__in' },
      el('div', { class: 'frame__head' },
        el('h2', { class: 'frame__title' }, el('span', {}, 'Traits')),
        el('span', { style: 'font-size:10.5px;color:var(--muted)' }, `${LAYER_NAMES.length} layers`)),
      el('div', { class: 'traits' },
        ...LAYER_NAMES.map((layer) => {
          const value = token.traits[layer];
          const n = counts[layer][value] ?? 0;
          return el('div', { class: 'trait' },
            el('div', { class: 'trait__k' }, layer),
            el('div', { class: 'trait__v' }, value),
            el('div', { class: 'trait__p' }, `${((n / total) * 100).toFixed(1)}% · ${fmt.int(n)}`));
        }))));

  /* -- vault ------------------------------------------------------------- */
  const rows = api.holdings(token.id);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  const vault = el('section', { class: 'frame' },
    el('div', { class: 'frame__in' },
      el('div', { class: 'frame__head' },
        el('h2', { class: 'frame__title' }, el('span', {}, 'The vault')),
        el('span', { style: 'font-size:12px;font-weight:700', class: 'tnum brand' }, fmt.usd(totalValue))),
      el('div', { class: 'tw' },
        el('table', { class: 't' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Asset'), el('th', { class: 'r' }, 'Units'), el('th', { class: 'r' }, 'Value'))),
          el('tbody', {}, ...rows.map((r) =>
            el('tr', {},
              el('td', {}, el('span', { class: 'em' }, r.sym),
                el('span', { class: 'dim', style: 'margin-left:8px;font-size:11px' }, r.name)),
              el('td', { class: 'r' }, r.units.toFixed(4)),
              el('td', { class: 'r' }, fmt.usd(r.value))))))),
      el('p', { class: 'frame__cap' },
        'The vault is owned by the NFT, not by the wallet holding it. Transferring the ' +
        'desk transfers the vault, its balances, and anything a round has credited but ' +
        'not yet delivered.')));

  page.replaceChildren(
    title,
    el('div', { class: 'detail' }, art, facts),
    traits,
    vault,
  );
}

function kv(k, v) {
  return el('div', { class: 'kv' },
    el('span', { class: 'kv__k' }, k),
    el('span', { class: 'kv__v' }, v));
}
