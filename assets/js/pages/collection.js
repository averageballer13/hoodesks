/* HOODESKS — the collection browser
   5,000 desks, filtered client-side. Nothing is fetched: the whole set is
   regenerated from the seed on load in ~25ms. */

import { ECON, fmt } from '../config.js';
import { collection } from '../data.js';
import { LAYERS, LAYER_NAMES, DESK_SEED } from '../desks.js';
import { boot, el, $, deskCanvas, makePager } from '../ui.js';

boot('collection.html');

const PER_PAGE = 60;
const { tokens, counts } = collection();

$('#col-lede').textContent =
  `All ${fmt.int(tokens.length)} desks, generated from the seed "${DESK_SEED}" across ` +
  `eight trait layers. The set is fixed: the same seed rebuilds the same collection, ` +
  `in the same order, on any machine. Rarity is the sum of each trait's scarcity — higher is rarer.`;

/* -- state ---------------------------------------------------------------- */

const selected = new Map(LAYER_NAMES.map((n) => [n, new Set()]));
let sort = 'id';
let query = '';
let page = 0;

/* -- filters -------------------------------------------------------------- */

function buildFilters() {
  const host = $('#filters');
  host.replaceChildren(...LAYERS.map((layer) => {
    const opts = [...layer.traits]
      .map((t) => ({ name: t.name, n: counts[layer.name][t.name] ?? 0 }))
      .sort((a, b) => b.n - a.n);

    return el('div', { class: 'filters__grp' },
      el('div', { class: 'filters__h' },
        el('span', {}, layer.name),
        el('span', {}, fmt.int(opts.length))),
      el('div', { class: 'filters__list' },
        ...opts.map((o) => {
          const box = el('input', { type: 'checkbox' });
          const label = el('label', { class: 'fopt' },
            box,
            el('span', {}, o.name),
            el('span', { class: 'c' }, `${((o.n / tokens.length) * 100).toFixed(1)}%`));
          box.addEventListener('change', () => {
            const set = selected.get(layer.name);
            box.checked ? set.add(o.name) : set.delete(o.name);
            label.classList.toggle('is-on', box.checked);
            page = 0;
            render();
          });
          return label;
        })));
  }));
}

/* -- query ---------------------------------------------------------------- */

function filtered() {
  let out = tokens;

  for (const [layer, set] of selected) {
    if (set.size) out = out.filter((t) => set.has(t.traits[layer]));
  }

  if (query) {
    const q = query.replace(/[^0-9]/g, '');
    if (q) out = out.filter((t) => String(t.id).includes(q));
  }

  if (sort === 'id') out = [...out].sort((a, b) => a.id - b.id);
  else if (sort === 'id-desc') out = [...out].sort((a, b) => b.id - a.id);
  else if (sort === 'rare') out = [...out].sort((a, b) => a.rank - b.rank);
  else out = [...out].sort((a, b) => b.rank - a.rank);

  return out;
}

/* -- render --------------------------------------------------------------- */

const grid = $('#grid');
const pager = makePager((p) => { page = p; render(); }, 'desks');
$('#pager').replaceWith(pager);

function card(t) {
  return el('a', { class: 'card', href: `desk.html?id=${t.id}`, title: LAYER_NAMES.map((n) => t.traits[n]).join(' · ') },
    deskCanvas(t),
    el('div', { class: 'card__f' },
      el('span', { class: 'card__id' }, `#${t.id}`),
      el('span', { class: 'card__r' }, `#${fmt.int(t.rank)}`)));
}

function render() {
  const items = filtered();
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  page = Math.min(page, pages - 1);

  $('#count').textContent = `${fmt.int(items.length)} of ${fmt.int(ECON.supply)}`;

  const slice = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  grid.replaceChildren(
    ...(slice.length
      ? slice.map(card)
      : [el('div', { class: 'rows__empty', style: 'grid-column:1/-1' }, 'No desk matches those traits.')]),
  );

  pager.update(page, pages, items.length, PER_PAGE);
}

/* -- wiring --------------------------------------------------------------- */

$('#sort').addEventListener('change', (e) => { sort = e.target.value; page = 0; render(); });

let debounce;
$('#q').addEventListener('input', (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { query = e.target.value.trim(); page = 0; render(); }, 140);
});

$('#clear').addEventListener('click', () => {
  for (const set of selected.values()) set.clear();
  document.querySelectorAll('.fopt input').forEach((b) => { b.checked = false; });
  document.querySelectorAll('.fopt').forEach((l) => l.classList.remove('is-on'));
  $('#q').value = '';
  query = '';
  page = 0;
  render();
});

buildFilters();
render();
