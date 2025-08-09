const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

// Deployed contract address
const ARBITRAGE_BOT_ADDRESS = "0xb9A2cbbD2ff8F505378c40662284260e7b94DeC4";
const FAILED_TX_HASH = "0x35c0500369aace89a5387e6409cbc285e80939d2e059faf23b0ccfee158aaa01";

async function main() {
    console.log("🔍 Debugging Failed Arbitrage Transaction");
    console.log("=" .repeat(50));
    
    // Get transaction details
    const tx = await hre.ethers.provider.getTransaction(FAILED_TX_HASH);
    const receipt = await hre.ethers.provider.getTransactionReceipt(FAILED_TX_HASH);
    
    console.log("📋 Transaction Analysis:");
    console.log(`  Hash: ${FAILED_TX_HASH}`);
    console.log(`  Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()} / ${tx.gasLimit.toString()}`);
    console.log(`  Gas Price: ${hre.ethers.formatUnits(tx.gasPrice || 0, 'gwei')} gwei`);
    
    // Try to get revert reason using debug trace (if available)
    console.log("\n🔍 Analyzing Failure Reasons:");
    
    // Most common reasons for arbitrage failures:
    console.log("💡 Common Failure Reasons:");
    console.log("  1. ❌ Insufficient contract balance for flash loan fees");
    console.log("  2. ❌ Price slippage during execution");
    console.log("  3. ❌ Liquidity pool interface mismatch");
    console.log("  4. ❌ Token approvals not working");
    console.log("  5. ❌ Underlying vault redemption failing");
    
    // Check contract balance
    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = new hre.ethers.Contract(ARBITRUM_ADDRESSES.USDC, usdcAbi, hre.ethers.provider);
    const contractUsdcBalance = await usdc.balanceOf(ARBITRAGE_BOT_ADDRESS);
    
    console.log("\n💰 Contract Status Check:");
    console.log(`  Contract USDC Balance: ${hre.ethers.formatUnits(contractUsdcBalance, 6)} USDC`);
    
    if (contractUsdcBalance === 0n) {
        console.log("  ⚠️  CONTRACT HAS NO USDC BALANCE!");
        console.log("  💡 Flash loans need fees paid by the contract");
        console.log("  🎯 SOLUTION: Send some USDC to the contract first");
    }
    
    // Check Aave flash loan fee
    const aavePoolAbi = [
        "function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)"
    ];
    const aavePool = new hre.ethers.Contract(ARBITRUM_ADDRESSES.Pool, aavePoolAbi, hre.ethers.provider);
    
    try {
        const flashLoanFee = await aavePool.FLASHLOAN_PREMIUM_TOTAL();
        const feePercent = parseFloat(flashLoanFee.toString()) / 10000;
        console.log(`  Aave Flash Loan Fee: ${feePercent}%`);
        
        const flashLoanAmount = hre.ethers.parseUnits("1.0", 6);
        const requiredFee = (flashLoanAmount * flashLoanFee) / 10000n;
        console.log(`  Required Fee for $1 flash loan: ${hre.ethers.formatUnits(requiredFee, 6)} USDC`);
        
        if (contractUsdcBalance < requiredFee) {
            console.log("  ❌ Insufficient balance to pay flash loan fee!");
        } else {
            console.log("  ✅ Sufficient balance for flash loan fee");
        }
    } catch (error) {
        console.log("  ❌ Could not check flash loan fee:", error.message);
    }
    
    // Test individual components
    console.log("\n🧪 Component Testing:");
    
    // Test PEAS token
    console.log("🌱 Testing PEAS token...");
    try {
        const peasAbi = ["function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"];
        const peas = new hre.ethers.Contract(ARBITRUM_ADDRESSES.PEAS, peasAbi, hre.ethers.provider);
        const symbol = await peas.symbol();
        console.log(`  ✅ PEAS token: ${symbol}`);
    } catch (error) {
        console.log(`  ❌ PEAS token error:`, error.message);
    }
    
    // Test pPEAS pod
    console.log("🏭 Testing pPEAS pod...");
    try {
        const podAbi = ["function asset() view returns (address)", "function symbol() view returns (string)"];
        const pod = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, podAbi, hre.ethers.provider);
        const symbol = await pod.symbol();
        const asset = await pod.asset();
        console.log(`  ✅ pPEAS pod: ${symbol}, underlying: ${asset}`);
        console.log(`  Expected underlying: ${ARBITRUM_ADDRESSES.pfUSDC6}`);
        if (asset.toLowerCase() !== ARBITRUM_ADDRESSES.pfUSDC6.toLowerCase()) {
            console.log("  ❌ UNDERLYING ASSET MISMATCH!");
        }
    } catch (error) {
        console.log(`  ❌ pPEAS pod error:`, error.message);
    }
    
    // Test pfUSDC-6 vault
    console.log("🏛️ Testing pfUSDC-6 vault...");
    try {
        const vaultAbi = ["function asset() view returns (address)", "function symbol() view returns (string)"];
        const vault = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pfUSDC6, vaultAbi, hre.ethers.provider);
        const symbol = await vault.symbol();
        const asset = await vault.asset();
        console.log(`  ✅ pfUSDC-6 vault: ${symbol}, underlying: ${asset}`);
        console.log(`  Expected underlying: ${ARBITRUM_ADDRESSES.USDC}`);
        if (asset.toLowerCase() !== ARBITRUM_ADDRESSES.USDC.toLowerCase()) {
            console.log("  ❌ VAULT UNDERLYING MISMATCH!");
        }
    } catch (error) {
        console.log(`  ❌ pfUSDC-6 vault error:`, error.message);
    }
    
    console.log("\n🎯 RECOMMENDED ACTIONS:");
    console.log("1. 💰 Fund contract with USDC for flash loan fees:");
    console.log(`   Send 0.1 USDC to ${ARBITRAGE_BOT_ADDRESS}`);
    console.log("2. 🔍 Verify all contract interfaces match expectations");
    console.log("3. 📊 Check current market prices haven't moved significantly");
    console.log("4. 🧪 Test with smaller amounts first");
    
    console.log("\n💡 Quick Fix - Fund Contract:");
    console.log(`npx hardhat console --network arbitrum`);
    console.log(`const usdc = await ethers.getContractAt("IERC20", "${ARBITRUM_ADDRESSES.USDC}");`);
    console.log(`await usdc.transfer("${ARBITRAGE_BOT_ADDRESS}", ethers.parseUnits("0.1", 6));`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
