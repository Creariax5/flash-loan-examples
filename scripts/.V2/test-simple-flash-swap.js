const { ethers } = require("hardhat");

// Get contract address from environment or set it manually
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "REPLACE_WITH_DEPLOYED_CONTRACT_ADDRESS";

// Base network test parameters  
const UNISWAP_POOL = "0x2F8818D1B0f3e3E295440c1C0cDDf40aAA21fA87"; // SushiSwap USDC/WETH V2 pool on Base
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";   // USDC on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";   // WETH on Base

async function main() {
    console.log("🧪 Testing All-in-One Flash Loan + Swap on BASE");
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

    // Flash loan parameters for Base
    const FLASH_AMOUNT = ethers.parseUnits("1", 6); // 1 USDC
    const SWAP_AMOUNT = ethers.parseUnits("0.01", 6);   // Swap only 0.01 USDC (very small to minimize slippage)

    console.log("\n📋 Flash Loan Parameters (Base Network):");
    console.log("Asset:", USDC_ADDRESS, "(USDC on Base)");
    console.log("Flash Amount:", ethers.formatUnits(FLASH_AMOUNT, 6), "USDC");
    console.log("Swap Amount:", ethers.formatUnits(SWAP_AMOUNT, 6), "USDC");
    console.log("Pool:", UNISWAP_POOL, "(SushiSwap USDC/WETH V2 on Base)");
    console.log("Token Out:", WETH_ADDRESS, "(WETH on Base)");

    // Calculate flash loan fee
    const fee = await contract.calculateFlashLoanFee(FLASH_AMOUNT);
    console.log("Flash Loan Fee:", ethers.formatUnits(fee, 6), "USDC");

    try {
        console.log("\n🚀 Executing Flash Loan with Round-Trip Swap...");
        console.log("Flow: Borrow USDC → Swap to WETH → Swap back to USDC → Repay");
        
        const tx = await contract.requestFlashLoanWithSwap(
            USDC_ADDRESS,    // asset to flash loan
            FLASH_AMOUNT,    // amount to borrow
            UNISWAP_POOL,    // uniswap pool
            WETH_ADDRESS,    // token to swap to
            SWAP_AMOUNT      // amount to swap
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
            } else if (event.name === "SwapExecuted") {
                console.log(`🔄 Swap executed on pool: ${event.args.pool}`);
                console.log(`📊 Amount In: ${ethers.formatUnits(event.args.amountIn, 6)}`);
            }
        });

        // Check final balances
        console.log("\n💰 Final Contract Balances:");
        const usdcBalance = await contract.getTokenBalance(USDC_ADDRESS);
        const wethBalance = await contract.getTokenBalance(WETH_ADDRESS);
        
        console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
        console.log(`WETH: ${ethers.formatUnits(wethBalance, 18)}`);
        
        if (usdcBalance > 0) {
            console.log("💡 Contract has remaining USDC - potential profit!");
        }
        
        console.log("\n🎉 Flash Loan with Round-Trip Swap completed successfully on Base!");
        console.log("This tests arbitrage opportunities on Base's USDC/WETH pool.");
        console.log("Base network typically has lower fees and faster transactions! 🚀");
        
    } catch (error) {
        console.error("❌ Flash Loan failed:", error.message);
        
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
        
        // Base-specific troubleshooting
        console.log("\n🔧 Troubleshooting (Base Network):");
        console.log("1. Make sure you have Base ETH for gas fees");
        console.log("2. Verify the USDC/WETH pool exists and has liquidity on Base");
        console.log("3. Ensure flash loan amount is available in Aave on Base");
        console.log("4. Contract needs some USDC for fees (bridge from Ethereum if needed)");
        console.log("5. Check Base network status: https://status.base.org/");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
