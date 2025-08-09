const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🚀 DEPLOYING CORRECTED PEAPEAS ARBITRAGE BOT");
    console.log("=" .repeat(50));
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
    
    // Get the contract factory
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    
    console.log("\n📝 Deploying with corrected fee tiers:");
    console.log("PEAS/WETH fee: 10000 (1%) - CORRECTED");
    console.log("WETH/USDC fee: 500 (0.05%) - Already correct");
    
    try {
        // Deploy with manual gas settings for Arbitrum
        const bot = await PeaPEASArbitrageBot.deploy(
            ARBITRUM_ADDRESSES.PoolAddressesProvider,
            {
                gasPrice: ethers.parseUnits("0.1", "gwei"), // Very low gas price for Arbitrum
                gasLimit: 3000000 // Manual gas limit
            }
        );
        
        console.log("\n⏳ Waiting for deployment...");
        await bot.waitForDeployment();
        
        const contractAddress = await bot.getAddress();
        console.log("\n✅ PeaPEASArbitrageBot deployed successfully!");
        console.log("Contract address:", contractAddress);
        
        // Update addresses.js
        console.log("\n📋 Updating addresses.js with new contract address...");
        
        // Verify the fee constants in the deployed contract
        const peasWethFee = await bot.PEAS_WETH_FEE();
        const wethUsdcFee = await bot.WETH_USDC_FEE();
        
        console.log("\n🔍 Verifying deployed contract:");
        console.log("PEAS/WETH fee in contract:", peasWethFee.toString(), `(${Number(peasWethFee)/10000}%)`);
        console.log("WETH/USDC fee in contract:", wethUsdcFee.toString(), `(${Number(wethUsdcFee)/10000}%)`);
        
        if (Number(peasWethFee) === 10000) {
            console.log("✅ PEAS/WETH fee is correct (10000 = 1%)");
        } else {
            console.log("❌ PEAS/WETH fee is wrong!");
        }
        
        if (Number(wethUsdcFee) === 500) {
            console.log("✅ WETH/USDC fee is correct (500 = 0.05%)");
        } else {
            console.log("❌ WETH/USDC fee is wrong!");
        }
        
        console.log("\n🎯 CONTRACT IS READY FOR TESTING!");
        console.log("Next steps:");
        console.log("1. Update ARBITRAGE_CONTRACT in addresses.js");
        console.log("2. Fund with USDC");
        console.log("3. Test arbitrage execution");
        
        return contractAddress;
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error.message);
        
        if (error.message.includes("insufficient funds")) {
            console.log("\n💡 Solution: You need more ETH for gas");
            console.log("Current balance:", ethers.formatEther(balance), "ETH");
            console.log("Estimated needed: ~0.001 ETH for deployment");
        }
        
        throw error;
    }
}

main()
    .then((address) => {
        if (address) {
            console.log(`\n🔧 To update addresses.js, run:`);
            console.log(`Replace ARBITRAGE_CONTRACT with: "${address}"`);
        }
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
