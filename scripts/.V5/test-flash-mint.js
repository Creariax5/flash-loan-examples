const { ethers } = require("hardhat");

const TESTER_CONTRACT_ADDRESS = "0x9962684dcA2D7b3b2E9bb27e008a021B88c78602";

async function main() {
    const [signer] = await ethers.getSigners();
    
    const tester = await ethers.getContractAt("PodFlashMintTester", TESTER_CONTRACT_ADDRESS);
    const testAmount = ethers.parseEther("0.001");
    
    try {
        const tx = await tester.requestFlashMint(testAmount);
        await tx.wait();
        console.log("Flash mint succeeded");
    } catch (error) {
        console.log("Flash mint failed:", error.message);
    }
}

main().catch(console.error);