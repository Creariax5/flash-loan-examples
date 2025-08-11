const { ethers } = require('ethers');
require('dotenv').config();

// Addresses on Base
const ADDRESSES = {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006", 
    podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
    pfUSDC: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04",
    uniV2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    uniV3Router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    indexUtils: "0x490b03c6afe733576cf1f5d2a821cf261b15826d"
};

// ABIs
const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)"
];

const ROUTER_ABI = [
    "function factory() view returns (address)",
    "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address pair)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    
    console.log("🔍 Fetching Prices...\n");
    
    try {
        // Get V2 router and factory
        const v2Router = new ethers.Contract(ADDRESSES.uniV2Router, ROUTER_ABI, provider);
        const factoryAddress = await v2Router.factory();
        const v2Factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
        
        console.log(`📍 Using V2 Factory: ${factoryAddress}`);
        
        // 1. Get podETH price via V2 pair (podETH/pfUSDC)
        const podEthPrice = await getPodETHPriceV2(v2Router, provider);
        
        // 2. Get WETH price via V2 (simpler and more reliable)
        const wethPrice = await getWETHPriceV2(v2Router);
        
        // 3. Calculate arbitrage opportunity
        const priceDiff = ((podEthPrice - wethPrice) / wethPrice) * 100;
        
        // 4. Display results
        console.log("\n💰 PRICE ANALYSIS");
        console.log("=".repeat(50));
        console.log(`podETH Price: ${podEthPrice.toFixed(6)} (via V2 pfUSDC path)`);
        console.log(`WETH Price:   ${wethPrice.toFixed(6)} (via V2 USDC)`);
        console.log(`Price Gap:    ${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)}%`);
        console.log();
        
        // 5. Strategy recommendation
        recommendStrategy(priceDiff, podEthPrice, wethPrice);
        
        // 6. Profitability analysis
        await analyzeProfitability(priceDiff);
        
    } catch (error) {
        console.error("❌ Error fetching prices:", error.message);
        if (error.code) console.error("Error code:", error.code);
    }
}

async function getPodETHPriceV2(v2Router, provider) {
    try {
        // Get price via V2 router using getAmountsOut
        // Path: podETH → pfUSDC → USDC (if possible) or use reserves directly
        
        console.log("📊 Getting podETH price via V2...");
        
        // Try direct path: podETH → pfUSDC
        const amountIn = ethers.parseEther("1"); // 1 podETH
        
        try {
            // Try path: podETH → pfUSDC
            const amounts1 = await v2Router.getAmountsOut(amountIn, [ADDRESSES.podETH, ADDRESSES.pfUSDC]);
            const pfUsdcPerPodEth = Number(ethers.formatUnits(amounts1[1], 6)); // pfUSDC has 6 decimals
            
            console.log(`   1 podETH = ${pfUsdcPerPodEth.toFixed(6)} pfUSDC`);
            
            // Now try pfUSDC → USDC (if there's a direct pair)
            try {
                const amounts2 = await v2Router.getAmountsOut(ethers.parseUnits("1", 6), [ADDRESSES.pfUSDC, ADDRESSES.USDC]);
                const usdcPerPfUsdc = Number(ethers.formatUnits(amounts2[1], 6));
                
                const podEthPrice = pfUsdcPerPodEth * usdcPerPfUsdc;
                console.log(`   1 pfUSDC = ${usdcPerPfUsdc.toFixed(6)} USDC`);
                console.log(`   podETH price = ${podEthPrice.toFixed(6)} USDC`);
                
                return podEthPrice;
            } catch (e) {
                // No direct pfUSDC → USDC pair, assume 1:1 for now
                console.log(`   Assuming pfUSDC ≈ USDC (1:1 ratio)`);
                return pfUsdcPerPodEth;
            }
            
        } catch (e) {
            console.log("   No direct podETH/pfUSDC pair found");
            
            // Try alternative path: podETH → WETH → USDC
            try {
                const amounts = await v2Router.getAmountsOut(amountIn, [ADDRESSES.podETH, ADDRESSES.WETH, ADDRESSES.USDC]);
                const podEthPrice = Number(ethers.formatUnits(amounts[2], 6)); // USDC has 6 decimals
                console.log(`   Alternative path: podETH → WETH → USDC = $${podEthPrice.toFixed(6)}`);
                return podEthPrice;
            } catch (e2) {
                throw new Error("Cannot find any valid path for podETH pricing");
            }
        }
        
    } catch (error) {
        console.error("Error getting podETH price:", error.message);
        throw error;
    }
}

async function getWETHPriceV2(v2Router) {
    try {
        console.log("📊 Getting WETH price via V2...");
        
        const amountIn = ethers.parseEther("1"); // 1 WETH
        const amounts = await v2Router.getAmountsOut(amountIn, [ADDRESSES.WETH, ADDRESSES.USDC]);
        const wethPrice = Number(ethers.formatUnits(amounts[1], 6)); // USDC has 6 decimals
        
        console.log(`   1 WETH = ${wethPrice.toFixed(6)} USDC`);
        return wethPrice;
        
    } catch (error) {
        console.error("Error getting WETH price via V2:", error.message);
        throw error;
    }
}

