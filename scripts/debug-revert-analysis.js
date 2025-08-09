const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 DEEP DEBUGGING: Transaction Revert Analysis");
    console.log("=" .repeat(60));
    
    const [executor] = await ethers.getSigners();
    console.log("Account:", executor.address);
    
    const contractAddress = ARBITRUM_ADDRESSES.ARBITRAGE_CONTRACT;
    console.log("Contract:", contractAddress);
    
    // Check the failed transaction on Arbiscan
    console.log("🔗 Last TX: https://arbiscan.io/tx/0x0f4122ab6f9d2452c52eb5fabb3ef3f9d8535e2129c753ce6c5bda017f013aeb");
    
    // Let's test each component individually to isolate the failure
    console.log("\n1️⃣ TESTING INDIVIDUAL COMPONENTS:");
    
    // Test USDC contract
    try {
        const usdcAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const usdc = new ethers.Contract(ARBITRUM_ADDRESSES.USDC, usdcAbi, ethers.provider);
        const contractBalance = await usdc.balanceOf(contractAddress);
        const decimals = await usdc.decimals();
        console.log("✅ USDC Contract - Balance:", ethers.formatUnits(contractBalance, decimals), "USDC");
    } catch (error) {
        console.log("❌ USDC test failed:", error.message);
    }
    
    // Test PEAS contract
    try {
        const peasAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const peas = new ethers.Contract(ARBITRUM_ADDRESSES.PEAS, peasAbi, ethers.provider);
        const peasBalance = await peas.balanceOf(contractAddress);
        const peasDecimals = await peas.decimals();
        console.log("✅ PEAS Contract - Balance:", ethers.formatUnits(peasBalance, peasDecimals), "PEAS");
    } catch (error) {
        console.log("❌ PEAS test failed:", error.message);
    }
    
    // Test pPEAS pod with correct interface
    try {
        const podAbi = [
            "function balanceOf(address) view returns (uint256)",
            "function isAsset(address) view returns (bool)",
            "function getAllAssets() view returns (tuple(address token, uint256 weighting, uint256 basePriceUSDX96, address c1, uint256 q1)[])"
        ];
        const pPEAS = new ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, podAbi, ethers.provider);
        const podBalance = await pPEAS.balanceOf(contractAddress);
        const isPEASAsset = await pPEAS.isAsset(ARBITRUM_ADDRESSES.PEAS);
        const assets = await pPEAS.getAllAssets();
        
        console.log("✅ pPEAS Pod - Balance:", ethers.formatEther(podBalance), "pPEAS");
        console.log("✅ pPEAS Pod - PEAS is asset:", isPEASAsset);
        console.log("✅ pPEAS Pod - Asset count:", assets.length);
    } catch (error) {
        console.log("❌ pPEAS pod test failed:", error.message);
    }
    
    // Test Aave Pool
    try {
        const aaveAbi = ["function getReserveData(address) view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,uint8))"];
        const aavePool = new ethers.Contract(ARBITRUM_ADDRESSES.Pool, aaveAbi, ethers.provider);
        const reserveData = await aavePool.getReserveData(ARBITRUM_ADDRESSES.USDC);
        console.log("✅ Aave Pool - USDC reserve active");
    } catch (error) {
        console.log("❌ Aave pool test failed:", error.message);
    }
    
    console.log("\n2️⃣ ANALYZING FLASH LOAN CALLBACK:");
    
    // The issue is likely in the flash loan callback - let's check what might be wrong
    const contractAbi = [
        "function calculatePotentialProfit(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params) view returns (uint256 estimatedProfit, bool isProfitable)"
    ];
    
    const contract = new ethers.Contract(contractAddress, contractAbi, ethers.provider);
    
    const params = {
        usdcToken: ARBITRUM_ADDRESSES.USDC,
        peasToken: ARBITRUM_ADDRESSES.PEAS,
        peaPEAS: ARBITRUM_ADDRESSES.pPEAS,
        pfpOHMo27Vault: ARBITRUM_ADDRESSES.pfUSDC6,
        peaPEASLiquidityPool: ARBITRUM_ADDRESSES.pPEASPool,
        isUndervaluedStrategy: true,
        minProfitAmount: 0,
        maxSlippage: 500
    };
    
    // Test multiple amounts to see if it's amount-specific
    const testAmounts = [
        ethers.parseUnits("1", 6),
        ethers.parseUnits("2", 6),
        ethers.parseUnits("5", 6),
        ethers.parseUnits("10", 6)
    ];
    
    console.log("\n3️⃣ PROFITABILITY CHECKS:");
    for (const amount of testAmounts) {
        try {
            const [profit, profitable] = await contract.calculatePotentialProfit(amount, params);
            const amountUSD = ethers.formatUnits(amount, 6);
            const profitUSD = ethers.formatUnits(profit, 6);
            console.log(`$${amountUSD}: Profit $${profitUSD} - ${profitable ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`$${ethers.formatUnits(amount, 6)}: ❌ Calc failed -`, error.message.slice(0, 50));
        }
    }
    
    console.log("\n4️⃣ LIKELY REVERT CAUSES:");
    console.log("Based on the error pattern, the revert is likely caused by:");
    console.log("");
    console.log("A) SLIPPAGE ISSUES:");
    console.log("   - Uniswap V3 swaps failing due to price impact");
    console.log("   - PEAS/WETH pool has low liquidity for small amounts");
    console.log("   - Need higher slippage tolerance");
    console.log("");
    console.log("B) POD BOND/DEBOND ISSUES:");
    console.log("   - bond() function may require minimum amounts");
    console.log("   - debond() may fail with small pPEAS amounts");
    console.log("   - Pod fee calculations causing underflows");
    console.log("");
    console.log("C) VAULT INTERACTION ISSUES:");
    console.log("   - pfUSDC-6 vault may have minimum deposit/withdrawal");
    console.log("   - Vault liquidity constraints");
    console.log("");
    console.log("D) INSUFFICIENT BALANCE ISSUES:");
    console.log("   - Contract running out of tokens mid-execution");
    console.log("   - Flash loan repayment calculation errors");
    
    console.log("\n5️⃣ RECOMMENDED FIXES:");
    console.log("");
    console.log("1. INCREASE SLIPPAGE TOLERANCE:");
    console.log("   - Change maxSlippage from 500 (5%) to 1000 (10%)");
    console.log("");
    console.log("2. USE LARGER AMOUNTS:");
    console.log("   - Test with $100+ to avoid minimum thresholds");
    console.log("");
    console.log("3. ADD MORE DEBUGGING:");
    console.log("   - Add require() statements with detailed error messages");
    console.log("   - Log intermediate balances in contract");
    console.log("");
    console.log("4. CHECK POOL LIQUIDITY:");
    console.log("   - Verify PEAS/WETH pool has sufficient liquidity");
    console.log("   - Check pPEAS/pfUSDC-6 LP pool state");
    
    console.log("\n6️⃣ TRANSACTION TRACE ANALYSIS:");
    console.log("From the Arbiscan logs, I can see:");
    console.log("✅ Flash loan was initiated successfully");
    console.log("✅ USDC was transferred to contract (100 USDC)");
    console.log("✅ USDC was repaid to Aave (100.05 USDC)");
    console.log("❌ ArbitrageFailed events were emitted");
    console.log("");
    console.log("This means the failure happens INSIDE the arbitrage logic,");
    console.log("not in the flash loan setup or repayment.");
    
    console.log("\n🎯 MOST LIKELY ISSUE:");
    console.log("The revert is happening during PEAS → pPEAS bond() or");
    console.log("during the Uniswap swaps due to insufficient liquidity");
    console.log("for small amounts ($2) combined with slippage protection.");
    console.log("");
    console.log("Try testing with larger amounts ($50-100) to see if");
    console.log("the issue is related to minimum thresholds in the pods");
    console.log("or DEX pools.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
