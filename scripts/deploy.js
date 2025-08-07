// SPDX-License-Identifier: MIT
const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting deployment of refactored contracts...\n");

    // Get deployment parameters
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

    // Network-specific addresses (update these for your target network)
    const ADDRESSES = {
        // Mainnet Aave V3
        mainnet: {
            aaveAddressProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"
        },
        // Polygon Aave V3  
        polygon: {
            aaveAddressProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb"
        },
        // Add other networks as needed
        hardhat: {
            aaveAddressProvider: "0x0000000000000000000000000000000000000000" // Mock address for testing
        }
    };

    const networkName = hre.network.name;
    const networkConfig = ADDRESSES[networkName];
    
    if (!networkConfig) {
        throw new Error(`No configuration found for network: ${networkName}`);
    }

    console.log(`📡 Deploying to network: ${networkName}`);
    console.log(`🏦 Aave AddressProvider: ${networkConfig.aaveAddressProvider}\n`);

    // 1. Deploy SwapLibrary
    console.log("📚 Deploying SwapLibrary...");
    const SwapLibrary = await hre.ethers.getContractFactory("SwapLibrary");
    const swapLibrary = await SwapLibrary.deploy();
    await swapLibrary.deployed();
    console.log("✅ SwapLibrary deployed to:", swapLibrary.address);

    // 2. Deploy UniswapV2SimpleSwap (linking SwapLibrary)
    console.log("\n💱 Deploying UniswapV2SimpleSwap...");
    const SimpleV2Swap = await hre.ethers.getContractFactory("SimpleV2Swap", {
        libraries: {
            SwapLibrary: swapLibrary.address
        }
    });
    const simpleSwap = await SimpleV2Swap.deploy();
    await simpleSwap.deployed();
    console.log("✅ SimpleV2Swap deployed to:", simpleSwap.address);

    // 3. Deploy AaveFlashBorrower
    console.log("\n⚡ Deploying AaveFlashBorrower...");
    const AaveFlashBorrower = await hre.ethers.getContractFactory("AaveFlashBorrower");
    const flashBorrower = await AaveFlashBorrower.deploy(
        networkConfig.aaveAddressProvider,
        simpleSwap.address
    );
    await flashBorrower.deployed();
    console.log("✅ AaveFlashBorrower deployed to:", flashBorrower.address);

    // 4. Verify deployments
    console.log("\n🔍 Verifying deployments...");
    
    // Check if contracts are properly initialized
    try {
        const pool = await flashBorrower.pool();
        const swapContract = await flashBorrower.swapContract();
        console.log("✅ Flash borrower pool address:", pool);
        console.log("✅ Flash borrower swap contract:", swapContract);
    } catch (error) {
        console.log("❌ Error verifying flash borrower:", error.message);
    }

    // 5. Output deployment summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("📚 SwapLibrary:        ", swapLibrary.address);
    console.log("💱 SimpleV2Swap:       ", simpleSwap.address);
    console.log("⚡ AaveFlashBorrower:   ", flashBorrower.address);
    console.log("=".repeat(60));
    
    // 6. Save deployment addresses
    const deploymentInfo = {
        network: networkName,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            SwapLibrary: swapLibrary.address,
            SimpleV2Swap: simpleSwap.address,
            AaveFlashBorrower: flashBorrower.address
        },
        config: networkConfig
    };

    const fs = require('fs');
    const path = require('path');
    const deploymentDir = path.join(__dirname, '..', 'deployments');
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentDir, `${networkName}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentFile}`);

    console.log("\n📝 Next steps:");
    console.log("1. Verify contracts on Etherscan (if on mainnet/testnet)");
    console.log("2. Fund the AaveFlashBorrower contract if needed");
    console.log("3. Test with small amounts first");
    console.log("4. Monitor gas costs and slippage");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
