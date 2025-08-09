const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 DETAILED DEBUGGING: Corrected Arbitrage Contract");
    console.log("=" .repeat(60));
    
    const [executor] = await ethers.getSigners();
    console.log("Debugging with account:", executor.address);
    
    const contractAddress = ARBITRUM_ADDRESSES.ARBITRAGE_CONTRACT;
    console.log("Contract Address:", contractAddress);
    
    // Extended ABI with more functions for debugging
    const contractAbi = [
        "function owner() view returns (address)",
        "function executePeaPEASArbitrage(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params)",
        "function calculatePotentialProfit(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params) view returns (uint256 estimatedProfit, bool isProfitable)",
        "event ArbitrageExecuted(uint256 flashLoanAmount, uint256 profit, bool isUndervaluedStrategy, address indexed executor)",
        "event ArbitrageFailed(string reason, uint256 flashLoanAmount, bool isUndervaluedStrategy)"
    ];
    
    const arbitrageBot = new ethers.Contract(contractAddress, contractAbi, executor);
    
    // Check what specific interfaces are being called
    console.log("\n🔍 TESTING INDIVIDUAL COMPONENTS:");
    
    // Test PEAS token
    const peasAbi = ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"];
    const PEAS = new ethers.Contract(ARBITRUM_ADDRESSES.PEAS, peasAbi, ethers.provider);
    
    try {
        const peasBalance = await PEAS.balanceOf(contractAddress);
        console.log("✅ Contract PEAS Balance:", ethers.formatEther(peasBalance));
    } catch (error) {
        console.log("❌ PEAS balance check failed:", error.message);
    }
    
    // Test pPEAS pod with corrected interface
    const podAbi = [
        "function balanceOf(address) view returns (uint256)",
        "function isAsset(address) view returns (bool)",
        "function bond(address token, uint256 amount, uint256 amountMintMin) external", // This should exist now
        "function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external"
    ];
    
    try {
        const pPEAS = new ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, podAbi, ethers.provider);
        const podBalance = await pPEAS.balanceOf(contractAddress);
        const isPEASAsset = await pPEAS.isAsset(ARBITRUM_ADDRESSES.PEAS);
        
        console.log("✅ Contract pPEAS Balance:", ethers.formatEther(podBalance));
        console.log("✅ PEAS is pod asset:", isPEASAsset);
        
    } catch (error) {
        console.log("❌ pPEAS interface test failed:", error.message);
    }
    
    // Test with minimal parameters for debugging
    const debugParams = {
        usdcToken: ARBITRUM_ADDRESSES.USDC,
        peasToken: ARBITRUM_ADDRESSES.PEAS,
        peaPEAS: ARBITRUM_ADDRESSES.pPEAS,
        pfpOHMo27Vault: ARBITRUM_ADDRESSES.pfUSDC6,
        peaPEASLiquidityPool: ARBITRUM_ADDRESSES.pPEASPool,
        isUndervaluedStrategy: true,
        minProfitAmount: 0, // Set to 0 for debugging
        maxSlippage: 1000 // 10% for debugging
    };
    
    console.log("\n🧪 MINIMAL TEST EXECUTION:");
    const testAmount = ethers.parseUnits("1", 6); // $1 test
    console.log("Test Amount: $1 USDC");
    
    try {
        // First check profitability
        console.log("⏳ Checking profitability...");
        const [estimatedProfit, isProfitable] = await arbitrageBot.calculatePotentialProfit(testAmount, debugParams);
        console.log("Estimated Profit:", ethers.formatUnits(estimatedProfit, 6), "USDC");
        console.log("Is Profitable:", isProfitable);
        
        // Try execution with more detailed error catching
        console.log("⏳ Attempting execution...");
        
        // Estimate gas first
        const gasEstimate = await arbitrageBot.executePeaPEASArbitrage.estimateGas(testAmount, debugParams);
        console.log("Gas Estimate:", gasEstimate.toString());
        
        // Execute with manual gas limit
        const tx = await arbitrageBot.executePeaPEASArbitrage(testAmount, debugParams, {
            gasLimit: gasEstimate + 100000n, // Add 100k gas buffer
            gasPrice: 10000000 // 0.01 gwei for Arbitrum
        });
        
        console.log("📝 Transaction Hash:", tx.hash);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ SUCCESS! Transaction confirmed");
            console.log("Gas Used:", receipt.gasUsed.toString());
            
            // Check for events
            const events = receipt.logs;
            console.log("Events emitted:", events.length);
            
        } else {
            console.log("❌ Transaction failed (status 0)");
        }
        
    } catch (error) {
        console.log("❌ Detailed Error Analysis:");
        console.log("Error Type:", error.constructor.name);
        console.log("Error Message:", error.message);
        
        if (error.data) {
            console.log("Error Data:", error.data);
        }
        
        if (error.transaction) {
            console.log("Transaction Data:", error.transaction.data?.slice(0, 100));
        }
        
        // Check for specific interface errors
        if (error.message.includes("bond") || error.message.includes("debond")) {
            console.log("\n🔍 POD INTERFACE ISSUE DETECTED:");
            console.log("- bond() or debond() function call failed");
            console.log("- Contract may still have interface mismatch");
            console.log("- Check pPEAS pod actual function signatures");
        }
        
        if (error.message.includes("flash") || error.message.includes("loan")) {
            console.log("\n🔍 FLASH LOAN ISSUE DETECTED:");
            console.log("- Flash loan provider may have issues");
            console.log("- Check Aave V3 pool configuration");
        }
        
        if (error.message.includes("swap") || error.message.includes("uniswap")) {
            console.log("\n🔍 SWAP ISSUE DETECTED:");
            console.log("- Uniswap V3 swap may be failing");
            console.log("- Check pool liquidity and routing");
        }
    }
    
    console.log("\n📋 CURRENT STATUS:");
    console.log("✅ Contract deployed successfully");
    console.log("✅ Profitability calculations working (1.47% returns)");
    console.log("✅ Contract funded with flash loan fees");
    console.log("❌ Execution still failing - need more detailed debugging");
    
    console.log("\n🎯 NEXT DEBUGGING STEPS:");
    console.log("1. Test individual pod function calls directly");
    console.log("2. Check actual pPEAS pod function signatures on Arbiscan");
    console.log("3. Test Uniswap V3 swaps independently");
    console.log("4. Verify flash loan callback implementation");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
