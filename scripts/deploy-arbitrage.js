const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const PodFlashMintTester = await ethers.getContractFactory("SimpleArbitrage");
    const tester = await PodFlashMintTester.deploy();
    
    await tester.waitForDeployment();
    const contractAddress = await tester.getAddress();
    
    console.log("Contract deployed to:", contractAddress);
    
    // Wait for confirmations
    await tester.deploymentTransaction().wait(3);
    
    console.log("Owner:", await tester.owner());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });