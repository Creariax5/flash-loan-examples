const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const SimpleMultiWrapper = await ethers.getContractFactory("SimpleMultiWrapper");
    const wrapper = await SimpleMultiWrapper.deploy();

    await wrapper.waitForDeployment();
    const contractAddress = await wrapper.getAddress();

    console.log("Contract deployed to:", contractAddress);
    
    // Wait for confirmations
    await wrapper.deploymentTransaction().wait(3);
    console.log("Deployment confirmed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });