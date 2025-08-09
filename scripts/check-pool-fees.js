const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 CHECKING ACTUAL POOL FEE TIERS");
    console.log("=" .repeat(50));
    
    const poolAbi = [
        "function token0() view returns (address)",
        "function token1() view returns (address)",
        "function fee() view returns (uint24)",
        "function liquidity() view returns (uint128)"
    ];
    
    // Check PEAS/WETH pool
    console.log("1️⃣ PEAS/WETH Pool:");
    console.log("Address:", ARBITRUM_ADDRESSES.PEAS_WETH_V3_POOL);
    
    try {
        const peasWethPool = new ethers.Contract(ARBITRUM_ADDRESSES.PEAS_WETH_V3_POOL, poolAbi, ethers.provider);
        
        const token0 = await peasWethPool.token0();
        const token1 = await peasWethPool.token1();
        const fee = await peasWethPool.fee();
        const liquidity = await peasWethPool.liquidity();
        
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("Actual Fee:", fee.toString(), `(${Number(fee)/10000}%)`);
        console.log("Liquidity:", liquidity.toString());
        
        // Check if tokens match expected
        const isPEAS0 = token0.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase();
        const isPEAS1 = token1.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase();
        const isWETH0 = token0.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase();
        const isWETH1 = token1.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase();
        
        console.log("Contains PEAS:", isPEAS0 || isPEAS1);
        console.log("Contains WETH:", isWETH0 || isWETH1);
        
        if (Number(fee) != 3000) {
            console.log("❌ FEE MISMATCH! Contract expects 3000, pool has", fee.toString());
        } else {
            console.log("✅ Fee tier matches contract (3000)");
        }
        
    } catch (error) {
        console.log("❌ PEAS/WETH pool error:", error.message);
    }
    
    // Check WETH/USDC pool
    console.log("\n2️⃣ WETH/USDC Pool:");
    console.log("Address:", ARBITRUM_ADDRESSES.WETH_USDC_V3_POOL);
    
    try {
        const wethUsdcPool = new ethers.Contract(ARBITRUM_ADDRESSES.WETH_USDC_V3_POOL, poolAbi, ethers.provider);
        
        const token0 = await wethUsdcPool.token0();
        const token1 = await wethUsdcPool.token1();
        const fee = await wethUsdcPool.fee();
        const liquidity = await wethUsdcPool.liquidity();
        
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("Actual Fee:", fee.toString(), `(${Number(fee)/10000}%)`);
        console.log("Liquidity:", liquidity.toString());
        
        // Check if tokens match expected
        const isUSDC0 = token0.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase();
        const isUSDC1 = token1.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase();
        const isWETH0 = token0.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase();
        const isWETH1 = token1.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase();
        
        console.log("Contains USDC:", isUSDC0 || isUSDC1);
        console.log("Contains WETH:", isWETH0 || isWETH1);
        
        if (Number(fee) != 500) {
            console.log("❌ FEE MISMATCH! Contract expects 500, pool has", fee.toString());
        } else {
            console.log("✅ Fee tier matches contract (500)");
        }
        
    } catch (error) {
        console.log("❌ WETH/USDC pool error:", error.message);
    }
    
    // Also check if there are alternative pools with different fee tiers
    console.log("\n3️⃣ SEARCHING FOR ALTERNATIVE POOLS:");
    
    const factoryAbi = [
        "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
    ];
    
    const factory = new ethers.Contract(ARBITRUM_ADDRESSES.UNISWAP_V3_FACTORY, factoryAbi, ethers.provider);
    
    // Check different fee tiers for PEAS/WETH
    const peasWethFees = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    console.log("PEAS/WETH alternative pools:");
    
    for (const feeAmount of peasWethFees) {
        try {
            const poolAddress = await factory.getPool(ARBITRUM_ADDRESSES.PEAS, ARBITRUM_ADDRESSES.WETH, feeAmount);
            if (poolAddress !== "0x0000000000000000000000000000000000000000") {
                console.log(`  ${feeAmount/10000}% fee: ${poolAddress}`);
                
                // Check liquidity
                const pool = new ethers.Contract(poolAddress, poolAbi, ethers.provider);
                const liquidity = await pool.liquidity();
                console.log(`    Liquidity: ${liquidity.toString()}`);
            }
        } catch (error) {
            console.log(`  ${feeAmount/10000}% fee: Not found or error`);
        }
    }
    
    // Check different fee tiers for WETH/USDC
    const wethUsdcFees = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
    console.log("\nWETH/USDC alternative pools:");
    
    for (const feeAmount of wethUsdcFees) {
        try {
            const poolAddress = await factory.getPool(ARBITRUM_ADDRESSES.WETH, ARBITRUM_ADDRESSES.USDC, feeAmount);
            if (poolAddress !== "0x0000000000000000000000000000000000000000") {
                console.log(`  ${feeAmount/10000}% fee: ${poolAddress}`);
                
                // Check liquidity
                const pool = new ethers.Contract(poolAddress, poolAbi, ethers.provider);
                const liquidity = await pool.liquidity();
                console.log(`    Liquidity: ${liquidity.toString()}`);
            }
        } catch (error) {
            console.log(`  ${feeAmount/10000}% fee: Not found or error`);
        }
    }
    
    console.log("\n🎯 DIAGNOSIS:");
    console.log("If fee mismatches are found, this explains the reverts!");
    console.log("Uniswap will revert if you try to swap with wrong fee tier.");
    console.log("");
    console.log("SOLUTION: Update contract with correct fee tiers for Arbitrum pools.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
