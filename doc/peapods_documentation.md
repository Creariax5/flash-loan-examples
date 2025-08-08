# Peapods Quick Reference

## What is a "Pod"?

**A "Pod" = DecentralizedIndex** (the index fund contract)
- Pod = Tokenized basket of multiple assets (like an ETF)
- Each pod is an ERC20 token representing shares in the index
- Pods have liquidity pools (Uniswap V2) for trading
- Pod LP stakers earn rewards that can be auto-compounded

## Core Contracts

### 1. **DecentralizedIndex** - Main Index Fund
```solidity
// WRAP: Multiple tokens → Index tokens
bond(address token, uint256 amount, uint256 amountMintMin)

// UNWRAP: Index tokens → Multiple tokens  
debond(uint256 amount, address[] tokens, uint8[] percentages)

// LIQUIDITY
addLiquidityV2(uint256 idxTokens, uint256 pairedTokens, uint256 slippage, uint256 deadline)
removeLiquidityV2(uint256 lpTokens, uint256 minTokens, uint256 minPaired, uint256 deadline)
```

### 2. **Zapper** - Token Conversion Engine
```solidity
// INTERNAL: Convert any token to any token
_zap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin)
```
**Supports:** Uniswap V2/V3, Curve, ETH/WETH, special tokens (YETH, OHM, pOHM)

### 3. **IndexUtils** - User-Friendly Wrapper
```solidity
// EASY WRAP: One token → Index tokens (auto-converts other needed tokens)
bond(IDecentralizedIndex indexFund, address token, uint256 amount, uint256 amountMintMin)

// LIQUIDITY + STAKING: Add LP and stake in one transaction
addLPAndStake(indexFund, idxTokens, pairedToken, pairedAmount, minPaired, slippage, deadline)

// UNSTAKE + REMOVE LP: Reverse of above
unstakeAndRemoveLP(indexFund, stakedTokens, minLP, minPaired, deadline)

// BATCH REWARDS: Claim from multiple contracts
claimRewardsMulti(address[] rewardContracts)
```

## Quick Usage

### Wrap Tokens
```solidity
// Simple way - provide any token, get index tokens
indexUtils.bond(indexFund, USDC, 1000e6, 0);

// Direct way - must provide all underlying tokens
indexFund.bond(USDC, 1000e6, 0);
```

### Unwrap Tokens
```solidity
// Burn index tokens, get back 50% USDC + 50% WETH
address[] memory tokens = [USDC, WETH];
uint8[] memory percentages = [50, 50];
indexFund.debond(100e18, tokens, percentages);
```

### Add Liquidity + Stake
```solidity
// Provide index tokens + ETH, automatically stake LP tokens
indexUtils.addLPAndStake{value: 1 ether}(
    indexFund, 1000e18, address(0), 1 ether, 0, 30, deadline
);
```

### 4. **LendingAssetVault** - Lending Yield Vault (ERC4626)
```solidity
// LEND: Deposit assets to earn lending yield
deposit(uint256 assets, address receiver) returns (uint256 shares)
mint(uint256 shares, address receiver) returns (uint256 assets)

// WITHDRAW: Redeem shares for assets
withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)  
redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)

// VIEW FUNCTIONS
totalAssets() // Total assets in vault
totalAvailableAssets() // Assets available for withdrawal
convertToShares(uint256 assets) // Convert assets to shares
convertToAssets(uint256 shares) // Convert shares to assets
```

### 5. **LendingAssetVaultFactory** - Create New Lending Vaults
```solidity
// CREATE: Deploy new lending vault for any asset
create(string name, string symbol, address asset, uint96 salt) returns (address vault)
```

## Lending Usage

### Deposit for Lending Yield
```solidity
// Deposit USDC to earn lending yield
IERC20(USDC).approve(vault, 1000e6);
uint256 shares = vault.deposit(1000e6, msg.sender);

// Or mint specific shares
uint256 assets = vault.mint(shares, msg.sender);
```

