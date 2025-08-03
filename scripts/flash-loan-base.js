const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

const CONTRACT_ADDRESS = "0xa5eEf9F1D4F6DCdb5F11b0Ad2F34B9ECa995C124"; // Base mainnet contract

async function main() {
    console.log("🚀 Base Mainnet Flash Loan Test");
    console.log("===============================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Account:", signer.address);
    console.log("Balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH\n");
    
    // Get contract instances
    const borrower = await ethers.getContractAt("AaveFlashBorrower", CONTRACT_ADDRESS);
    const USDC = await ethers.getContractAt("IERC20", BASE_ADDRESSES.USDC);
    
    // Check current balance
    const currentBalance = await USDC.balanceOf(CONTRACT_ADDRESS);
    console.log("Contract USDC balance:", ethers.formatUnits(currentBalance, 6), "USDC");
    
    // Flash loan amount
    const loanAmount = ethers.parseUnits("10", 6); // 10 USDC
    console.log("Loan amount: 10 USDC");
    
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
        console.log("USDC address:", BASE_ADDRESSES.USDC);
        return;
    }
    
    try {
        console.log("\n⚡ Executing flash loan on Base...");
        const tx = await borrower.requestFlashLoan(BASE_ADDRESSES.USDC, loanAmount);
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Check final balance
        const finalBalance = await USDC.balanceOf(CONTRACT_ADDRESS);
        console.log("Final balance:", ethers.formatUnits(finalBalance, 6), "USDC");
        
        const feePaid = currentBalance - finalBalance;
        console.log("Fee paid:", ethers.formatUnits(feePaid, 6), "USDC");
        
        console.log("\n🎉 Base flash loan completed successfully!");
        console.log("🔗 View on BaseScan:", `https://basescan.org/tx/${tx.hash}`);
        
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
