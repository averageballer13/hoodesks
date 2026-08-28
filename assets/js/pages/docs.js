/* HOODESKS — docs: value injection, table building, TOC scrollspy */

import { ACCOUNTS, CHAIN, ECON, ROTATION, TOKEN, fmt } from '../config.js';
import { boot, el, $, $$ } from '../ui.js';

boot('docs.html');

const eth = (n) => `${n} ${CHAIN.currency}`;

/* -- one source of truth for every number in the prose -------------------- */
const VALUES = {
  deposit: fmt.int(ECON.deposit),
  ticker: TOKEN.symbol,
  surcharge: eth(ECON.surcharge),
  toPot: eth(ECON.surchargeToPot),
  toProtocol: eth(ECON.surchargeToProtocol),
  gas: eth(ECON.activationGas),
  threshold: eth(ECON.roundThreshold),
  royalty: `${ECON.royaltyPct}%`,
  supply: fmt.int(ECON.supply),
  launchpad: CHAIN.launchpad,
  sweep: String(ECON.sweepMinutes),
  chain: CHAIN.name,
};

for (const node of $$('[data-v]')) {
  const v = VALUES[node.dataset.v];
  if (v != null) node.textContent = v;
}

/* -- rotation chips ------------------------------------------------------- */
$('#rotation').replaceChildren(...ROTATION.map((a) =>
  el('span', { class: 'chip', title: a.name },
    el('span', { class: 'i' }, String(a.i).padStart(2, '0')), ' ', a.sym)));

/* -- the numbers table ---------------------------------------------------- */
const NUMBERS = [
  ['Deposit', `${fmt.int(ECON.deposit)} ${TOKEN.symbol} · burned`],
  ['Surcharge', eth(ECON.surcharge)],
  ['Protocol share', `${eth(ECON.surchargeToProtocol)} per mint`],
  ['Royalty', `${ECON.royaltyPct}% · to the pot`],
  ['Round threshold', eth(ECON.roundThreshold)],
  ['Supply', `${fmt.int(ECON.supply)} desks`],
  ['Assets in rotation', String(ROTATION.length)],
  ['Vault deployment', `~${eth(ECON.activationGas)} of gas, once`],
  ['Chain', CHAIN.name],
  ['Launchpad', CHAIN.launchpad],
];

$('#numbers').replaceChildren(...NUMBERS.map(([k, v]) =>
  el('tr', {}, el('td', { class: 'em' }, k), el('td', {}, v))));

/* -- accounts ------------------------------------------------------------- */
const addrRow = (label, addr, lead) =>
  el('div', { class: 'kv' },
    el('span', { class: 'kv__k' }, lead != null ? `${lead}  ${label}` : label),
    el('a', {
      class: 'addr', href: CHAIN.explorerAccount(addr),
      target: '_blank', rel: 'noreferrer', title: addr,
    }, fmt.addr(addr)));

$('#accounts').replaceChildren(...ACCOUNTS.map((a) => addrRow(a.label, a.addr)));

$('#assets').replaceChildren(...ROTATION.map((a) =>
  addrRow(`${a.sym} · ${a.name}`, a.addr, String(a.i).padStart(2, '0'))));

/* -- table of contents + scrollspy ---------------------------------------- */
const sections = $$('.doc section[id]');

$('#toc').replaceChildren(...sections.map((sec, i) =>
  el('li', {},
    el('a', { href: `#${sec.id}`, 'data-for': sec.id },
      el('span', { class: 'n' }, String(i + 1).padStart(2, '0')),
      el('span', {}, sec.querySelector('h2').textContent)))));

const links = new Map($$('#toc a').map((a) => [a.dataset.for, a]));

const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    for (const a of links.values()) a.classList.remove('is-active');
    links.get(e.target.id)?.classList.add('is-active');
  }
}, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });

sections.forEach((s) => spy.observe(s));
