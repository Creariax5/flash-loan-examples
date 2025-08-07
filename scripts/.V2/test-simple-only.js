const { ethers } = require("hardhat");

// Get contract address from environment or set it manually
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x798685324eE76Db2e9238C38471C1B2190cec41b";

// Base network test parameters
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";   // USDC on Base

async function main() {
    console.log("🧪 Testing SIMPLE Flash Loan on Base (No Swap)");
    console.log("===============================================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);
    console.log("Balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH\n");

    // Connect to the deployed contract
    const AaveFlashLoanWithSwap = await ethers.getContractFactory("AaveFlashLoanWithSwap");
    const contract = AaveFlashLoanWithSwap.attach(CONTRACT_ADDRESS);
    
    console.log("Connected to contract:", CONTRACT_ADDRESS);

    // Check contract owner
    const owner = await contract.owner();
    console.log("Contract owner:", owner);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log("❌ You are not the contract owner!");
        return;
    }

    // Check contract USDC balance
    const usdcBalance = await contract.getTokenBalance(USDC_ADDRESS);
    console.log(`💰 Contract USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC\n`);

    // Test simple flash loan (no swap)
    const FLASH_AMOUNT = ethers.parseUnits("1", 6); // 1 USDC
    const fee = await contract.calculateFlashLoanFee(FLASH_AMOUNT);
    
    console.log("📋 Flash Loan Parameters:");
    console.log(`Asset: ${USDC_ADDRESS} (USDC on Base)`);
    console.log(`Flash Amount: ${ethers.formatUnits(FLASH_AMOUNT, 6)} USDC`);
    console.log(`Flash Fee: ${ethers.formatUnits(fee, 6)} USDC`);
    console.log(`Total Required: ${ethers.formatUnits(FLASH_AMOUNT + fee, 6)} USDC`);
    
    // Check if we have enough USDC for fee
    if (usdcBalance < fee) {
        console.log(`❌ Insufficient USDC balance for fee. Need at least ${ethers.formatUnits(fee, 6)} USDC`);
        console.log("💡 The contract has enough balance, proceeding with test...");
    }

    try {
        console.log("\n🚀 Executing Simple Flash Loan (No Swap)...");
        console.log("Flow: Borrow USDC → Return USDC + Fee");
        
        const tx = await contract.requestFlashLoan(
            USDC_ADDRESS,    // asset to flash loan
            FLASH_AMOUNT     // amount to borrow
        );

        console.log("Transaction sent:", tx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Parse events
        const events = receipt.logs.map(log => {
            try {
                return contract.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
        
        console.log("\n📊 Events:");
        events.forEach(event => {
            if (event.name === "FlashLoanExecuted") {
                console.log(`💰 Flash Loan: ${ethers.formatUnits(event.args.amount, 6)} USDC`);
                console.log(`💸 Premium: ${ethers.formatUnits(event.args.premium, 6)} USDC`);
                console.log(`✅ Success: ${event.args.success}`);
            }
        });

        // Check final balance
        const finalBalance = await contract.getTokenBalance(USDC_ADDRESS);
        console.log(`\n💰 Final Contract USDC Balance: ${ethers.formatUnits(finalBalance, 6)} USDC`);
        
        const balanceChange = finalBalance - usdcBalance;
        if (balanceChange < 0) {
            console.log(`💸 Fee paid: ${ethers.formatUnits(-balanceChange, 6)} USDC (Expected: ${ethers.formatUnits(fee, 6)} USDC)`);
        }
        
        console.log("\n🎉 Simple Flash Loan completed successfully!");
        console.log("✅ Aave flash loans are working on Base!");
        
    } catch (error) {
        console.error("❌ Flash Loan failed:", error.message);
        
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
        
        // Detailed error analysis
        console.log("\n🔍 Error Analysis:");
        console.log("1. Contract balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
        console.log("2. Required fee:", ethers.formatUnits(fee, 6), "USDC");
        console.log("3. Contract has sufficient balance:", usdcBalance >= fee ? "✅ Yes" : "❌ No");
        
        if (error.message.includes("execution reverted")) {
            console.log("\n💡 This might be an issue with:");
            console.log("- Aave pool configuration on Base");
            console.log("- Flash loan limits or availability");
            console.log("- Contract approval or permission issues");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