### Withdraw from Lending
```solidity
// Withdraw specific amount of USDC
uint256 shares = vault.withdraw(500e6, msg.sender, msg.sender);

// Or redeem all shares
uint256 assets = vault.redeem(shares, msg.sender, msg.sender);
```

### Check Available Liquidity
```solidity
// Check how much you can withdraw
uint256 maxWithdraw = vault.maxWithdraw(user);
uint256 availableAssets = vault.totalAvailableAssets();
```

### 6. **AutoCompoundingPodLp** - Auto-Compound LP Rewards (ERC4626)
```solidity
// DEPOSIT: Stake LP tokens to auto-compound rewards
deposit(uint256 assets, address receiver) returns (uint256 shares)

// WITHDRAW: Redeem shares for LP tokens  
withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)

// AUTO-COMPOUND: Owner triggers reward processing
processAllRewardsTokensToPodLp(uint256 amountLpOutMin, uint256 deadline)
```

### 7. **AutoCompoundingPodLpFactory** - Create Auto-Compound Vaults
```solidity
// CREATE: Deploy new auto-compounding vault for any pod
create(string name, string symbol, bool isSelfLendingPod, pod, dexAdapter, indexUtils, salt)
```

## How Pods Work - Complete Flow

### 1. **Create a Pod (Index Fund)**
```solidity
// Pod = DecentralizedIndex with multiple underlying tokens
// Example: Pod holds 40% WETH + 30% USDC + 30% WBTC
```

### 2. **Mint Pod Tokens (Wrapping)**
```solidity
// Deposit underlying tokens → Get pod tokens
indexUtils.bond(pod, USDC, 1000e6, 0);
// User provides USDC → Gets proportional pod tokens
```

### 3. **Create Liquidity Pool**
```solidity
// Pod tokens + Paired token (like DAI) → LP tokens
indexUtils.addLPAndStake(pod, podTokens, DAI, daiAmount, 0, 30, deadline);
```

### 4. **Stake LP Tokens for Rewards**
```solidity
// LP tokens → Staked LP tokens (earn rewards)
stakingPool.stake(user, lpTokens);
```

### 5. **Auto-Compound Rewards (Optional)**
```solidity
// Staked LP tokens → Auto-compounding vault shares
autoCompoundVault.deposit(stakedLpTokens, user);
// Vault automatically:
// 1. Claims reward tokens
// 2. Swaps rewards for paired token
// 3. Adds liquidity to get more LP tokens  
// 4. Stakes new LP tokens
// 5. User's shares grow in value
```

## Leveraged Yield Farming

### How Leverage Works - Step by Step

1. **User deposits pod tokens** (e.g., 1000 pTKN)
2. **Flash loan borrowed tokens** (e.g., 4000 DAI)
3. **Add liquidity** to Uniswap V2 pool: 1000 pTKN + 4000 DAI → LP tokens
4. **Stake LP tokens** → Get staked LP tokens (spTKN)
5. **Deposit spTKN into auto-compound vault** → Get aspTKN (collateral)
6. **Use aspTKN as collateral** in Fraxlend pair to borrow 4000 DAI
7. **Repay flash loan** with borrowed DAI
8. **Result**: 5x leveraged position earning compounded LP rewards

### Leverage Example
```solidity
// User wants 5x leverage on $1000 worth of pTKN
// 1. User provides 1000 pTKN
// 2. System flash loans 4000 DAI
// 3. Creates LP position worth $5000 total
// 4. Uses LP position as collateral to borrow 4000 DAI
// 5. Repays flash loan
// 6. User now has 5x exposure to pTKN price + LP rewards

leverageManager.addLeverage(
    0,           // positionId (0 = new position)
    podAddress,  // pod to leverage
    1000e18,     // pTKN amount
    4000e18,     // total paired LP desired
    0,           // user provided debt amount
    false,       // hasSelfLendingPairPod
    config       // slippage, deadline, etc.
);
```

### Position Management
```solidity
// Increase leverage
leverageManager.addLeverage(positionId, pod, morePtkn, morePairedLp, 0, false, config);

// Reduce leverage
leverageManager.removeLeverage(positionId, borrowSharesToRepay, remLevConfig);

// Borrow more against position
leverageManager.borrowAssets(positionId, 1000e18, 0, msg.sender);
```

