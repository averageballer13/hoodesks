# HOODESKS — contracts

Two contracts. `Hoodesks` is the collection, the pot and the ledger;
`DeskVault` is the per-desk container it deploys clones of.

```bash
npm install
npx hardhat compile
npx hardhat test
```

## The ledger

The hard part is not minting, it is paying five thousand desks without five
thousand transfers. It uses the accumulator-and-stamp pattern, one accumulator
per asset in the rotation:

```
accPerDesk[i]   units of asset i credited to every desk, ever, scaled by 1e18
stamp[id][i]    how far desk `id` has already been paid
owed            (accPerDesk[i] - stamp[id][i]) / 1e18
```

A round writes one number and is a single transaction at any supply. Three
properties follow from keying the stamp on the tokenId rather than a wallet:

- **Selling a desk hands over what a round credited but never delivered.**
  Nothing is settled on transfer because there is nothing to settle.
- **A desk cannot claim rounds that fired before it existed** — `mint` stamps
  it at the current accumulator.
- **Entitlement accrues with or without a vault.** Deployment is lazy and
  happens on the first claim.

Integer division is handled rather than ignored. Each round carries its
remainder into the next (`carry`), and a claim advances the stamp only by what
it actually paid, so sub-unit dust stays owed instead of being rounded away.
The test suite asserts the protocol never over-pays and never strands more
than one unit per desk.

## Delivery is lazy on purpose

A single round credits each desk a fraction of a cent. Delivering that per
desk per round would cost more gas than it moves. `claim(tokenId)` pays every
asset at once, is permissionless, and deploys the vault if it is still
missing — so a holder claims when it is worth claiming, and a keeper can batch
with `claimMany`.

## The swap is behind an interface

`ISwapAdapter` is the one thing delegated. The ledger is what has to be right
and what gets audited; which venue fills the order will change. An adapter is
trusted with the pot for the length of one call, so it needs the same scrutiny
as the core.

`fireRound(minAmountOut)` takes its slippage floor from the caller because the
contract has no oracle. A keeper passing zero is inviting a sandwich.

## Deploying

```bash
export RPC_URL=...            # Robinhood Chain
export DEPLOYER_KEY=...       # never commit this
export DEPOSIT_TOKEN=0x...    # the launch token, from Pons
export PROTOCOL_WALLET=0xa0A502e18D8EC97FF64338741b3296e65147002f
export BASE_URI=ipfs://<cid>/

npx hardhat run scripts/deploy.cjs --network robinhood
```

The script refuses to deploy if any rotation address has no code on the target
network, and prints a block to paste into `../assets/js/config.js`.

Then, in order:

1. deploy a swap adapter and call `setSwapAdapter`
2. repoint the Pons creator-fee recipient at the collection
3. run a keeper: claim Pons fees into the pot, then `fireRound(minAmountOut)`

## Before this touches real money

- **Get it audited.** The tests prove the invariants they were written for,
  which is not the same as the contract being safe.
- `setSwapAdapter` is the sharpest edge — the owner can repoint the pot's
  counterparty. It belongs behind a timelock.
- Ownership is `Ownable2Step`; transfer it to a multisig, not an EOA.
- Compiled for the `paris` EVM so the bytecode runs on an Orbit chain of any
  recent ArbOS. Bumping OpenZeppelin past 5.0.2 pulls in `mcopy` and forces a
  Cancun target — check the chain supports it before you do.
