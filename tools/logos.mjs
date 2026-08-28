/* ==========================================================================
   HOODESKS — refresh the stock token logos
   --------------------------------------------------------------------------
   Downloads one brand mark per asset in ROTATION into assets/img/tokens/,
   so the site never depends on a third-party image host at runtime.

     node tools/logos.mjs           # fetch anything missing
     node tools/logos.mjs --force   # re-fetch everything

   Note on the source: Robinhood's own CDN serves the same generic feather
   for every stock token, so it is no use here. These come from a public
   ticker-keyed logo host instead. Company marks are used to identify the
   stock they belong to — the same nominative use every broker makes of them.
   ========================================================================== */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROTATION } from '../assets/js/config.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'img', 'tokens');
const FORCE = process.argv.includes('--force');

const SOURCE = (sym) => `https://financialmodelingprep.com/image-stock/${sym}.png`;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

await mkdir(OUT, { recursive: true });

const exists = async (p) => access(p).then(() => true, () => false);

let fetched = 0, skipped = 0, failed = 0;

for (const asset of ROTATION) {
  const dest = join(OUT, `${asset.sym}.png`);

  if (!FORCE && (await exists(dest))) {
    console.log(`  skip   ${asset.sym}  (already present)`);
    skipped++;
    continue;
  }

  try {
    const res = await fetch(SOURCE(asset.sym), { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    // A logo host that 404s into an HTML error page would otherwise write
    // a "PNG" that is really markup. Check the magic number.
    if (buf.length < 200 || buf[0] !== 0x89 || buf[1] !== 0x50) {
      throw new Error('not a PNG');
    }

    await writeFile(dest, buf);
    console.log(`  ok     ${asset.sym.padEnd(6)} ${buf.length} bytes`);
    fetched++;
  } catch (err) {
    console.warn(`  FAIL   ${asset.sym.padEnd(6)} ${err.message}`);
    failed++;
  }
}

console.log(`\n${fetched} fetched, ${skipped} skipped, ${failed} failed`);
if (failed) {
  console.log('Fill any gap by dropping a square PNG at assets/img/tokens/<SYM>.png.');
  process.exitCode = 1;
}
