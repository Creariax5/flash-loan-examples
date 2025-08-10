const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("🧪 Testing Simple Contract Deployment on Base");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    try {
        const SimpleTest = await ethers.getContractFactory("SimpleTest");
        console.log("🚀 Deploying SimpleTest contract...");
        
        const simpleTest = await SimpleTest.deploy({
            gasPrice: ethers.parseUnits("0.01", "gwei"),
            gasLimit: 500000
        });
        
        await simpleTest.waitForDeployment();
        console.log("✅ SimpleTest deployed to:", await simpleTest.getAddress());
        
        // Test a function call
        const value = await simpleTest.getValue();
        console.log("✅ Contract working - test value:", value.toString());
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
