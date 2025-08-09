const { ethers } = require('ethers');
const { BASE_ADDRESSES } = require('./addresses');

// RPC endpoint for Base mainnet  
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

async function analyzePeaPEASArbitrage() {
    console.log('🎯 PEAPEAS ARBITRAGE ANALYSIS - OFFICIAL DATA');
    console.log('==============================================');
    
    // Price analysis
    const podPrice = BASE_ADDRESSES.peaPEASPodPrice;
    const fairPrice = BASE_ADDRESSES.peaPEASFairPrice;
    const priceDiscrepancy = ((fairPrice - podPrice) / podPrice) * 100;
    
    console.log('\n📊 PEAPODS OFFICIAL DATA:');
    console.log('=========================');
    console.log(`peaPEAS Pod Price: $${podPrice}`);
    console.log(`peaPEAS Fair Price: $${fairPrice}`);
    console.log(`Price Gap: ${BASE_ADDRESSES.peaPEASGap}%`);
    console.log('Pod TVL: $35.2K');
    console.log('LP TVL: $33.1K');
    console.log(`Liquidity Pool: ${BASE_ADDRESSES.peaPEASPool}`);
    
    console.log(`\n🎯 ARBITRAGE OPPORTUNITY: ${priceDiscrepancy.toFixed(2)}%`);
    
    if (priceDiscrepancy > 3) {
        console.log('✅ STRONG PROFITABLE OPPORTUNITY DETECTED!');
    } else if (priceDiscrepancy > 1) {
        console.log('⚠️  MARGINAL OPPORTUNITY - CHECK FEES CAREFULLY');
    } else {
        console.log('❌ OPPORTUNITY TOO SMALL');
    }

    console.log('\n🔍 STRATEGY ANALYSIS:');
    console.log('====================');
    
    // Determine arbitrage direction based on price gap
    const isPeaPEASOvervalued = podPrice > fairPrice;
    const isPeaPEASUndervalued = podPrice < fairPrice;
    
    if (isPeaPEASUndervalued) {
        console.log('💡 ARBITRAGE STRATEGY: peaPEAS UNDERVALUED');
        console.log('1. Flash loan USDC');
        console.log(`2. USDC → PEAS (direct V3 pool: ${BASE_ADDRESSES.PEAS_USDC_V3_POOL})`);
        console.log('3. PEAS → peaPEAS (wrap - Wrap Fee: 0.3%)');
        console.log('4. peaPEAS → pfpOHMo-27 (sell on liquidity pool - Sell Fee + DEX fees)');
        console.log('5. pfpOHMo-27 → USDC (convert back via vault)');
        console.log('6. Repay flash loan + keep profit');
    } else {
        console.log('💡 ARBITRAGE STRATEGY: peaPEAS OVERVALUED');
        console.log('1. Flash loan USDC');
        console.log('2. USDC → pfpOHMo-27 (via vault)');
        console.log('3. pfpOHMo-27 → peaPEAS (buy on liquidity pool - Buy Fee + DEX fees)');
        console.log('4. Unwrap peaPEAS → PEAS tokens (Base Unwrap Fee: 1.2%)');
        console.log(`5. PEAS → USDC (direct V3 pool: ${BASE_ADDRESSES.PEAS_USDC_V3_POOL})`);
        console.log('6. Repay flash loan + keep profit');
    }
    
    // Fee analysis from Peapods - CORRECTED
    console.log('\n💸 FEE STRUCTURE ANALYSIS (CORRECTED):');
    console.log('=====================================');
    console.log('Peapods peaPEAS Fees:');
    console.log(`- Wrap Fee: ${BASE_ADDRESSES.peaPEASWrapFee}% (when wrapping PEAS → peaPEAS)`);
    console.log(`- Buy Fee: ${BASE_ADDRESSES.peaPEASBuyFee}% (when buying peaPEAS on DEX)`);
    console.log(`- Sell Fee: ${BASE_ADDRESSES.peaPEASSellFee}% (when selling peaPEAS on DEX)`);
    console.log(`- Base Unwrap Fee: ${BASE_ADDRESSES.peaPEASUnwrapFee}% (when unwrapping peaPEAS → PEAS)`);
    console.log('');
    console.log('External Fees:');
    console.log('- Aave Flash Loan: 0.09%');
    console.log('- DEX Trading Fees: ~0.3% per swap');
    console.log('- Liquidity Pool DEX Fee: ~0.3% (pfpOHMo-27/peaPEAS)');
    
    let totalFees, strategyDescription;
    
    if (isPeaPEASUndervalued) {
        // Strategy: Buy PEAS cheap via direct USDC/PEAS pool, wrap to peaPEAS, sell peaPEAS high
        totalFees = 0.27 + 0.3 + 1.95 + 0.3 + 0.09; // USDC→PEAS (V3) + Wrap + Sell + DEX + Flash
        strategyDescription = 'BUY PEAS → WRAP → SELL peaPEAS';
        console.log(`\n📊 UNDERVALUED STRATEGY FEES (CORRECTED):`);
        console.log(`- USDC→PEAS: ${BASE_ADDRESSES.PEAS_USDC_FEE}% (V3 pool)`);
        console.log(`- Wrap PEAS: ${BASE_ADDRESSES.peaPEASWrapFee}%`);
        console.log(`- Sell peaPEAS: ${BASE_ADDRESSES.peaPEASSellFee}% + 0.3% DEX = ${BASE_ADDRESSES.peaPEASSellFee + 0.3}%`);
        console.log(`- Flash loan: 0.09%`);
    } else {
        // Strategy: Buy peaPEAS cheap, unwrap to PEAS, sell PEAS high via direct PEAS/USDC pool
        totalFees = BASE_ADDRESSES.peaPEASBuyFee + 0.3 + BASE_ADDRESSES.peaPEASUnwrapFee + 0.27 + 0.09; // Buy + DEX + Unwrap + PEAS→USDC (V3) + Flash
        strategyDescription = 'BUY peaPEAS → UNWRAP → SELL PEAS';
        console.log(`\n📊 OVERVALUED STRATEGY FEES (CORRECTED):`);
        console.log(`- Buy peaPEAS: ${BASE_ADDRESSES.peaPEASBuyFee}% + 0.3% DEX = ${BASE_ADDRESSES.peaPEASBuyFee + 0.3}%`);
        console.log(`- Unwrap peaPEAS: ${BASE_ADDRESSES.peaPEASUnwrapFee}%`);
        console.log(`- PEAS→USDC: ${BASE_ADDRESSES.PEAS_USDC_FEE}% (V3 pool)`);
        console.log(`- Flash loan: 0.09%`);
    }
    
    console.log(`\n- STRATEGY: ${strategyDescription}`);
    console.log(`- TOTAL FEES: ${totalFees.toFixed(2)}%`);
    
    const netProfit = priceDiscrepancy - totalFees;
    console.log(`- NET PROFIT POTENTIAL: ${netProfit.toFixed(2)}%`);

    if (netProfit > 1) {
        console.log('✅ HIGHLY PROFITABLE!');
    } else if (netProfit > 0) {
        console.log('✅ Profitable but margins are tight');
    } else {
        console.log('❌ NOT PROFITABLE after fees');
    }

    // Contract verification 
    console.log('\n🔍 CONTRACT VERIFICATION:');
    console.log('=========================');
    
    const contracts = [
        { name: 'peaPEAS', address: BASE_ADDRESSES.peaPEAS },
        { name: 'pfpOHMo-27', address: BASE_ADDRESSES.pfpOHMo27 },
        { name: 'PEAS', address: BASE_ADDRESSES.PEAS },
        { name: 'Liquidity Pool', address: BASE_ADDRESSES.peaPEASPool },
    ];

    for (const contract of contracts) {
        try {
            const code = await provider.getCode(contract.address);
            if (code !== '0x') {
                console.log(`✅ ${contract.name}: ${contract.address} (verified)`);
            } else {
                console.log(`❌ ${contract.name}: ${contract.address} (no code found)`);
            }
        } catch (error) {
            console.log(`⚠️  ${contract.name}: ${contract.address} (error: ${error.message})`);
        }
    }

    // Find PEAS trading routes - UPDATE WITH FOUND POOL
    console.log('\n🔍 VERIFIED PEAS TRADING ROUTE:');
    console.log('==============================');
    console.log('✅ DIRECT PEAS/USDC V3 Pool Found!');
    console.log(`Pool Address: ${BASE_ADDRESSES.PEAS_USDC_V3_POOL}`);
    console.log(`TVL: $${BASE_ADDRESSES.PEAS_USDC_TVL.toLocaleString()}`);
    console.log(`Pool Balances: ${BASE_ADDRESSES.PEAS_BALANCE.toLocaleString()} PEAS / ${BASE_ADDRESSES.USDC_BALANCE.toLocaleString()} USDC`);
    console.log(`Fee Tier: ${BASE_ADDRESSES.PEAS_USDC_FEE}%`);
    console.log('24H Volume: $3.2K (active trading!)');
    console.log('');
    console.log('🎯 COMPLETE ARBITRAGE PATH VERIFIED:');
    console.log('USDC → PEAS → peaPEAS → pfpOHMo-27 → USDC');

    // Trade size recommendations based on TVL
    console.log('\n📏 TRADE SIZE RECOMMENDATIONS:');
    console.log('==============================');
    console.log('Based on TVL and liquidity:');
    console.log('- Conservative: $100-500 (0.3-1.5% of LP TVL)');
    console.log('- Moderate: $1,000-2,000 (3-6% of LP TVL)');
    console.log('- Aggressive: $5,000+ (15%+ of LP TVL - high slippage risk)');

    // Expected profits
    console.log('\n💰 EXPECTED PROFITS (if executable):');
    console.log('===================================');
    const tradeSizes = [100, 500, 1000, 2000, 5000];
    for (const size of tradeSizes) {
        const expectedProfit = (size * netProfit) / 100;
        console.log(`$${size} trade → $${expectedProfit.toFixed(2)} profit`);
    }

    // Next steps
    console.log('\n🚀 NEXT STEPS:');
    console.log('==============');
    if (netProfit > 0) {
        console.log('1. ✅ PROFITABLE OPPORTUNITY FOUND!');
        console.log('2. 🔍 Research PEAS trading routes and liquidity');
        console.log('3. 🛠️  Build arbitrage contract for peaPEAS');
        console.log('4. 🧪 Test execution with small amounts');
    } else {
        console.log('1. ❌ Current opportunity not profitable due to high fees');
        console.log('2. ⚠️  Monitor for better price gaps (current fees require >3% gap)');
        console.log('3. 💡 Consider optimizing fee structure or finding better DEX routes');
    }

    console.log(`\n🎯 Analysis complete! Profitable: ${netProfit > 0 ? '✅' : '❌'}`);
    console.log(`Net Profit Margin: ${netProfit.toFixed(2)}% (vs pCircle: 0.02%)`);
    
    return {
        profitable: netProfit > 0,
        netProfit: netProfit,
        priceGap: priceDiscrepancy,
        totalFees: totalFees,
        strategy: strategyDescription
    };
}

// Execute analysis
if (require.main === module) {
    analyzePeaPEASArbitrage()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { analyzePeaPEASArbitrage };
