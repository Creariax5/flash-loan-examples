const { ethers } = require("hardhat");

// Base network test parameters
const UNISWAP_POOL = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"; // USDC/WETH V2 pool on Base
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";   // USDC on Base  
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";   // WETH on Base

async function main() {
    console.log("🔍 Verifying Uniswap Pool on Base");
    console.log("=================================\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);
    console.log("Balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH\n");

    // Check if the pool address is a contract
    const poolCode = await signer.provider.getCode(UNISWAP_POOL);
    console.log("Pool contract exists:", poolCode !== "0x" ? "✅ Yes" : "❌ No");
    
    if (poolCode === "0x") {
        console.log("❌ The pool address is not a contract!");
        console.log("Pool address:", UNISWAP_POOL);
        console.log("\n💡 This might be a Uniswap V3 pool, not V2!");
        console.log("Base uses Uniswap V3, not V2 for most pools.");
        
        // Let's check if this is a V3 pool
        try {
            const v3PoolAbi = [
                "function token0() external view returns (address)",
                "function token1() external view returns (address)",
                "function fee() external view returns (uint24)"
            ];
            
            const v3Pool = new ethers.Contract(UNISWAP_POOL, v3PoolAbi, signer);
            const token0 = await v3Pool.token0();
            const token1 = await v3Pool.token1();
            const fee = await v3Pool.fee();
            
            console.log("\n🔬 V3 Pool Analysis:");
            console.log("Token0:", token0);
            console.log("Token1:", token1);
            console.log("Fee tier:", fee);
            
            console.log("\n⚠️ PROBLEM IDENTIFIED:");
            console.log("This is a Uniswap V3 pool, but your contract uses V2 interfaces!");
            console.log("Base primarily uses Uniswap V3, not V2.");
            
        } catch (e) {
            console.log("Could not identify as V3 pool either:", e.message);
        }
        
        return;
    }

    // Try to interact with the pool as V2
    try {
        const v2PoolAbi = [
            "function token0() external view returns (address)",
            "function token1() external view returns (address)",
            "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
        ];
        
        const v2Pool = new ethers.Contract(UNISWAP_POOL, v2PoolAbi, signer);
        
        console.log("🔬 V2 Pool Analysis:");
        const token0 = await v2Pool.token0();
        const token1 = await v2Pool.token1();
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        
        const [reserve0, reserve1] = await v2Pool.getReserves();
        console.log(`Reserve0: ${token0 === USDC_ADDRESS ? ethers.formatUnits(reserve0, 6) + ' USDC' : ethers.formatEther(reserve0) + ' WETH'}`);
        console.log(`Reserve1: ${token1 === USDC_ADDRESS ? ethers.formatUnits(reserve1, 6) + ' USDC' : ethers.formatEther(reserve1) + ' WETH'}`);
        
        // Verify tokens match
        const hasUSDC = token0 === USDC_ADDRESS || token1 === USDC_ADDRESS;
        const hasWETH = token0 === WETH_ADDRESS || token1 === WETH_ADDRESS;
        
        console.log("\n✅ Token Verification:");
        console.log("Contains USDC:", hasUSDC ? "✅ Yes" : "❌ No");
        console.log("Contains WETH:", hasWETH ? "✅ Yes" : "❌ No");
        
        if (hasUSDC && hasWETH) {
            console.log("🎉 Pool verified! This is a valid USDC/WETH V2 pool.");
            
            // Test swap calculation
            const swapAmount = ethers.parseUnits("0.5", 6); // 0.5 USDC
            console.log("\n🧮 Testing Swap Calculation:");
            console.log(`Swap Amount: ${ethers.formatUnits(swapAmount, 6)} USDC`);
            
            const isToken0USDC = token0 === USDC_ADDRESS;
            const usdcReserve = isToken0USDC ? reserve0 : reserve1;
            const wethReserve = isToken0USDC ? reserve1 : reserve0;
            
            // Calculate expected output using V2 formula
            const amountInWithFee = swapAmount * 997n;
            const numerator = amountInWithFee * wethReserve;
            const denominator = (usdcReserve * 1000n) + amountInWithFee;
            const expectedWETH = numerator / denominator;
            
            console.log(`Expected WETH output: ${ethers.formatEther(expectedWETH)}`);
            
            if (expectedWETH > 0) {
                console.log("✅ Swap calculation looks valid");
                
                // Now calculate reverse swap
                const wethToUSDCAmountIn = expectedWETH * 997n / 1000n;
                const reverseNumerator = wethToUSDCAmountIn * usdcReserve;
                const reverseDenominator = (wethReserve * 1000n) + wethToUSDCAmountIn;
                const expectedUSDCBack = reverseNumerator / reverseDenominator;
                
                console.log(`Expected USDC back: ${ethers.formatUnits(expectedUSDCBack, 6)}`);
                console.log(`Net loss from slippage: ${ethers.formatUnits(swapAmount - expectedUSDCBack, 6)} USDC`);
                
                if (expectedUSDCBack < swapAmount * 98n / 100n) {
                    console.log("⚠️ HIGH SLIPPAGE WARNING:");
                    console.log("Round-trip swap will lose more than 2% due to slippage!");
                    console.log("This might cause the flash loan to fail.");
                }
                
            } else {
                console.log("❌ Invalid swap calculation");
            }
            
        } else {
            console.log("❌ Pool doesn't contain both USDC and WETH!");
        }
        
    } catch (error) {
        console.error("❌ Error analyzing pool:", error.message);
        console.log("\nThis might not be a Uniswap V2 pool.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
