# Peapods API Reference

## Core Contracts

### **DecentralizedIndex** (Pod Contract)
```solidity
// WRAP/UNWRAP (implemented in concrete contracts)
bond(address token, uint256 amount, uint256 amountMintMin)
debond(uint256 amount, address[] tokens, uint8[] percentages)

// LIQUIDITY
addLiquidityV2(uint256 _pTKNLPTokens, uint256 _pairedLPTokens, uint256 _slippage, uint256 _deadline) returns (uint256)
removeLiquidityV2(uint256 _lpTokens, uint256 _minIdxTokens, uint256 _minPairedLpToken, uint256 _deadline)

// FLASH OPERATIONS  
flash(address _recipient, address _token, uint256 _amount, bytes calldata _data) // Flash loan underlying tokens (10 DAI fee)
flashMint(address _recipient, uint256 _amount, bytes calldata _data) // Flash mint pTKN (0.1% fee)

// UTILS
burn(uint256 _amount) // Burn your pTKN
processPreSwapFeesAndSwap() // Process accumulated fees

// VIEW
getAllAssets() returns (IndexAssetInfo[]) // Get all underlying tokens
isAsset(address _token) returns (bool) // Check if token is in pod
config() returns (Config) // Get pod configuration  
fees() returns (Fees) // Get fee structure
BOND_FEE() returns (uint16) // Get bond fee in basis points
DEBOND_FEE() returns (uint16) // Get debond fee in basis points
```

### **IndexUtils** (User-Friendly Wrapper)
```solidity
// EASY WRAP - Any token → Pod tokens (auto-converts)
bond(IDecentralizedIndex indexFund, address token, uint256 amount, uint256 amountMintMin)

// LIQUIDITY + STAKING
addLPAndStake(indexFund, idxTokens, pairedToken, pairedAmount, minPaired, slippage, deadline)
unstakeAndRemoveLP(indexFund, stakedTokens, minLP, minPaired, deadline)

// BATCH
claimRewardsMulti(address[] rewardContracts) // Claim from multiple contracts
```

### **LendingAssetVault** (ERC4626)
```solidity
// DEPOSIT
deposit(uint256 assets, address receiver) returns (uint256 shares) // Deposit assets, get shares
mint(uint256 shares, address receiver) returns (uint256 assets) // Mint shares, pay assets

// WITHDRAW  
withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares) // Get assets, burn shares
redeem(uint256 shares, address receiver, address owner) returns (uint256 assets) // Burn shares, get assets

// VIEW
totalAssets() returns (uint256) // Total assets in vault
totalAvailableAssets() returns (uint256) // Assets available for withdrawal
convertToShares(uint256 assets) returns (uint256) // Assets → Shares
convertToAssets(uint256 shares) returns (uint256) // Shares → Assets
maxWithdraw(address owner) returns (uint256) // Max withdrawable assets
```

### **LendingAssetVaultFactory**
```solidity
create(string name, string symbol, address asset, uint96 salt) returns (address vault) // Deploy new lending vault
```

### **AutoCompoundingPodLp** (ERC4626)
```solidity
// DEPOSIT/WITHDRAW (same as LendingAssetVault)
deposit(uint256 assets, address receiver) returns (uint256 shares) // Stake LP tokens
withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares) // Unstake LP tokens

// AUTO-COMPOUND
processAllRewardsTokensToPodLp(uint256 amountLpOutMin, uint256 deadline) // Owner only: compound rewards
```

### **AutoCompoundingPodLpFactory**
```solidity
create(string name, string symbol, bool isSelfLendingPod, pod, dexAdapter, indexUtils, salt) // Deploy auto-compound vault
```

### **Zapper** (Internal Token Conversion)
```solidity
_zap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) // Convert any token to any token
```
**Supports:** Uniswap V2/V3, Curve, ETH/WETH, special tokens

## Base Network Addresses

```javascript
const ADDRESSES = {
  // Tokens
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  weth: "0x4200000000000000000000000000000000000006",
  
  // Pods
  podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
  
  // Vaults  
  pfUSDCVault: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04",
  
  // Core
  indexUtils: "0x490b03c6afe733576cf1f5d2a821cf261b15826d"
};
```

## Usage Patterns

### Deposit to Lending Vault
```javascript
await usdc.approve(vault, amount);
const shares = await vault.deposit(amount, userAddress);
```

### Withdraw from Lending Vault  
```javascript
const assets = await vault.redeem(shares, userAddress, userAddress);
```

### Wrap Token to Pod
```javascript
await token.approve(indexUtils, amount);
await indexUtils.bond(pod, token, amount, 0);
```

### Unwrap Pod to Tokens
```javascript
await pod.debond(amount, [token1, token2], [50, 50]); // 50% each
```

### Add Liquidity to Pod
```javascript
await pod.addLiquidityV2(podTokens, pairedTokens, 30, deadline); // 3% slippage
```

### Remove Liquidity from Pod
```javascript
await pod.removeLiquidityV2(lpTokens, minPod, minPaired, deadline);
```

## Key Concepts

- **Pod** = Index fund (DecentralizedIndex contract)
- **Bonding** = Wrapping tokens → Pod tokens  
- **Debonding** = Unwrapping Pod tokens → Underlying tokens
- **pfToken** = Vault shares (e.g., pfUSDC = USDC vault shares)
- **ERC4626** = Standard vault interface
- **Slippage** = 30 = 3%, 100 = 10%, 1000 = 100%
- **Fees** = Basis points (100 = 1%)
- **Flash Loan Fee** = 10 DAI flat fee
- **Flash Mint Fee** = 0.1% of minted amount