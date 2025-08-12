const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Fixed PodETH Arbitrage Contract...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "ETH");

    // Check minimum balance
    if (balance < ethers.parseEther("0.001")) {
        console.log("⚠️  WARNING: Low ETH balance, deployment might fail");
    }

    console.log("\n⏳ Deploying contract...");

    try {
        // Deploy the arbitrage contract
        const PodETHArbitrage = await ethers.getContractFactory("PodETHArbitrage");
        const arbitrage = await PodETHArbitrage.deploy();

        console.log("📄 Deployment transaction sent...");
        await arbitrage.waitForDeployment();
        
        const contractAddress = await arbitrage.getAddress();
        console.log("✅ Contract deployed successfully!");
        console.log("📍 Contract Address:", contractAddress);
        
        // Get deployment transaction details
        const deployTx = arbitrage.deploymentTransaction();
        console.log("🔗 Transaction Hash:", deployTx.hash);
        
        console.log("⏳ Waiting for 3 confirmations...");
        const receipt = await deployTx.wait(3);
        console.log("✅ Contract confirmed on-chain!");
        console.log("⛽ Gas Used:", receipt.gasUsed.toString());
        console.log("📦 Block Number:", receipt.blockNumber);

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        if (error.code === 'INSUFFICIENT_FUNDS') {
            console.log("💡 TIP: You need more ETH for gas fees");
        }
        process.exit(1);
    }

    console.log("\n🧪 Running post-deployment checks...");
    
    try {
        // Verify contract setup
        const contractAddress = await arbitrage.getAddress();
        
        // Display key contract addresses
        console.log("\n📋 Contract Configuration:");
        console.log("Contract Address:", contractAddress);
        console.log("podETH:", await arbitrage.POD_ETH());
        console.log("pfUSDC:", await arbitrage.PFUSDC());
        console.log("USDC:", await arbitrage.USDC());
        console.log("WETH:", await arbitrage.WETH());
        console.log("Uniswap V2 Router:", await arbitrage.UNI_V2_ROUTER());
        console.log("Uniswap V3 Router:", await arbitrage.UNI_V3_ROUTER());
        console.log("👤 Owner:", await arbitrage.owner());

        // Test basic functions
        const testAmount = ethers.parseEther("0.001");
        const fee = await arbitrage.calculateFlashMintFee(testAmount);
        const canCover = await arbitrage.canCoverFlashMint(testAmount);
        
        console.log("\n🔍 Contract Health Check:");
        console.log("✅ Contract responds to function calls");
        console.log("✅ Fee calculation works:", formatEther(fee), "podETH");
        console.log("✅ Can cover flash mint check:", canCover);
        
        // Check current balances
        const podETHBalance = await arbitrage.getTokenBalance(await arbitrage.POD_ETH());
        console.log("💰 Current podETH balance:", formatEther(podETHBalance));

    } catch (error) {
        console.error("⚠️  Post-deployment check failed:", error.message);
        console.log("Contract deployed but may have issues");
    }

    console.log("\n🔧 Contract Features:");
    console.log("✅ Flash mint arbitrage (podETH < WETH strategy)");
    console.log("✅ Route: podETH → WETH → USDC → pfUSDC → podETH");
    console.log("✅ Simple flash mint testing function");
    console.log("✅ Better error handling with debug events");
    console.log("✅ Emergency withdraw functions");
    console.log("✅ State reset capabilities");

    console.log("\n📊 Next Steps:");
    console.log("1. Update CONTRACT_ADDRESS in test-arbitrage.js");
    console.log("2. Run: npx hardhat run scripts/test-arbitrage.js --network base");
    console.log("3. Test simple flash mint first");
    console.log("4. Check arbitrage opportunity: node arbitrage-checker.js");
    console.log("5. Fund contract with small podETH for fees if needed:");
    console.log("   - arbitrage.fundWithPodETH(amount)");
    console.log("6. Execute when profitable and tested");

    console.log("\n💡 Important Notes:");
    console.log("- Contract needs podETH balance to cover flash mint fees");
    console.log("- Start with tiny amounts (0.001 podETH) for testing");
    console.log("- Monitor gas costs and slippage");
    console.log("- Only execute when arbitrage-checker shows clear profit");

    console.log("\n🎉 Fixed Arbitrage Contract Deployed Successfully!");
    console.log("📍 CONTRACT ADDRESS:", await arbitrage.getAddress());
    
    // Save contract address to a file for easy reference
    const fs = require('fs');
    const contractInfo = {
        address: await arbitrage.getAddress(),
        deployer: deployer.address,
        network: "base",
        deploymentBlock: (await ethers.provider.getBlockNumber()),
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('deployed-contract.json', JSON.stringify(contractInfo, null, 2));
    console.log("📝 Contract info saved to deployed-contract.json");
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
});