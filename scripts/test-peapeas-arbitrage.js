const { ethers } = require('ethers');
const { BASE_ADDRESSES } = require('./addresses');

/**
 * Test script for peaPEAS arbitrage with $5 USDC flash loan
 * Tests both strategies: UNDERVALUED and OVERVALUED
 */
async function testPeaPEASArbitrage() {
    console.log('🧪 PEAPEAS ARBITRAGE TEST - $5 USDC FLASH LOAN');
    console.log('===============================================');
    
    const flashLoanAmount = ethers.parseUnits('5', 6); // $5 USDC (6 decimals)
    console.log(`Flash Loan Amount: ${ethers.formatUnits(flashLoanAmount, 6)} USDC`);
    
    // Flash loan fee calculation (Aave = 0.09%)
    const flashLoanFeePercent = 0.09;
    const flashLoanFee = (flashLoanAmount * BigInt(Math.floor(flashLoanFeePercent * 100))) / 10000n;
    const totalRepayAmount = flashLoanAmount + flashLoanFee;
    
    console.log(`Flash Loan Fee: ${ethers.formatUnits(flashLoanFee, 6)} USDC (${flashLoanFeePercent}%)`);
    console.log(`Total Repay: ${ethers.formatUnits(totalRepayAmount, 6)} USDC`);
    
    // Test both strategies
    await testUndervaluedStrategy(flashLoanAmount, totalRepayAmount);
    await testOvervaluedStrategy(flashLoanAmount, totalRepayAmount);
    
    console.log('\n🎯 DEPLOYMENT PARAMETERS:');
    console.log('==========================');
    console.log('Contract deployment parameters for PeaPEASArbitrageBot:');
    console.log(`- Addresses Provider: ${BASE_ADDRESSES.PoolAddressesProvider}`);
    console.log('');
    console.log('Execute arbitrage parameters:');
    console.log(`- USDC Token: ${BASE_ADDRESSES.USDC}`);
    console.log(`- PEAS Token: ${BASE_ADDRESSES.PEAS}`);
    console.log(`- peaPEAS: ${BASE_ADDRESSES.peaPEAS}`);
    console.log(`- pfpOHMo-27 Vault: ${BASE_ADDRESSES.pfpOHMo27}`);
    console.log(`- Liquidity Pool: ${BASE_ADDRESSES.peaPEASPool}`);
    console.log(`- Flash Loan Amount: ${ethers.formatUnits(flashLoanAmount, 6)} USDC`);
    console.log(`- Min Profit: 0.01 USDC (adjustable)`);
    console.log(`- Max Slippage: 300 (3%)`);
}

