const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🚀 DEPLOYING Updated pPEAS Arbitrage Contract on Arbitrum!");
    console.log("==================================================");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    try {
        // Check ETH balance
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log("ETH Balance:", ethers.formatEther(balance), "ETH");
        
        if (balance < ethers.parseEther("0.0005")) {  // Reduced for Arbitrum L2 costs
            console.log("❌ Insufficient ETH for deployment");
            return;
        }

        console.log("\n📝 Contract Configuration:");
        console.log("Pool Addresses Provider:", ARBITRUM_ADDRESSES.PoolAddressesProvider);
        console.log("USDC:", ARBITRUM_ADDRESSES.USDC);
        console.log("pPEAS Pod:", ARBITRUM_ADDRESSES.pPEAS);
        console.log("pfUSDC-6 Vault:", ARBITRUM_ADDRESSES.pfUSDC6);

        // Deploy the contract
        console.log("\n🚀 Deploying PeaPEASArbitrageBot...");
        const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
        const arbitrageBot = await PeaPEASArbitrageBot.deploy(ARBITRUM_ADDRESSES.PoolAddressesProvider);
        
        console.log("⏳ Waiting for deployment confirmation...");
        await arbitrageBot.waitForDeployment();
        
        const contractAddress = await arbitrageBot.getAddress();
        console.log("✅ PeaPEASArbitrageBot deployed to:", contractAddress);
        
        // Fund the contract with a small amount of USDC for flash loan fees
        console.log("\n💰 Funding contract with USDC for flash loan fees...");
        
        // Get USDC contract (check if it's a valid contract)
        const USDC = await ethers.getContractAt("IERC20", ARBITRUM_ADDRESSES.USDC);
        
        // Check if we have USDC to fund (for testnet we might need to get some first)
        try {
            const usdcBalance = await USDC.balanceOf(deployer.address);
            console.log("Deployer USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
            
            if (usdcBalance > 0n) {
                const fundingAmount = ethers.parseUnits("0.1", 6); // 0.1 USDC
                console.log("Transferring", ethers.formatUnits(fundingAmount, 6), "USDC to contract...");
                
                const transferTx = await USDC.transfer(contractAddress, fundingAmount);
                await transferTx.wait();
                
                const contractUsdcBalance = await USDC.balanceOf(contractAddress);
                console.log("✅ Contract USDC Balance:", ethers.formatUnits(contractUsdcBalance, 6), "USDC");
            } else {
                console.log("⚠️ No USDC available to fund contract");
            }
        } catch (error) {
            console.log("⚠️ Could not check/transfer USDC:", error.message);
        }
        
        console.log("\n📋 DEPLOYMENT SUMMARY");
        console.log("====================");
        console.log("Contract Address:", contractAddress);
        console.log("Network: Arbitrum One");
        console.log("Gas Used: ~", (await arbitrageBot.deploymentTransaction()).gasUsed?.toString() || "unknown");
        
        console.log("\n🎯 NEXT STEPS:");
        console.log("1. Update addresses.js with new contract address");
        console.log("2. Test arbitrage execution with correct pod interfaces");
        console.log("3. Monitor for profitable opportunities");
        
        // Update the addresses file
        console.log("\n📝 Updating addresses.js...");
        const fs = require('fs');
        const addressesContent = fs.readFileSync('./scripts/addresses.js', 'utf8');
        const updatedContent = addressesContent.replace(
            /ARBITRAGE_CONTRACT: ".*"/,
            `ARBITRAGE_CONTRACT: "${contractAddress}"`
        );
        
        // Add the arbitrage contract address if it doesn't exist
        if (!updatedContent.includes('ARBITRAGE_CONTRACT:')) {
            const insertPoint = updatedContent.lastIndexOf('};');
            const beforeClosing = updatedContent.substring(0, insertPoint);
            const afterClosing = updatedContent.substring(insertPoint);
            const newContent = beforeClosing + `    \n    // Updated Arbitrage Contract\n    ARBITRAGE_CONTRACT: "${contractAddress}",\n    ` + afterClosing;
            fs.writeFileSync('./scripts/addresses.js', newContent);
        } else {
            fs.writeFileSync('./scripts/addresses.js', updatedContent);
        }
        
        console.log("✅ Updated addresses.js with new contract address");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
