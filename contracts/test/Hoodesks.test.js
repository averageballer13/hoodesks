const { expect } = require('chai');
const { ethers } = require('hardhat');

const SURCHARGE = ethers.parseEther('0.05');
const PROTOCOL_CUT = ethers.parseEther('0.005');
const TO_POT = SURCHARGE - PROTOCOL_CUT; // 0.045
const THRESHOLD = ethers.parseEther('0.01');
const DEPOSIT = ethers.parseEther('1000000'); // 1,000,000 with 18 decimals
const BURN = '0x000000000000000000000000000000000000dEaD';
const RATE = 1n; // mock adapter: 1 token unit per wei

async function deploy(assetCount = 3) {
  const [deployer, protocol, alice, bob, carol, keeper] = await ethers.getSigners();

  const ERC20 = await ethers.getContractFactory('MockERC20');
  const desks = await ERC20.deploy('Hoodesks', 'DESKS');

  const rotation = [];
  for (let i = 0; i < assetCount; i++) {
    rotation.push(await ERC20.deploy(`Asset${i}`, `A${i}`));
  }

  const Hoodesks = await ethers.getContractFactory('Hoodesks');
  const hood = await Hoodesks.deploy(
    await desks.getAddress(),
    DEPOSIT,
    protocol.address,
    await Promise.all(rotation.map((r) => r.getAddress())),
    'ipfs://cid/',
    deployer.address,
  );

  const Adapter = await ethers.getContractFactory('MockSwapAdapter');
  const adapter = await Adapter.deploy(RATE);
  await hood.setSwapAdapter(await adapter.getAddress());

  return { hood, desks, rotation, adapter, deployer, protocol, alice, bob, carol, keeper };
}

/** Give `who` enough deposit token and approve the protocol, then mint. */
async function mintTo(hood, desks, who, count = 1) {
  const ids = [];
  await desks.mint(who.address, DEPOSIT * BigInt(count));
  await desks.connect(who).approve(await hood.getAddress(), DEPOSIT * BigInt(count));
  for (let i = 0; i < count; i++) {
    const tx = await hood.connect(who).mint({ value: SURCHARGE });
    const rc = await tx.wait();
    ids.push(await hood.totalMinted());
  }
  return ids;
}

