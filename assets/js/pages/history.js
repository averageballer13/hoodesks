/* HOODESKS — round history */

import { CHAIN, ROTATION, fmt } from '../config.js';
import * as api from '../data.js';
import { boot, el, $, makePager } from '../ui.js';

boot('history.html');

const PER_PAGE = 10;
const s = api.stats();
const items = api.rounds();

/* -- summary -------------------------------------------------------------- */
{
  const last = items[0];
  const cards = [
    { k: 'Rounds', v: fmt.int(s.rounds) },
    { k: `${CHAIN.currency} converted`, v: s.converted.toFixed(3) },
    { k: 'Assets bought', v: fmt.int(new Set(items.map((r) => r.sym)).size) },
    { k: 'Buys next', v: s.buysNext, sub: last ? `last: ${last.sym}` : 'rotation head' },
  ];
  $('#summary').replaceChildren(...cards.map((c) =>
    el('div', { class: 'statcard' },
      el('div', { class: 'statcard__k' }, c.k),
      el('div', { class: 'statcard__v' }, c.v),
      c.sub ? el('div', { class: 'statcard__s' }, c.sub) : null)));
}

/* -- rows ----------------------------------------------------------------- */
const rowsHost = $('#rows');
const pager = makePager((p) => { page = p; render(); }, 'rounds');
$('#pager').replaceWith(pager);

let page = 0;

function render() {
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  const slice = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (!slice.length) {
    rowsHost.style.minHeight = `${PER_PAGE * 60}px`;
    rowsHost.replaceChildren(
      el('div', { class: 'rows__empty' },
        'No round has fired yet. The first one settles once the pot clears its threshold.'));
  } else {
    rowsHost.style.minHeight = '';
    rowsHost.replaceChildren(...slice.map((r) =>
      el('div', { class: 'row' },
        el('span', { class: 'row__n' }, fmt.int(r.n)),
        el('span', { class: 'row__main' },
          el('span', { class: 'row__t' }, r.sym),
          el('span', { class: 'row__s' },
            `${r.units.toFixed(4)} split across ${fmt.int(r.desks)} desks`)),
        el('span', { class: 'row__v' }, `${r.spent.toFixed(4)} ${CHAIN.currency}`))));
  }
  pager.update(page, pages, items.length, PER_PAGE);
}

render();

/* -- rotation ------------------------------------------------------------- */
$('#rotation').replaceChildren(...ROTATION.map((a) =>
  el('span', { class: 'chip', title: a.name },
    el('span', { class: 'i' }, String(a.i).padStart(2, '0')),
    ' ',
    a.sym)));
