const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🚀 SIMPLE DEPLOYMENT WITH CORRECTED FEES");
    console.log("=" .repeat(50));
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.formatEther(balance), "ETH");
    
    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    console.log("Current gas price:", ethers.formatUnits(feeData.gasPrice || 0n, "gwei"), "gwei");
    
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    
    try {
        console.log("\n📝 Deploying with minimal gas settings...");
        
        const bot = await PeaPEASArbitrageBot.deploy(
            ARBITRUM_ADDRESSES.PoolAddressesProvider,
            {
                gasPrice: ethers.parseUnits("0.05", "gwei"), // Ultra low gas price
                gasLimit: 2500000 // Reduced gas limit
            }
        );
        
        console.log("⏳ Transaction submitted, waiting...");
        console.log("Transaction hash:", bot.deploymentTransaction().hash);
        
        // Wait with timeout
        const deployedBot = await Promise.race([
            bot.waitForDeployment(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Deployment timeout")), 60000)
            )
        ]);
        
        const address = await bot.getAddress();
        console.log("\n✅ SUCCESS! Contract deployed at:", address);
        
        // Verify the fees are correct
        const peasWethFee = await bot.PEAS_WETH_FEE();
        const wethUsdcFee = await bot.WETH_USDC_FEE();
        
        console.log("\n🔍 Contract verification:");
        console.log("PEAS/WETH fee:", peasWethFee.toString(), `(${Number(peasWethFee)/10000}%)`);
        console.log("WETH/USDC fee:", wethUsdcFee.toString(), `(${Number(wethUsdcFee)/10000}%)`);
        
        if (Number(peasWethFee) === 10000) {
            console.log("✅ PEAS/WETH fee is CORRECT! (10000 = 1%)");
        } else {
            console.log("❌ PEAS/WETH fee is wrong - expected 10000");
        }
        
        console.log("\n🎯 READY FOR TESTING!");
        console.log(`Update addresses.js: ARBITRAGE_CONTRACT: "${address}"`);
        
        return address;
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        
        if (error.message.includes("insufficient funds") || error.message.includes("gas")) {
            console.log("\n💡 Gas-related issue detected");
            console.log("Current balance:", ethers.formatEther(balance), "ETH");
            console.log("Try getting more ETH or using lower gas settings");
        }
        
        throw error;
    }
}

main()
    .then((address) => {
        if (address) {
            console.log("\n🔧 Next steps:");
            console.log("1. Update ARBITRAGE_CONTRACT address");
            console.log("2. Fund contract with USDC");
            console.log("3. Test arbitrage - should work now!");
        }
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