### Benefits of Leveraged Positions
- **Amplified Returns**: 2-10x exposure to pod performance
- **Auto-Compounding**: LP rewards automatically reinvested
- **Capital Efficiency**: More exposure with less capital
- **NFT Positions**: Transferable, composable positions

### Risks
- **Liquidation Risk**: If collateral value drops too much
- **Amplified Losses**: Leverage works both ways
- **Interest Costs**: Borrowing costs reduce net returns
- **Complexity**: More moving parts = more risk

## Complete Peapods Ecosystem

## Complete Peapods Ecosystem

### All Components Working Together

**1. Index Funds (Pods)**
- DecentralizedIndex contracts
- Hold baskets of tokens (like ETFs)
- Users wrap/unwrap tokens ↔ pod tokens

**2. Yield Farming**
- Add pod tokens + paired token to Uniswap V2
- Stake LP tokens to earn rewards
- Auto-compound rewards for exponential growth

**3. Lending**
- Deposit any token into lending vaults
- Earn yield from lending to borrowers
- ERC4626 standard vaults

**4. Leveraged Yield Farming** 
- Use pod positions as collateral
- Borrow to amplify exposure
- Auto-compound leveraged returns
- NFT-based position management

### Complete Flow Example
```
User's $1000 USDC → Multiple Strategies:

STRATEGY 1: Index Fund
USDC → Pod Tokens → Diversified exposure

STRATEGY 2: Yield Farming  
USDC → Pod Tokens → LP Tokens → Staked LP → Auto-Compound Vault → Compound growth

STRATEGY 3: Lending
USDC → Lending Vault → Earn interest from borrowers

STRATEGY 4: Leveraged Yield Farming
USDC → Pod Tokens → Flash loan → 5x LP position → Collateralized borrowing → 5x exposure + compound rewards
```

### Why Peapods is Powerful
- **Composability**: All systems work together
- **Flexibility**: Choose your risk/reward level
- **Automation**: Set-and-forget compound growth
- **Capital Efficiency**: Leverage for maximum returns
- **Diversification**: Index funds + multiple yield sources

## How Lending Works

### Behind the Scenes
1. **User deposits USDC** → Gets vault shares (receipt tokens)
2. **Vault owner deploys USDC** to whitelisted lending protocols (Fraxlend, etc.)
3. **Lending protocols pay interest** → Vault shares increase in value
4. **User redeems shares** → Gets original USDC + earned interest

### Auto-Compound LP Rewards
```solidity
// Deposit staked LP tokens into auto-compound vault
IERC20(stakedLpToken).approve(autoVault, amount);
uint256 shares = autoVault.deposit(amount, msg.sender);

// Vault automatically compounds rewards over time
// Your shares increase in value as rewards are reinvested

// Withdraw anytime
uint256 assets = autoVault.redeem(shares, msg.sender, msg.sender);
```

### Manual Reward Processing (Owner Only)
```solidity
// Vault owner can manually trigger reward compounding
autoVault.processAllRewardsTokensToPodLp(minLpOut, deadline);
```

## Lending Integration (Fraxlend Example)
```solidity
// Vault deposits to Fraxlend pair
vault.depositToVault(fraxlendPair, 10000e6); // Lend 10k USDC

// Fraxlend pays interest automatically
// Vault tracks increased value via convertToAssets()

// Vault withdraws from Fraxlend when needed
vault.redeemFromVault(fraxlendPair, shares); // Get USDC back + interest
```

## Key Concepts
- **Index Tokens** = ERC20 representing basket of underlying tokens
- **Bonding** = Wrapping (mint index tokens)
- **Debonding** = Unwrapping (burn index tokens)  
- **Zapping** = Converting between any tokens
- **Lending Vault** = ERC4626 vault that lends assets to earn yield
- **Shares** = ERC20 tokens representing your vault deposit + earned interest
- **1 Wei Reserve** = Keep tiny amounts for gas optimization