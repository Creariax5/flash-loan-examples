const { ethers } = require("hardhat");

// Get contract address from environment or set it manually
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x798685324eE76Db2e9238C38471C1B2190cec41b";

// Base network test parameters
const UNISWAP_POOL = "0xd0b53d9277642d899df5c87a3966a349a798f224"; // USDC/WETH pool on Base
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";   // USDC on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";   // WETH on Base

async function main() {
    console.log("🔍 Debugging Flash Loan Issue on Base");
    console.log("=====================================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);
    console.log("Balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH\n");

    // Connect to the deployed contract
    const AaveFlashLoanWithSwap = await ethers.getContractFactory("AaveFlashLoanWithSwap");
    const contract = AaveFlashLoanWithSwap.attach(CONTRACT_ADDRESS);
    
    console.log("Connected to contract:", CONTRACT_ADDRESS);

    // 1. Check contract USDC balance
    const usdcBalance = await contract.getTokenBalance(USDC_ADDRESS);
    console.log(`💰 Contract USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);

    // 2. Check Uniswap pool reserves
    const uniswapPair = await ethers.getContractAt(
        ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
         "function token0() external view returns (address)",
         "function token1() external view returns (address)"],
        UNISWAP_POOL
    );
    
    const [reserve0, reserve1] = await uniswapPair.getReserves();
    const token0 = await uniswapPair.token0();
    const token1 = await uniswapPair.token1();
    
    console.log("\n📊 Uniswap Pool Reserves:");
    console.log(`Token0 (${token0}): ${token0 === USDC_ADDRESS ? ethers.formatUnits(reserve0, 6) + ' USDC' : ethers.formatEther(reserve0) + ' WETH'}`);
    console.log(`Token1 (${token1}): ${token1 === USDC_ADDRESS ? ethers.formatUnits(reserve1, 6) + ' USDC' : ethers.formatEther(reserve1) + ' WETH'}`);
    
    // 3. Test simple flash loan first (no swap)
    console.log("\n🧪 Step 1: Testing Simple Flash Loan (No Swap)");
    console.log("================================================");
    
    const SIMPLE_AMOUNT = ethers.parseUnits("1", 6); // 1 USDC
    const fee = await contract.calculateFlashLoanFee(SIMPLE_AMOUNT);
    console.log(`Flash Amount: ${ethers.formatUnits(SIMPLE_AMOUNT, 6)} USDC`);
    console.log(`Flash Fee: ${ethers.formatUnits(fee, 6)} USDC`);
    console.log(`Total Required: ${ethers.formatUnits(SIMPLE_AMOUNT + fee, 6)} USDC`);
    
    // Check if we have enough USDC for fee
    if (usdcBalance < fee) {
        console.log(`❌ Insufficient USDC balance for fee. Need at least ${ethers.formatUnits(fee, 6)} USDC`);
        console.log("\n💡 Solution: Send some USDC to the contract first:");
        console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
        console.log("Send at least 0.001 USDC to cover flash loan fees");
        return;
    }

    try {
        console.log("🚀 Testing simple flash loan...");
        
        const tx = await contract.requestFlashLoan(
            USDC_ADDRESS,    // asset to flash loan
            SIMPLE_AMOUNT    // amount to borrow
        );

        console.log("Transaction sent:", tx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Simple flash loan successful!");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Now test with minimal swap
        console.log("\n🧪 Step 2: Testing Flash Loan with Minimal Swap");
        console.log("===============================================");
        
        // Use smaller amount for swap to reduce slippage
        const SWAP_AMOUNT = ethers.parseUnits("0.1", 6); // Only 0.1 USDC
        
        console.log(`Swap Amount: ${ethers.formatUnits(SWAP_AMOUNT, 6)} USDC`);
        
        const swapTx = await contract.requestFlashLoanWithSwap(
            USDC_ADDRESS,    // asset to flash loan
            SIMPLE_AMOUNT,   // amount to borrow
            UNISWAP_POOL,    // uniswap pool
            WETH_ADDRESS,    // token to swap to
            SWAP_AMOUNT      // amount to swap (smaller)
        );

        console.log("Swap transaction sent:", swapTx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const swapReceipt = await swapTx.wait();
        console.log("✅ Flash loan with swap successful!");
        console.log("Gas used:", swapReceipt.gasUsed.toString());
        
    } catch (error) {
        console.error("❌ Error:", error.message);
        
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
        
        // Additional debugging
        if (error.message.includes("execution reverted")) {
            console.log("\n🔍 Possible Issues:");
            console.log("1. Aave pool might not have enough liquidity");
            console.log("2. Contract might not have enough USDC for fees");
            console.log("3. Uniswap pool might have insufficient liquidity");
            console.log("4. Slippage tolerance too low for round-trip swap");
            
            // Check Aave pool address
            console.log("\n🏦 Aave Pool Address Check:");
            try {
                const poolAddress = await contract.pool();
                console.log("Aave Pool Address:", poolAddress);
                
                const poolAddressesProvider = await contract.addressesProvider();
                console.log("Pool Addresses Provider:", poolAddressesProvider);
            } catch (e) {
                console.log("Could not get pool addresses:", e.message);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
