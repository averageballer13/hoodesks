/* Check the hand-rolled encoder against ethers, byte for byte. */
import { AbiCoder, parseUnits } from '../contracts/node_modules/ethers/lib.esm/index.js';
import { encodeArgs, toUnits, deployData } from '../assets/js/abi.js';
import { ROTATION } from '../assets/js/config.js';

const coder = AbiCoder.defaultAbiCoder();
const TYPES = ['address', 'uint256', 'address', 'address[]', 'string', 'address'];

const cases = [
  ['plain', ['0xa0A502e18D8EC97FF64338741b3296e65147002f', toUnits('100000'),
    '0xa0A502e18D8EC97FF64338741b3296e65147002f', ROTATION.map(r => r.addr),
    'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/',
    '0xa0A502e18D8EC97FF64338741b3296e65147002f']],
  ['empty string + 1 asset', ['0x0000000000000000000000000000000000000001', 0n,
    '0x0000000000000000000000000000000000000002',
    ['0x0000000000000000000000000000000000000003'], '', '0x0000000000000000000000000000000000000004']],
  ['string needing padding', ['0xa0A502e18D8EC97FF64338741b3296e65147002f', toUnits('1'),
    '0xa0A502e18D8EC97FF64338741b3296e65147002f', ROTATION.slice(0,3).map(r => r.addr),
    'x'.repeat(33), '0xa0A502e18D8EC97FF64338741b3296e65147002f']],
  ['unicode uri', ['0xa0A502e18D8EC97FF64338741b3296e65147002f', toUnits('0.5'),
    '0xa0A502e18D8EC97FF64338741b3296e65147002f', ROTATION.map(r => r.addr),
    'ipfs://café/—/', '0xa0A502e18D8EC97FF64338741b3296e65147002f']],
];

let fail = 0;
for (const [name, values] of cases) {
  const mine = '0x' + encodeArgs(TYPES, values);
  const theirs = coder.encode(TYPES, values);
  const ok = mine.toLowerCase() === theirs.toLowerCase();
  if (!ok) { fail++; console.log('MISMATCH:', name); console.log('  mine  ', mine); console.log('  ethers', theirs); }
  else console.log(`  ok  ${name.padEnd(24)} ${(mine.length-2)/2} bytes`);
}

// toUnits vs parseUnits
for (const v of ['100000', '1', '0.5', '0.000000000000000001', '1000000000']) {
  const a = toUnits(v), b = parseUnits(v, 18);
  if (a !== b) { fail++; console.log('MISMATCH toUnits', v, a, b); }
}
console.log(fail ? `\n${fail} MISMATCHES` : '\nall encodings match ethers exactly');
process.exitCode = fail ? 1 : 0;
