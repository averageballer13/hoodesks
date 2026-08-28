/* ==========================================================================
   HOODESKS — deployment
   --------------------------------------------------------------------------
     npx hardhat run scripts/deploy.cjs --network robinhood

   Reads its inputs from the environment so nothing sensitive lands in git:

     DEPOSIT_TOKEN   address of the launch token (deploy it on Pons first)
     DEPOSIT_AMOUNT  whole tokens burned per mint, default 1000000
     PROTOCOL_WALLET where the protocol's cut goes
     BASE_URI        metadata base, e.g. ipfs://<cid>/
     OWNER           contract owner, defaults to the deployer

   Prints a block ready to paste into ../assets/js/config.js.
   ========================================================================== */

const { ethers } = require('hardhat');

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

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();

  const depositToken = required('DEPOSIT_TOKEN');
  const protocolWallet = required('PROTOCOL_WALLET');
  const baseURI = required('BASE_URI');
  const owner = process.env.OWNER || deployer.address;
  const depositAmount = ethers.parseUnits(process.env.DEPOSIT_AMOUNT || '1000000', 18);

  console.log(`network       ${net.name} (${net.chainId})`);
  console.log(`deployer      ${deployer.address}`);
  console.log(`balance       ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`deposit token ${depositToken}`);
  console.log(`deposit       ${ethers.formatUnits(depositAmount, 18)}`);
  console.log(`protocol      ${protocolWallet}`);
  console.log(`owner         ${owner}`);
  console.log(`base URI      ${baseURI}\n`);

  // Sanity: refuse to deploy against a rotation entry that is not a contract.
  for (const [sym, addr] of ROTATION) {
    const code = await ethers.provider.getCode(addr);
    if (code === '0x') throw new Error(`${sym} at ${addr} has no code on this network`);
  }
  console.log(`rotation      ${ROTATION.length} assets verified on chain\n`);

  const Hoodesks = await ethers.getContractFactory('Hoodesks');
  const hood = await Hoodesks.deploy(
    depositToken,
    depositAmount,
    protocolWallet,
    ROTATION.map(([, a]) => a),
    baseURI,
    owner,
  );
  await hood.waitForDeployment();

  const address = await hood.getAddress();
  const vaultImpl = await hood.vaultImplementation();

  console.log(`Hoodesks             ${address}`);
  console.log(`DeskVault (impl)     ${vaultImpl}\n`);

  console.log('--- paste into assets/js/config.js -------------------------');
  console.log(`  { label: 'Collection · pot', addr: '${address}' },`);
  console.log(`  { label: 'Vault implementation', addr: '${vaultImpl}' },`);
  console.log(`  { label: '$DESKS token', addr: '${depositToken}' },`);
  console.log('------------------------------------------------------------\n');

  console.log('Still to do, in order:');
  console.log('  1. deploy a swap adapter and call setSwapAdapter');
  console.log('  2. repoint the Pons creator-fee wallet at', address);
  console.log('  3. run the keeper: claim Pons fees -> fireRound(minAmountOut)');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
