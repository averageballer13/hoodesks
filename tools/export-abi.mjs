/* ==========================================================================
   HOODESKS — publish the compiled contract to the front end
   --------------------------------------------------------------------------
   Copies the ABI and creation bytecode out of the Hardhat build so the deploy
   page can ship them without the site depending on the contracts workspace.

     cd contracts && npx hardhat compile && cd ..
     node tools/export-abi.mjs

   Writes assets/js/contract.js. Re-run it after any change to the contract,
   or the page will deploy a stale build.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ARTIFACT = join(ROOT, 'contracts', 'artifacts', 'src', 'Hoodesks.sol', 'Hoodesks.json');
const OUT = join(ROOT, 'assets', 'js', 'contract.js');

const artifact = JSON.parse(await readFile(ARTIFACT, 'utf8'));

if (!artifact.bytecode || artifact.bytecode === '0x') {
  throw new Error('Artifact has no bytecode. Run `npx hardhat compile` in contracts/ first.');
}

const ctor = artifact.abi.find((e) => e.type === 'constructor');
const types = ctor.inputs.map((i) => i.type);
const names = ctor.inputs.map((i) => i.name.replace(/_$/, ''));

// A fingerprint so a deployed contract can be traced back to a build.
const hash = createHash('sha256').update(artifact.bytecode).digest('hex').slice(0, 16);

const body = `/* ==========================================================================
   HOODESKS — compiled contract
   --------------------------------------------------------------------------
   GENERATED FILE. Do not edit.

     cd contracts && npx hardhat compile && cd ..
     node tools/export-abi.mjs

   build ${hash}
   bytecode ${(artifact.bytecode.length / 2 / 1024).toFixed(1)} KB
   ========================================================================== */

export const BUILD = '${hash}';

/** Constructor signature, in order. */
export const CONSTRUCTOR = ${JSON.stringify(names.map((n, i) => ({ name: n, type: types[i] })), null, 2)};

export const HOODESKS_ABI = ${JSON.stringify(artifact.abi)};

export const HOODESKS_BYTECODE =
  '${artifact.bytecode}';
`;

await writeFile(OUT, body);
console.log(`assets/js/contract.js  build ${hash}  ${(body.length / 1024).toFixed(0)} KB`);
console.log(`constructor: ${names.map((n, i) => `${types[i]} ${n}`).join(', ')}`);
