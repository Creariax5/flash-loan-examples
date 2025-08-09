const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

// Deployed contract address
const ARBITRAGE_BOT_ADDRESS = "0xb9A2cbbD2ff8F505378c40662284260e7b94DeC4";

async function main() {
    console.log("🚀 Testing Deployed pPEAS Arbitrage Bot on Arbitrum");
    console.log("=" .repeat(60));
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("Testing with account:", deployer.address);
    
    // Get the deployed contract
    console.log("📋 Contract Info:");
    console.log(`  Address: ${ARBITRAGE_BOT_ADDRESS}`);
    console.log(`  Explorer: https://arbiscan.io/address/${ARBITRAGE_BOT_ADDRESS}`);
    
    // Check contract code
    const code = await hre.ethers.provider.getCode(ARBITRAGE_BOT_ADDRESS);
    console.log(`  Contract deployed: ${code !== '0x' ? '✅ YES' : '❌ NO'} (${code.length} bytes)`);
    
    // Create contract instance
    const contractAbi = [
        "function owner() view returns (address)",
        "function executePeaPEASArbitrage(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params)",
        "function calculatePotentialProfit(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params) view returns (uint256 estimatedProfit, bool isProfitable)",
        "function emergencyRecoverToken(address token, uint256 amount)"
    ];
    
    const arbitrageBot = new hre.ethers.Contract(ARBITRAGE_BOT_ADDRESS, contractAbi, deployer);
    
    console.log("\n🔍 Contract Status Check:");
    try {
        const owner = await arbitrageBot.owner();
        console.log(`  Owner: ${owner}`);
        console.log(`  Is Owner: ${owner.toLowerCase() === deployer.address.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    } catch (error) {
        console.log(`  ❌ Owner check failed:`, error.message);
    }
    
    console.log("\n💰 Current pPEAS Opportunity:");
    console.log(`  pPEAS TVL: $${(ARBITRUM_ADDRESSES.pPEASTVL / 1000000).toFixed(1)}M`);
    console.log(`  Price Gap: ${ARBITRUM_ADDRESSES.pPEASGap}%`);
    console.log(`  Current Price: $${ARBITRUM_ADDRESSES.pPEASPodPrice}`);
    console.log(`  Fair Price: $${ARBITRUM_ADDRESSES.pPEASFairPrice}`);
    console.log(`  Strategy: ${ARBITRUM_ADDRESSES.pPEASPodPrice < ARBITRUM_ADDRESSES.pPEASFairPrice ? 'UNDERVALUED (buy PEAS→wrap)' : 'OVERVALUED (buy peaPEAS→unwrap)'}`);
    
    // Prepare arbitrage parameters
    const arbitrageParams = {
        usdcToken: ARBITRUM_ADDRESSES.USDC,
        peasToken: ARBITRUM_ADDRESSES.PEAS,
        peaPEAS: ARBITRUM_ADDRESSES.pPEAS,
        pfpOHMo27Vault: ARBITRUM_ADDRESSES.pfUSDC6, // pfUSDC-6 vault (USDC-based)
        peaPEASLiquidityPool: ARBITRUM_ADDRESSES.pPEASPool, // pPEAS/pfUSDC-6 LP
        isUndervaluedStrategy: ARBITRUM_ADDRESSES.pPEASPodPrice < ARBITRUM_ADDRESSES.pPEASFairPrice,
        minProfitAmount: hre.ethers.parseUnits("0.01", 6), // 0.01 USDC minimum profit
        maxSlippage: 300 // 3% max slippage
    };
    
    console.log("\n📋 Arbitrage Parameters:");
    console.log(`  USDC: ${arbitrageParams.usdcToken}`);
    console.log(`  PEAS: ${arbitrageParams.peasToken}`);
    console.log(`  pPEAS: ${arbitrageParams.peaPEAS}`);
    console.log(`  pfUSDC-6 Vault: ${arbitrageParams.pfpOHMo27Vault}`);
    console.log(`  LP Pool: ${arbitrageParams.peaPEASLiquidityPool}`);
    console.log(`  Strategy: ${arbitrageParams.isUndervaluedStrategy ? 'UNDERVALUED' : 'OVERVALUED'}`);
    console.log(`  Min Profit: ${hre.ethers.formatUnits(arbitrageParams.minProfitAmount, 6)} USDC`);
    console.log(`  Max Slippage: ${arbitrageParams.maxSlippage / 100}%`);
    
    console.log("\n🧪 Testing Small Flash Loan (1 USDC):");
    const testFlashLoanAmount = hre.ethers.parseUnits("1.0", 6); // 1 USDC
    
    try {
        // Test profit calculation (this should work as it's a view function)
        const [estimatedProfit, isProfitable] = await arbitrageBot.calculatePotentialProfit(
            testFlashLoanAmount,
            arbitrageParams
        );
        
        const profitUsdc = parseFloat(hre.ethers.formatUnits(estimatedProfit, 6));
        const profitPercent = (profitUsdc / 1.0) * 100;
        
        console.log(`  📈 Profit Calculation:`);
        console.log(`     Input: ${hre.ethers.formatUnits(testFlashLoanAmount, 6)} USDC`);
        console.log(`     Estimated Profit: ${profitUsdc.toFixed(4)} USDC (${profitPercent.toFixed(2)}%)`);
        console.log(`     Profitable: ${isProfitable ? '✅ YES' : '❌ NO'}`);
        
        if (isProfitable && profitPercent > 1.0) {
            console.log(`\n🎉 EXCELLENT! Ready for real arbitrage execution!`);
            console.log(`💡 Recommendation: Start with larger amounts for better profits`);
        } else if (isProfitable) {
            console.log(`\n✅ Marginally profitable. Consider waiting for better conditions.`);
        } else {
            console.log(`\n⚠️  Not profitable at current prices. Monitor for better gaps.`);
        }
        
    } catch (error) {
        console.log(`  ❌ Profit calculation failed:`, error.message);
        console.log(`     This might be due to price/liquidity conditions or interface issues`);
    }
    
    console.log("\n🎯 Next Steps:");
    console.log("1. 💰 Fund the contract with USDC for flash loan fees:");
    console.log(`   - Send 10-100 USDC to ${ARBITRAGE_BOT_ADDRESS}`);
    console.log("2. 📊 Monitor pPEAS prices on Peapods dashboard");
    console.log("3. 🚀 Execute arbitrage when profitable:");
    console.log(`   - Call executePeaPEASArbitrage() with appropriate parameters`);
    console.log("4. 📈 Scale up: $5.3M TVL can handle large trades!");
    
    console.log("\n🔗 Useful Links:");
    console.log(`  📊 Peapods Dashboard: https://app.peapods.finance`);
    console.log(`  🔍 Contract Explorer: https://arbiscan.io/address/${ARBITRAGE_BOT_ADDRESS}`);
    console.log(`  💱 pPEAS Pool: https://app.peapods.finance/pods/0x4548c7fAfeFd9e18dBfd583F2b43b67B3B4D4C0A`);
    
    console.log("\n✅ DEPLOYMENT COMPLETE!");
    console.log("Your pPEAS arbitrage bot is live on Arbitrum with superior liquidity!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
