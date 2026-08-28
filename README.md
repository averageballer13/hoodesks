# HOODESKS

> A desk that trades while you hold it.

Front end for **hoodesks.fun** — an NFT collection where every token owns a vault,
and the vault fills with tokenised stock round after round. Launching on
[Pons](https://pons.xyz), the launchpad on Robinhood Chain.

Static site. No build step, no framework, no dependencies.

---

## Run it

```bash
node tools/serve.mjs
```

Then open <http://localhost:4321>. On Windows you can double-click `start.cmd`.

The pages use ES modules, so they need to be served over HTTP —
opening `index.html` from the filesystem will not work.

---

## What's here

| Page | File | What it does |
|---|---|---|
| The desks | `index.html` | Hero, preview strip, live stats, leaderboard with All / Yours / Burns |
| Mint | `mint.html` | Deposit breakdown, next serial preview, the three-step explainer |
| Collection | `collection.html` | All 5,000 desks, filterable on eight trait layers, sortable by rarity |
| Desk | `desk.html?id=N` | One desk: art, traits with scarcity, rank, and what its vault holds |
| History | `history.html` | Every round settled, and the rotation |
| Docs | `docs.html` | The eight-section explanation of the mechanism |
| Changelog | `changelog.html` | Announcements, newest first |

---

## The collection

5,000 desks, each a 32×32 pixel trading terminal, built from **eight trait layers**:

`Field · Case · Bezel · Tube · Screen · Keys · Lamp · Plate`

Nothing is stored and nothing is fetched. The whole collection is regenerated
from the seed string on every page load, in about 25ms:

```js
import { buildDesks, rankCollection } from './assets/js/desks.js';
const { tokens } = buildDesks();   // 5,000 unique desks, always in this order
rankCollection(tokens);            // adds .rarity and .rank
```

The seed (`hoodesks-v1`, in `assets/js/desks.js`) is the entire collection.
Change it and you get a different — but statistically identical — set of 5,000.
Duplicate trait combinations are rejected at generation, so every desk is one
of a kind. There are 268,800 possible combinations, of which 5,000 are used.

Rarity is additive: the sum of `supply / trait count` across the eight layers.
Higher is rarer. Rank 1 is the rarest desk in the set.

### Exporting for the mint

```bash
node tools/export.mjs                 # 5,000 PNGs at 512px + ERC-721 metadata
node tools/export.mjs --limit 20      # a sample to eyeball first
node tools/export.mjs --size 1024 --base ipfs://<cid>
```

Writes to `assets/collection/`, which is committed to this repo:

```
images/<id>.png        512×512 nearest-neighbour, transparent background
metadata/<id>.json     ERC-721 metadata with the eight traits + rarity rank
collection.json        trait counts, percentages, and every rank
```

The PNG encoder is written into `tools/export.mjs` on top of `node:zlib` —
there is nothing to install.

### Contact sheets

```bash
node tools/sheet.mjs --count 120 --cols 15      # a spread across the set
node tools/sheet.mjs --rare 30 --cols 10        # the rarest
node tools/sheet.mjs --from 1 --count 64        # the first serials
```

One PNG with many desks on it, for a reveal post.

### Stock token logos

Every ticker in the UI carries its company's brand mark, served from
`assets/img/tokens/` so the site never depends on an image host at runtime.

```bash
node tools/logos.mjs           # fetch anything missing
node tools/logos.mjs --force   # re-fetch everything
```

Change the rotation in `config.js` and re-run it; anything it cannot find is
reported, and you can drop a square PNG at `assets/img/tokens/<SYM>.png` by
hand instead.

Robinhood's own CDN is not the source: `cdn.robinhood.com/ncw_assets/logos/`
returns the same generic feather for every stock token, so the marks come from
a public ticker-keyed host. They are used to identify the stock they belong to
— the same nominative use every broker makes of them.

---

## Going live

Two files hold everything that changes.

**`assets/js/config.js`** — every number, address, ticker and label the UI renders.
Chain, currency, launchpad, supply, deposit, surcharge, the ten assets in
rotation, and the deployed contract addresses. The docs page reads its prose
values from here too, via `data-v` attributes, so the numbers in the copy can
never drift from the numbers in the app.

**`assets/js/data.js`** — the seam between the UI and the chain. Every function
in it currently returns a deterministic pre-launch state so the site is fully
browsable before the contracts exist. Replace the bodies with reads against the
indexer or RPC; the shapes are what the pages expect, so nothing above this file
has to change.

```js
stats()          // minted, live desks, burned, buys next, paid to holders
leaderboard()    // [{ token, value }]  desks by vault value
rounds()         // [{ n, sym, spent, units, desks, at }]
burns()          // [{ token, amount, at }]
holdings(id)     // [{ sym, name, units, value }]
myDesks()        // { connected, desks }
```

Flip `LAUNCHED` and `MINTED` at the top of `data.js` to move the whole site out
of its pre-launch state.

### Animated GIFs

```bash
node tools/gif.mjs                      # all three
node tools/gif.mjs --mode flip --delay 3 --scale 10
```

| File | Shape | Use |
|---|---|---|
| `brand/hoodesks-flip.gif` | 288x288, 72 frames | one desk cycling — PFP, teaser |
| `brand/hoodesks-scroll.gif` | 624x112, 80 frames | a strip scrolling sideways — banner |
| `brand/hoodesks-grid.gif` | 552x348, 60 frames | a wall of 40 desks re-rolling |

All loop forever at 25fps. `--delay` is in hundredths of a second, GIF's own
unit; below 2 most browsers clamp to 10, so 3-5 is the fast end.

The art uses 45 flat colours, so the whole palette fits one global colour
table and the output is colour-exact — no quantisation, no dithering. The
encoder (GIF89a + LZW) is written into the tool on top of nothing at all.

---

## Brand

The masters live in `brand/` and everything the site serves is derived from
them, so there is one place to change the logo:

```
brand/logo.png              square mark, any size
brand/banner.png            wide banner, any size
brand/logo-transparent.png  cut-out variant, kept for print
```

```bash
node tools/icons.mjs
```

builds `assets/img/mark-64.png` (header), `favicon-32.png`,
`favicon-180.png` (apple-touch), `logo-512.png`, and `og.png` — the banner
letterboxed onto a 1200x630 Open Graph card. The tool trims the master's dead
margin first, so the mark fills a 16px tab instead of floating in it.

It decodes, resamples and re-encodes PNG on `node:zlib` alone — same as the
collection exporter, nothing to install.

The mark is a black tile, so it carries its own ground and needs no light and
dark variants. That is also why the header applies its own `border-radius`
rather than the artwork baking one in.

---

## Theme

Robinhood palette, defined once in `assets/css/theme.css`:

| Token | Dark | Light |
|---|---|---|
| `--paper` | `#000000` | `#ffffff` |
| `--brand` | `#00c805` | `#00a804` |
| `--head` | `#ccff00` | `#0b0c0e` |
| `--alert` | `#ff5000` | `#e03e00` |
| `--gold` | `#ffd426` | `#a97c00` |

Dark is the default. The choice persists in `localStorage` under
`hoodesks-theme` and is applied before first paint by an inline script in each
page's `<head>`, so there is no flash.

The desk artwork keeps its own period palette in `assets/js/desks.js` and does
not follow the theme — the terminals are meant to look like 1980s hardware
regardless of what the page around them is doing.

---

## Deploying

Any static host. The repo is already shaped for it:

- `CNAME` points at `hoodesks.fun` — for GitHub Pages, enable Pages on the
  default branch and set the custom domain.
- `404.html` is served for unknown paths by GitHub Pages, Netlify and Vercel
  alike.
- Nothing needs building, so there is no build command to configure.
