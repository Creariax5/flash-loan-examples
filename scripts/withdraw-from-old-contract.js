const { ethers } = require("hardhat");

const OLD_CONTRACT_ADDRESS = "0xc48a52bdfcdf5e3c8ae2cf8633f59d8f78a5624d";

async function main() {
    const [signer] = await ethers.getSigners();
    
    const oldContract = await ethers.getContractAt("PodFlashMintTester", OLD_CONTRACT_ADDRESS);
    const podETHAddress = await oldContract.POD_ETH();
    
    console.log("Withdrawing podETH...");
    
    const tx = await oldContract.emergencyWithdraw(podETHAddress);
    await tx.wait();
    
    console.log("✅ Withdrawal complete:", tx.hash);
}

main().catch(console.error);