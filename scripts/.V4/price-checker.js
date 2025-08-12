const { ethers } = require('ethers');
require('dotenv').config();

// Base network addresses
const ADDRESSES = {
    podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
    pfUSDC: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04", 
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
    uniV2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
};

const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

async function getPodETHPrice() {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const router = new ethers.Contract(ADDRESSES.uniV2Router, ROUTER_ABI, provider);
    
    console.log("🔍 Getting podETH price via V2 liquidity pools (using tiny amounts for accuracy)...\n");
    
    try {
        // Method 1: Direct podETH → pfUSDC path (using tiny amount for accurate pricing)
        const amountIn = ethers.parseEther("0.000001"); // 0.000001 podETH
        
        try {
            const amounts1 = await router.getAmountsOut(amountIn, [
                ADDRESSES.podETH, 
                ADDRESSES.pfUSDC
            ]);
            
            const pfUsdcAmount = Number(ethers.formatUnits(amounts1[1], 6));
            // Calculate price per 1 podETH
            const pricePerPodETH = pfUsdcAmount / 0.000001;
            console.log(`📊 0.000001 podETH = ${pfUsdcAmount.toFixed(9)} pfUSDC`);
            console.log(`📊 1 podETH = ${pricePerPodETH.toFixed(6)} pfUSDC`);
            
            // Try to convert pfUSDC → USDC for USD price
            try {
                const amounts2 = await router.getAmountsOut(
                    ethers.parseUnits("1", 6), 
                    [ADDRESSES.pfUSDC, ADDRESSES.USDC]
                );
                
                const usdcRate = Number(ethers.formatUnits(amounts2[1], 6));
                const podEthPriceUSD = pricePerPodETH * usdcRate;
                
                console.log(`💱 1 pfUSDC = ${usdcRate.toFixed(6)} USDC`);
                console.log(`💰 podETH Price: ${podEthPriceUSD.toFixed(6)} USD`);
                
                return podEthPriceUSD;
                
            } catch (e) {
                // Assume pfUSDC ≈ USDC (1:1)
                console.log(`💰 podETH Price: ~${pricePerPodETH.toFixed(6)} USD (assuming pfUSDC ≈ USDC)`);
                return pricePerPodETH;
            }
            
        } catch (e) {
            console.log("❌ No direct podETH/pfUSDC pair found");
            
            // Fallback: podETH → WETH → USDC
            console.log("🔄 Trying alternate path: podETH → WETH → USDC");
            
            const amounts = await router.getAmountsOut(amountIn, [
                ADDRESSES.podETH,
                ADDRESSES.WETH, 
                ADDRESSES.USDC
            ]);
            
            const usdcForTinyAmount = Number(ethers.formatUnits(amounts[2], 6));
            const podEthPriceUSD = usdcForTinyAmount / 0.000001; // Scale to 1 podETH
            console.log(`💰 podETH Price: ${podEthPriceUSD.toFixed(6)} USD`);
            
            return podEthPriceUSD;
        }
        
    } catch (error) {
        console.error("❌ Error:", error.message);
        throw error;
    }
}

async function getWETHPrice() {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const router = new ethers.Contract(ADDRESSES.uniV2Router, ROUTER_ABI, provider);
    
    try {
        const amountIn = ethers.parseEther("0.001"); // Use 0.001 WETH (better liquidity than podETH)
        const amounts = await router.getAmountsOut(amountIn, [
            ADDRESSES.WETH, 
            ADDRESSES.USDC
        ]);
        
        const usdcForSmallAmount = Number(ethers.formatUnits(amounts[1], 6));
        const wethPrice = usdcForSmallAmount / 0.001; // Scale to 1 WETH
        console.log(`📊 WETH Price: ${wethPrice.toFixed(6)} USD`);
        
        return wethPrice;
        
    } catch (error) {
        console.error("❌ Error getting WETH price:", error.message);
        throw error;
    }
}

async function main() {
    console.log("🚀 podETH Price Monitor\n");
    
    try {
        const [podEthPrice, wethPrice] = await Promise.all([
            getPodETHPrice(),
            getWETHPrice()
        ]);
        
        // Calculate gap using the cheaper asset as base (like Peapods Finance)
        const cheaperPrice = Math.min(podEthPrice, wethPrice);
        const expensivePrice = Math.max(podEthPrice, wethPrice);
        const arbitrageGap = ((expensivePrice - cheaperPrice) / cheaperPrice) * 100;
        
        console.log("\n" + "=".repeat(40));
        console.log(`podETH: ${podEthPrice.toFixed(6)}`);
        console.log(`WETH:   ${wethPrice.toFixed(6)}`);
        console.log(`Gap:    ${arbitrageGap.toFixed(2)}% (potential profit)`);
        console.log("=".repeat(40));
        
        if (arbitrageGap > 1) {
            console.log(`\n🎯 ${arbitrageGap.toFixed(2)}% arbitrage opportunity detected!`);
            console.log(podEthPrice < wethPrice ? "📉 podETH is cheap (BUY)" : "📈 podETH is expensive (SELL)");
        } else {
            console.log("\n😴 No significant arbitrage opportunity");
        }
        
    } catch (error) {
        console.error("❌ Failed to get prices:", error.message);
    }
}

// Run once or monitor continuously
if (process.argv.includes('--watch')) {
    console.log("👀 Monitoring mode - updating every 30 seconds\n");
    setInterval(main, 30000);
}

main();