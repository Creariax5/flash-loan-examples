require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
  solidity: "0.8.19",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
      maxFeePerGas: 20000000,      // 0.02 gwei max
      maxPriorityFeePerGas: 1000000, // 0.001 gwei priority
      gasLimit: 2000000,
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc", 
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
      gasPrice: 50000000, // 0.05 gwei (lower)
      gasLimit: 800000,   // 800k limit (lower)
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
    },
  },
};