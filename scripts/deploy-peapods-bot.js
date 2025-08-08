const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Deploying PeapodsArbitrageBot on SEPOLIA TESTNET...");
    
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Sepolia network Aave V3 AddressesProvider (FREE TESTNET)
    const AAVE_ADDRESSES_PROVIDER = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A";
    
    console.log("🧪 Using Aave AddressesProvider (SEPOLIA TESTNET):", AAVE_ADDRESSES_PROVIDER);
    console.log("💡 This deployment uses FREE testnet ETH - no real cost!");

    // Deploy PeapodsArbitrageBot
    const PeapodsArbitrageBot = await ethers.getContractFactory("PeapodsArbitrageBot");
    let arbitrageBot;
    
    console.log("⏳ Estimating gas...");
    try {
        const deployTx = await PeapodsArbitrageBot.getDeployTransaction(AAVE_ADDRESSES_PROVIDER);
        const gasEstimate = await deployer.estimateGas(deployTx);
        console.log("⛽ Gas estimate:", gasEstimate.toString());
        
        console.log("⏳ Deploying contract...");
        arbitrageBot = await PeapodsArbitrageBot.deploy(AAVE_ADDRESSES_PROVIDER, {
            gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        });
        
        console.log("⏳ Waiting for deployment confirmation...");
        await arbitrageBot.waitForDeployment();
    } catch (error) {
        console.error("❌ Deployment error details:", error);
        
        // Try to get more specific error info
        if (error.reason) {
            console.error("📋 Error reason:", error.reason);
        }
        if (error.code) {
            console.error("📋 Error code:", error.code);
        }
        
        throw error;
    }
    
    const contractAddress = await arbitrageBot.getAddress();
    console.log("✅ PeapodsArbitrageBot deployed to:", contractAddress);
    
    // Verify deployment
    console.log("🔍 Verifying deployment...");
    const owner = await arbitrageBot.owner();
    console.log("👤 Contract owner:", owner);
    console.log("🏛️ Aave pool address:", await arbitrageBot.pool());
    
    // Save deployment info
    const deploymentInfo = {
        contractName: "PeapodsArbitrageBot",
        contractAddress: contractAddress,
        deployerAddress: deployer.address,
        network: "sepolia-testnet",
        aaveAddressesProvider: AAVE_ADDRESSES_PROVIDER,
        deploymentDate: new Date().toISOString(),
        transactionHash: arbitrageBot.deploymentTransaction()?.hash
    };
    
    console.log("\n📋 Deployment Summary:");
    console.log("========================");
    console.log(`Contract: ${deploymentInfo.contractName}`);
    console.log(`Address: ${deploymentInfo.contractAddress}`);
    console.log(`Owner: ${deploymentInfo.deployerAddress}`);
    console.log(`Network: ${deploymentInfo.network}`);
    console.log(`Tx Hash: ${deploymentInfo.transactionHash}`);
    
    console.log("\n🎯 Next Steps:");
    console.log("1. Update CONTRACT_ADDRESSES.arbitrageBot in arbitrage_js_interface.js");
    console.log("2. Find missing contract addresses (pfUSDC-31 vault, TOAST/USDC pair)");
    console.log("3. Fund the contract with some ETH for gas if needed");
    console.log("4. Start monitoring for arbitrage opportunities!");
    
    console.log(`\n💡 Copy this address for your JavaScript interface:`);
    console.log(`arbitrageBot: '${contractAddress}',`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
