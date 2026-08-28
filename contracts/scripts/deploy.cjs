/* ==========================================================================
   HOODESKS — deployment
   --------------------------------------------------------------------------
   Rehearsal on the testnet, then the real thing:

     npx hardhat run scripts/deploy.cjs --network robinhoodTestnet
     npx hardhat run scripts/deploy.cjs --network robinhood

   On the testnet the Robinhood Stock Tokens do not exist, so the script
   deploys mock ERC-20s and a mock swap venue, then mints a desk, fires a
   round and claims it — an end-to-end rehearsal against the real chain.

   On mainnet it uses the canonical token addresses, refuses to continue if
   any of them has no code, and deploys nothing but the collection.

   Environment:
     DEPLOYER_KEY     private key of the deploying wallet (export it, never commit)
     RPC_URL          optional, overrides the public endpoint
     DEPOSIT_TOKEN    the launch token from Pons        (mainnet only)
     PROTOCOL_WALLET  where the protocol's cut goes
     BASE_URI         metadata base, e.g. ipfs://<cid>/
     OWNER            contract owner, defaults to the deployer
     DEPOSIT_AMOUNT   whole tokens burned per mint, default 1000000
   ========================================================================== */

const { ethers, network } = require('hardhat');

const TESTNET_CHAIN_ID = 46630n;

// The ten canonical Robinhood Stock Tokens, from the on-chain asset registry
// at docs.robinhood.com/chain/contracts. Keep in sync with config.js.
const ROTATION = [
  ['AAPL', '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9'],
  ['MSFT', '0xe93237C50D904957Cf27E7B1133b510C669c2e74'],
  ['NVDA', '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'],
  ['AMZN', '0x12f190a9F9d7D37a250758b26824B97CE941bF54'],
  ['GME', '0x1b0E319c6A659F002271B69dB8A7df2F911c153E'],
  ['CRCL', '0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5'],
  ['SPCX', '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa'],
  ['CRWV', '0x5f10A1C971B69e47e059e1dC91901B59b3fB49C3'],
  ['PLTR', '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A'],
  ['TSLA', '0x322F0929c4625eD5bAd873c95208D54E1c003b2d'],
];

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No signer. Export DEPLOYER_KEY before running.');

  const net = await ethers.provider.getNetwork();
  const rehearsal = net.chainId === TESTNET_CHAIN_ID || process.env.USE_MOCKS === '1';
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`network       ${network.name} (chainId ${net.chainId})`);
  console.log(`mode          ${rehearsal ? 'REHEARSAL — mock tokens' : 'LIVE — canonical stock tokens'}`);
  console.log(`deployer      ${deployer.address}`);
  console.log(`balance       ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) throw new Error('Deployer has no ETH on this network.');

  const protocolWallet = required('PROTOCOL_WALLET');
  const baseURI = required('BASE_URI');
  const owner = process.env.OWNER || deployer.address;
  const depositAmount = ethers.parseUnits(process.env.DEPOSIT_AMOUNT || '1000000', 18);

  /* -- the rotation ------------------------------------------------------ */

  let depositToken;
  let rotationAddresses;

  if (rehearsal) {
    const ERC20 = await ethers.getContractFactory('MockERC20');

    const mockDeposit = await ERC20.deploy('Hoodesks Test', 'tDESKS');
    await mockDeposit.waitForDeployment();
    depositToken = await mockDeposit.getAddress();
    console.log(`\nmock deposit  ${depositToken}`);

    rotationAddresses = [];
    for (const [sym] of ROTATION) {
      const t = await ERC20.deploy(`${sym} Test`, `t${sym}`);
      await t.waitForDeployment();
      rotationAddresses.push(await t.getAddress());
    }
    console.log(`mock rotation ${rotationAddresses.length} tokens deployed`);
  } else {
    depositToken = required('DEPOSIT_TOKEN');
    const code = await ethers.provider.getCode(depositToken);
    if (code === '0x') throw new Error(`DEPOSIT_TOKEN ${depositToken} has no code on this network`);

    for (const [sym, addr] of ROTATION) {
      if ((await ethers.provider.getCode(addr)) === '0x') {
        throw new Error(`${sym} at ${addr} has no code on this network`);
      }
    }
    rotationAddresses = ROTATION.map(([, a]) => a);
    console.log(`\nrotation      ${ROTATION.length} canonical stock tokens verified on chain`);
  }

  console.log(`deposit       ${ethers.formatUnits(depositAmount, 18)} per mint, burned`);
  console.log(`protocol      ${protocolWallet}`);
  console.log(`owner         ${owner}`);
  console.log(`base URI      ${baseURI}\n`);

  /* -- the collection ---------------------------------------------------- */

  const Hoodesks = await ethers.getContractFactory('Hoodesks');
  const hood = await Hoodesks.deploy(
    depositToken,
    depositAmount,
    protocolWallet,
    rotationAddresses,
    baseURI,
    owner,
  );
  await hood.waitForDeployment();

  const address = await hood.getAddress();
  const vaultImpl = await hood.vaultImplementation();

  console.log(`Hoodesks             ${address}`);
  console.log(`DeskVault (impl)     ${vaultImpl}`);

  /* -- rehearsal: prove the whole cycle works on the real chain ---------- */

  if (rehearsal) {
    console.log('\n--- rehearsal ------------------------------------------------');
    const ERC20 = await ethers.getContractFactory('MockERC20');
    const Adapter = await ethers.getContractFactory('MockSwapAdapter');

    const adapter = await Adapter.deploy(1n);
    await adapter.waitForDeployment();
    await (await hood.setSwapAdapter(await adapter.getAddress())).wait();
    console.log(`adapter       ${await adapter.getAddress()}`);

    const deposit = ERC20.attach(depositToken);
    await (await deposit.mint(deployer.address, depositAmount)).wait();
    await (await deposit.approve(address, depositAmount)).wait();

    const surcharge = await hood.SURCHARGE();
    await (await hood.mint({ value: surcharge })).wait();
    console.log(`mint          desk #1 issued, ${ethers.formatUnits(depositAmount, 18)} burned`);

    await (await hood.fireRound(0)).wait();
    const pending = await hood.pendingOf(1);
    console.log(`round         fired, desk #1 owed ${pending[0]} units of asset 0`);

    await (await hood.claim(1)).wait();
    const vault = await hood.vaultOf(1);
    const held = await ERC20.attach(rotationAddresses[0]).balanceOf(vault);
    console.log(`claim         vault ${vault} holds ${held}`);

    if (held !== pending[0]) throw new Error('rehearsal mismatch: vault does not hold what was owed');
    console.log('result        OK — mint, round and claim all settled on chain');
    console.log('--------------------------------------------------------------');
    return;
  }

  /* -- live: what to paste, and what is still missing -------------------- */

  console.log('\n--- paste into assets/js/config.js ---------------------------');
  console.log(`  { label: 'Collection · pot', addr: '${address}' },`);
  console.log(`  { label: 'Vault implementation', addr: '${vaultImpl}' },`);
  console.log(`  { label: '$DESKS token', addr: '${depositToken}' },`);
  console.log('--------------------------------------------------------------\n');

  console.log('Not live until all of these are done:');
  console.log('  1. deploy a swap adapter, then setSwapAdapter');
  console.log('  2. repoint the Pons creator-fee wallet at', address);
  console.log('  3. transfer ownership to a multisig (Ownable2Step: propose, then accept)');
  console.log('  4. flip LAUNCHED in assets/js/data.js');
}

main().catch((err) => {
  console.error('\n' + err.message);
  process.exitCode = 1;
});
