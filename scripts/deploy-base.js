const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

async function main() {
    console.log("🚀 Deploying Flash Loan Contract to Base Mainnet");
    console.log("================================================\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy the contract
    console.log("📋 Deploying AaveFlashBorrower to Base...");
    const AaveFlashBorrower = await ethers.getContractFactory("AaveFlashBorrower");
    const borrower = await AaveFlashBorrower.deploy(BASE_ADDRESSES.PoolAddressesProvider);
    await borrower.waitForDeployment();
    
    const contractAddress = await borrower.getAddress();
    console.log("✅ Contract deployed to:", contractAddress);
    
    // Wait for confirmations
    console.log("⏳ Waiting for confirmations...");
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Verify contract is working
    try {
        const owner = await borrower.owner();
        console.log("Contract owner:", owner);
        console.log("Contract ready for flash loans!\n");
    } catch (error) {
        console.log("⚠️ Contract deployed but verification failed:", error.message);
    }
    
    console.log("📋 Next Steps:");
    console.log("==============");
    console.log("1. Update CONTRACT_ADDRESS in flash-loan-base.js");
    console.log("2. Send some USDC to contract for fees:", contractAddress);
    console.log("3. Run: npx hardhat run scripts/flash-loan-base.js --network base");
    
    console.log("\n🔍 Verification command:");
    console.log(`npx hardhat verify --network base ${contractAddress} "${BASE_ADDRESSES.PoolAddressesProvider}"`);
    
    console.log("\n💰 Base Contract Info:");
    console.log("Contract:", contractAddress);
    console.log("Pool Provider:", BASE_ADDRESSES.PoolAddressesProvider);
    console.log("USDC Address:", BASE_ADDRESSES.USDC);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
