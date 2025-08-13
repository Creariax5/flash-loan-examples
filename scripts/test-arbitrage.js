const { ethers } = require("hardhat");

const ARBITRAGE_CONTRACT_ADDRESS = "0x02999374768C86BE73ad5bA9b1e10Ec0CD046c19";

async function main() {
    const [signer] = await ethers.getSigners();
    
    console.log("Executing arbitrage with amount: 0.00001 podETH");
    console.log("From address:", signer.address);
    console.log("Contract address:", ARBITRAGE_CONTRACT_ADDRESS);
    
    try {
        // Check if contract exists
        const code = await ethers.provider.getCode(ARBITRAGE_CONTRACT_ADDRESS);
        if (code === "0x") {
            console.log("Error: No contract found at address", ARBITRAGE_CONTRACT_ADDRESS);
            return;
        }
        console.log("✓ Contract exists");
        
        const arbitrage = await ethers.getContractAt("SimpleArbitrage", ARBITRAGE_CONTRACT_ADDRESS);
        const testAmount = ethers.parseEther("0.00001");
        
        // Try to check owner (optional, skip if it fails)
        try {
            const owner = await arbitrage.owner();
            console.log("Contract owner:", owner);
            if (owner.toLowerCase() !== signer.address.toLowerCase()) {
                console.log("Warning: You are not the contract owner");
                console.log("This transaction will likely fail");
            } else {
                console.log("✓ You are the contract owner");
            }
        } catch (ownerError) {
            console.log("Warning: Could not check owner, proceeding anyway...");
        }
        
        // Execute arbitrage
        console.log("Submitting arbitrage transaction...");
        const tx = await arbitrage.arbitrage(testAmount);
        console.log("Transaction submitted:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("✓ Arbitrage succeeded! Gas used:", receipt.gasUsed.toString());
        
    } catch (error) {
        console.log("❌ Arbitrage failed:", error.message);
        
        // Try to get more specific error info
        if (error.reason) {
            console.log("Reason:", error.reason);
        }
        if (error.data) {
            console.log("Error data:", error.data);
        }
        
        // Common error suggestions
        if (error.message.includes("revert")) {
            console.log("\nPossible causes:");
            console.log("- Not enough podETH in contract for flash mint fee");
            console.log("- You're not the contract owner");
            console.log("- Flash mint failed or arbitrage not profitable");
        }
    }
}

main().catch(console.error);