describe('Hoodesks', () => {
  describe('mint', () => {
    it('burns the deposit and splits the surcharge in the same transaction', async () => {
      const { hood, desks, protocol, alice } = await deploy();
      const protoBefore = await ethers.provider.getBalance(protocol.address);

      await mintTo(hood, desks, alice);

      expect(await hood.ownerOf(1)).to.equal(alice.address);
      expect(await hood.totalMinted()).to.equal(1n);
      expect(await desks.balanceOf(BURN)).to.equal(DEPOSIT);
      expect(await desks.balanceOf(alice.address)).to.equal(0n);

      // 10% to the protocol, the rest is the pot and stays in the contract
      expect(await ethers.provider.getBalance(protocol.address) - protoBefore).to.equal(PROTOCOL_CUT);
      expect(await ethers.provider.getBalance(await hood.getAddress())).to.equal(TO_POT);
    });

    it('rejects the wrong surcharge', async () => {
      const { hood, desks, alice } = await deploy();
      await desks.mint(alice.address, DEPOSIT);
      await desks.connect(alice).approve(await hood.getAddress(), DEPOSIT);
      await expect(hood.connect(alice).mint({ value: ethers.parseEther('0.04') }))
        .to.be.revertedWithCustomError(hood, 'WrongSurcharge');
    });

    it('reverts without an approved deposit', async () => {
      const { hood, alice } = await deploy();
      await expect(hood.connect(alice).mint({ value: SURCHARGE })).to.be.reverted;
    });
  });

  describe('rounds', () => {
    it('needs the pot to clear the threshold', async () => {
      const { hood } = await deploy();
      await expect(hood.fireRound(0)).to.be.revertedWithCustomError(hood, 'NoDesksYet');
    });

    it('spends the whole pot and moves to the next asset in order', async () => {
      const { hood, desks, rotation, alice } = await deploy(3);
      await mintTo(hood, desks, alice);

      expect(await hood.nextAsset()).to.equal(0n);
      await hood.fireRound(0);
      expect(await hood.nextAsset()).to.equal(1n);
      expect(await ethers.provider.getBalance(await hood.getAddress())).to.equal(0n);
      expect(await rotation[0].balanceOf(await hood.getAddress())).to.equal(TO_POT * RATE);

      // pot refills, second round buys asset 1
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);
      expect(await hood.nextAsset()).to.equal(2n);
      expect(await rotation[1].balanceOf(await hood.getAddress())).to.equal(TO_POT * RATE);

      // and wraps around after the last
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);
      expect(await hood.nextAsset()).to.equal(0n);
    });

    it('splits equally — one desk, one share, regardless of holder', async () => {
      const { hood, desks, rotation, alice, bob } = await deploy(1);
      await mintTo(hood, desks, alice, 2); // alice holds two
      await mintTo(hood, desks, bob, 1); // bob holds one

      await hood.fireRound(0);

      const pending1 = await hood.pendingOf(1);
      const pending2 = await hood.pendingOf(2);
      const pending3 = await hood.pendingOf(3);
      expect(pending1[0]).to.equal(pending2[0]);
      expect(pending2[0]).to.equal(pending3[0]);
      expect(pending1[0]).to.be.greaterThan(0n);
    });

    it('does not let a desk reach back into rounds that fired before it existed', async () => {
      const { hood, desks, alice, bob } = await deploy(1);
      await mintTo(hood, desks, alice, 1);
      await hood.fireRound(0);

      const early = (await hood.pendingOf(1))[0];
      expect(early).to.be.greaterThan(0n);

      await mintTo(hood, desks, bob, 1);
      expect((await hood.pendingOf(2))[0]).to.equal(0n);

      // and the newcomer participates from the next round on
      await hood.fireRound(0);
      expect((await hood.pendingOf(2))[0]).to.be.greaterThan(0n);
    });

    it('honours the slippage floor', async () => {
      const { hood, desks, alice } = await deploy(1);
      await mintTo(hood, desks, alice);
      await expect(hood.fireRound(ethers.parseEther('999'))).to.be.reverted;
    });
  });

  describe('claiming', () => {
    it('deploys the vault lazily and delivers into it', async () => {
      const { hood, desks, rotation, alice } = await deploy(2);
      await mintTo(hood, desks, alice);

      expect(await hood.vaultOf(1)).to.equal(ethers.ZeroAddress);
      const predicted = await hood.predictVault(1);

      await hood.fireRound(0);
      const owed = (await hood.pendingOf(1))[0];

      await hood.claim(1);
      const vault = await hood.vaultOf(1);
      expect(vault).to.equal(predicted);
      expect(await rotation[0].balanceOf(vault)).to.equal(owed);
      expect((await hood.pendingOf(1))[0]).to.equal(0n);
    });

    it('is permissionless — anyone can deliver to someone else s desk', async () => {
      const { hood, desks, rotation, alice, keeper } = await deploy(1);
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);

      await hood.connect(keeper).claim(1);
      expect(await rotation[0].balanceOf(await hood.vaultOf(1))).to.be.greaterThan(0n);
    });

    it('pays every asset in one call', async () => {
      const { hood, desks, rotation, alice } = await deploy(3);
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);

      await hood.claim(1);
      const vault = await hood.vaultOf(1);
      for (let i = 0; i < 3; i++) {
        expect(await rotation[i].balanceOf(vault)).to.be.greaterThan(0n, `asset ${i} unpaid`);
      }
    });

    it('is idempotent — a second claim pays nothing more', async () => {
      const { hood, desks, rotation, alice } = await deploy(1);
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);
      await hood.claim(1);
      const after = await rotation[0].balanceOf(await hood.vaultOf(1));
      await hood.claim(1);
      expect(await rotation[0].balanceOf(await hood.vaultOf(1))).to.equal(after);
    });
  });

  describe('selling a desk', () => {
    it('hands over what a round credited but never delivered', async () => {
      const { hood, desks, rotation, alice, bob } = await deploy(1);
      await mintTo(hood, desks, alice);

      await hood.fireRound(0);
      const owed = (await hood.pendingOf(1))[0];
      expect(owed).to.be.greaterThan(0n);

      // alice sells without claiming first
      await hood.connect(alice).transferFrom(alice.address, bob.address, 1);
      expect(await hood.ownerOf(1)).to.equal(bob.address);

      // the entitlement went with the token, not the wallet
      expect((await hood.pendingOf(1))[0]).to.equal(owed);

      await hood.connect(bob).claim(1);
      const vault = await hood.vaultOf(1);
      expect(await rotation[0].balanceOf(vault)).to.equal(owed);

      // and bob, as the new holder, is the one who can empty it
      const Vault = await ethers.getContractFactory('DeskVault');
      const v = Vault.attach(vault);
      expect(await v.owner()).to.equal(bob.address);
      await expect(v.connect(alice).withdrawAll(await rotation[0].getAddress(), alice.address))
        .to.be.revertedWithCustomError(v, 'NotDeskOwner');
      await v.connect(bob).withdrawAll(await rotation[0].getAddress(), bob.address);
      expect(await rotation[0].balanceOf(bob.address)).to.equal(owed);
    });

    it('carries a vault that already holds stock', async () => {
      const { hood, desks, rotation, alice, bob } = await deploy(1);
      await mintTo(hood, desks, alice);
      await hood.fireRound(0);
      await hood.claim(1);

      const vault = await hood.vaultOf(1);
      const held = await rotation[0].balanceOf(vault);
      expect(held).to.be.greaterThan(0n);

      await hood.connect(alice).transferFrom(alice.address, bob.address, 1);

      // nothing moved, and the new holder controls it
      expect(await rotation[0].balanceOf(vault)).to.equal(held);
      const Vault = await ethers.getContractFactory('DeskVault');
      expect(await Vault.attach(vault).owner()).to.equal(bob.address);
    });
  });

  describe('integer division', () => {
    it('loses nothing across many rounds with an awkward desk count', async () => {
      // 7 desks against a pot that does not divide by 7
      const { hood, desks, rotation, alice } = await deploy(1);
      await mintTo(hood, desks, alice, 7);

      let bought = 0n;
      for (let r = 0; r < 5; r++) {
        await mintTo(hood, desks, alice, 1); // refill the pot
        const before = await rotation[0].balanceOf(await hood.getAddress());
        await hood.fireRound(0);
        bought += (await rotation[0].balanceOf(await hood.getAddress())) - before;
      }

      const total = await hood.totalMinted();
      for (let id = 1n; id <= total; id++) await hood.claim(id);

      let delivered = 0n;
      for (let id = 1n; id <= total; id++) {
        delivered += await rotation[0].balanceOf(await hood.vaultOf(id));
      }

      // Never over-pay, and never strand more than one unit per desk:
      // the per-round remainder is carried, so only the final floor is left.
      expect(delivered).to.be.lessThanOrEqual(bought);
      expect(bought - delivered).to.be.lessThan(total);

      // whatever is left is still held by the protocol, not destroyed
      const residual = await rotation[0].balanceOf(await hood.getAddress());
      expect(residual).to.equal(bought - delivered);
    });
  });

  describe('royalties', () => {
    it('declares 5% payable to the pot rather than to the protocol wallet', async () => {
      const { hood, protocol } = await deploy();
      const [receiver, amount] = await hood.royaltyInfo(1, ethers.parseEther('1'));
      expect(receiver).to.equal(await hood.getAddress());
      expect(receiver).to.not.equal(protocol.address);
      expect(amount).to.equal(ethers.parseEther('0.05'));
    });

    it('accepts native currency straight into the pot', async () => {
      const { hood, alice } = await deploy();
      await alice.sendTransaction({ to: await hood.getAddress(), value: ethers.parseEther('0.2') });
      expect(await ethers.provider.getBalance(await hood.getAddress())).to.equal(ethers.parseEther('0.2'));
    });
  });

  describe('metadata', () => {
    it('serves a tokenURI off the base URI', async () => {
      const { hood, desks, alice } = await deploy();
      await mintTo(hood, desks, alice);
      expect(await hood.tokenURI(1)).to.equal('ipfs://cid/1.json');
    });
  });
});
