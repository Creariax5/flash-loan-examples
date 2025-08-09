const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 Testing pPEAS Arbitrage Opportunity on Arbitrum");
    console.log("📍 Network:", (await hre.ethers.provider.getNetwork()).name);
    console.log("=" .repeat(60));

    // First, let's verify all the contract addresses exist and have correct interfaces
    console.log("\n📋 Step 1: Verifying Contract Interfaces");
    
    const testAddress = "0x1234567890123456789012345678901234567890";
    
    try {
        // Test Aave Pool
        console.log("🏦 Testing Aave V3 Pool...");
        const poolAbi = [
            "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes params, uint16 referralCode)",
            "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowRate, uint128 stableBorrowRate, uint128 lastUpdateTimestamp, uint128 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)"
        ];
        const aavePool = new hre.ethers.Contract(ARBITRUM_ADDRESSES.Pool, poolAbi, hre.ethers.provider);
        const usdcReserve = await aavePool.getReserveData(ARBITRUM_ADDRESSES.USDC);
        console.log("  ✅ Aave Pool functional, USDC reserve found");

        // Test USDC token
        console.log("💵 Testing USDC Token...");
        const erc20Abi = [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)"
        ];
        const usdc = new hre.ethers.Contract(ARBITRUM_ADDRESSES.USDC, erc20Abi, hre.ethers.provider);
        const usdcDecimals = await usdc.decimals();
        const usdcSymbol = await usdc.symbol();
        console.log(`  ✅ USDC: ${usdcSymbol}, ${usdcDecimals} decimals`);

        // Test PEAS token  
        console.log("🌱 Testing PEAS Token...");
        const peas = new hre.ethers.Contract(ARBITRUM_ADDRESSES.PEAS, erc20Abi, hre.ethers.provider);
        const peasSymbol = await peas.symbol();
        const peasDecimals = await peas.decimals();
        console.log(`  ✅ PEAS: ${peasSymbol}, ${peasDecimals} decimals`);

    } catch (error) {
        console.log("❌ Contract interface error:", error.message);
        return;
    }

    console.log("\n📋 Step 2: Checking pPEAS Pod Configuration");
    
    try {
        // Test pPEAS pod (should be ERC4626)
        console.log("🏭 Testing pPEAS Pod...");
        const erc4626Abi = [
            "function asset() view returns (address)",
            "function totalAssets() view returns (uint256)", 
            "function previewDeposit(uint256 assets) view returns (uint256)",
            "function previewRedeem(uint256 shares) view returns (uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function totalSupply() view returns (uint256)"
        ];
        const pPEAS = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, erc4626Abi, hre.ethers.provider);
        
        const underlyingAsset = await pPEAS.asset();
        const totalAssets = await pPEAS.totalAssets();
        const totalSupply = await pPEAS.totalSupply();
        
        console.log("  📊 pPEAS Pod Analysis:");
        console.log(`     Underlying Asset: ${underlyingAsset}`);
        console.log(`     Expected pfUSDC-6: ${ARBITRUM_ADDRESSES.pfUSDC6}`);
        console.log(`     Total Assets: ${hre.ethers.utils.formatEther(totalAssets)}`);
        console.log(`     Total Supply: ${hre.ethers.utils.formatEther(totalSupply)}`);
        
        if (underlyingAsset.toLowerCase() === ARBITRUM_ADDRESSES.pfUSDC6.toLowerCase()) {
            console.log("  ✅ pPEAS correctly uses pfUSDC-6 as underlying (USDC-based!)");
        } else {
            console.log("  ❌ pPEAS underlying asset mismatch!");
            return;
        }

        // Test pfUSDC-6 vault
        console.log("🏛️ Testing pfUSDC-6 Vault...");
        const pfUSDC6 = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pfUSDC6, erc4626Abi, hre.ethers.provider);
        const vaultUnderlying = await pfUSDC6.asset();
        
        console.log(`  Vault Underlying: ${vaultUnderlying}`);
        console.log(`  Expected USDC: ${ARBITRUM_ADDRESSES.USDC}`);
        
        if (vaultUnderlying.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase()) {
            console.log("  ✅ pfUSDC-6 correctly uses USDC as underlying!");
        } else {
            console.log("  ❌ pfUSDC-6 underlying asset mismatch!");
            return;
        }

    } catch (error) {
        console.log("❌ pPEAS pod error:", error.message);
        return;
    }

    console.log("\n📋 Step 3: Checking PEAS/USDC Trading Pool");
    
    try {
        // Test Uniswap V3 Pool
        console.log("🦄 Testing PEAS/USDC Uniswap V3 Pool...");
        const poolV3Abi = [
            "function token0() view returns (address)",
            "function token1() view returns (address)",
            "function fee() view returns (uint24)",
            "function liquidity() view returns (uint128)",
            "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
        ];
        
        const peasUsdcPool = new hre.ethers.Contract(ARBITRUM_ADDRESSES.PEAS_USDC_V3_POOL, poolV3Abi, hre.ethers.provider);
        const token0 = await peasUsdcPool.token0();
        const token1 = await peasUsdcPool.token1();
        const fee = await peasUsdcPool.fee();
        const liquidity = await peasUsdcPool.liquidity();
        
        console.log("  📊 Pool Analysis:");
        console.log(`     Token0: ${token0}`);
        console.log(`     Token1: ${token1}`);
        console.log(`     Fee Tier: ${fee / 10000}%`);
        console.log(`     Liquidity: ${liquidity.toString()}`);
        
        // Verify tokens match
        const hasUSDC = token0.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase() || 
                       token1.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase();
        const hasPEAS = token0.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase() || 
                       token1.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase();
        
        if (hasUSDC && hasPEAS) {
            console.log("  ✅ PEAS/USDC pool verified!");
        } else {
            console.log("  ❌ Pool tokens don't match PEAS/USDC");
            return;
        }
        
        if (liquidity.gt(0)) {
            console.log("  ✅ Pool has liquidity for trading!");
        } else {
            console.log("  ❌ Pool has no liquidity!");
            return;
        }

    } catch (error) {
        console.log("❌ Trading pool error:", error.message);
        return;
    }

    console.log("\n📋 Step 4: Economic Analysis");
    
    const economics = {
        pPEASTVL: ARBITRUM_ADDRESSES.pPEASTVL,
        priceGap: ARBITRUM_ADDRESSES.pPEASGap,
        peasUsdcTVL: ARBITRUM_ADDRESSES.PEAS_USDC_TVL,
        fees: {
            wrap: ARBITRUM_ADDRESSES.pPEASWrapFee,
            unwrap: ARBITRUM_ADDRESSES.pPEASUnwrapFee,
            buy: ARBITRUM_ADDRESSES.pPEASBuyFee,
            sell: ARBITRUM_ADDRESSES.pPEASSellFee
        }
    };

    console.log("💰 Economic Opportunity Analysis:");
    console.log(`   pPEAS TVL: $${(economics.pPEASTVL / 1000000).toFixed(1)}M (MASSIVE!)`);
    console.log(`   Price Gap: ${economics.priceGap}%`);
    console.log(`   PEAS/USDC TVL: $${(economics.peasUsdcTVL / 1000).toFixed(1)}K`);
    console.log(`   Total Fees: ${economics.fees.wrap + economics.fees.unwrap + economics.fees.buy + economics.fees.sell}%`);
    
    const netProfitEstimate = economics.priceGap - (economics.fees.wrap + economics.fees.unwrap + economics.fees.buy + economics.fees.sell) - 0.1; // 0.1% for flash loan
    console.log(`   Estimated Net Profit: ${netProfitEstimate.toFixed(2)}%`);

    if (netProfitEstimate > 1.0) {
        console.log("\n🎉 EXCELLENT OPPORTUNITY! Net profit > 1%");
        console.log("🚀 Ready for deployment to Arbitrum!");
    } else if (netProfitEstimate > 0.5) {
        console.log("\n✅ GOOD OPPORTUNITY! Net profit > 0.5%");
        console.log("🚀 Ready for deployment to Arbitrum!");
    } else if (netProfitEstimate > 0) {
        console.log("\n⚠️  MARGINAL OPPORTUNITY. Profit < 0.5%");
        console.log("💡 Consider waiting for better price gap");
    } else {
        console.log("\n❌ NOT PROFITABLE at current prices");
        console.log("⏳ Wait for price gap to improve");
    }

    console.log("\n📝 Summary:");
    console.log("✅ All contract interfaces verified");
    console.log("✅ pPEAS uses USDC-based pfUSDC-6 (not OHM!)"); 
    console.log("✅ PEAS/USDC trading pool functional");
    console.log("✅ Massive $5.3M TVL for large arbitrage");
    console.log(`✅ Estimated ${netProfitEstimate.toFixed(2)}% net profit potential`);

    console.log("\n🚀 Deploy command:");
    console.log("npx hardhat run scripts/deploy-arbitrum-ppeas.js --network arbitrum");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