async function testUndervaluedStrategy(flashLoanAmount, totalRepayAmount) {
    console.log('\n🔍 TESTING UNDERVALUED STRATEGY');
    console.log('================================');
    console.log('Path: USDC → PEAS → peaPEAS → pfpOHMo-27 → USDC');
    console.log('💡 Key: peaPEAS is UNDERVALUED, so we buy cheap and sell at fair price!');
    
    // Simulate the path with our known fees AND price advantage
    let currentAmount = flashLoanAmount;
    console.log(`\nStep 0: Flash loan ${ethers.formatUnits(currentAmount, 6)} USDC`);
    
    // Step 1: USDC → PEAS (0.27% V3 fee)
    const v3Fee = 0.27;
    currentAmount = (currentAmount * BigInt(10000 - Math.floor(v3Fee * 100))) / 10000n;
    console.log(`Step 1: USDC→PEAS (-${v3Fee}%) = ${ethers.formatUnits(currentAmount, 6)} PEAS value`);
    
    // Step 2: PEAS → peaPEAS (0.3% wrap fee)
    const wrapFee = BASE_ADDRESSES.peaPEASWrapFee;
    currentAmount = (currentAmount * BigInt(10000 - Math.floor(wrapFee * 100))) / 10000n;
    console.log(`Step 2: PEAS→peaPEAS (-${wrapFee}%) = ${ethers.formatUnits(currentAmount, 6)} peaPEAS value`);
    
    // Step 3: peaPEAS → pfpOHMo-27 (1.95% sell fee + 0.3% DEX)
    // 🎯 CRITICAL: Here we sell peaPEAS at FAIR VALUE, not undervalued price!
    const sellFee = BASE_ADDRESSES.peaPEASSellFee + 0.3;
    currentAmount = (currentAmount * BigInt(10000 - Math.floor(sellFee * 100))) / 10000n;
    
    // 💰 PRICE ADVANTAGE: We bought peaPEAS at $5.42 but sell at fair value $5.66
    // Price gain = (5.66 - 5.42) / 5.42 = 4.43%
    const priceGain = 4.43; // 4.43% gain from price difference
    currentAmount = (currentAmount * BigInt(10000 + Math.floor(priceGain * 100))) / 10000n;
    
    console.log(`Step 3: peaPEAS→pfpOHMo-27 (-${sellFee}% fees +${priceGain}% price gain) = ${ethers.formatUnits(currentAmount, 6)} pfpOHMo-27 value`);
    
    // Step 4: pfpOHMo-27 → USDC (assume 1:1 for vault redemption)
    console.log(`Step 4: pfpOHMo-27→USDC (1:1) = ${ethers.formatUnits(currentAmount, 6)} USDC`);
    
    // Calculate profit
    if (currentAmount > totalRepayAmount) {
        const profit = currentAmount - totalRepayAmount;
        const profitPercent = (Number(profit) / Number(flashLoanAmount)) * 100;
        console.log(`\n✅ PROFITABLE!`);
        console.log(`Profit: ${ethers.formatUnits(profit, 6)} USDC (${profitPercent.toFixed(3)}%)`);
        
        // Expected profit based on our analysis: 1.52%
        const expectedProfit = (Number(flashLoanAmount) * 1.52) / 100;
        console.log(`Expected: $${(expectedProfit / 1e6).toFixed(4)} profit (1.52%)`);
        console.log(`Actual vs Expected: ${profitPercent.toFixed(2)}% vs 1.52%`);
    } else {
        const loss = totalRepayAmount - currentAmount;
        console.log(`\n❌ NOT PROFITABLE!`);
        console.log(`Loss: ${ethers.formatUnits(loss, 6)} USDC`);
    }
}

