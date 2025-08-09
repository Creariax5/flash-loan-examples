const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("../scripts/addresses");

async function main() {
    console.log("🚀 DEPLOYING PEAPEAS ARBITRAGE BOT");
    console.log("==================================");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    // Deploy PeaPEASArbitrageBot
    console.log("\n📝 Deploying PeaPEASArbitrageBot...");
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    const bot = await PeaPEASArbitrageBot.deploy(BASE_ADDRESSES.PoolAddressesProvider);
    
    await bot.waitForDeployment();
    const botAddress = await bot.getAddress();
    
    console.log("✅ PeaPEASArbitrageBot deployed to:", botAddress);
    
    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const owner = await bot.owner();
    console.log("Contract owner:", owner);
    console.log("Deployer address:", deployer.address);
    console.log("Owner matches deployer:", owner === deployer.address);
    
    // Prepare test parameters
    console.log("\n🧪 PREPARING TEST EXECUTION");
    console.log("============================");
    
    const params = {
        usdcToken: BASE_ADDRESSES.USDC,
        peasToken: BASE_ADDRESSES.PEAS,
        peaPEAS: BASE_ADDRESSES.peaPEAS,
        pfpOHMo27Vault: BASE_ADDRESSES.pfpOHMo27,
        peaPEASLiquidityPool: BASE_ADDRESSES.peaPEASPool,
        isUndervaluedStrategy: true, // Current market condition (peaPEAS undervalued)
        minProfitAmount: ethers.parseUnits("0.01", 6), // 1 cent minimum profit
        maxSlippage: 300 // 3%
    };
    
    const flashLoanAmount = ethers.parseUnits("5", 6); // $5 USDC
    
    console.log("Parameters:");
    console.log("- Flash Loan Amount: $5 USDC");
    console.log("- Strategy: UNDERVALUED (buy PEAS → wrap → sell peaPEAS)");
    console.log("- Min Profit: $0.01 USDC");
    console.log("- Max Slippage: 3%");
    console.log("- Expected Profit: ~$0.07 (1.41%)");
    
    // Check if we want to execute immediately
    console.log("\n⚠️  READY TO EXECUTE REAL ARBITRAGE!");
    console.log("=====================================");
    console.log("To execute the arbitrage, run:");
    console.log(`npx hardhat run scripts/execute-peapeas-arbitrage.js --network base`);
    console.log("");
    console.log("Contract Address:", botAddress);
    
    // Save deployment info
    const deploymentInfo = {
        contractAddress: botAddress,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        network: "base",
        flashLoanAmount: "5000000", // 5 USDC in wei
        expectedProfit: "70000", // 0.07 USDC in wei
        params: params
    };
    
    console.log("\n💾 Deployment Info:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    return { bot, botAddress, params, flashLoanAmount };
}

// Execute deployment
if (require.main === module) {
    main()
        .then(({ botAddress }) => {
            console.log(`\n🎯 Deployment completed successfully!`);
            console.log(`Contract address: ${botAddress}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = { main };
