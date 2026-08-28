/* ==========================================================================
   HOODESKS — shared chrome
   Header, ticker tape, footer, theme toggle, and small render helpers.
   ========================================================================== */

import { BRAND, CHAIN, ROTATION, ECON, fmt } from './config.js';
import { drawDesk, SIZE } from './desks.js';

/* -- dom helpers ---------------------------------------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** A 32x32 canvas painted with a desk. Size it with CSS. */
export function deskCanvas(token) {
  const c = el('canvas', { width: SIZE, height: SIZE, title: `#${token.id}` });
  drawDesk(c, token);
  return c;
}

/* -- theme ---------------------------------------------------------------- */

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

export function initTheme() {
  let saved = 'dark';
  try { saved = localStorage.getItem('hoodesks-theme') || 'dark'; } catch { /* private mode */ }
  document.documentElement.dataset.theme = saved;
  return saved;
}

function toggleTheme(btn) {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('hoodesks-theme', next); } catch { /* private mode */ }
  paintThemeBtn(btn);
}

function paintThemeBtn(btn) {
  const dark = document.documentElement.dataset.theme === 'dark';
  btn.innerHTML = dark ? SUN : MOON;
  btn.setAttribute('aria-label', dark ? 'Switch to light' : 'Switch to dark');
  btn.title = dark ? 'Light' : 'Dark';
}

/* -- logo ----------------------------------------------------------------- */

/* A pixel terminal reduced to its silhouette: screen, stand, deck. */
export const LOGO_SVG = `
<svg class="hdr__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--brand)"/>
  <rect x="7" y="8"  width="18" height="12" rx="2" fill="#000"/>
  <rect x="9.5" y="10.5" width="13" height="7" fill="var(--brand)"/>
  <rect x="10" y="15" width="2" height="2" fill="#000"/>
  <rect x="13" y="13.5" width="2" height="3.5" fill="#000"/>
  <rect x="16" y="12" width="2" height="5" fill="#000"/>
  <rect x="19" y="13" width="2" height="4" fill="#000"/>
  <rect x="5" y="22" width="22" height="3" rx="1.4" fill="#000"/>
</svg>`;

/* -- header --------------------------------------------------------------- */

const NAV = [
  { href: 'mint.html', label: 'Mint' },
  { href: 'collection.html', label: 'Collection' },
  { href: 'history.html', label: 'History' },
  { href: 'changelog.html', label: 'Changelog' },
  { href: 'docs.html', label: 'Docs' },
];

const X_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"/></svg>';

export function mountHeader(current) {
  const host = $('#hdr');
  if (!host) return;

  const themeBtn = el('button', { class: 'icon-btn', type: 'button' });
  themeBtn.addEventListener('click', () => toggleTheme(themeBtn));
  paintThemeBtn(themeBtn);

  host.replaceChildren(
    el('a', { class: 'hdr__logo', href: 'index.html', 'aria-label': `${BRAND.name} — home` },
      el('span', { html: LOGO_SVG }).firstElementChild,
      el('span', { class: 'hdr__word' }, BRAND.wordmark)),
    el('nav', { class: 'nav', 'aria-label': 'Main' },
      NAV.map((n) =>
        el('a', { href: n.href, 'aria-current': n.href === current ? 'page' : null }, n.label))),
    el('div', { class: 'hdr__tools' },
      el('a', {
        class: 'icon-btn', href: BRAND.x, target: '_blank', rel: 'noreferrer',
        'aria-label': `${BRAND.name} on X`, html: X_SVG,
      }),
      themeBtn),
  );
}

/* -- ticker tape ---------------------------------------------------------- */

/* Deterministic pseudo-quotes so the tape is stable within a page load. */
function quoteFor(sym, i) {
  let h = 0;
  for (const ch of sym) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const px = 40 + ((h % 46000) / 100);
  const chg = (((h >> 7) % 900) / 100) - 4.2;
  return { px, chg };
}

export function mountTape() {
  const host = $('#tape');
  if (!host) return;

  const items = ROTATION.map((s, i) => {
    const { px, chg } = quoteFor(s.sym, i);
    const up = chg >= 0;
    return el('span', { class: 'tape__item', title: s.name },
      el('span', { class: 'tape__sym' }, s.sym),
      el('span', { class: 'tape__px' }, px.toFixed(2)),
      el('span', { class: `tape__chg ${up ? 'up' : 'down'}` }, `${up ? '+' : ''}${chg.toFixed(2)}%`));
  });

  // duplicated once so the -50% keyframe loops seamlessly
  host.replaceChildren(el('div', { class: 'tape__row' }, items, items.map((n) => n.cloneNode(true))));
}

/* -- footer --------------------------------------------------------------- */

export function mountFooter() {
  const host = $('#ftr');
  if (!host) return;
  host.className = 'ftr';
  host.replaceChildren(
    el('span', {}, `${BRAND.name} · ${BRAND.domain}`),
    el('span', { class: 'dim' }, `${fmt.int(ECON.supply)} desks on ${CHAIN.name}`),
    el('span', { class: 'ftr__spacer' }),
    el('a', { href: 'docs.html' }, 'Docs'),
    el('a', { href: BRAND.x, target: '_blank', rel: 'noreferrer' }, 'X'),
    el('a', { href: CHAIN.launchpadUrl, target: '_blank', rel: 'noreferrer' }, CHAIN.launchpad),
  );
}

/* -- pager ---------------------------------------------------------------- */

const ARROW_L = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5.5 8 10 13"/></svg>';
const ARROW_R = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l4.5 5L6 13"/></svg>';

/**
 * A previous/next pager. `onPage` receives the new zero-based page index.
 * Returns the element; call `.update(page, pages, total)` to re-render.
 */
export function makePager(onPage, noun = '') {
  const label = el('span', { class: 'tnum' }, '—');
  const prev = el('button', { class: 'pager__btn', type: 'button', 'aria-label': 'Previous', html: ARROW_L });
  const next = el('button', { class: 'pager__btn', type: 'button', 'aria-label': 'Next', html: ARROW_R });
  const node = el('div', { class: 'pager' }, label, el('span', { class: 'pager__btns' }, prev, next));

  let page = 0, pages = 1;
  prev.addEventListener('click', () => onPage(Math.max(0, page - 1)));
  next.addEventListener('click', () => onPage(Math.min(pages - 1, page + 1)));

  node.update = (p, pg, total, perPage) => {
    page = p; pages = pg;
    const from = total === 0 ? 0 : p * perPage + 1;
    const to = Math.min((p + 1) * perPage, total);
    label.textContent = total === 0 ? '—' : `${from}–${to} of ${fmt.int(total)}${noun ? ' ' + noun : ''}`;
    prev.disabled = p === 0;
    next.disabled = p >= pg - 1;
  };
  return node;
}

/* -- boot ----------------------------------------------------------------- */

export function boot(current) {
  initTheme();
  mountHeader(current);
  mountTape();
  mountFooter();
  document.title = document.title || BRAND.name;
}
