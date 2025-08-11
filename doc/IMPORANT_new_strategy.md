## 🔽 Strategy 1: podETH is CHEAP (Below WETH)

**Objective:** Buy cheap podETH → Convert to expensive WETH

### **Flash Mint Approach:**
```solidity
1. flashMint(podETH, amount)           // Create podETH temporarily (0.1% fee)
2. debond(podETH → WETH)              // Unwrap to get WETH (0.5% fee)
3. Sell WETH → USDC (market)          // Sell at high WETH price
4. Buy podETH with USDC (market)      // Buy at low podETH price  
5. Return podETH + 0.1% fee           // Complete flash mint
```

### **Flash Borrow WETH Approach:**
```solidity
1. flash(WETH, amount)                // Borrow WETH (10 DAI fee)
2. Sell WETH → USDC (market)          // Convert to capital
3. Buy podETH with USDC (cheap)       // Buy underpriced podETH
4. debond(podETH → WETH)              // Unwrap to get WETH back
5. Return WETH                        // Complete flash loan
```

---

## 🔼 Strategy 2: podETH is EXPENSIVE (Above WETH)

**Objective:** Buy cheap WETH → Convert to expensive podETH

### **Flash Borrow WETH Approach:**
```solidity
1. flash(WETH, amount)                // Borrow WETH (10 DAI fee)
2. bond(WETH → podETH)                // Wrap to get podETH (0.5% fee)
3. Sell podETH → USDC (market)        // Sell at high podETH price
4. Buy WETH with USDC (market)        // Buy at low WETH price
5. Return WETH                        // Complete flash loan
```

### **Flash Mint Approach:**
```solidity
1. flashMint(podETH, amount)          // Create podETH temporarily (0.1% fee)
2. Sell podETH → USDC (market)        // Sell at high price
3. Buy WETH with USDC (cheap)         // Buy underpriced WETH
4. bond(WETH → podETH)                // Wrap to get podETH back
5. Return podETH + 0.1% fee           // Complete flash mint
```

---

## 💰 Fee Comparison

| Strategy | Flash Fee | Bond/Debond | Trading | Total |
|----------|-----------|-------------|---------|-------|
| **Flash Mint (Both)** | 0.1% | 0.5% | 0.3% | **~0.9%** |
| **Flash WETH (Both)** | 10 DAI | 0.5% | 0.3% | **~0.8% + 10 DAI** |

## 🎯 Which to Use When?

### **When podETH < WETH (Cheap):**
- **Flash Mint**: Best for smaller amounts ($10K-100K)
- **Flash WETH**: Best for larger amounts ($200K+) where 10 DAI becomes negligible

### **When podETH > WETH (Expensive):**
- **Flash WETH**: Usually best (can wrap WETH→podETH directly)
- **Flash Mint**: Alternative if you want to avoid bond fees

## 🔧 Implementation Logic

```solidity
function executeArbitrage(uint256 podETHPrice, uint256 wethPrice, uint256 amount) external {
    if (podETHPrice < wethPrice) {
        // podETH is cheap - exploit by getting WETH
        if (amount < 100000e18) {
            flashMintToCaptureWETH(amount);
        } else {
            flashWETHToCaptureArbitrage(amount);
        }
    } else if (podETHPrice > wethPrice) {
        // podETH is expensive - exploit by getting podETH
        flashWETHToCapturePodETH(amount);
    }
}
```
