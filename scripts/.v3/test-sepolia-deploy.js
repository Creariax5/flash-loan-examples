const { ethers } = require("hardhat");

// Sepolia test deployment - using dummy addresses for deployment test
const TEST_ADDRESSES = {
    USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Sepolia USDC
    WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c", // Sepolia WETH
    POD_ETH: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Dummy
    PF_USDC_VAULT: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Dummy
    PF_USDC_POD_ETH_PAIR: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Dummy
    WETH_USDC_PAIR: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8" // Dummy
};

async function main() {
    console.log("🧪 Testing Minimal Contract Deployment on Sepolia");
    
    const [deployer] = await ethers.getSigners();
    const network = await deployer.provider.getNetwork();
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    console.log("Account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    if (network.chainId !== 11155111n) {
        console.log("❌ This script is for Sepolia testnet only (Chain ID: 11155111)");
        console.log("Use: npx hardhat run scripts/test-sepolia-deploy.js --network sepolia");
        return;
    }
    
    // Deploy minimal contract
    console.log("\n🚀 Deploying minimal test contract...");
    const Test = await ethers.getContractFactory("MinimalPodETHTest");
    const test = await Test.deploy({
        gasLimit: 1000000 // 1M gas limit - should be plenty for minimal contract
    });
    await test.waitForDeployment();
    
    const contractAddress = await test.getAddress();
    console.log("✅ Deployed to:", contractAddress);
    
    // Get deployment cost
    const deployTx = test.deploymentTransaction();
    if (deployTx) {
        const receipt = await deployTx.wait();
        const cost = receipt.gasUsed * receipt.gasPrice;
        console.log("💰 Deployment cost:", ethers.formatEther(cost), "ETH");
        console.log("📊 Gas used:", receipt.gasUsed.toString());
    }
    
    // Setup addresses (dummy ones for testing)
    console.log("\n⚙️ Setting up test addresses...");
    await test.setup(
        TEST_ADDRESSES.USDC,
        TEST_ADDRESSES.WETH,
        TEST_ADDRESSES.POD_ETH,
        TEST_ADDRESSES.PF_USDC_VAULT,
        TEST_ADDRESSES.PF_USDC_POD_ETH_PAIR,
        TEST_ADDRESSES.WETH_USDC_PAIR,
        {
            gasLimit: 100000
        }
    );
    
    console.log("✅ Setup complete!");
    
    // Test basic functionality
    console.log("\n🧪 Testing basic functions...");
    const balances = await test.balances();
    console.log("✅ Balance check works");
    
    console.log("\n🎉 SEPOLIA DEPLOYMENT SUCCESSFUL!");
    console.log("Contract size is acceptable and deployment works");
    console.log("Ready to deploy on Arbitrum with real addresses");
    
    console.log("\n📋 Next Steps:");
    console.log("1. npx hardhat run scripts/minimal-test.js --network arbitrum");
    console.log("2. Cost should be ~$0.20 on Arbitrum (much cheaper than Base)");
    console.log("3. Test with real podETH addresses on Arbitrum");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
