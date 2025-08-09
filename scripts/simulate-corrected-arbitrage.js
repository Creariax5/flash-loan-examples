const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🧪 TESTING Corrected Pod Logic (Simulation)");
    console.log("=".repeat(50));

    console.log("\n📋 CORRECTED UNDERSTANDING:");
    console.log("1. PEAS is 100% weighted asset in pPEAS pod");
    console.log("2. pPEAS pod uses bond(PEAS, amount, minMint) to wrap");
    console.log("3. pPEAS pod uses debond(amount, [PEAS], [100]) to unwrap");
    console.log("4. pPEAS paired LP token IS pfUSDC-6 vault");
    console.log("5. Need: USDC → WETH → PEAS → pPEAS → pPEAS/pfUSDC-6 → pfUSDC-6 → USDC");

    console.log("\n🔄 SIMULATED ARBITRAGE FLOW:");
    
    // Simulate with 1000 USDC
    const flashAmount = ethers.parseUnits("1000", 6);
    console.log("\n1️⃣ Flash loan:", ethers.formatUnits(flashAmount, 6), "USDC");
    
    // Step 1: USDC → WETH (assume 0.1% fee)
    const wethReceived = flashAmount * 999n / 1000n; // 0.1% fee
    console.log("2️⃣ USDC → WETH:", ethers.formatUnits(wethReceived, 6), "WETH equivalent");
    
    // Step 2: WETH → PEAS (assume 0.3% fee) 
    const peasReceived = wethReceived * 997n / 1000n; // 0.3% fee
    console.log("3️⃣ WETH → PEAS:", ethers.formatUnits(peasReceived, 18), "PEAS");
    
    // Step 3: PEAS → pPEAS (bond - 0.2% fee per addresses.js)
    const bondFee = 20n; // 0.2% = 20/10000
    const pPEASReceived = peasReceived * (10000n - bondFee) / 10000n;
    console.log("4️⃣ PEAS → pPEAS (bond):", ethers.formatUnits(pPEASReceived, 18), "pPEAS");
    
    // Step 4: Trade pPEAS for pfUSDC-6 on LP (2% fee per addresses.js)
    const sellFee = 200n; // 2% = 200/10000  
    const pfUSDCReceived = pPEASReceived * (10000n - sellFee) / 10000n;
    console.log("5️⃣ pPEAS → pfUSDC-6 (LP):", ethers.formatUnits(pfUSDCReceived, 18), "pfUSDC-6");
    
    // Step 5: Redeem pfUSDC-6 → USDC (ERC4626 - minimal fee)
    const redeemFee = 1n; // minimal fee
    const finalUSDC = pfUSDCReceived * (10000n - redeemFee) / 10000n;
    console.log("6️⃣ pfUSDC-6 → USDC:", ethers.formatUnits(finalUSDC, 18), "USDC equivalent");
    
    // Calculate profit
    const flashFee = flashAmount * 5n / 10000n; // 0.05% Aave fee
    const totalNeeded = flashAmount + flashFee;
    
    // Note: This is simplified - actual rates depend on pool liquidity/prices
    console.log("\n💰 PROFIT ANALYSIS:");
    console.log("Flash loan amount:", ethers.formatUnits(flashAmount, 6), "USDC");
    console.log("Flash loan fee:", ethers.formatUnits(flashFee, 6), "USDC (0.05%)");
    console.log("Total needed:", ethers.formatUnits(totalNeeded, 6), "USDC");
    console.log("Estimated return:", ethers.formatUnits(finalUSDC, 18), "USDC equivalent");
    
    if (finalUSDC > totalNeeded) {
        const profit = finalUSDC - totalNeeded;
        console.log("✅ Estimated profit:", ethers.formatUnits(profit, 18), "USDC");
        console.log("📈 Profit margin:", ((Number(profit) / Number(totalNeeded)) * 100).toFixed(4), "%");
    } else {
        const loss = totalNeeded - finalUSDC;
        console.log("❌ Estimated loss:", ethers.formatUnits(loss, 18), "USDC");
    }
    
    console.log("\n🎯 NEXT STEPS:");
    console.log("1. Deploy contract with corrected pod interfaces");
    console.log("2. Test actual bond/debond functions on pPEAS pod");
    console.log("3. Test pPEAS/pfUSDC-6 LP trading");
    console.log("4. Execute real arbitrage with correct flow");
    
    console.log("\n🔧 CORRECTED CONTRACT FUNCTIONS NEEDED:");
    console.log("- IPeaPEAS(pPEAS).bond(PEAS_ADDRESS, amount, 0)");
    console.log("- IPeaPEAS(pPEAS).debond(amount, [PEAS_ADDRESS], [100])");
    console.log("- Trade pPEAS/pfUSDC-6 on LP pool");
    console.log("- IERC4626(pfUSDC6).redeem(shares, receiver, owner)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
