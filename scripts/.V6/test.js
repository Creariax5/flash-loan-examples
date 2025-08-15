const { ethers } = require("hardhat");

async function main() {
    const CONTRACT_ADDRESS = "0x0620580B0B6950513f8aC01d2d0DEbCD877447d1";
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // Very small amount - 1 USDC
    const AMOUNT = ethers.parseUnits("1", 6);
    
    const [signer] = await ethers.getSigners();
    console.log("Testing with 1 USDC");
    console.log("Signer:", signer.address);
    
    try {
        const contract = await ethers.getContractAt("AaveFlashBorrower", CONTRACT_ADDRESS);
        
        // Calculate expected fee
        const fee = await contract.calculateFee(AMOUNT);
        const total = AMOUNT + fee;
        console.log("Amount:", ethers.formatUnits(AMOUNT, 6), "USDC");
        console.log("Fee:", ethers.formatUnits(fee, 6), "USDC"); 
        console.log("Total needed:", ethers.formatUnits(total, 6), "USDC");
        
        // Execute with detailed error catching
        console.log("\nExecuting flash loan...");
        
        const tx = await contract.requestFlashLoan(USDC_ADDRESS, AMOUNT, {
            gasLimit: 2000000
        });
        
        console.log("Tx hash:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("✅ Success! Gas used:", receipt.gasUsed.toString());
        
        // Check for Debug events
        const iface = contract.interface;
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === "Debug") {
                    console.log("Debug:", parsed.args[0]);
                }
            } catch (e) {
                // Skip non-contract logs
            }
        }
        
    } catch (error) {
        console.log("❌ Failed:", error.message);
        
        // Look for revert reason in error data
        if (error.data && error.data.startsWith("0x08c379a0")) {
            try {
                const reason = ethers.AbiCoder.defaultAbiCoder().decode(
                    ["string"], 
                    "0x" + error.data.substring(10)
                )[0];
                console.log("Revert reason:", reason);
            } catch (e) {
                console.log("Raw error data:", error.data);
            }
        }
    }
}

main().catch(console.error);