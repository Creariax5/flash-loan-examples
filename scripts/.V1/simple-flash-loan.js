const { ethers } = require("hardhat");

// Aave V3 Sepolia addresses
const AAVE_POOL_PROVIDER = "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A";
const USDC_ADDRESS = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"; // USDC on Sepolia
const CONTRACT_ADDRESS = "0x332a3d79483A9b2Db3B89E28A8358Ca8f63400C2"; // Updated with deployed contract

async function main() {
    console.log("🚀 Simple Flash Loan Test (1 USDC)");
    console.log("===================================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Account:", signer.address);
    console.log("Balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH\n");
    
    // Get contract instances
    const borrower = await ethers.getContractAt("AaveFlashBorrower", CONTRACT_ADDRESS);
    const USDC = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    // Check current balance
    const currentBalance = await USDC.balanceOf(CONTRACT_ADDRESS);
    console.log("Contract USDC balance:", ethers.formatUnits(currentBalance, 6), "USDC");
    
    // Calculate flash loan amount based on available liquidity
    // USDC only has 1.58 available, so let's borrow 1 USDC to be safe
    const loanAmount = ethers.parseUnits("1", 6); // 1 USDC instead of 100
    console.log("Loan amount: 1 USDC (adjusted for available liquidity)");
    
    // Calculate expected fee
    const expectedFee = await borrower.calculateFlashLoanFee(loanAmount);
    console.log("Expected fee:", ethers.formatUnits(expectedFee, 6), "USDC");
    
    // Check if we have enough to pay the fee
    const totalNeeded = expectedFee;
    if (currentBalance < totalNeeded) {
        console.log("❌ Insufficient balance to pay fee!");
        console.log("Need:", ethers.formatUnits(totalNeeded, 6), "USDC");
        console.log("Have:", ethers.formatUnits(currentBalance, 6), "USDC");
        console.log("\n💡 Send some USDC to the contract first:");
        console.log("Contract address:", CONTRACT_ADDRESS);
        return;
    }
    
    try {
        console.log("\n⚡ Executing flash loan...");
        const tx = await borrower.requestFlashLoan(USDC_ADDRESS, loanAmount);
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Check final balance
        const finalBalance = await USDC.balanceOf(CONTRACT_ADDRESS);
        console.log("Final balance:", ethers.formatUnits(finalBalance, 6), "USDC");
        
        const feePaid = currentBalance - finalBalance;
        console.log("Fee paid:", ethers.formatUnits(feePaid, 6), "USDC");
        
        console.log("\n🎉 Flash loan completed successfully!");
        
    } catch (error) {
        console.log("❌ Flash loan failed:");
        console.log("Error:", error.message);
        
        if (error.reason) {
            console.log("Reason:", error.reason);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
