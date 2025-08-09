const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 Finding PEAS/USDC Pool on Arbitrum");
    console.log("=" .repeat(50));

    const UNISWAP_V3_FACTORY = ARBITRUM_ADDRESSES.UNISWAP_V3_FACTORY;
    const PEAS = ARBITRUM_ADDRESSES.PEAS;
    const USDC = ARBITRUM_ADDRESSES.USDC;
    
    // Uniswap V3 Factory ABI
    const factoryAbi = [
        "function getPool(address token0, address token1, uint24 fee) view returns (address pool)"
    ];
    
    const factory = new hre.ethers.Contract(UNISWAP_V3_FACTORY, factoryAbi, hre.ethers.provider);
    
    // Common fee tiers: 0.01% (100), 0.05% (500), 0.3% (3000), 1% (10000)
    const feeTiers = [100, 500, 3000, 10000];
    
    console.log(`🏭 Factory: ${UNISWAP_V3_FACTORY}`);
    console.log(`🌱 PEAS: ${PEAS}`);
    console.log(`💵 USDC: ${USDC}`);
    
    for (const feeTier of feeTiers) {
        try {
            console.log(`\n🔍 Checking ${feeTier / 100}% fee tier...`);
            
            // Try both token orders
            let pool1 = await factory.getPool(PEAS, USDC, feeTier);
            let pool2 = await factory.getPool(USDC, PEAS, feeTier);
            
            console.log(`   PEAS->USDC: ${pool1}`);
            console.log(`   USDC->PEAS: ${pool2}`);
            
            // Check if either pool exists (not zero address)
            if (pool1 !== "0x0000000000000000000000000000000000000000") {
                console.log(`✅ Found PEAS/USDC pool at ${feeTier / 100}%: ${pool1}`);
                
                // Verify the pool has code
                const code = await hre.ethers.provider.getCode(pool1);
                if (code !== '0x') {
                    console.log(`✅ Pool has contract code (${code.length} bytes)`);
                    
                    // Test basic pool functions
                    const poolAbi = [
                        "function token0() view returns (address)",
                        "function token1() view returns (address)",
                        "function fee() view returns (uint24)",
                        "function liquidity() view returns (uint128)"
                    ];
                    
                    const poolContract = new hre.ethers.Contract(pool1, poolAbi, hre.ethers.provider);
                    const token0 = await poolContract.token0();
                    const token1 = await poolContract.token1();
                    const poolFee = await poolContract.fee();
                    const liquidity = await poolContract.liquidity();
                    
                    console.log(`   Token0: ${token0}`);
                    console.log(`   Token1: ${token1}`);
                    console.log(`   Fee: ${poolFee}`);
                    console.log(`   Liquidity: ${liquidity.toString()}`);
                    
                    if (liquidity.gt(0)) {
                        console.log(`🎉 FOUND ACTIVE POOL! Use this address: ${pool1}`);
                    } else {
                        console.log(`⚠️ Pool exists but has no liquidity`);
                    }
                } else {
                    console.log(`❌ Pool address returned but no code deployed`);
                }
            }
            
            if (pool2 !== "0x0000000000000000000000000000000000000000" && pool2 !== pool1) {
                console.log(`✅ Found USDC/PEAS pool at ${feeTier / 100}%: ${pool2}`);
                // Similar verification...
            }
            
        } catch (error) {
            console.log(`❌ Error checking ${feeTier / 100}% tier:`, error.message);
        }
    }
    
    console.log("\n🔍 Alternative: Search for PEAS pools using events...");
    
    try {
        // Search for PoolCreated events mentioning PEAS
        const poolCreatedTopic = "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118"; // PoolCreated event
        
        console.log("📡 Searching recent PoolCreated events...");
        
        // Get recent blocks to search
        const currentBlock = await hre.ethers.provider.getBlockNumber();
        const fromBlock = currentBlock - 100000; // Search last 100k blocks
        
        const filter = {
            address: UNISWAP_V3_FACTORY,
            topics: [poolCreatedTopic],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const logs = await hre.ethers.provider.getLogs(filter);
        console.log(`📋 Found ${logs.length} PoolCreated events`);
        
        // Look for events containing PEAS or USDC
        for (const log of logs.slice(-20)) { // Check last 20 events
            try {
                const decoded = hre.ethers.utils.defaultAbiCoder.decode(
                    ['address', 'address', 'uint24', 'int24', 'address'],
                    log.data
                );
                const token0 = decoded[0];
                const token1 = decoded[1];
                const fee = decoded[2];
                const poolAddress = decoded[4];
                
                if (token0.toLowerCase() === PEAS.toLowerCase() || token1.toLowerCase() === PEAS.toLowerCase()) {
                    console.log(`🌱 Found pool with PEAS: ${poolAddress}`);
                    console.log(`   Token0: ${token0}`);
                    console.log(`   Token1: ${token1}`);
                    console.log(`   Fee: ${fee}`);
                }
            } catch (e) {
                // Skip invalid logs
            }
        }
        
    } catch (error) {
        console.log("❌ Event search failed:", error.message);
    }
    
    console.log("\n💡 Recommendations:");
    console.log("1. Check Uniswap V3 info page for PEAS/USDC on Arbitrum");
    console.log("2. Look at PEAS token contract for official pool listings");
    console.log("3. Check if PEAS uses different pairing token (WETH, etc.)");
    console.log("4. Verify PEAS contract address is correct for Arbitrum");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
