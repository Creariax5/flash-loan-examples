const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

async function main() {
    console.log("🚀 Deploying All-in-One Flash Loan Contract on BASE");
    console.log("==================================================\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy the all-in-one contract
    console.log("⚡ Deploying AaveFlashLoanWithSwap...");
    const AaveFlashLoanWithSwap = await ethers.getContractFactory("AaveFlashLoanWithSwap");
    const contract = await AaveFlashLoanWithSwap.deploy(
        BASE_ADDRESSES.PoolAddressesProvider
    );
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log("✅ AaveFlashLoanWithSwap deployed to:", contractAddress);

    // Wait for confirmations
    console.log("\n⏳ Waiting for confirmations...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Verify deployments
    try {
        const owner = await contract.owner();
        const pool = await contract.pool();
        
        console.log("\n✅ Verification successful:");
        console.log("Owner:", owner);
        console.log("Pool:", pool);
    } catch (error) {
        console.log("⚠️ Verification failed:", error.message);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("⚡ Contract Address:", contractAddress);
    console.log("=".repeat(60));

    console.log("\n📋 Test Your Flash Loan + Swap on BASE:");
    console.log("======================================");
    console.log("Contract:", contractAddress);
    console.log("Pool:", "0xd0b53d9277642d899df5c87a3966a349a798f224");
    console.log("USDC:", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
    console.log("WETH:", "0x4200000000000000000000000000000000000006");
    
    console.log("\n🧪 Run test:");
    console.log(`CONTRACT_ADDRESS="${contractAddress}" npx hardhat run scripts/test-simple-flash-swap.js --network base`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
