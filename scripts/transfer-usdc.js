const { ethers } = require("hardhat");

// Contract addresses
const OLD_CONTRACT = "0xD6514B6CEEf5E21698E99Ce9172dEd377A0553EF";
const NEW_CONTRACT = "0x332a3d79483A9b2Db3B89E28A8358Ca8f63400C2";
const USDC_ADDRESS = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

async function main() {
    console.log("🔄 Transferring USDC from Old to New Contract");
    console.log("==============================================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Account:", signer.address);
    console.log("ETH Balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH\n");
    
    // Get contract instances
    const oldBorrower = await ethers.getContractAt("AaveFlashBorrower", OLD_CONTRACT);
    const USDC = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    // Check balances
    console.log("💰 Current Balances:");
    console.log("====================");
    
    const oldBalance = await USDC.balanceOf(OLD_CONTRACT);
    const newBalance = await USDC.balanceOf(NEW_CONTRACT);
    const walletBalance = await USDC.balanceOf(signer.address);
    
    console.log("Old contract USDC:", ethers.formatUnits(oldBalance, 6), "USDC");
    console.log("New contract USDC:", ethers.formatUnits(newBalance, 6), "USDC");
    console.log("Wallet USDC:", ethers.formatUnits(walletBalance, 6), "USDC\n");
    
    if (oldBalance === 0n) {
        console.log("❌ No USDC in old contract to transfer!");
        return;
    }
    
    // Verify ownership
    try {
        const owner = await oldBorrower.owner();
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.log("❌ You are not the owner of the old contract!");
            console.log("Owner:", owner);
            console.log("Your address:", signer.address);
            return;
        }
        console.log("✅ Ownership verified\n");
    } catch (error) {
        console.log("❌ Error checking ownership:", error.message);
        return;
    }
    
    try {
        console.log("🔄 Withdrawing USDC from old contract...");
        const tx1 = await oldBorrower.emergencyWithdraw(USDC_ADDRESS);
        console.log("Withdrawal transaction:", tx1.hash);
        await tx1.wait();
        console.log("✅ USDC withdrawn to wallet\n");
        
        // Check wallet balance after withdrawal
        const newWalletBalance = await USDC.balanceOf(signer.address);
        console.log("Wallet balance after withdrawal:", ethers.formatUnits(newWalletBalance, 6), "USDC");
        
        if (newWalletBalance > 0) {
            console.log("💸 Sending USDC to new contract...");
            const tx2 = await USDC.transfer(NEW_CONTRACT, newWalletBalance);
            console.log("Transfer transaction:", tx2.hash);
            await tx2.wait();
            console.log("✅ USDC sent to new contract\n");
            
            // Final balance check
            const finalNewBalance = await USDC.balanceOf(NEW_CONTRACT);
            console.log("Final new contract balance:", ethers.formatUnits(finalNewBalance, 6), "USDC");
            
            console.log("\n🎉 Transfer completed successfully!");
            console.log("💡 You can now run the flash loan test:");
            console.log("npm run test-flash-loan");
        }
        
    } catch (error) {
        console.log("❌ Transfer failed:", error.message);
        
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
