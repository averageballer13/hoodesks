/* ==========================================================================
   HOODESKS — economic model
   --------------------------------------------------------------------------
   How much stock a desk actually ends up holding, and where it came from.

     node tools/model.mjs                    # the mint phase, by serial
     node tools/model.mjs --volume 2000      # add a post-mint year at 2000 ETH
                                             # of secondary NFT volume

   A round spends the whole pot the moment it clears the threshold, and splits
   what it bought equally across every desk minted so far. So a desk's share
   of any one round is 1/N, where N is the supply at that instant — which
   means when you mint matters far more than anything else.
   ========================================================================== */

import { ECON } from '../assets/js/config.js';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : Number(process.argv[i + 1]);
};

const SUPPLY = ECON.supply;
const TO_POT = ECON.surchargeToPot;   // 0.045 ETH per mint
const SURCHARGE = ECON.surcharge;     // 0.05 ETH paid by the minter

/* -- the mint phase -------------------------------------------------------
   Mint number k puts TO_POT into the pot while raising the supply to k. The
   pot fires and splits across those k desks, so every desk alive at that
   point receives TO_POT / k.

   A desk minted at serial s therefore accumulates:
       sum over k = s..SUPPLY of TO_POT / k
   which is TO_POT * (H(SUPPLY) - H(s-1)) — the harmonic series, and the
   reason the curve is so steep at the front.
   ------------------------------------------------------------------------ */

const H = new Float64Array(SUPPLY + 1);
for (let k = 1; k <= SUPPLY; k++) H[k] = H[k - 1] + 1 / k;

const fromMints = (serial) => TO_POT * (H[SUPPLY] - H[serial - 1]);

const totalRaised = SUPPLY * TO_POT;

console.log('MINT PHASE');
console.log(`  ${SUPPLY} desks x ${TO_POT} ETH to the pot = ${totalRaised.toFixed(1)} ETH, once and never again`);
console.log(`  each desk pays ${SURCHARGE} ETH + the burned deposit\n`);

console.log(`  serial   stock accrued   vs the ${SURCHARGE} ETH surcharge`);
console.log('  ------   -------------   ------------------------');
for (const s of [1, 10, 100, 500, 1000, 2500, 4000, 5000]) {
  const eth = fromMints(s);
  const ratio = eth / SURCHARGE;
  console.log(
    `  ${String(s).padStart(6)}   ${eth.toFixed(4).padStart(9)} ETH   ` +
    `${ratio >= 1 ? ratio.toFixed(1) + 'x' : '0.' + String(Math.round(ratio * 100)).padStart(2, '0') + 'x'}`,
  );
}

const breakeven = (() => {
  for (let s = 1; s <= SUPPLY; s++) if (fromMints(s) < SURCHARGE) return s;
  return null;
})();
console.log(
  `\n  Mint revenue alone covers the surcharge up to serial ~${breakeven - 1}.` +
  `\n  After that a desk is betting entirely on the two perpetual sources.`,
);

/* -- after sell-out -------------------------------------------------------
   Mints stop. The pot then fills only from the 5% royalty on secondary sales
   and the launchpad's creator fees, and every desk takes 1/SUPPLY of it.
   ------------------------------------------------------------------------ */

const volume = arg('volume', 0);
if (volume > 0) {
  const royalties = volume * (ECON.royaltyPct / 100);
  const perDesk = royalties / SUPPLY;
  console.log('\nAFTER SELL-OUT');
  console.log(`  ${volume} ETH of secondary NFT volume in a year`);
  console.log(`  -> ${royalties.toFixed(1)} ETH of royalties into the pot`);
  console.log(`  -> ${perDesk.toFixed(5)} ETH per desk per year, before any launchpad fees`);
  console.log(`\n  Creator fees on ${'$'}DESKS trading add to this and are the larger`);
  console.log('  of the two if the token stays liquid — but they are the part');
  console.log('  nobody can promise.');
} else {
  console.log('\nAFTER SELL-OUT');
  console.log('  Only royalties and launchpad creator fees fill the pot, split 1/5000.');
  console.log('  Pass --volume <ETH> to size a year of secondary trading.');
}

console.log(
  '\nThe shape to take away: a round splits by the supply at that instant,' +
  '\nso the mint phase pays early serials many times what it pays late ones.' +
  '\nThat is arithmetic, not a policy — it falls out of "one desk, one share".',
);
