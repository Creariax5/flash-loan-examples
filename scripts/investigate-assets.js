const { ethers } = require("hardhat");

async function investigateAssets() {
    console.log("🔍 INVESTIGATING ACTUAL ASSETS");
    console.log("==============================");
    
    // 1. Check what pfpOHMo27 underlying asset actually is
    console.log("\n1️⃣ INVESTIGATING PFPOHMO27 UNDERLYING");
    console.log("=====================================");
    
    const underlyingAddress = "0x2Dc1E8dCb74B260567cff4B0937e1848EFBDd1c2";
    
    try {
        const tokenAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)"
        ];
        
        const underlying = new ethers.Contract(underlyingAddress, tokenAbi, ethers.provider);
        
        console.log(`✅ Underlying Address: ${underlyingAddress}`);
        console.log(`✅ Name: ${await underlying.name()}`);
        console.log(`✅ Symbol: ${await underlying.symbol()}`);
        console.log(`✅ Decimals: ${await underlying.decimals()}`);
        
    } catch (error) {
        console.log(`❌ Underlying Asset Error: ${error.message}`);
    }
    
    // 2. Check all possible PEAS/USDC pools at different fee tiers
    console.log("\n2️⃣ SEARCHING FOR PEAS/USDC POOLS");
    console.log("=================================");
    
    const PEAS = "0x02f92800F57BCD74066F5709F1Daa1A4302Df875";
    const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    
    const factoryAbi = [
        "function getPool(address, address, uint24) view returns (address)"
    ];
    
    const factory = new ethers.Contract("0x33128a8fC17869897dcE68Ed026d694621f6FDfD", factoryAbi, ethers.provider);
    
    const feeTiers = [100, 500, 2500, 3000, 10000]; // 0.01%, 0.05%, 0.25%, 0.30%, 1%
    
    for (const fee of feeTiers) {
        try {
            const poolAddress = await factory.getPool(PEAS, USDC, fee);
            const feePercent = (fee / 10000) * 100;
            
            if (poolAddress !== "0x0000000000000000000000000000000000000000") {
                console.log(`✅ FOUND POOL at ${feePercent}% fee: ${poolAddress}`);
                
                // Check pool reserves
                const poolAbi = [
                    "function liquidity() view returns (uint128)",
                    "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"
                ];
                
                try {
                    const pool = new ethers.Contract(poolAddress, poolAbi, ethers.provider);
                    const liquidity = await pool.liquidity();
                    console.log(`   Liquidity: ${liquidity.toString()}`);
                } catch (e) {
                    console.log(`   Could not get liquidity: ${e.message}`);
                }
            } else {
                console.log(`❌ No pool at ${feePercent}% fee`);
            }
        } catch (error) {
            console.log(`❌ Error checking ${fee} fee tier: ${error.message}`);
        }
    }
    
    // 3. Check if we need WETH as intermediate token
    console.log("\n3️⃣ CHECKING PEAS/WETH AND WETH/USDC POOLS");
    console.log("==========================================");
    
    const WETH = "0x4200000000000000000000000000000000000006";
    
    // Check PEAS/WETH pools
    console.log("PEAS/WETH pools:");
    for (const fee of feeTiers) {
        try {
            const poolAddress = await factory.getPool(PEAS, WETH, fee);
            const feePercent = (fee / 10000) * 100;
            
            if (poolAddress !== "0x0000000000000000000000000000000000000000") {
                console.log(`✅ PEAS/WETH at ${feePercent}%: ${poolAddress}`);
            }
        } catch (error) {
            // Skip errors
        }
    }
    
    // Check WETH/USDC pools  
    console.log("WETH/USDC pools:");
    for (const fee of feeTiers) {
        try {
            const poolAddress = await factory.getPool(WETH, USDC, fee);
            const feePercent = (fee / 10000) * 100;
            
            if (poolAddress !== "0x0000000000000000000000000000000000000000") {
                console.log(`✅ WETH/USDC at ${feePercent}%: ${poolAddress}`);
            }
        } catch (error) {
            // Skip errors
        }
    }
}

investigateAssets()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Investigation failed:", error);
        process.exit(1);
    });
