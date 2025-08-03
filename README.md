# Simple Aave Flash Loan - Sepolia & Base

A minimal implementation of Aave V3 flash loans on both Ethereum Sepolia testnet and Base mainnet.

## What This Does

This project demonstrates simple flash loans:
- **Sepolia**: Borrow 1 USDC (testing with limited liquidity)
- **Base**: Borrow 1000 USDC (mainnet with full liquidity)
- Verify tokens received
- Pay back loan + fee (0.05% = 5 basis points)

## Quick Start

### 1. Setup Environment

Create a `.env` file:
```
PRIVATE_KEY=your_private_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
BASE_RPC_URL=https://mainnet.base.org
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Deploy Contracts

**Sepolia (Testing):**
```bash
npm run compile
npm run deploy
```

**Base (Mainnet):**
```bash
npm run deploy:base
```

### 4. Get Tokens & Test

**For Sepolia:**
1. Get USDC from [Aave Faucet](https://staging.aave.com/faucet/)
2. Send ~0.1 USDC to contract for fees
3. Run: `npm run test-flash-loan`

**For Base:**
1. Send ~1 USDC to contract for fees  
2. Update contract address in `flash-loan-base.js`
3. Run: `npm run test-flash-loan:base`

## Project Structure

```
contracts/
  AaveFlashBorrower.sol     - Simple flash loan contract
scripts/
  addresses.js              - Network addresses
  deploy-simple.js          - Deploy to Sepolia
  deploy-base.js            - Deploy to Base
  simple-flash-loan.js      - Test on Sepolia
  flash-loan-base.js        - Test on Base
```

## Networks

- **Sepolia**: Testing with limited liquidity (1 USDC loans)
- **Base**: Mainnet with full liquidity (1000+ USDC loans)

## Cost

- Flash loan fee: 0.05% (5 basis points)
- Sepolia: ~$0.0005 fee + ~$2-5 gas
- Base: ~$0.50 fee + ~$0.10-0.50 gas
