const { ethers } = require("hardhat");

// Aave V3 Sepolia Pool Addresses Provider
const AAVE_POOL_PROVIDER = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A";

async function main() {
    console.log("🚀 Deploying Simple Flash Loan Contract");
    console.log("=======================================\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy the contract
    console.log("📋 Deploying AaveFlashBorrower...");
    const AaveFlashBorrower = await ethers.getContractFactory("AaveFlashBorrower");
    const borrower = await AaveFlashBorrower.deploy(AAVE_POOL_PROVIDER);
    await borrower.waitForDeployment();
    
    const contractAddress = await borrower.getAddress();
    console.log("✅ Contract deployed to:", contractAddress);
    
    // Wait for confirmations
    console.log("⏳ Waiting for confirmations...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
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
    console.log("1. Update CONTRACT_ADDRESS in simple-flash-loan.js");
    console.log("2. Get USDC from Aave faucet: https://staging.aave.com/faucet/");
    console.log("3. Send ~1 USDC to contract for fees:", contractAddress);
    console.log("4. Run: npx hardhat run scripts/simple-flash-loan.js --network sepolia");
    
    console.log("\n🔍 Verification command:");
    console.log(`npx hardhat verify --network sepolia ${contractAddress} "${AAVE_POOL_PROVIDER}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
