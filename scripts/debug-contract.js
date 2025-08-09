const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

async function debugContract() {
    console.log("🔍 DEBUGGING CONTRACT ISSUES");
    console.log("============================");
    
    const contractAddress = "0xa8628d8163C0262C89A4544624D2A5382bAe9aF0";
    const [signer] = await ethers.getSigners();
    
    console.log("Account:", signer.address);
    console.log("Contract:", contractAddress);
    
    // Connect to contract
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    const bot = PeaPEASArbitrageBot.attach(contractAddress);
    
    // Test basic contract functions
    console.log("\n🧪 TESTING CONTRACT FUNCTIONS:");
    console.log("==============================");
    
    try {
        const owner = await bot.owner();
        console.log("✅ Owner:", owner);
    } catch (error) {
        console.log("❌ Owner call failed:", error.message);
    }
    
    // Test calculateFlashLoanFee
    try {
        const flashLoanAmount = ethers.parseUnits("5", 6);
        const fee = await bot.calculateFlashLoanFee(flashLoanAmount);
        console.log(`✅ Flash loan fee for $5 USDC: ${ethers.formatUnits(fee, 6)} USDC`);
    } catch (error) {
        console.log("❌ Flash loan fee calculation failed:", error.message);
    }
    
    // Test simulation
    const params = {
        usdcToken: BASE_ADDRESSES.USDC,
        peasToken: BASE_ADDRESSES.PEAS,
        peaPEAS: BASE_ADDRESSES.peaPEAS,
        pfpOHMo27Vault: BASE_ADDRESSES.pfpOHMo27,
        peaPEASLiquidityPool: BASE_ADDRESSES.peaPEASPool,
        isUndervaluedStrategy: true,
        minProfitAmount: ethers.parseUnits("0.001", 6),
        maxSlippage: 300
    };
    
    const flashLoanAmount = ethers.parseUnits("5", 6);
    
    try {
        const [profit, isProfitable] = await bot.calculatePotentialProfit(flashLoanAmount, params);
        console.log(`✅ Simulation - Profit: ${ethers.formatUnits(profit, 6)} USDC, Profitable: ${isProfitable}`);
    } catch (error) {
        console.log("❌ Simulation failed:", error.message);
    }
    
    console.log("\n🔍 DEBUGGING RECOMMENDATIONS:");
    console.log("==============================");
    console.log("1. The simulation shows profit but execution fails");
    console.log("2. This indicates a problem in the actual arbitrage logic");
    console.log("3. Most likely issues:");
    console.log("   - PEAS/USDC pool doesn't have enough liquidity for $5 swap");
    console.log("   - peaPEAS wrapping might be failing");
    console.log("   - LP pool liquidity issues");
    console.log("   - pfpOHMo27 vault interaction problems");
    console.log("");
    console.log("4. SOLUTION: Test with smaller amount first");
    console.log("   - Try $1 USDC instead of $5");
    console.log("   - Check individual step liquidity");
    
    console.log("\n💡 NEXT STEP: Try smaller amount");
    console.log("=================================");
    console.log("Let's test with $1 USDC to see if liquidity is the issue...");
    
    // Test with $1 USDC
    const smallFlashLoanAmount = ethers.parseUnits("1", 6);
    const smallParams = { ...params, minProfitAmount: ethers.parseUnits("0.001", 6) };
    
    try {
        const [smallProfit, smallProfitable] = await bot.calculatePotentialProfit(smallFlashLoanAmount, smallParams);
        console.log(`$1 USDC Test - Profit: ${ethers.formatUnits(smallProfit, 6)} USDC, Profitable: ${smallProfitable}`);
        
        if (smallProfitable) {
            console.log("\n🎯 RECOMMENDATION: Execute with $1 USDC first!");
            console.log("If $1 works, the issue is likely liquidity constraints at $5 level.");
        }
    } catch (error) {
        console.log("❌ $1 USDC simulation failed:", error.message);
    }
}

debugContract()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Debug failed:", error);
        process.exit(1);
    });
