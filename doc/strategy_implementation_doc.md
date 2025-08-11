# Arbitrage Strategy - Essential Implementation

## ✅ Working Components
- **Flash mint podETH** ✅ (0.1% fee)
- **Flash loan WETH** ✅ (10 DAI fee)  
- **WETH ↔ podETH** ✅ (bond/debond)
- **USDC ↔ pfUSDC** ✅ (vault deposit/redeem)
- **WETH ↔ USDC** ✅ (Uniswap V3)

## ❌ Missing Components
- **pfUSDC ↔ podETH** (Uniswap V2 - both directions)
- **Price checker** (compare podETH vs WETH)
- **Arbitrage executor** (single contract with both strategies)

## Strategy Logic

### When podETH < WETH (Flash Mint Route)
```solidity
function executeArbitrage1() external {
    // 1. Flash mint podETH (0.1% fee)
    IDecentralizedIndex(podETH).flashMint(address(this), amount, "");
}

function callback(bytes calldata) external override {
    // 2. podETH → WETH (debond)
    IERC20(podETH).approve(podETH, amount);
    IDecentralizedIndex(podETH).debond(amount, [WETH], [100]);
    
    // 3. WETH → USDC (V3 swap)
    IERC20(WETH).approve(uniV3Router, wethAmount);
    ISwapRouter(uniV3Router).exactInputSingle(...);
    
    // 4. USDC → pfUSDC (vault deposit)
    IERC20(USDC).approve(pfUSDC, usdcAmount);
    IERC4626(pfUSDC).deposit(usdcAmount, address(this));
    
    // 5. pfUSDC → podETH (V2 swap)
    IERC20(pfUSDC).approve(uniV2Router, pfUsdcAmount);
    IUniswapV2Router(uniV2Router).swapExactTokensForTokens(
        pfUsdcAmount, 0, [pfUSDC, podETH], address(this), deadline
    );
    
    // 6. Repay flash mint (amount + fee)
    IERC20(podETH).transfer(msg.sender, amount + fee);
}
```

### When podETH > WETH (Flash Loan Route)  
```solidity
function executeArbitrage2() external {
    // 1. Flash loan WETH (10 DAI fee)
    IERC20(DAI).transferFrom(msg.sender, address(this), 10e18);
    IDecentralizedIndex(podETH).flash(address(this), WETH, amount, "");
}

function callback(bytes calldata) external override {
    // 2. WETH → podETH (bond)
    IERC20(WETH).approve(indexUtils, amount);
    IIndexUtils(indexUtils).bond(podETH, WETH, amount, 0);
    
    // 3. podETH → pfUSDC (V2 swap)
    IERC20(podETH).approve(uniV2Router, podEthAmount);
    IUniswapV2Router(uniV2Router).swapExactTokensForTokens(
        podEthAmount, 0, [podETH, pfUSDC], address(this), deadline
    );
    
    // 4. pfUSDC → USDC (vault redeem)
    IERC4626(pfUSDC).redeem(pfUsdcAmount, address(this), address(this));
    
    // 5. USDC → WETH (V3 swap) 
    IERC20(USDC).approve(uniV3Router, usdcAmount);
    ISwapRouter(uniV3Router).exactInputSingle(...);
    
    // 6. Repay flash loan
    IERC20(WETH).transfer(msg.sender, amount);
}
```

## Missing V2 Swap Implementation

### pfUSDC → podETH
```javascript
// Script: scripts/swap-pfusdc-to-podeth.js
const path = [pfUSDC, podETH];
await uniV2Router.swapExactTokensForTokens(
    amount, 0, path, recipient, deadline
);
```

### podETH → pfUSDC  
```javascript
// Script: scripts/swap-podeth-to-pfusdc.js  
const path = [podETH, pfUSDC];
await uniV2Router.swapExactTokensForTokens(
    amount, 0, path, recipient, deadline
);
```

## Price Checker Contract
```solidity
contract PriceChecker {
    function getPodETHPrice() external view returns (uint256) {
        // Get podETH/pfUSDC price from V2 pair
    }
    
    function getWETHPrice() external view returns (uint256) {
        // Get WETH/USDC price from V3 pool
    }
    
    function isArbitrageProfitable() external view returns (bool, uint8) {
        // Compare prices, return (profitable, strategy)
        // strategy: 1 = flash mint, 2 = flash loan
    }
}
```

## Final Arbitrage Contract
```solidity
contract PodETHArbitrage is IFlashLoanRecipient {
    // Combine both strategies + price checking
    // Add profit calculation
    // Add slippage protection
    // Add emergency functions
}
```

## Implementation Priority
1. **Create missing V2 swap scripts** (pfUSDC ↔ podETH)
2. **Build price checker** (compare podETH vs WETH)  
3. **Combine into single arbitrage contract**
4. **Add profit calculation and safety checks**
5. **Deploy and test with small amounts**

## Key Success Metrics
- **Profitable after fees**: Flash mint (0.1%) + DEX fees (0.35%) + gas
- **Execution speed**: Complete arbitrage in single transaction
- **Risk management**: Slippage protection + emergency exits