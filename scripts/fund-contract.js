const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

// Deployed contract address
const ARBITRAGE_BOT_ADDRESS = "0xb9A2cbbD2ff8F505378c40662284260e7b94DeC4";

async function main() {
    console.log("💰 Funding Arbitrage Contract with USDC");
    console.log("=" .repeat(45));
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("Funding from account:", deployer.address);
    
    // Check current balances
    const usdcAbi = [
        "function balanceOf(address) view returns (uint256)", 
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)"
    ];
    const usdc = new hre.ethers.Contract(ARBITRUM_ADDRESSES.USDC, usdcAbi, deployer);
    
    const deployerBalance = await usdc.balanceOf(deployer.address);
    const contractBalance = await usdc.balanceOf(ARBITRAGE_BOT_ADDRESS);
    const decimals = await usdc.decimals();
    
    console.log("\n📊 Current Balances:");
    console.log(`  Your USDC: ${hre.ethers.formatUnits(deployerBalance, decimals)} USDC`);
    console.log(`  Contract USDC: ${hre.ethers.formatUnits(contractBalance, decimals)} USDC`);
    
    if (deployerBalance === 0n) {
        console.log("\n❌ You have no USDC to transfer!");
        console.log("💡 Get some USDC first, then fund the contract");
        return;
    }
    
    // Fund with 0.1 USDC (enough for fees)
    const fundAmount = hre.ethers.parseUnits("0.1", decimals);
    
    if (deployerBalance < fundAmount) {
        console.log(`\n⚠️  Insufficient USDC. You have ${hre.ethers.formatUnits(deployerBalance, decimals)} USDC`);
        console.log("Using all available USDC instead...");
        fundAmount = deployerBalance;
    }
    
    console.log(`\n💸 Transferring ${hre.ethers.formatUnits(fundAmount, decimals)} USDC to contract...`);
    
    try {
        const tx = await usdc.transfer(ARBITRAGE_BOT_ADDRESS, fundAmount);
        console.log("📝 Transaction Hash:", tx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`✅ Transfer confirmed in block ${receipt.blockNumber}`);
        
        // Check new balances
        const newDeployerBalance = await usdc.balanceOf(deployer.address);
        const newContractBalance = await usdc.balanceOf(ARBITRAGE_BOT_ADDRESS);
        
        console.log("\n📊 New Balances:");
        console.log(`  Your USDC: ${hre.ethers.formatUnits(newDeployerBalance, decimals)} USDC`);
        console.log(`  Contract USDC: ${hre.ethers.formatUnits(newContractBalance, decimals)} USDC`);
        
        // Calculate flash loan capacity
        const flashLoanFeeRate = 5; // 0.0005% = 5 / 10000
        const maxFlashLoan = newContractBalance * 10000n / BigInt(flashLoanFeeRate);
        
        console.log("\n🧮 Flash Loan Capacity:");
        console.log(`  Max Flash Loan: ${hre.ethers.formatUnits(maxFlashLoan, decimals)} USDC`);
        console.log(`  (Contract balance can cover flash loan fees)`);
        
        if (newContractBalance >= hre.ethers.parseUnits("0.01", decimals)) {
            console.log("\n🎉 CONTRACT READY FOR ARBITRAGE!");
            console.log("💡 Now retry the arbitrage execution");
        } else {
            console.log("\n⚠️  Contract balance still low. Consider adding more USDC");
        }
        
    } catch (error) {
        console.log("\n❌ Transfer failed:", error.message);
        
        if (error.message.includes('insufficient allowance')) {
            console.log("💡 Need to approve USDC spending first");
        } else if (error.message.includes('insufficient balance')) {
            console.log("💡 Insufficient USDC balance");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