function recommendStrategy(priceDiff, podEthPrice, wethPrice) {
    console.log("🎯 STRATEGY RECOMMENDATION");
    console.log("=".repeat(50));
    
    if (Math.abs(priceDiff) < 0.5) {
        console.log("⚪ NO ARBITRAGE - Price difference too small (<0.5%)");
        console.log("   Wait for larger price divergence");
        return;
    }
    
    if (priceDiff > 0) {
        // podETH is more expensive than WETH
        console.log("🔵 STRATEGY 1: podETH is EXPENSIVE (+ve gap)");
        console.log("   📈 podETH ($" + podEthPrice.toFixed(6) + ") > WETH ($" + wethPrice.toFixed(6) + ")");
        console.log("   🎯 Action: Buy cheap WETH → Convert to expensive podETH");
        console.log();
        console.log("   💡 RECOMMENDED: Flash Loan WETH");
        console.log("   1. Flash loan WETH (10 DAI fee)");
        console.log("   2. WETH → podETH (bond via IndexUtils)");
        console.log("   3. podETH → pfUSDC (V2 swap)");
        console.log("   4. pfUSDC → USDC (vault redeem)");
        console.log("   5. USDC → WETH (V3 swap)");
        console.log("   6. Repay WETH loan + 10 DAI");
    } else {
        // podETH is cheaper than WETH  
        console.log("🔴 STRATEGY 2: podETH is CHEAP (-ve gap)");
        console.log("   📉 podETH ($" + podEthPrice.toFixed(6) + ") < WETH ($" + wethPrice.toFixed(6) + ")");
        console.log("   🎯 Action: Buy cheap podETH → Convert to expensive WETH");
        console.log();
        console.log("   💡 RECOMMENDED: Flash Mint podETH");
        console.log("   1. Flash mint podETH (0.1% fee)");
        console.log("   2. podETH → WETH (debond)");
        console.log("   3. WETH → USDC (V3 swap)");
        console.log("   4. USDC → pfUSDC (vault deposit)");
        console.log("   5. pfUSDC → podETH (V2 swap)");
        console.log("   6. Repay podETH + 0.1% fee");
    }
    console.log();
}

async function analyzeProfitability(priceDiff) {
    console.log("💰 PROFITABILITY ANALYSIS");
    console.log("=".repeat(50));
    
    const absDiff = Math.abs(priceDiff);
    
    // Updated costs based on strategy document
    const flashFee = 0.1;      // Flash mint/loan fee
    const bondDebondFee = 0.5; // Bond/debond fees  
    const dexFees = 1.35;      // V2 (0.3% + 0.7% pod fees) + V3 (0.05%)
    const gasCost = 0.1;       // Estimated gas cost
    
    const totalCosts = flashFee + bondDebondFee + dexFees + gasCost;
    const netProfit = absDiff - totalCosts;
    
    console.log(`Price Difference: ${absDiff.toFixed(2)}%`);
    console.log(`Estimated Costs:`);
    console.log(`  - Flash fee:     ${flashFee.toFixed(1)}%`);
    console.log(`  - Bond/Debond:   ${bondDebondFee.toFixed(1)}%`);
    console.log(`  - DEX fees:      ${dexFees.toFixed(2)}% (includes pod buy/sell fees)`);
    console.log(`  - Gas cost:      ${gasCost.toFixed(1)}%`);
    console.log(`  - Total costs:   ${totalCosts.toFixed(2)}%`);
    console.log();
    console.log(`Net Profit:       ${netProfit > 0 ? '+' : ''}${netProfit.toFixed(2)}%`);
    
    if (netProfit > 0.5) {
        console.log("✅ HIGHLY PROFITABLE - Execute immediately!");
    } else if (netProfit > 0.2) {
        console.log("✅ PROFITABLE - Good opportunity");
    } else if (netProfit > 0) {
        console.log("⚠️  MARGINALLY PROFITABLE - Consider gas fluctuations");
    } else {
        console.log("❌ NOT PROFITABLE - Wait for better opportunity");
    }
    
    // Sample profit calculations using strategy doc optimal sizes
    console.log();
    console.log("💵 OPTIMAL TRADE SIZES (based on gap):");
    
    if (absDiff >= 3.0 && absDiff < 4.0) {
        const tradeSize = 30000;
        const profit = (tradeSize * netProfit) / 100;
        console.log(`  Gap ${absDiff.toFixed(1)}% → Optimal: $${tradeSize.toLocaleString()} → $${profit.toFixed(0)} profit`);
    } else if (absDiff >= 4.0 && absDiff < 5.0) {
        const tradeSize = 60000;
        const profit = (tradeSize * netProfit) / 100;
        console.log(`  Gap ${absDiff.toFixed(1)}% → Optimal: $${tradeSize.toLocaleString()} → $${profit.toFixed(0)} profit`);
    } else if (absDiff >= 5.0 && absDiff < 6.0) {
        const tradeSize = 95000;
        const profit = (tradeSize * netProfit) / 100;
        console.log(`  Gap ${absDiff.toFixed(1)}% → Optimal: $${tradeSize.toLocaleString()} → $${profit.toFixed(0)} profit`);
    } else if (absDiff >= 6.0) {
        const tradeSize = 150000;
        const profit = (tradeSize * netProfit) / 100;
        console.log(`  Gap ${absDiff.toFixed(1)}% → Optimal: $${tradeSize.toLocaleString()} → $${profit.toFixed(0)} profit`);
    } else {
        // Show smaller amounts for demonstration
        const amounts = [1000, 5000, 10000];
        amounts.forEach(amount => {
            const profit = (amount * netProfit) / 100;
            console.log(`  $${amount.toLocaleString()} → $${profit.toFixed(2)} profit`);
        });
    }
}

// Auto-refresh functionality
async function startMonitoring() {
    console.log("🔄 Starting price monitoring (refresh every 30s)...");
    console.log("Press Ctrl+C to stop\n");
    
    while (true) {
        try {
            await main();
        } catch (error) {
            console.error("❌ Monitor error:", error.message);
        }
        console.log("\n" + "=".repeat(80) + "\n");
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    }
}

// CLI interface
if (process.argv.includes('--monitor')) {
    startMonitoring().catch(console.error);
} else {
    main().catch(console.error);
}