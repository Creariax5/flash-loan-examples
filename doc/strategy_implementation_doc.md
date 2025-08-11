# Strategy Implementation Status

## ✅ What You Have (Working Scripts)

### Core Conversion Functions
- **USDC → pfUSDC** (deposit.js) - Vault deposit
- **pfUSDC → USDC** (withdraw.js) - Vault withdrawal  
- **WETH → podETH** (wrap.js) - Bond via IndexUtils
- **podETH → WETH** (unwrap.js) - Debond via IndexUtils

### Market Swaps  
- **USDC → WETH** (swap.js) - Uniswap V3
- **pfUSDC → podETH** (new script) - V2 router

## ❌ Missing Critical Components

### Market Swaps (Reverse Direction)
- **WETH → USDC** - Need reverse of swap.js
- **podETH → pfUSDC** - Need reverse of pfUSDC→podETH

### Flash Loan Infrastructure
- **Flash WETH borrow** - Aave/similar protocol
- **Flash podETH mint** - Pod protocol flash mint
- **Flash loan callback logic**

### Strategy Logic
- **Price checker** - Compare podETH vs WETH prices
- **Arbitrage detector** - Identify profitable opportunities  
- **Strategy executor** - Choose flash mint vs flash loan
- **Profit calculator** - Account for all fees

## 🎯 Solidity Contract Calls Needed

### Strategy 1: podETH < WETH (Flash Mint Approach)
```solidity
// 1. Flash mint podETH ✅ NOW HAVE
IDecentralizedIndex(0x433aA366c4dc76aaB00C02E17531ca1A8570De0C).flashMint(
    address(this), 
    amount, 
    "" // callback data
);

// 2. Debond podETH → WETH ✅ HAVE
IDecentralizedIndex(0x433aA366c4dc76aaB00C02E17531ca1A8570De0C).debond(
    amount, 
    [0x4200000000000000000000000000000000000006], // WETH
    [100] // 100%
);

// 3. Swap WETH → USDC ❌ MISSING
ISwapRouter(0x2626664c2603336E57B271c5C0b26F421741e481).exactInputSingle(
    ExactInputSingleParams({
        tokenIn: 0x4200000000000000000000000000000000000006, // WETH
        tokenOut: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, // USDC
        fee: 500,
        recipient: address(this),
        amountIn: wethAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    })
);

// 4. USDC → pfUSDC → podETH ❌ MISSING
// 4a. USDC → pfUSDC ✅ HAVE
IVault(0xAbE754EE72Be07F2707a26Da0724Ac5619295b04).deposit(usdcAmount, address(this));

// 4b. pfUSDC → podETH ✅ HAVE
IUniswapV2Router(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24).swapExactTokensForTokens(
    pfUsdcAmount,
    0,
    [0xAbE754EE72Be07F2707a26Da0724Ac5619295b04, 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C],
    address(this),
    deadline
);

// 5. Return podETH + 0.1% fee (handled in callback)
```

### Strategy 2: podETH > WETH (Flash WETH Approach)
```solidity
// 1. Flash loan WETH ✅ NOW HAVE
IDecentralizedIndex(0x433aA366c4dc76aaB00C02E17531ca1A8570De0C).flash(
    address(this),
    0x4200000000000000000000000000000000000006, // WETH
    amount,
    "" // callback data
);

// 2. Bond WETH → podETH ✅ HAVE  
IIndexUtils(0x490b03c6afe733576cf1f5d2a821cf261b15826d).bond(
    IDecentralizedIndex(0x433aA366c4dc76aaB00C02E17531ca1A8570De0C), // podETH
    0x4200000000000000000000000000000000000006, // WETH
    amount,
    0 // minOut
);

// 3. podETH → pfUSDC → USDC ❌ MISSING
// 3a. podETH → pfUSDC (reverse of pfUSDC→podETH)
IUniswapV2Router(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24).swapExactTokensForTokens(
    podEthAmount,
    0,
    [0x433aA366c4dc76aaB00C02E17531ca1A8570De0C, 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04],
    address(this),
    deadline
);

// 3b. pfUSDC → USDC ✅ HAVE
IVault(0xAbE754EE72Be07F2707a26Da0724Ac5619295b04).redeem(
    pfUsdcAmount,
    address(this),
    address(this)
);

// 4. USDC → WETH ✅ HAVE (reverse of WETH→USDC)
ISwapRouter(0x2626664c2603336E57B271c5C0b26F421741e481).exactInputSingle(
    ExactInputSingleParams({
        tokenIn: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, // USDC
        tokenOut: 0x4200000000000000000000000000000000000006, // WETH
        fee: 500,
        recipient: address(this),
        amountIn: usdcAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    })
);

// 5. Return WETH + 10 DAI fee (handled in callback)
```

## 🔄 Required Callback Functions
```solidity
// For flash mint
function receiveFlashMint(address token, uint256 amount, uint256 fee, bytes calldata data) external {
    // Execute arbitrage logic here
    // Must return `amount + fee` of `token` to msg.sender
}

// For flash loan  
function receiveFlash(address token, uint256 amount, uint256 fee, bytes calldata data) external {
    // Execute arbitrage logic here  
    // Must return `amount + fee` of `token` to msg.sender
    // Fee is 10 DAI regardless of token borrowed
}
```

## 📋 Required Approvals (Don't Forget!)
```solidity
// Before debond (pod needs to burn tokens)
IERC20(0x433aA366c4dc76aaB00C02E17531ca1A8570De0C).approve(0x433aA366c4dc76aaB00C02E17531ca1A8570De0C, amount);

// Before Uniswap V3 swap  
IERC20(tokenIn).approve(0x2626664c2603336E57B271c5C0b26F421741e481, amount);

// Before vault deposit
IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).approve(0xAbE754EE72Be07F2707a26Da0724Ac5619295b04, amount);

// Before V2 swap
IERC20(tokenIn).approve(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24, amount);

// Before bond via IndexUtils
IERC20(0x4200000000000000000000000000000000000006).approve(0x490b03c6afe733576cf1f5d2a821cf261b15826d, amount);
```

## 🔧 Contract Addresses
```solidity
address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant WETH = 0x4200000000000000000000000000000000000006;
address constant pfUSDC = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
address constant podETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
address constant UNISWAP_V3 = 0x2626664c2603336E57B271c5C0b26F421741e481;
address constant UNISWAP_V2 = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
address constant INDEX_UTILS = 0x490b03c6afe733576cf1f5d2a821cf261b15826d;
```

## ✅ Status Summary
- **Flash operations**: ✅ COMPLETE (both flash mint and flash loan)
- **Core conversions**: ✅ COMPLETE (wrap/unwrap, vault deposit/redeem)  
- **Missing swaps**: ❌ WETH→USDC, podETH→pfUSDC (need reverse scripts)
- **Callback functions**: ❌ Need to implement receiveFlashMint() and receiveFlash()

**Next step**: Create the 2 missing swap scripts, then you have everything needed!

## 💡 Quick Wins
Your current scripts can be **combined manually** to test the full flow without flash loans first - just use your own capital to verify the conversion chain works.