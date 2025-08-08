const { ethers } = require("hardhat");

async function debugDeployment() {
    console.log("🔍 Debugging Base deployment issue...");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log(`🌐 Network: ${network.name} (${network.chainId})`);
    console.log(`📍 Deployer: ${deployer.address}`);
    
    // Test the Aave addresses
    const AAVE_ADDRESSES_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
    console.log(`🏛️ Testing Aave AddressesProvider: ${AAVE_ADDRESSES_PROVIDER}`);
    
    try {
        // Check if the address has code
        const code = await ethers.provider.getCode(AAVE_ADDRESSES_PROVIDER);
        if (code === "0x") {
            console.log("❌ AddressesProvider has no code - invalid address!");
        } else {
            console.log("✅ AddressesProvider has code");
            
            // Try to get the pool address
            const addressesProvider = new ethers.Contract(
                AAVE_ADDRESSES_PROVIDER,
                ["function getPool() external view returns (address)"],
                ethers.provider
            );
            
            const poolAddress = await addressesProvider.getPool();
            console.log(`🏊 Pool address: ${poolAddress}`);
            
            // Check if pool has code
            const poolCode = await ethers.provider.getCode(poolAddress);
            if (poolCode === "0x") {
                console.log("❌ Pool has no code!");
            } else {
                console.log("✅ Pool has code");
            }
        }
    } catch (error) {
        console.log("❌ Error testing Aave addresses:", error.message);
    }
    
    // Let's use the correct Base Aave addresses
    console.log("\n🔧 Trying correct Base Aave addresses...");
    const CORRECT_BASE_AAVE = "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D"; // From your addresses.js
    console.log(`🏛️ Correct Base AddressesProvider: ${CORRECT_BASE_AAVE}`);
    
    try {
        const code = await ethers.provider.getCode(CORRECT_BASE_AAVE);
        if (code === "0x") {
            console.log("❌ Correct address also has no code!");
        } else {
            console.log("✅ Correct address has code - this should work!");
        }
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

debugDeployment().catch(console.error);
