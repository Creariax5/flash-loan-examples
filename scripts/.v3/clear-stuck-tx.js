// Clear stuck transactions by sending a replacement transaction with higher gas price
const { ethers } = require("hardhat");
require('dotenv').config();

async function clearStuckTransactions() {
    console.log("🔧 Clearing stuck transactions...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Account:", deployer.address);
    
    // Check nonce status
    const latestNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
    const pendingNonce = await deployer.provider.getTransactionCount(deployer.address, "pending");
    
    console.log(`Latest nonce: ${latestNonce}`);
    console.log(`Pending nonce: ${pendingNonce}`);
    
    if (pendingNonce > latestNonce) {
        console.log(`⚠️  ${pendingNonce - latestNonce} transactions are stuck in mempool`);
        console.log("Sending replacement transaction with higher gas...");
        
        // Send a simple self-transfer with higher gas price to unstick transactions
        const tx = await deployer.sendTransaction({
            to: deployer.address,
            value: 0, // Send 0 ETH to self
            gasPrice: ethers.parseUnits("2", "gwei"), // Higher gas price
            gasLimit: 21000, // Standard transfer gas
            nonce: latestNonce // Use the next nonce that needs to be cleared
        });
        
        console.log("Replacement transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");
        
        await tx.wait();
        console.log("✅ Transaction confirmed - mempool should be cleared");
        
        // Verify nonce is now clean
        const newPendingNonce = await deployer.provider.getTransactionCount(deployer.address, "pending");
        const newLatestNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
        
        console.log(`New latest nonce: ${newLatestNonce}`);
        console.log(`New pending nonce: ${newPendingNonce}`);
        
        if (newPendingNonce === newLatestNonce) {
            console.log("✅ No stuck transactions remaining");
        } else {
            console.log("⚠️  Some transactions may still be stuck");
        }
    } else {
        console.log("✅ No stuck transactions found");
    }
}

async function main() {
    try {
        await clearStuckTransactions();
    } catch (error) {
        console.error("❌ Error clearing stuck transactions:", error.message);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { clearStuckTransactions };
