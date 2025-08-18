const hre = require("hardhat");

async function main() {
    console.log(`🌐 Connected to: ${hre.network.name}\n`);
    
    // Contract addresses
    const PSIMMI = '0x4707a4535df0e7589B4bfF2A7362FB114D05cC14';
    const SIMMI = '0x161e113B8E9BBAEfb846F73F31624F6f9607bd44';
    const WETH = '0x4200000000000000000000000000000000000006';
    const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const PF_USDC_VAULT = '0x02c9428716B6DC4062EB8ba1b2769704b9E24851';

    // Pool addresses
    const PSIMMI_PFUSDC_POOL = '0xd93e757e4e1a79d5126a622933706d24d3165528'; // V2
    const SIMMI_WETH_POOL = '0xe9a65059e895dd5d49806f6a71b63fed0ffffd4b';   // V3
    const WETH_USDC_POOL = '0xd0b53D9277642d899DF5C87A3966A349A798F224';   // V3

    // Simple ABI
    const v2PairAbi = [
        'function getReserves() view returns (uint112, uint112, uint32)',
        'function token0() view returns (address)',
        'function token1() view returns (address)'
    ];

    const v3PoolAbi = [
        'function slot0() view returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool)',
        'function token0() view returns (address)',
        'function token1() view returns (address)'
    ];

    try {
        // 1. Get pSIMMI price from V2 pool
        console.log('📊 Getting pSIMMI price from V2 pool...');
        const pairContract = new hre.ethers.Contract(PSIMMI_PFUSDC_POOL, v2PairAbi, hre.ethers.provider);
        
        const [reserve0, reserve1] = await pairContract.getReserves();
        const token0 = await pairContract.token0();
        
        let pSimmiPrice;
        if (token0.toLowerCase() === PSIMMI.toLowerCase()) {
            // pSIMMI is token0, pfUSDC is token1
            pSimmiPrice = Number(hre.ethers.formatUnits(reserve1, 6)) / Number(hre.ethers.formatEther(reserve0));
        } else {
            // pfUSDC is token0, pSIMMI is token1
            pSimmiPrice = Number(hre.ethers.formatUnits(reserve0, 6)) / Number(hre.ethers.formatEther(reserve1));
        }
        
        console.log(`   pSIMMI price: $${pSimmiPrice.toFixed(8)}`);

        // 2. Get ETH price from V3 pool
        console.log('\n📊 Getting ETH price from V3 pool...');
        const ethUsdcContract = new hre.ethers.Contract(WETH_USDC_POOL, v3PoolAbi, hre.ethers.provider);
        
        const ethSlot0 = await ethUsdcContract.slot0();
        const ethSqrtPriceX96 = BigInt(ethSlot0[0].toString());
        const ethToken0 = await ethUsdcContract.token0();
        
        // Proper sqrtPriceX96 conversion
        const Q96 = BigInt(2 ** 96);
        const ethPriceRaw = (ethSqrtPriceX96 * ethSqrtPriceX96) / (Q96 * Q96);
        
        let ethPrice;
        if (ethToken0.toLowerCase() === WETH.toLowerCase()) {
            // WETH is token0, USDC is token1: price is USDC per WETH
            ethPrice = Number(ethPriceRaw) * Math.pow(10, 12); // Adjust for 18-6 decimal difference
        } else {
            // USDC is token0, WETH is token1: price is WETH per USDC, so invert
            ethPrice = 1 / (Number(ethPriceRaw) / Math.pow(10, 12));
        }
        
        console.log(`   ETH price: ${ethPrice.toFixed(2)}`);

        // 3. Get SIMMI price from V3 pool
        console.log('\n📊 Getting SIMMI price from V3 pool...');
        const simmiWethContract = new hre.ethers.Contract(SIMMI_WETH_POOL, v3PoolAbi, hre.ethers.provider);
        
        const simmiSlot0 = await simmiWethContract.slot0();
        const simmiSqrtPriceX96 = BigInt(simmiSlot0[0].toString());
        const simmiToken0 = await simmiWethContract.token0();
        
        // Proper sqrtPriceX96 conversion
        const simmiPriceRaw = (simmiSqrtPriceX96 * simmiSqrtPriceX96) / (Q96 * Q96);
        
        let simmiInWeth;
        if (simmiToken0.toLowerCase() === SIMMI.toLowerCase()) {
            // SIMMI is token0, WETH is token1: price is WETH per SIMMI
            simmiInWeth = Number(simmiPriceRaw); // Both have 18 decimals
        } else {
            // WETH is token0, SIMMI is token1: price is SIMMI per WETH, so invert
            simmiInWeth = 1 / Number(simmiPriceRaw);
        }
        
        const simmiPrice = simmiInWeth * ethPrice;
        
        console.log(`   SIMMI in WETH: ${simmiInWeth.toFixed(12)} ETH`);
        console.log(`   SIMMI price: ${simmiPrice.toFixed(8)}`);

        // 4. Calculate arbitrage opportunity
        console.log('\n🔀 Arbitrage Analysis:');
        console.log(`   pSIMMI: $${pSimmiPrice.toFixed(8)}`);
        console.log(`   SIMMI:  $${simmiPrice.toFixed(8)}`);
        
        const diff = pSimmiPrice - simmiPrice;
        const diffPercent = (diff / simmiPrice) * 100;
        
        console.log(`   Difference: $${diff.toFixed(8)} (${diffPercent.toFixed(2)}%)`);
        
        if (Math.abs(diffPercent) > 1) {
            if (diff > 0) {
                console.log(`   💡 pSIMMI is overpriced → SELL pSIMMI strategy`);
            } else {
                console.log(`   💡 SIMMI is overpriced → BUY pSIMMI strategy`);
            }
        } else {
            console.log(`   😐 No significant arbitrage opportunity`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main().catch(console.error);