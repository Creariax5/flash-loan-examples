const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying PodFlashMintArbitrage...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "ETH");

    // Deploy the arbitrage contract
    const PodFlashMintArbitrage = await ethers.getContractFactory("PodFlashMintArbitrage");
    const arbitrage = await PodFlashMintArbitrage.deploy();

    await arbitrage.waitForDeployment();
    const contractAddress = await arbitrage.getAddress();

    console.log("✅ PodFlashMintArbitrage deployed to:", contractAddress);
    console.log("✅ Transaction hash:", arbitrage.deploymentTransaction().hash);

    await arbitrage.deploymentTransaction().wait(3);

    const podETHAddress = await arbitrage.POD_ETH();
    const wethAddress = await arbitrage.WETH();
    const indexUtilsAddress = await arbitrage.INDEX_UTILS();
    
    console.log("📋 Contract Addresses:");
    console.log("  Pod ETH:", podETHAddress);
    console.log("  WETH:", wethAddress);
    console.log("  IndexUtils:", indexUtilsAddress);
    console.log("👤 Owner:", await arbitrage.owner());

    console.log("\n🔧 Features:");
    console.log("✅ Flash mint from Pod protocol");
    console.log("✅ Debond podETH to WETH arbitrage");
    console.log("✅ Bond WETH back to podETH");
    console.log("✅ Automatic fee calculation (0.1%, min 1)");
    console.log("✅ Isolated arbitrage logic");

    console.log("\n📖 Usage:");
    console.log("1. Call requestFlashMint(amount) to execute arbitrage");
    console.log("2. Contract will automatically:");
    console.log("   - Flash mint podETH");
    console.log("   - Debond to WETH");
    console.log("   - Bond back to podETH");
    console.log("   - Repay flash loan + fee");

    console.log("\n🎉 Arbitrage contract deployed successfully!");
    console.log("Contract Address:", contractAddress);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});