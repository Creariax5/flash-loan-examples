# Base Network Flash Loan + Swap Deployment

## 🚀 Deploy to Base Mainnet

```bash
npx hardhat run scripts/deploy-all-in-one.js --network base
```

## 📋 What You're Testing

- **Network**: Base Mainnet (cheaper fees than Ethereum)
- **Pool**: `0xd0b53d9277642d899df5c87a3966a349a798f224` (USDC/WETH)
- **Strategy**: Flash loan → Swap USDC→WETH → Swap WETH→USDC → Check profit

## 💰 Economics

- **Flash Loan**: 1000 USDC from Aave V3 Base
- **Aave Fee**: ~0.05% (0.5 USDC)
- **Swap Fees**: 0.3% per swap (Uniswap V2)
- **Total Cost**: ~6 USDC in fees
- **Breakeven**: Need >0.6% price difference between swaps

## 🧪 Test After Deployment

```bash
CONTRACT_ADDRESS="<your_deployed_address>" npx hardhat run scripts/test-simple-flash-swap.js --network base
```

## ⛽ Gas & Costs

- **Base ETH needed**: ~0.005 ETH for deployment + testing
- **Lower fees**: Base has significantly lower gas costs than Ethereum mainnet
- **Fast confirmation**: Usually 2-4 seconds per transaction

## 🎯 Expected Results

This tests if there's any arbitrage opportunity in the same USDC/WETH pool by:
1. Borrowing USDC
2. Swapping 500 USDC → WETH
3. Immediately swapping all WETH → USDC
4. Checking if final USDC > initial amount + fees

**Real arbitrage** would use different pools/DEXes, but this tests the infrastructure.

## 🚨 Important Notes

- **Mainnet testing**: This uses real money on Base mainnet
- **Start small**: Contract uses 1000 USDC for testing
- **Monitor gas**: Base is cheaper but still costs real ETH
- **Emergency exit**: Contract has `emergencyWithdraw()` function
