const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying FIXED PodFlashMintTester...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "ETH");

    // Deploy the FIXED contract
    const PodFlashMintTester = await ethers.getContractFactory("PodFlashMintTester");
    const tester = await PodFlashMintTester.deploy();

    await tester.waitForDeployment();
    const contractAddress = await tester.getAddress();

    console.log("✅ FIXED PodFlashMintTester deployed to:", contractAddress);
    console.log("✅ Transaction hash:", tester.deploymentTransaction().hash);

    await tester.deploymentTransaction().wait(3);

    const podETHAddress = await tester.POD_ETH();
    console.log("📋 Pod ETH Address:", podETHAddress);
    console.log("👤 Owner:", await tester.owner());

    console.log("\n🔧 Key Fix Applied:");
    console.log("✅ Now implements IFlashLoanRecipient.callback() instead of receiveFlashMint()");
    console.log("✅ Properly handles Pod's flash mint callback interface");
    console.log("✅ Correctly calculates 0.1% fee (amount/1000, min 1)");
    console.log("✅ Transfers amount + fee back to Pod contract");

    console.log("\n🎉 FIXED contract deployed successfully!");
    console.log("Contract Address:", contractAddress);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});