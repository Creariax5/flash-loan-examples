const { ethers } = require("hardhat");

const CONTRACT_ADDRESS = "0x332a3d79483A9b2Db3B89E28A8358Ca8f63400C2";

async function main() {
    console.log("🔍 Checking New Contract Status");
    console.log("===============================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Your address:", signer.address);
    
    try {
        const borrower = await ethers.getContractAt("AaveFlashBorrower", CONTRACT_ADDRESS);
        
        // Check owner
        const owner = await borrower.owner();
        console.log("Contract owner:", owner);
        console.log("Ownership match:", owner.toLowerCase() === signer.address.toLowerCase());
        
        // Try to get token balance
        const USDC_ADDRESS = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
        const balance = await borrower.getTokenBalance(USDC_ADDRESS);
        console.log("Contract USDC balance:", ethers.formatUnits(balance, 6), "USDC");
        
        // Check if it can calculate fees
        const loanAmount = ethers.parseUnits("100", 6);
        const fee = await borrower.calculateFlashLoanFee(loanAmount);
        console.log("Expected fee for 100 USDC:", ethers.formatUnits(fee, 6), "USDC");
        
        console.log("\n✅ Contract is working correctly!");
        
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
