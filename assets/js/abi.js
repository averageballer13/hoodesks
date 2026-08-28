/* ==========================================================================
   HOODESKS — minimal ABI encoding
   --------------------------------------------------------------------------
   Enough of the ABI spec to encode this contract's constructor, and no more:
   address, uintN, address[] and string. Anything else throws rather than
   guessing, because a silently wrong encoding deploys a broken contract.

   Hand-rolled so the deploy page stays dependency-free. Verified byte-for-byte
   against ethers by tools/verify-abi.mjs — an encoder nobody checked is worth
   less than no encoder at all.
   ========================================================================== */

const strip = (h) => String(h).replace(/^0x/, '').toLowerCase();
const slot = (h) => h.padStart(64, '0');

export function encodeAddress(a) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(a))) throw new Error(`Not an address: ${a}`);
  return slot(strip(a));
}

export function encodeUint(v) {
  const n = BigInt(v);
  if (n < 0n) throw new Error(`Not an unsigned integer: ${v}`);
  if (n >= 1n << 256n) throw new Error(`Overflows uint256: ${v}`);
  return slot(n.toString(16));
}

/** Right-pad to a whole number of 32-byte words. */
function padRight(hex) {
  const rem = hex.length % 64;
  return rem === 0 ? hex : hex + '0'.repeat(64 - rem);
}

function bytesTail(bytes) {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return encodeUint(bytes.length) + padRight(hex);
}

export const encodeStringTail = (s) => bytesTail(new TextEncoder().encode(String(s)));

export const encodeAddressArrayTail = (list) =>
  encodeUint(list.length) + list.map(encodeAddress).join('');

/**
 * Encode constructor arguments. Static values sit in the head; dynamic ones
 * put a byte offset there and append their payload to the tail.
 *
 * @param {string[]} types  solidity types, in order
 * @param {any[]} values    matching values
 * @returns {string} hex without the 0x prefix
 */
export function encodeArgs(types, values) {
  if (types.length !== values.length) throw new Error('types and values differ in length');

  const heads = [];
  const tails = [];
  let offset = types.length * 32; // the head is one word per argument

  types.forEach((type, i) => {
    const value = values[i];

    if (type === 'address') {
      heads.push(encodeAddress(value));
      return;
    }
    if (/^uint(8|16|32|64|128|256)?$/.test(type)) {
      heads.push(encodeUint(value));
      return;
    }
    if (type === 'address[]') {
      const tail = encodeAddressArrayTail(value);
      heads.push(encodeUint(offset));
      tails.push(tail);
      offset += tail.length / 2;
      return;
    }
    if (type === 'string') {
      const tail = encodeStringTail(value);
      heads.push(encodeUint(offset));
      tails.push(tail);
      offset += tail.length / 2;
      return;
    }
    throw new Error(`Unsupported type: ${type}`);
  });

  return heads.join('') + tails.join('');
}

/** Creation calldata: bytecode followed by the encoded constructor args. */
export function deployData(bytecode, types, values) {
  return `0x${strip(bytecode)}${encodeArgs(types, values)}`;
}

/** Whole tokens to base units, without floating point. */
export function toUnits(amount, decimals = 18) {
  const s = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Not a positive number: ${amount}`);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) throw new Error(`More than ${decimals} decimals: ${amount}`);
  return BigInt(whole + frac.padEnd(decimals, '0'));
}
