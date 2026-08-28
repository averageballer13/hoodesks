require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

// Values from docs.robinhood.com/chain/connecting. The public RPCs are
// rate-limited and fine for a deploy; point RPC_URL at an Alchemy or QuickNode
// endpoint for anything that reads in a loop.
const PUBLIC_RPC = {
  mainnet: 'https://rpc.mainnet.chain.robinhood.com',
  testnet: 'https://rpc.testnet.chain.robinhood.com',
};

// Never commit a key. Export DEPLOYER_KEY in the shell for the one command
// that needs it, and use a wallet that holds only what the deploy costs.
const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: { sources: './src', tests: './test', cache: './cache', artifacts: './artifacts' },
  networks: {
    robinhood: {
      url: process.env.RPC_URL || PUBLIC_RPC.mainnet,
      chainId: 4663,
      accounts,
    },
    robinhoodTestnet: {
      url: process.env.RPC_URL || PUBLIC_RPC.testnet,
      chainId: 46630,
      accounts,
    },
  },
  etherscan: {
    // Blockscout verification. No API key needed, but the endpoint must match.
    apiKey: { robinhood: 'blockscout', robinhoodTestnet: 'blockscout' },
    customChains: [
      {
        network: 'robinhood',
        chainId: 4663,
        urls: {
          apiURL: 'https://robinhoodchain.blockscout.com/api',
          browserURL: 'https://robinhoodchain.blockscout.com',
        },
      },
      {
        network: 'robinhoodTestnet',
        chainId: 46630,
        urls: {
          apiURL: 'https://explorer.testnet.chain.robinhood.com/api',
          browserURL: 'https://explorer.testnet.chain.robinhood.com',
        },
      },
    ],
  },
};
