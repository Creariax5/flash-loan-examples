const { ethers } = require("hardhat");

const USDC_ADDRESS = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
const CONTRACT_ADDRESS = "0x332a3d79483A9b2Db3B89E28A8358Ca8f63400C2";

async function main() {
    console.log("💰 Checking USDC Balances");
    console.log("=========================\n");
    
    const [signer] = await ethers.getSigners();
    const USDC = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    const walletBalance = await USDC.balanceOf(signer.address);
    const contractBalance = await USDC.balanceOf(CONTRACT_ADDRESS);
    
    console.log("Wallet address:", signer.address);
    console.log("Wallet USDC balance:", ethers.formatUnits(walletBalance, 6), "USDC");
    console.log("Contract USDC balance:", ethers.formatUnits(contractBalance, 6), "USDC");
    
    if (walletBalance > 0) {
        console.log("\n💡 You have USDC! You can send some to the contract:");
        console.log("Contract address:", CONTRACT_ADDRESS);
        console.log("Need at least 0.1 USDC for fees");
    } else {
        console.log("\n💡 Get USDC from Aave faucet:");
        console.log("1. Go to: https://staging.aave.com/faucet/");
        console.log("2. Connect wallet and switch to Sepolia");
        console.log("3. Request USDC tokens");
        console.log("4. Send ~0.1 USDC to contract:", CONTRACT_ADDRESS);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
