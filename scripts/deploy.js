const { ethers } = require("hardhat");

const AAVE_POOL_PROVIDER = "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const Contract = await ethers.getContractFactory("podETHArbitrageBuy");
    const tester = await Contract.deploy(AAVE_POOL_PROVIDER);

    await tester.waitForDeployment();
    const contractAddress = await tester.getAddress();
    
    console.log("Contract deployed to:", contractAddress);
    
    // Wait for confirmations
    await tester.deploymentTransaction().wait(3);
    console.log("✓ Deployment confirmed");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });