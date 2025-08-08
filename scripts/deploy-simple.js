const { ethers } = require("hardhat");
const { BASE_ADDRESSES, SEPOLIA_ADDRESSES } = require("./addresses");

async function main() {
    console.log("🚀 Simple PeapodsArbitrageBot Deployment");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log(`📍 Account: ${deployer.address}`);
    console.log(`🌐 Network: ${network.name} (${network.chainId})`);
    console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

    // Use addresses from addresses.js
    let AAVE_ADDRESSES_PROVIDER;
    if (network.chainId === 11155111n) { // Sepolia
        AAVE_ADDRESSES_PROVIDER = SEPOLIA_ADDRESSES.PoolAddressesProvider;
        console.log("🧪 Using Sepolia testnet - FREE!");
    } else if (network.chainId === 8453n) { // Base
        AAVE_ADDRESSES_PROVIDER = BASE_ADDRESSES.PoolAddressesProvider;
        console.log("🏦 Using Base mainnet");
    } else {
        throw new Error(`Unsupported network: ${network.name}`);
    }

    console.log(`🏛️ Aave AddressesProvider: ${AAVE_ADDRESSES_PROVIDER}`);

    // Deploy with simple approach
    const PeapodsArbitrageBot = await ethers.getContractFactory("PeapodsArbitrageBot");
    
    console.log("⏳ Deploying contract...");
    
    // Set a reasonable timeout
    const deployPromise = PeapodsArbitrageBot.deploy(AAVE_ADDRESSES_PROVIDER);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Deployment timeout after 60 seconds")), 60000)
    );
    
    let arbitrageBot;
    try {
        arbitrageBot = await Promise.race([deployPromise, timeoutPromise]);
        console.log("✅ Contract deployed! Waiting for confirmation...");
        
        // Wait for deployment with timeout
        const confirmPromise = arbitrageBot.waitForDeployment();
        const confirmTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Confirmation timeout after 120 seconds")), 120000)
        );
        
        await Promise.race([confirmPromise, confirmTimeoutPromise]);
        
    } catch (error) {
        if (error.message.includes("timeout")) {
            console.log("⏰ Deployment timed out, but may still be processing...");
            console.log("💡 Check the transaction on Etherscan with your deployer address");
            return;
        }
        throw error;
    }
    
    const contractAddress = await arbitrageBot.getAddress();
    const txHash = arbitrageBot.deploymentTransaction()?.hash;
    
    console.log("\n🎉 SUCCESS!");
    console.log("===========");
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Transaction Hash: ${txHash}`);
    console.log(`👤 Owner: ${deployer.address}`);
    
    // Quick verification
    try {
        const owner = await arbitrageBot.owner();
        const poolAddress = await arbitrageBot.pool();
        console.log(`✅ Owner verified: ${owner}`);
        console.log(`✅ Aave pool: ${poolAddress}`);
    } catch (error) {
        console.log("⚠️  Contract deployed but verification failed (network lag)");
    }
    
    // Show explorer links
    if (network.chainId === 11155111n) {
        console.log(`🔍 Sepolia Explorer: https://sepolia.etherscan.io/address/${contractAddress}`);
    } else if (network.chainId === 8453n) {
        console.log(`🔍 Base Explorer: https://basescan.org/address/${contractAddress}`);
    }
    
    console.log(`\n📋 Copy for JavaScript interface:`);
    console.log(`arbitrageBot: '${contractAddress}',`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error.message);
        process.exit(1);
    });
