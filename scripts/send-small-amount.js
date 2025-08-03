const { ethers } = require("hardhat");

const NEW_CONTRACT = "0x332a3d79483A9b2Db3B89E28A8358Ca8f63400C2";
const USDC_ADDRESS = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";

async function main() {
    console.log("💸 Sending Small Amount of USDC to New Contract");
    console.log("===============================================\n");
    
    const [signer] = await ethers.getSigners();
    const USDC = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    // Check current balances
    const walletBalance = await USDC.balanceOf(signer.address);
    const contractBalance = await USDC.balanceOf(NEW_CONTRACT);
    
    console.log("Wallet USDC balance:", ethers.formatUnits(walletBalance, 6), "USDC");
    console.log("Contract USDC balance:", ethers.formatUnits(contractBalance, 6), "USDC\n");
    
    if (walletBalance === 0n) {
        console.log("❌ No USDC in wallet to transfer!");
        return;
    }
    
    // Send just 1 USDC (enough for many flash loan tests)
    const amountToSend = ethers.parseUnits("1", 6); // 1 USDC
    
    if (walletBalance < amountToSend) {
        console.log("❌ Not enough USDC in wallet!");
        console.log("Need: 1 USDC");
        console.log("Have:", ethers.formatUnits(walletBalance, 6), "USDC");
        return;
    }
    
    try {
        console.log("💸 Sending 1 USDC to new contract...");
        const tx = await USDC.transfer(NEW_CONTRACT, amountToSend);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Transfer completed!\n");
        
        // Check final balances
        const finalWalletBalance = await USDC.balanceOf(signer.address);
        const finalContractBalance = await USDC.balanceOf(NEW_CONTRACT);
        
        console.log("Final wallet balance:", ethers.formatUnits(finalWalletBalance, 6), "USDC");
        console.log("Final contract balance:", ethers.formatUnits(finalContractBalance, 6), "USDC");
        
        console.log("\n🎉 Ready to test flash loans!");
        console.log("💡 Run: npm run test-flash-loan");
        
    } catch (error) {
        console.log("❌ Transfer failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
