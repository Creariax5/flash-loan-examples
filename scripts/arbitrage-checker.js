const { ethers } = require('ethers');
require('dotenv').config();

const ADDRESSES = {
    podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
    pfUSDC: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04", 
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
    v2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    v3Quoter: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"
};

const FEES = {
    flashLoan: 0.001,     // 0.1% flash loan fee
    debond: 0.01,         // 1% debond fee  
    uniV3: 0.0005,        // 0.05% V3 WETH/USDC
    uniV2: 0.003,         // 0.3% V2 pfUSDC/podETH
    podETHBuy: 0.01       // 1% buy fee for podETH
};

async function checkArbitrage() {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    
    const v2Router = new ethers.Contract(ADDRESSES.v2Router, [
        "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
    ], provider);
    
    const v3Quoter = new ethers.Contract(ADDRESSES.v3Quoter, [
        "function quoteExactInputSingle(address,address,uint24,uint256,uint160) external view returns (uint256)"
    ], provider);
    
    console.log("🎯 PodETH Arbitrage Strategy Checker");
    console.log("=".repeat(45));
    console.log("Strategy: Flash mint → Debond → V3 swap → Vault deposit → V2 swap");
    console.log();
    
    try {
        const startAmount = ethers.parseEther("1"); // 1 podETH
        console.log(`💰 Flash mint: ${ethers.formatEther(startAmount)} podETH`);
        
        // Step 1: Debond podETH → WETH (1% fee)
        const wethAfterDebond = startAmount * BigInt(Math.floor((1 - FEES.debond) * 1000)) / BigInt(1000);
        console.log(`🔓 Debond (1% fee): ${ethers.formatEther(wethAfterDebond)} WETH`);
        
        // Step 2: WETH → USDC (V3, 0.05% fee)
        const usdcReceived = await v3Quoter.quoteExactInputSingle(
            ADDRESSES.WETH,
            ADDRESSES.USDC, 
            500, // 0.05% fee tier
            wethAfterDebond,
            0
        );
        const usdcAfterFees = usdcReceived * BigInt(Math.floor((1 - FEES.uniV3) * 1000)) / BigInt(1000);
        console.log(`🔄 V3 WETH→USDC (0.05% fee): ${ethers.formatUnits(usdcAfterFees, 6)} USDC`);
        
        // Step 3: USDC → pfUSDC (assume 1:1, no fee)
        const pfUsdcAmount = usdcAfterFees;
        console.log(`🏦 Vault deposit (no fee): ${ethers.formatUnits(pfUsdcAmount, 6)} pfUSDC`);
        
        // Step 4: pfUSDC → podETH (V2 0.3% + podETH buy 1% = 1.3% total)
        const v2Quote = await v2Router.getAmountsOut(
            pfUsdcAmount, 
            [ADDRESSES.pfUSDC, ADDRESSES.podETH]
        );
        const podETHFromV2 = v2Quote[1];
        
        // Apply total fees: V2 (0.3%) + podETH buy fee (1%) = 1.3%
        const totalV2Fees = FEES.uniV2 + FEES.podETHBuy;
        const finalPodETH = podETHFromV2 * BigInt(Math.floor((1 - totalV2Fees) * 1000)) / BigInt(1000);
        console.log(`🔄 V2 pfUSDC→podETH (1.3% total fees): ${ethers.formatEther(finalPodETH)} podETH`);
        
        // Step 5: Calculate net result
        const flashLoanFee = startAmount * BigInt(Math.floor(FEES.flashLoan * 1000)) / BigInt(1000);
        const totalCost = startAmount + flashLoanFee;
        
        console.log("\n📊 PROFIT ANALYSIS:");
        console.log("=".repeat(25));
        console.log(`Flash loan amount: ${ethers.formatEther(startAmount)} podETH`);
        console.log(`Flash loan fee (0.1%): ${ethers.formatEther(flashLoanFee)} podETH`);
        console.log(`Total to repay: ${ethers.formatEther(totalCost)} podETH`);
        console.log(`Final received: ${ethers.formatEther(finalPodETH)} podETH`);
        
        if (finalPodETH > totalCost) {
            const profit = finalPodETH - totalCost;
            const profitPercent = (Number(profit) * 100) / Number(startAmount);
            console.log(`✅ PROFIT: ${ethers.formatEther(profit)} podETH (${profitPercent.toFixed(3)}%)`);
            
            if (profitPercent > 0.1) {
                console.log("🚀 ARBITRAGE IS PROFITABLE!");
            } else {
                console.log("⚠️  Profit very small - gas costs would likely eat it");
            }
        } else {
            const loss = totalCost - finalPodETH;
            const lossPercent = (Number(loss) * 100) / Number(startAmount);
            console.log(`❌ LOSS: ${ethers.formatEther(loss)} podETH (${lossPercent.toFixed(3)}%)`);
        }
        
        // Show fee breakdown
        console.log("\n🧾 FEE BREAKDOWN:");
        console.log("=".repeat(20));
        console.log(`Flash loan: ${(FEES.flashLoan * 100).toFixed(1)}%`);
        console.log(`Debond: ${(FEES.debond * 100).toFixed(1)}%`);
        console.log(`V3 WETH/USDC: ${(FEES.uniV3 * 100).toFixed(2)}%`);
        console.log(`V2 pfUSDC/podETH: ${(FEES.uniV2 * 100).toFixed(1)}%`);
        console.log(`podETH buy fee: ${(FEES.podETHBuy * 100).toFixed(1)}%`);
        const totalFees = FEES.flashLoan + FEES.debond + FEES.uniV3 + FEES.uniV2 + FEES.podETHBuy;
        console.log(`TOTAL FEES: ~${(totalFees * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error("❌ Check failed:", error.message);
        
        if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
            console.log("💡 One of the pairs has insufficient liquidity");
        } else if (error.message.includes("call revert")) {
            console.log("💡 Pool might not exist or quoter failed");
        }
    }
}

console.log("⚠️  TEST ONLY - NO ACTUAL TRADES EXECUTED");
console.log();
checkArbitrage();