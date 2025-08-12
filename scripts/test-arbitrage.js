const { ethers } = require("hardhat");

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0xc48a52bdfcdf5e3c8ae2cf8633f59d8f78a5624d";

async function main() {
    console.log("🧪 Testing PodETH Arbitrage Contract...");

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);
    
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "ETH");

    // Get the contract
    const PodETHArbitrage = await ethers.getContractFactory("PodETHArbitrage");
    const arbitrage = PodETHArbitrage.attach(CONTRACT_ADDRESS);

    console.log("📋 Contract Address:", CONTRACT_ADDRESS);
    console.log("👤 Contract Owner:", await arbitrage.owner());

    // Test with very small amount
    const testAmount = ethers.parseEther("0.00001"); // 0.00001 podETH

    console.log("\n🔍 Pre-execution Checks:");
    console.log("Test amount:", formatEther(testAmount), "podETH");
    
    // Check flash mint fee
    const fee = await arbitrage.calculateFlashMintFee(testAmount);
    console.log("Flash mint fee:", formatEther(fee), "podETH");
    
    // Check if we can cover the fee
    const canCover = await arbitrage.canCoverFlashMint(testAmount);
    console.log("Can cover flash mint fee:", canCover);
    
    // Check contract balances
    const podETHBalance = await arbitrage.getTokenBalance(await arbitrage.POD_ETH());
    const pfUSDCBalance = await arbitrage.getTokenBalance(await arbitrage.PFUSDC());
    const usdcBalance = await arbitrage.getTokenBalance(await arbitrage.USDC());
    const wethBalance = await arbitrage.getTokenBalance(await arbitrage.WETH());
    
    console.log("\n💰 Contract Balances:");
    console.log("podETH:", formatEther(podETHBalance));
    console.log("pfUSDC:", ethers.formatUnits(pfUSDCBalance, 6));
    console.log("USDC:", ethers.formatUnits(usdcBalance, 6));
    console.log("WETH:", formatEther(wethBalance));
    
    if (!canCover) {
        console.log("\n⚠️  WARNING: Contract needs podETH to cover flash mint fees!");
        console.log("💡 TIP: Send some podETH to the contract first or use fundWithPodETH()");
        return;
    }
    
    // STEP 1: Test simple flash mint first
    console.log("\n🧪 STEP 1: Testing simple flash mint...");
    try {
        const tx1 = await arbitrage.testSimpleFlashMint(testAmount);
        console.log("⏳ Simple flash mint submitted:", tx1.hash);
        const receipt1 = await tx1.wait();
        console.log("✅ Simple flash mint successful!");
        console.log("Gas used:", receipt1.gasUsed.toString());
        
    } catch (error) {
        console.error("❌ Simple flash mint failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        
        // Try to reset state
        try {
            await arbitrage.resetFlashMintState();
            console.log("🔄 Flash mint state reset");
        } catch (e) {
            console.log("⚠️  Could not reset flash mint state");
        }
        
        console.log("\n🛑 Since simple flash mint failed, skipping complex arbitrage test");
        return;
    }
    
    // STEP 2: Test complex arbitrage if simple flash mint worked
    console.log("\n🚀 STEP 2: Testing complex arbitrage...");
    console.log("🚨 IMPORTANT: Only execute when arbitrage-checker.js shows profit!");
    
    // Uncomment the section below to test complex arbitrage
    /*
    try {
        console.log("🚀 Executing complex arbitrage...");
        
        // Set up event listener for debug events
        arbitrage.on("DebugStep", (step, amount, event) => {
            console.log(`📊 Debug: ${step} = ${formatEther(amount)}`);
        });
        
        const tx = await arbitrage.executeArbitrageWhenPodETHCheap(testAmount);
        
        console.log("⏳ Transaction submitted:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("✅ Transaction confirmed!");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Block number:", receipt.blockNumber);
        
        // Check results
        const finalPodETH = await arbitrage.getTokenBalance(await arbitrage.POD_ETH());
        const profit = await arbitrage.lastProfit();
        
        console.log("\n📊 Results:");
        console.log("Final podETH balance:", formatEther(finalPodETH));
        console.log("Profit:", formatEther(profit), "podETH");
        
        if (profit > 0) {
            console.log("🎉 ARBITRAGE SUCCESSFUL!");
        } else {
            console.log("😞 No profit made (possibly due to fees/slippage)");
        }
        
    } catch (error) {
        console.error("❌ Complex arbitrage failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        if (error.reason) {
            console.error("Revert reason:", error.reason);
        }
        
        // Try to reset state if needed
        try {
            await arbitrage.resetFlashMintState();
            console.log("🔄 Flash mint state reset");
        } catch (e) {
            console.log("⚠️  Could not reset flash mint state");
        }
    }
    */
    
    console.log("\n✅ Test completed!");
    console.log("📝 Next steps:");
    console.log("1. If simple flash mint worked, uncomment complex arbitrage test");
    console.log("2. Run arbitrage-checker.js to verify profit opportunity");
    console.log("3. Execute complex arbitrage when profitable");
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
});