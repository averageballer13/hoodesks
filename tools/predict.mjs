/* ==========================================================================
   HOODESKS — precompute where the collection will land
   --------------------------------------------------------------------------
   A contract deployed by a plain wallet gets an address derived only from the
   deployer and its nonce. So the addresses the collection *could* have are
   knowable before it exists, and the site can find it with nothing but an RPC
   — no explorer API, no manual edit after deploying.

     node tools/predict.mjs                    # for the configured wallet
     node tools/predict.mjs --count 40

   Writes the candidates into assets/js/config.js. The browser checks each for
   code and confirms the right one by calling MAX_SUPPLY(), so a wrong guess
   is impossible rather than merely unlikely.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCreateAddress } from '../contracts/node_modules/ethers/lib.esm/index.js';
import { ACCOUNTS } from '../assets/js/config.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CONFIG = join(ROOT, 'assets', 'js', 'config.js');

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1];
};

const deployer = arg('from', ACCOUNTS[0].addr);
const count = Number(arg('count', 24));

if (!/^0x[0-9a-fA-F]{40}$/.test(deployer)) throw new Error(`Not an address: ${deployer}`);

const candidates = Array.from({ length: count }, (_, nonce) =>
  getCreateAddress({ from: deployer, nonce }));

const block = `/**
 * Where the collection can land. A contract from a plain wallet takes an
 * address derived from the deployer and its nonce alone, so these are
 * knowable before it exists — which is what lets the site find the
 * deployment on its own instead of waiting for someone to paste an address
 * in. The browser confirms the right one by calling MAX_SUPPLY() on it, so
 * picking a wrong contract is impossible rather than unlikely.
 *
 * Regenerate with: node tools/predict.mjs
 * Deployer: ${deployer}
 */
export const COLLECTION_CANDIDATES = [
${candidates.map((a) => `  '${a}',`).join('\n')}
];`;

let src = await readFile(CONFIG, 'utf8');
const marker = 'export const COLLECTION_CANDIDATES';

if (src.includes(marker)) {
  const start = src.lastIndexOf('/**', src.indexOf(marker));
  const end = src.indexOf('];', src.indexOf(marker)) + 2;
  src = src.slice(0, start) + block + src.slice(end);
} else {
  src = src.replace('export const TOKEN = {', `${block}\n\nexport const TOKEN = {`);
}

await writeFile(CONFIG, src);
console.log(`deployer   ${deployer}`);
console.log(`candidates ${count} written to assets/js/config.js`);
console.log(`nonce 0    ${candidates[0]}`);
console.log(`nonce 1    ${candidates[1]}`);
