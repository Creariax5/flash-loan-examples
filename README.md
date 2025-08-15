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







uint256 testAmount = amount / 10; // Use only 10% for testing to ensure enough left for repayment
        
        // ETH -> POD_ETH
        ISimpleMultiWrapper(WRAPPER).wrap{value: testAmount}();

        // POD_ETH -> ETH
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            IPodETH(POD_ETH).approve(WRAPPER, testAmount);
            ISimpleMultiWrapper(WRAPPER).unwrap(testAmount);
        }
        
        uint256 podBalanceAfter = IERC20(POD_ETH).balanceOf(address(this));
        require(podBalanceAfter >= amount + premium, "Not enough POD_ETH after wrap/unwrap cycle");


USDC -> pfUSDC
pfUSDC -> podETH
podETH -> ETH
ETH -> USDC




____________________________________

1. +USDC (flashloan AAVE)
2. USDC -> pfUSDC (deposit)
3. pfUSDC -> pSimmi (swap pool V2)
4. pSimmi -> simmi (unwrap)
5. simmi -> ETH (swap pool V3)
6. ETH -> USDC (swap pool V3)
7. -USDC (repay flashloan AAVE)


address constant PSIMMI = 0x4707a4535df0e7589B4bfF2A7362FB114D05cC14
address constant SIMMI = 0x161e113B8E9BBAEfb846F73F31624F6f9607bd44
address constant WETH = 0x4200000000000000000000000000000000000006;
address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant PF_USDC_VAULT = 0x02c9428716B6DC4062EB8ba1b2769704b9E24851;
address constant V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
address constant V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;