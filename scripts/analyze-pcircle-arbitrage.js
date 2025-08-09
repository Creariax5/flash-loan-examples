const { ethers } = require('ethers');
const { BASE_ADDRESSES } = require('./addresses');
require('dotenv').config();

async function analyzePCircleArbitrage() {
    console.log('🎯 PCIRCLE ARBITRAGE ANALYSIS - OFFICIAL DATA');
    console.log('============================================\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
    
    // Key insights from Peapods UI
    console.log('📊 PEAPODS OFFICIAL DATA:');
    console.log('=========================');
    console.log(`pCircle Pod Price: $${BASE_ADDRESSES.pCirclePodPrice}`);
    console.log(`pCircle Fair Price: $${BASE_ADDRESSES.pCircleFairPrice}`);
    console.log(`Price Gap: ${BASE_ADDRESSES.priceGap}%`);
    console.log(`Pod TVL: $76.6K`);
    console.log(`LP TVL: $44.8K`);
    console.log(`Liquidity Pool: ${BASE_ADDRESSES.liquidityPool}`);
    console.log('');
    
    // Arbitrage opportunity analysis
    const priceDiscrepancy = ((BASE_ADDRESSES.pCircleFairPrice - BASE_ADDRESSES.pCirclePodPrice) / BASE_ADDRESSES.pCirclePodPrice) * 100;
    console.log(`🎯 ARBITRAGE OPPORTUNITY: ${priceDiscrepancy.toFixed(2)}%`);
    
    if (priceDiscrepancy > 1) {
        console.log('✅ PROFITABLE OPPORTUNITY DETECTED!');
    } else {
        console.log('⚠️  MARGINAL OPPORTUNITY');
    }
    
    console.log('\n🔍 STRATEGY ANALYSIS:');
    console.log('====================');
    
    // Determine arbitrage direction based on price gap
    const isPCircleOvervalued = BASE_ADDRESSES.pCirclePodPrice > BASE_ADDRESSES.pCircleFairPrice;
    const isPCircleUndervalued = BASE_ADDRESSES.pCirclePodPrice < BASE_ADDRESSES.pCircleFairPrice;
    
    if (isPCircleOvervalued) {
        console.log('💡 ARBITRAGE STRATEGY: pCircle OVERVALUED');
        console.log('1. Flash loan USDC');
        console.log('2. USDC → pfUSDC-89 (deposit to vault - 0% fee)');
        console.log('3. pfUSDC-89 → pCircle (buy on liquidity pool - Buy Fee + DEX fees)');
        console.log('4. Unwrap pCircle → CIRCLE tokens (Base Unwrap Fee: 1%)');
        console.log('5. CIRCLE → WETH (Uniswap V3 - ~0.3-1% fee)');
        console.log('6. WETH → USDC (BaseSwap - 0.3% fee)');
        console.log('7. Repay flash loan + keep profit');
    } else {
        console.log('💡 ARBITRAGE STRATEGY: pCircle UNDERVALUED');
        console.log('1. Flash loan USDC');
        console.log('2. USDC → WETH (BaseSwap - 0.3% fee)');
        console.log('3. WETH → CIRCLE (Uniswap V3 - ~0.3-1% fee)');
        console.log('4. CIRCLE → pCircle (wrap - Wrap Fee: 0.5%)');
        console.log('5. pCircle → pfUSDC-89 (sell on liquidity pool - Sell Fee + DEX fees)');
        console.log('6. pfUSDC-89 → USDC (withdraw from vault - 0% fee)');
        console.log('7. Repay flash loan + keep profit');
    }
    
    // Fee analysis from Peapods - CORRECTED
    console.log('\n💸 FEE STRUCTURE ANALYSIS (CORRECTED):');
    console.log('=====================================');
    console.log('Peapods Pod Fees:');
    console.log('- Wrap Fee: 0.5% (when wrapping CIRCLE → pCircle)');
    console.log('- Buy Fee: 0.5% (when buying pCircle on DEX)');
    console.log('- Sell Fee: 0.75% (when selling pCircle on DEX)');
    console.log('- Base Unwrap Fee: 1% (when unwrapping pCircle → CIRCLE)');
    console.log('');
    console.log('External Fees:');
    console.log('- Aave Flash Loan: 0.09%');
    console.log('- Uniswap V3 Fee: ~1% (CIRCLE/WETH pool)');
    console.log('- BaseSwap Fee: 0.3% (WETH/USDC)');
    console.log('- Liquidity Pool DEX Fee: ~0.3% (pfUSDC/pCircle)');
    
    let totalFees, strategyDescription;
    
    if (isPCircleOvervalued) {
        // Strategy: Buy pCircle cheap, unwrap to CIRCLE, sell CIRCLE high
        totalFees = 0.5 + 0.3 + 1 + 1 + 0.3 + 0.09; // Buy + DEX + Unwrap + V3 + BaseSwap + Flash
        strategyDescription = 'BUY pCircle → UNWRAP → SELL CIRCLE';
        console.log(`\n📊 OVERVALUED STRATEGY FEES:`);
        console.log(`- Buy pCircle: 0.5% + 0.3% DEX = 0.8%`);
        console.log(`- Unwrap pCircle: 1%`);
        console.log(`- CIRCLE→WETH: 1% (V3)`);
        console.log(`- WETH→USDC: 0.3%`);
        console.log(`- Flash loan: 0.09%`);
    } else {
        // Strategy: Buy CIRCLE cheap, wrap to pCircle, sell pCircle high  
        totalFees = 0.3 + 1 + 0.5 + 0.75 + 0.3 + 0.09; // BaseSwap + V3 + Wrap + Sell + DEX + Flash
        strategyDescription = 'BUY CIRCLE → WRAP → SELL pCircle';
        console.log(`\n📊 UNDERVALUED STRATEGY FEES:`);
        console.log(`- USDC→WETH: 0.3%`);
        console.log(`- WETH→CIRCLE: 1% (V3)`);
        console.log(`- Wrap CIRCLE: 0.5%`);
        console.log(`- Sell pCircle: 0.75% + 0.3% DEX = 1.05%`);
        console.log(`- Flash loan: 0.09%`);
    }
    
    console.log(`\n- STRATEGY: ${strategyDescription}`);
    console.log(`- TOTAL FEES: ${totalFees.toFixed(2)}%`);
    
    const netProfit = priceDiscrepancy - totalFees;
    console.log(`- NET PROFIT POTENTIAL: ${netProfit.toFixed(2)}%`);
    
    if (netProfit > 0.5) {
        console.log('✅ PROFITABLE after fees!');
    } else {
        console.log('❌ NOT PROFITABLE after fees');
    }
    
    // Verify contracts exist
    console.log('\n🔍 CONTRACT VERIFICATION:');
    console.log('=========================');
    
    const contracts = [
        { name: 'pCircle', address: BASE_ADDRESSES.pCircle },
        { name: 'pfUSDC-89', address: BASE_ADDRESSES.pfUsdcVault },
        { name: 'CIRCLE', address: BASE_ADDRESSES.CIRCLE },
        { name: 'Liquidity Pool', address: BASE_ADDRESSES.liquidityPool }
    ];
    
    for (const contract of contracts) {
        try {
            const code = await provider.getCode(contract.address);
            if (code !== '0x') {
                console.log(`✅ ${contract.name}: ${contract.address} (verified)`);
            } else {
                console.log(`❌ ${contract.name}: ${contract.address} (no code)`);
            }
        } catch (error) {
            console.log(`❌ ${contract.name}: ${contract.address} (error: ${error.message})`);
        }
    }
    
    // Check for Circle/WETH trading pairs
    console.log('\n🔍 FINDING CIRCLE TRADING ROUTES:');
    console.log('=================================');
    
    // Check Uniswap V3 pools for CIRCLE/WETH
    const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    let foundV3Pool = false;
    
    for (const fee of feeTiers) {
        try {
            const v3Factory = new ethers.Contract(
                BASE_ADDRESSES.UNISWAP_V3_FACTORY,
                ['function getPool(address,address,uint24) external view returns (address)'],
                provider
            );
            
            const poolAddr = await v3Factory.getPool(BASE_ADDRESSES.CIRCLE, BASE_ADDRESSES.WETH, fee);
            
            if (poolAddr !== '0x0000000000000000000000000000000000000000') {
                console.log(`✅ Found V3 pool (${fee/10000}% fee): ${poolAddr}`);
                
                // Check liquidity
                try {
                    const pool = new ethers.Contract(
                        poolAddr,
                        ['function liquidity() external view returns (uint128)'],
                        provider
                    );
                    
                    const liquidity = await pool.liquidity();
                    if (liquidity > 0) {
                        console.log(`   ✅ Active liquidity: ${liquidity}`);
                        foundV3Pool = true;
                    } else {
                        console.log(`   ⚠️  No liquidity in pool`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error checking liquidity: ${error.message}`);
                }
            }
        } catch (error) {
            console.log(`❌ Error checking ${fee/10000}% fee tier: ${error.message}`);
        }
    }
    
    if (!foundV3Pool) {
        console.log('❌ No CIRCLE/WETH V3 pools with liquidity found');
    }
    
    // Trade size recommendations
    console.log('\n📏 TRADE SIZE RECOMMENDATIONS:');
    console.log('==============================');
    console.log('Based on TVL and liquidity:');
    console.log('- Conservative: $100-500 (0.1-1.1% of LP TVL)');
    console.log('- Moderate: $1,000-2,000 (2-4.5% of LP TVL)');
    console.log('- Aggressive: $5,000+ (11%+ of LP TVL - high slippage risk)');
    
    // Expected profits
    if (netProfit > 0) {
        console.log('\n💰 EXPECTED PROFITS:');
        console.log('====================');
        const tradeSizes = [100, 500, 1000, 2000];
        tradeSizes.forEach(size => {
            const profit = size * (netProfit / 100);
            console.log(`$${size} trade → $${profit.toFixed(2)} profit`);
        });
    }
    
    // Next steps
    console.log('\n🚀 NEXT STEPS:');
    console.log('==============');
    if (netProfit > 0.5) {
        console.log('1. ✅ Update contract for pCircle flow');
        console.log('2. ✅ Add Uniswap V3 interface for CIRCLE→WETH');
        console.log('3. ✅ Test with small amount ($100)');
        console.log('4. ✅ Scale up if profitable');
    } else {
        console.log('1. ❌ Current opportunity not profitable due to high fees');
        console.log('2. ⚠️  Monitor for better price gaps (need >4% for profitability)');
        console.log('3. 💡 Consider different strategy or pod');
    }
    
    return {
        profitable: netProfit > 0.5,
        priceGap: priceDiscrepancy,
        netProfit: netProfit,
        fees: totalFees,
        hasV3Pool: foundV3Pool
    };
}

// Run analysis
if (require.main === module) {
    analyzePCircleArbitrage()
        .then(result => {
            console.log(`\n🎯 Analysis complete! Profitable: ${result.profitable ? '✅' : '❌'}`);
        })
        .catch(console.error);
}

module.exports = { analyzePCircleArbitrage };
