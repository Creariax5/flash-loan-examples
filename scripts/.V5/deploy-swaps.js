const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const SwapContract = await ethers.getContractFactory("SwapContract");
    const swapper = await SwapContract.deploy();

    await swapper.waitForDeployment();
    const contractAddress = await swapper.getAddress();

    console.log("Contract deployed to:", contractAddress);
    
    // Wait for confirmations
    await swapper.deploymentTransaction().wait(3);
    console.log("Deployment confirmed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });