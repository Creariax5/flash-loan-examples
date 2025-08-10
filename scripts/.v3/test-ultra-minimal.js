const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Ultra Minimal Deployment Test");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    // Deploy ultra minimal contract
    console.log("\n🚀 Deploying ultra minimal contract...");
    const Test = await ethers.getContractFactory("UltraMinimalTest");
    const test = await Test.deploy({
        gasLimit: 300000 // Much smaller limit
    });
    await test.waitForDeployment();
    
    const contractAddress = await test.getAddress();
    console.log("✅ Deployed to:", contractAddress);
    
    // Test it works
    const value = await test.getValue();
    console.log("✅ Contract works - value:", value.toString());
    
    console.log("\n🎉 SUCCESS! Basic deployment works");
    console.log("The issue is with the complex contract, not the deployment process");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Failed:", error.message);
        process.exit(1);
    });
