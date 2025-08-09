const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

// Deployed contract address
const ARBITRAGE_BOT_ADDRESS = "0xb9A2cbbD2ff8F505378c40662284260e7b94DeC4";

async function main() {
    console.log("🚀 EXECUTING pPEAS Arbitrage on Arbitrum!");
    console.log("=" .repeat(50));
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("Executing with account:", deployer.address);
    
    // Check account balance
    const ethBalance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", hre.ethers.formatEther(ethBalance), "ETH");
    
    // Check USDC balance
    const usdcAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    const usdc = new hre.ethers.Contract(ARBITRUM_ADDRESSES.USDC, usdcAbi, hre.ethers.provider);
    const usdcBalance = await usdc.balanceOf(deployer.address);
    const usdcDecimals = await usdc.decimals();
    console.log("USDC Balance:", hre.ethers.formatUnits(usdcBalance, usdcDecimals), "USDC");
    
    // Get the deployed contract
    const contractAbi = [
        "function owner() view returns (address)",
        "function executePeaPEASArbitrage(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params)",
        "function calculatePotentialProfit(uint256 flashLoanAmount, tuple(address usdcToken, address peasToken, address peaPEAS, address pfpOHMo27Vault, address peaPEASLiquidityPool, bool isUndervaluedStrategy, uint256 minProfitAmount, uint256 maxSlippage) params) view returns (uint256 estimatedProfit, bool isProfitable)",
        "event ArbitrageExecuted(uint256 flashLoanAmount, uint256 profit, bool isUndervaluedStrategy, address indexed executor)",
        "event ArbitrageFailed(string reason, uint256 flashLoanAmount, bool isUndervaluedStrategy)"
    ];
    
    const arbitrageBot = new hre.ethers.Contract(ARBITRAGE_BOT_ADDRESS, contractAbi, deployer);
    
    console.log("\n💰 Current Opportunity Analysis:");
    console.log(`  pPEAS Price: $${ARBITRUM_ADDRESSES.pPEASPodPrice} (UNDERVALUED)`);
    console.log(`  Fair Price: $${ARBITRUM_ADDRESSES.pPEASFairPrice}`);
    console.log(`  Gap: ${ARBITRUM_ADDRESSES.pPEASGap}%`);
    console.log(`  TVL: $${(ARBITRUM_ADDRESSES.pPEASTVL / 1000000).toFixed(1)}M`);
    
    // Prepare arbitrage parameters
    const isUndervalued = ARBITRUM_ADDRESSES.pPEASPodPrice < ARBITRUM_ADDRESSES.pPEASFairPrice;
    const arbitrageParams = {
        usdcToken: ARBITRUM_ADDRESSES.USDC,
        peasToken: ARBITRUM_ADDRESSES.PEAS,
        peaPEAS: ARBITRUM_ADDRESSES.pPEAS,
        pfpOHMo27Vault: ARBITRUM_ADDRESSES.pfUSDC6, // pfUSDC-6 vault
        peaPEASLiquidityPool: ARBITRUM_ADDRESSES.pPEASPool, // pPEAS/pfUSDC-6 LP
        isUndervaluedStrategy: isUndervalued,
        minProfitAmount: hre.ethers.parseUnits("0.005", 6), // 0.005 USDC minimum profit
        maxSlippage: 300 // 3% max slippage
    };
    
    // Test with different amounts to find optimal size
    const testAmounts = [
        { amount: "1", label: "$1 USDC" },
        { amount: "5", label: "$5 USDC" }, 
        { amount: "10", label: "$10 USDC" },
        { amount: "50", label: "$50 USDC" }
    ];
    
    console.log(`\n🧪 Strategy: ${isUndervalued ? 'UNDERVALUED' : 'OVERVALUED'}`);
    console.log("📊 Testing Different Flash Loan Amounts:");
    
    let bestAmount = null;
    let bestProfitPercent = 0;
    
    for (const test of testAmounts) {
        const flashLoanAmount = hre.ethers.parseUnits(test.amount, 6);
        
        try {
            const [estimatedProfit, isProfitable] = await arbitrageBot.calculatePotentialProfit(
                flashLoanAmount,
                arbitrageParams
            );
            
            const profitUsdc = parseFloat(hre.ethers.formatUnits(estimatedProfit, 6));
            const profitPercent = (profitUsdc / parseFloat(test.amount)) * 100;
            
            console.log(`  ${test.label}:`);
            console.log(`    Profit: ${profitUsdc.toFixed(4)} USDC (${profitPercent.toFixed(2)}%)`);
            console.log(`    Profitable: ${isProfitable ? '✅ YES' : '❌ NO'}`);
            
            if (isProfitable && profitPercent > bestProfitPercent) {
                bestAmount = { ...test, flashLoanAmount, profitPercent, profitUsdc };
                bestProfitPercent = profitPercent;
            }
        } catch (error) {
            console.log(`  ${test.label}: ❌ Error - ${error.message.substring(0, 50)}...`);
        }
    }
    
    if (!bestAmount) {
        console.log("\n❌ No profitable opportunities found at current prices");
        console.log("💡 Wait for better price gaps or check market conditions");
        return;
    }
    
    console.log(`\n🎯 Best Opportunity: ${bestAmount.label}`);
    console.log(`   Expected Profit: ${bestAmount.profitUsdc.toFixed(4)} USDC (${bestAmount.profitPercent.toFixed(2)}%)`);
    
    // Check if we have enough gas
    if (ethBalance < hre.ethers.parseEther("0.001")) {
        console.log("\n⚠️  Low ETH balance for gas fees");
        console.log("💡 Consider adding more ETH before execution");
    }
    
    console.log("\n🚀 EXECUTING ARBITRAGE...");
    console.log(`   Amount: ${bestAmount.label}`);
    console.log(`   Strategy: ${isUndervalued ? 'Buy PEAS → Wrap → Sell peaPEAS' : 'Buy peaPEAS → Unwrap → Sell PEAS'}`);
    console.log(`   Expected: ${bestAmount.profitPercent.toFixed(2)}% profit`);
    
    try {
        // Execute the arbitrage!
        console.log("\n⏳ Sending transaction...");
        const tx = await arbitrageBot.executePeaPEASArbitrage(
            bestAmount.flashLoanAmount,
            arbitrageParams,
            {
                gasLimit: 2000000, // 2M gas limit
                maxFeePerGas: hre.ethers.parseUnits("0.1", "gwei"), // Conservative gas price
                maxPriorityFeePerGas: hre.ethers.parseUnits("0.01", "gwei")
            }
        );
        
        console.log("📝 Transaction Hash:", tx.hash);
        console.log("🔗 Explorer:", `https://arbiscan.io/tx/${tx.hash}`);
        
        console.log("⏳ Waiting for confirmation...");
        const receipt = await tx.wait();
        
        console.log("\n🎉 TRANSACTION CONFIRMED!");
        console.log(`   Status: ${receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        
        // Parse events
        const events = receipt.logs.map(log => {
            try {
                return arbitrageBot.interface.parseLog(log);
            } catch {
                return null;
            }
        }).filter(Boolean);
        
        for (const event of events) {
            if (event.name === 'ArbitrageExecuted') {
                const profit = parseFloat(hre.ethers.formatUnits(event.args.profit, 6));
                const flashAmount = parseFloat(hre.ethers.formatUnits(event.args.flashLoanAmount, 6));
                const profitPercent = (profit / flashAmount) * 100;
                
                console.log("\n💰 ARBITRAGE SUCCESS!");
                console.log(`   Flash Loan: ${flashAmount} USDC`);
                console.log(`   Actual Profit: ${profit.toFixed(4)} USDC (${profitPercent.toFixed(2)}%)`);
                console.log(`   Strategy: ${event.args.isUndervaluedStrategy ? 'UNDERVALUED' : 'OVERVALUED'}`);
            } else if (event.name === 'ArbitrageFailed') {
                console.log("\n❌ ARBITRAGE FAILED!");
                console.log(`   Reason: ${event.args.reason}`);
                console.log(`   Amount: ${hre.ethers.formatUnits(event.args.flashLoanAmount, 6)} USDC`);
            }
        }
        
        // Check final balances
        const finalUsdcBalance = await usdc.balanceOf(deployer.address);
        const usdcChange = finalUsdcBalance - usdcBalance;
        const finalEthBalance = await hre.ethers.provider.getBalance(deployer.address);
        const ethUsed = ethBalance - finalEthBalance;
        
        console.log("\n📊 Balance Changes:");
        console.log(`   USDC: ${usdcChange >= 0 ? '+' : ''}${hre.ethers.formatUnits(usdcChange, usdcDecimals)} USDC`);
        console.log(`   ETH: -${hre.ethers.formatEther(ethUsed)} ETH (gas)`);
        
        if (usdcChange > 0) {
            console.log("\n🎉 PROFIT REALIZED!");
            console.log("💡 Consider scaling up for larger profits!");
        }
        
    } catch (error) {
        console.log("\n❌ EXECUTION FAILED!");
        console.log("Error:", error.message);
        
        if (error.message.includes('insufficient funds')) {
            console.log("💡 Insufficient funds for gas or flash loan fees");
        } else if (error.message.includes('slippage')) {
            console.log("💡 Slippage too high - market moved unfavorably");
        } else if (error.message.includes('liquidity')) {
            console.log("💡 Insufficient liquidity in pools");
        } else {
            console.log("💡 Check market conditions and try again");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
