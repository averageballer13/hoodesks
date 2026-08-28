/* HOODESKS — home */

import { BRAND, ECON, TOKEN, fmt } from '../config.js';
import { collection } from '../data.js';
import * as api from '../data.js';
import { boot, el, $, deskCanvas, makePager } from '../ui.js';

boot('index.html');

const PER_PAGE = 10;

/* -- hero lede ------------------------------------------------------------ */
$('#hero-lede').textContent = BRAND.tagline;

/* -- eight preview desks -------------------------------------------------- */
{
  const { tokens } = collection();
  // Spread across the collection rather than the first eight, so the strip
  // shows the range of the art instead of one corner of it.
  const step = Math.floor(tokens.length / 8);
  const picks = Array.from({ length: 8 }, (_, i) => tokens[i * step]);
  $('#desk-preview').replaceChildren(
    ...picks.map((t) =>
      el('a', { class: 'desk', href: `desk.html?id=${t.id}`, title: `Desk #${t.id}` }, deskCanvas(t))),
  );
}

/* -- stats bar ------------------------------------------------------------ */
{
  const s = api.stats();
  $('#minted-count').textContent = fmt.int(s.minted);
  $('#supply-count').textContent = fmt.int(s.supply);

  const cells = [
    { k: 'Minted', v: `${fmt.int(s.minted)} / ${fmt.int(s.supply)}`, tone: '' },
    { k: 'Live desks', v: fmt.int(s.liveDesks), tone: '' },
    { k: `${TOKEN.symbol} burned`, v: fmt.int(s.burned), tone: 'is-brand' },
    { k: 'Buys next', v: s.buysNext, tone: 'is-gold' },
    { k: 'Paid to holders', v: fmt.usd(s.paidToHolders), tone: 'is-head' },
  ];

  $('#stats').replaceChildren(
    el('span', { class: 'statsbar__lamp', 'aria-hidden': true }, el('span', { class: 'lamp' })),
    ...cells.map((c) =>
      el('div', { class: 'stat' },
        el('div', { class: 'stat__k' }, c.k),
        el('div', { class: `stat__v ${c.tone}` }, c.v))),
  );
}

/* -- leaderboard ---------------------------------------------------------- */

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'yours', label: 'Yours' },
  { id: 'burns', label: 'Burns' },
];

let active = 'all';
let page = 0;

const rowsHost = $('#rows');
const pager = makePager((p) => { page = p; render(); });
$('#pager').replaceWith(pager);

const tabsHost = $('#tabs');

function dataFor(id) {
  if (id === 'all') return api.leaderboard();
  if (id === 'burns') return api.burns();
  return api.myDesks().desks;
}

function emptyFor(id) {
  const s = api.stats();
  if (!s.launched) return 'Nothing yet — the mint has not opened.';
  if (id === 'yours') return 'Connect a wallet to view your desks.';
  if (id === 'burns') return 'No burns yet.';
  return 'No desks minted yet.';
}

function renderRow(item, i, kind) {
  if (kind === 'burns') {
    return el('a', { class: 'row', href: `desk.html?id=${item.token.id}` },
      el('span', { class: 'row__n' }, fmt.int(i + 1)),
      el('span', { class: 'row__art' }, deskCanvas(item.token)),
      el('span', { class: 'row__main' },
        el('span', { class: 'row__t' }, `Desk #${item.token.id}`),
        el('span', { class: 'row__s' }, 'Deposit burned')),
      el('span', { class: 'row__v is-brand' }, `−${fmt.int(item.amount)}`));
  }
  return el('a', { class: 'row', href: `desk.html?id=${item.token.id}` },
    el('span', { class: 'row__n' }, fmt.int(i + 1)),
    el('span', { class: 'row__art' }, deskCanvas(item.token)),
    el('span', { class: 'row__main' },
      el('span', { class: 'row__t' }, `Desk #${item.token.id}`),
      el('span', { class: 'row__s' }, `Rank ${fmt.int(item.token.rank)} of ${fmt.int(ECON.supply)}`)),
    el('span', { class: 'row__v' }, fmt.usd(item.value)));
}

function renderTabs() {
  const counts = { all: api.leaderboard().length, burns: api.burns().length };
  tabsHost.replaceChildren(
    ...TABS.map((t, i) => [
      i === 1 ? el('span', { class: 'tabs__sep', 'aria-hidden': true }) : null,
      el('button', {
        class: 'tab', type: 'button', role: 'tab',
        'aria-selected': String(t.id === active),
        onClick: () => { active = t.id; page = 0; render(); },
      }, t.id === 'yours' ? t.label : `${t.label}${counts[t.id] ? ' ' + fmt.int(counts[t.id]) : ''}`),
    ].filter(Boolean)).flat(),
  );
}

function render() {
  renderTabs();
  const items = dataFor(active);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  const slice = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (slice.length === 0) {
    rowsHost.style.minHeight = `${PER_PAGE * 60}px`;
    rowsHost.replaceChildren(el('div', { class: 'rows__empty' }, emptyFor(active)));
  } else {
    rowsHost.style.minHeight = '';
    rowsHost.replaceChildren(...slice.map((it, i) => renderRow(it, page * PER_PAGE + i, active)));
  }
  pager.update(page, pages, items.length, PER_PAGE);
}

render();
