# Simple Aave Flash Loan - $100 Example

A minimal implementation of an Aave V3 flash loan to borrow $100 worth of USDC on Ethereum Sepolia testnet.

## What This Does

This project demonstrates the simplest possible flash loan:
1. Borrow 100 USDC from Aave V3
2. Verify we received the tokens
3. Pay back the loan + fee (currently 0.09%)

## Quick Start

### 1. Setup Environment

Create a `.env` file:
```
PRIVATE_KEY=your_private_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Deploy Contract

```bash
npm run compile
npm run deploy
```

### 4. Get Test Tokens

1. Go to [Aave Faucet](https://staging.aave.com/faucet/)
2. Connect your wallet on Sepolia
3. Request USDC tokens
4. Send ~1 USDC to your deployed contract for fees

### 5. Test Flash Loan

Update the `CONTRACT_ADDRESS` in `scripts/simple-flash-loan.js` with your deployed contract address, then run:

```bash
npm run test-flash-loan
```

## Project Structure

```
contracts/
  AaveFlashBorrower.sol  - Simple flash loan contract
scripts/
  deploy-simple.js       - Deploy the contract
  simple-flash-loan.js   - Test the flash loan
.env                     - Environment variables
hardhat.config.ts        - Hardhat configuration
```

## Key Files

- **AaveFlashBorrower.sol**: Minimal flash loan contract with just the essential functionality
- **simple-flash-loan.js**: Test script that borrows exactly $100 worth of USDC

## How It Works

1. Contract requests 100 USDC from Aave Pool
2. Aave sends tokens to contract
3. Contract executes simple logic (just verification)
4. Contract approves repayment (100 USDC + 0.09 USDC fee)
5. Aave pulls back the repayment

## Cost

- Flash loan fee: 0.09% (9 basis points)
- For $100 loan: ~$0.09 fee
- Gas costs: ~$2-5 on Sepolia (varies)

## Notes

- This is for educational purposes on testnet only
- Real flash loans should implement profitable strategies
- Never keep funds permanently in the flash loan contract
