/* HOODESKS — changelog */

import { changelog } from '../data.js';
import { boot, el, $ } from '../ui.js';

boot('changelog.html');

$('#entries').replaceChildren(...changelog().map((e) =>
  el('article', { class: 'frame' },
    el('div', { class: 'frame__in' },
      el('div', { class: 'frame__head' },
        el('h2', { class: 'frame__title' }, el('span', {}, e.title)),
        el('span', { class: 'pill pill--brand' }, e.kind)),
      el('p', { style: 'font-size:13px;line-height:1.7;color:var(--ink-2)' }, e.body),
      el('p', { style: 'margin-top:10px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2)' }, e.at)))));
