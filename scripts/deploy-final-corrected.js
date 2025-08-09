const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🚀 DEPLOYING CORRECTED CONTRACT - FINAL FIX");
    console.log("=" .repeat(50));
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.002")) {
        console.log("❌ Need more ETH for deployment. Current:", ethers.formatEther(balance), "ETH");
        console.log("💡 Get some ETH from Arbitrum faucet or bridge from mainnet");
        return;
    }
    
    console.log("\n📝 DEPLOYING WITH CORRECT FEE CONSTANTS:");
    console.log("PEAS_WETH_FEE: 10000 (1%) - CORRECTED");
    console.log("WETH_USDC_FEE: 500 (0.05%) - Already correct");
    
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    
    try {
        // Use auto gas estimation but with some buffer
        const deployTx = await PeaPEASArbitrageBot.getDeployTransaction(
            ARBITRUM_ADDRESSES.PoolAddressesProvider
        );
        
        // Estimate gas
        const gasEstimate = await ethers.provider.estimateGas(deployTx);
        console.log("Estimated gas:", gasEstimate.toString());
        
        // Get current gas price
        const feeData = await ethers.provider.getFeeData();
        const gasPrice = feeData.gasPrice;
        console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
        
        // Calculate total cost
        const totalCost = gasEstimate * gasPrice;
        console.log("Estimated cost:", ethers.formatEther(totalCost), "ETH");
        
        if (balance < totalCost * 2n) { // 2x buffer
            console.log("❌ Insufficient ETH for deployment");
            console.log("Need:", ethers.formatEther(totalCost * 2n), "ETH");
            console.log("Have:", ethers.formatEther(balance), "ETH");
            return;
        }
        
        // Deploy with estimated gas + 20% buffer
        const bot = await PeaPEASArbitrageBot.deploy(
            ARBITRUM_ADDRESSES.PoolAddressesProvider,
            {
                gasLimit: gasEstimate + (gasEstimate * 20n) / 100n,
                gasPrice: gasPrice
            }
        );
        
        console.log("\n⏳ Deployment transaction submitted...");
        console.log("TX Hash:", bot.deploymentTransaction().hash);
        
        console.log("⏳ Waiting for confirmation...");
        await bot.waitForDeployment();
        
        const contractAddress = await bot.getAddress();
        console.log("\n✅ SUCCESS! Contract deployed to:", contractAddress);
        
        // Verify the fee constants
        const peasWethFee = await bot.PEAS_WETH_FEE();
        const wethUsdcFee = await bot.WETH_USDC_FEE();
        
        console.log("\n🔍 Verification:");
        console.log(`PEAS_WETH_FEE: ${peasWethFee} (${Number(peasWethFee)/10000}%)`);
        console.log(`WETH_USDC_FEE: ${wethUsdcFee} (${Number(wethUsdcFee)/10000}%)`);
        
        if (Number(peasWethFee) === 10000) {
            console.log("✅ PEAS_WETH_FEE is CORRECT!");
        } else {
            console.log("❌ PEAS_WETH_FEE is still wrong!");
        }
        
        console.log("\n🎯 NEXT STEPS:");
        console.log("1. Update ARBITRAGE_CONTRACT in addresses.js");
        console.log("2. Fund the new contract with USDC");
        console.log("3. Test arbitrage - should work now!");
        console.log("\nNew contract address:", contractAddress);
        
        return contractAddress;
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        
        if (error.message.includes("insufficient funds")) {
            console.log("💡 Need more ETH for gas");
        } else if (error.message.includes("execution reverted")) {
            console.log("💡 Constructor is reverting - check addresses");
        } else if (error.message.includes("gas")) {
            console.log("💡 Gas-related issue");
        }
        
        throw error;
    }
}

main()
    .then((address) => {
        if (address) {
            console.log(`\n🔧 UPDATE addresses.js:`);
            console.log(`ARBITRAGE_CONTRACT: "${address}"`);
        }
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