async function testOvervaluedStrategy(flashLoanAmount, totalRepayAmount) {
    console.log('\n🔍 TESTING OVERVALUED STRATEGY');
    console.log('===============================');
    console.log('Path: USDC → pfpOHMo-27 → peaPEAS → PEAS → USDC');
    console.log('💡 Key: peaPEAS is OVERVALUED, so we buy at fair price and sell the underlying high!');
    
    // Simulate the path
    let currentAmount = flashLoanAmount;
    console.log(`\nStep 0: Flash loan ${ethers.formatUnits(currentAmount, 6)} USDC`);
    
    // Step 1: USDC → pfpOHMo-27 (assume 1:1 for vault deposit)
    console.log(`Step 1: USDC→pfpOHMo-27 (1:1) = ${ethers.formatUnits(currentAmount, 6)} pfpOHMo-27 value`);
    
    // Step 2: pfpOHMo-27 → peaPEAS (1.3% buy fee + 0.3% DEX)
    // 🎯 CRITICAL: Here we buy peaPEAS at FAIR VALUE, not overvalued price!
    const buyFee = BASE_ADDRESSES.peaPEASBuyFee + 0.3;
    currentAmount = (currentAmount * BigInt(10000 - Math.floor(buyFee * 100))) / 10000n;
    console.log(`Step 2: pfpOHMo-27→peaPEAS (-${buyFee}% fees) = ${ethers.formatUnits(currentAmount, 6)} peaPEAS value`);
    
    // Step 3: peaPEAS → PEAS (1.2% unwrap fee)
    // 💰 PRICE ADVANTAGE: We bought peaPEAS at fair value $5.66 but it represents PEAS worth more
    // When overvalued, the underlying PEAS has higher market value
    const unwrapFee = BASE_ADDRESSES.peaPEASUnwrapFee;
    currentAmount = (currentAmount * BigInt(10000 - Math.floor(unwrapFee * 100))) / 10000n;
    
    // Price gain from overvaluation - if peaPEAS is overvalued by 4.43%, PEAS is undervalued
    const priceGain = 4.43; // 4.43% gain when selling the underlying at true market value
    currentAmount = (currentAmount * BigInt(10000 + Math.floor(priceGain * 100))) / 10000n;
    
    console.log(`Step 3: peaPEAS→PEAS (-${unwrapFee}% fees +${priceGain}% price gain) = ${ethers.formatUnits(currentAmount, 6)} PEAS value`);
    
    // Step 4: PEAS → USDC (0.27% V3 fee)
    const v3Fee = 0.27;
    currentAmount = (currentAmount * BigInt(10000 - Math.floor(v3Fee * 100))) / 10000n;
    console.log(`Step 4: PEAS→USDC (-${v3Fee}%) = ${ethers.formatUnits(currentAmount, 6)} USDC`);
    
    // Calculate profit
    if (currentAmount > totalRepayAmount) {
        const profit = currentAmount - totalRepayAmount;
        const profitPercent = (Number(profit) / Number(flashLoanAmount)) * 100;
        console.log(`\n✅ PROFITABLE!`);
        console.log(`Profit: ${ethers.formatUnits(profit, 6)} USDC (${profitPercent.toFixed(3)}%)`);
        console.log(`Actual vs Expected: ${profitPercent.toFixed(2)}% vs 1.52%`);
    } else {
        const loss = totalRepayAmount - currentAmount;
        console.log(`\n❌ NOT PROFITABLE!`);
        console.log(`Loss: ${ethers.formatUnits(loss, 6)} USDC`);
    }
}

// Generate contract deployment script
function generateDeploymentScript() {
    console.log('\n📝 HARDHAT DEPLOYMENT SCRIPT:');
    console.log('=============================');
    
    const deployScript = `
// Deploy script for PeaPEASArbitrageBot
const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying PeaPEASArbitrageBot...");
    
    const addressesProvider = "${BASE_ADDRESSES.PoolAddressesProvider}";
    
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    const bot = await PeaPEASArbitrageBot.deploy(addressesProvider);
    
    await bot.deployed();
    
    console.log("PeaPEASArbitrageBot deployed to:", bot.address);
    
    // Test with $5 USDC
    const params = {
        usdcToken: "${BASE_ADDRESSES.USDC}",
        peasToken: "${BASE_ADDRESSES.PEAS}",
        peaPEAS: "${BASE_ADDRESSES.peaPEAS}",
        pfpOHMo27Vault: "${BASE_ADDRESSES.pfpOHMo27}",
        peaPEASLiquidityPool: "${BASE_ADDRESSES.peaPEASPool}",
        isUndervaluedStrategy: true, // Current market condition
        minProfitAmount: ethers.utils.parseUnits("0.01", 6), // 1 cent minimum
        maxSlippage: 300 // 3%
    };
    
    const flashLoanAmount = ethers.utils.parseUnits("5", 6); // $5 USDC
    
    console.log("Executing arbitrage with $5 USDC...");
    const tx = await bot.executePeaPEASArbitrage(flashLoanAmount, params);
    console.log("Transaction:", tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});`;
    
    console.log(deployScript);
}

// Execute test
if (require.main === module) {
    testPeaPEASArbitrage()
        .then(() => {
            generateDeploymentScript();
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { testPeaPEASArbitrage };
