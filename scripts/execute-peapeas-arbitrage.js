const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

// Replace with your deployed contract address
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || ""; // Will be filled after deployment

async function main() {
    console.log("⚡ EXECUTING REAL PEAPEAS ARBITRAGE");
    console.log("===================================");
    
    if (!CONTRACT_ADDRESS) {
        console.error("❌ Please set CONTRACT_ADDRESS environment variable or update the script");
        console.error("Usage: CONTRACT_ADDRESS=0x... npx hardhat run scripts/execute-peapeas-arbitrage.js --network base");
        process.exit(1);
    }
    
    const [signer] = await ethers.getSigners();
    console.log("Executing with account:", signer.address);
    console.log("Account balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH");
    
    // Connect to deployed contract
    console.log("\n🤖 Connecting to PeaPEASArbitrageBot...");
    const PeaPEASArbitrageBot = await ethers.getContractFactory("PeaPEASArbitrageBot");
    const bot = PeaPEASArbitrageBot.attach(CONTRACT_ADDRESS);
    
    console.log("Contract address:", await bot.getAddress());
    console.log("Contract owner:", await bot.owner());
    
    // Verify we're the owner
    const owner = await bot.owner();
    if (owner !== signer.address) {
        console.error("❌ You are not the owner of this contract!");
        console.error(`Owner: ${owner}`);
        console.error(`Your address: ${signer.address}`);
        process.exit(1);
    }
    
    // Set up parameters for UNDERVALUED strategy
    const params = {
        usdcToken: BASE_ADDRESSES.USDC,
        peasToken: BASE_ADDRESSES.PEAS,
        peaPEAS: BASE_ADDRESSES.peaPEAS,
        pfpOHMo27Vault: BASE_ADDRESSES.pfpOHMo27,
        peaPEASLiquidityPool: BASE_ADDRESSES.peaPEASPool,
        isUndervaluedStrategy: true, // peaPEAS is undervalued - buy PEAS → wrap → sell peaPEAS
        minProfitAmount: ethers.parseUnits("0.001", 6), // 1 cent minimum profit
        maxSlippage: 300 // 3% max slippage
    };
    
    const flashLoanAmount = ethers.parseUnits("5", 6); // $5 USDC
    
    console.log("\n📊 EXECUTION PARAMETERS:");
    console.log("========================");
    console.log(`Flash Loan Amount: ${ethers.formatUnits(flashLoanAmount, 6)} USDC`);
    console.log(`Strategy: ${params.isUndervaluedStrategy ? 'UNDERVALUED' : 'OVERVALUED'}`);
    console.log(`Min Profit: ${ethers.formatUnits(params.minProfitAmount, 6)} USDC`);
    console.log(`Max Slippage: ${params.maxSlippage / 100}%`);
    console.log("");
    console.log("Strategy Flow:");
    if (params.isUndervaluedStrategy) {
        console.log("1. Flash loan $5 USDC");
        console.log("2. USDC → PEAS (Uniswap V3, 0.27% fee)");
        console.log("3. PEAS → peaPEAS (wrap, 0.3% fee)");
        console.log("4. peaPEAS → pfpOHMo-27 (sell on LP, 1.95% + 0.3% fees)");
        console.log("5. pfpOHMo-27 → USDC (redeem from vault)");
        console.log("6. Repay flash loan + keep profit");
        console.log("Expected profit: ~$0.07 (1.41%)");
    }
    
    // Calculate potential profit (simulation)
    console.log("\n🧮 SIMULATING PROFIT...");
    try {
        const [estimatedProfit, isProfitable] = await bot.calculatePotentialProfit(flashLoanAmount, params);
        console.log(`Estimated profit: ${ethers.formatUnits(estimatedProfit, 6)} USDC`);
        console.log(`Is profitable: ${isProfitable}`);
        
        if (!isProfitable) {
            console.warn("⚠️  Simulation shows unprofitable trade!");
            console.warn("This could be due to:");
            console.warn("- Price gap has closed");
            console.warn("- Insufficient liquidity");
            console.warn("- Market conditions changed");
            console.warn("");
            console.warn("Do you want to continue anyway? (Ctrl+C to abort)");
            // In a real script, you might want to add a confirmation prompt
        }
    } catch (error) {
        console.warn("⚠️  Could not simulate profit:", error.message);
        console.warn("Continuing with execution...");
    }
    
    // Execute the arbitrage
    console.log("\n🚀 EXECUTING ARBITRAGE...");
    console.log("=========================");
    
    try {
        // Estimate gas first
        console.log("Estimating gas...");
        const gasEstimate = await bot.executePeaPEASArbitrage.estimateGas(flashLoanAmount, params);
        console.log(`Gas estimate: ${gasEstimate.toString()}`);
        
        // Get current gas price
        const gasPrice = await signer.provider.getFeeData();
        console.log(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
        
        const gasCost = gasEstimate * gasPrice.gasPrice;
        console.log(`Estimated gas cost: ${ethers.formatEther(gasCost)} ETH`);
        
        // Execute transaction
        console.log("\n💥 Sending transaction...");
        const tx = await bot.executePeaPEASArbitrage(flashLoanAmount, params, {
            gasLimit: gasEstimate + BigInt(50000), // Add 50k gas buffer
            gasPrice: gasPrice.gasPrice
        });
        
        console.log(`Transaction hash: ${tx.hash}`);
        console.log("⏳ Waiting for confirmation...");
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        console.log("\n🎉 TRANSACTION CONFIRMED!");
        console.log("========================");
        console.log(`Block number: ${receipt.blockNumber}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
        
        // Parse events to find profit
        const arbitrageEvents = receipt.logs.filter(log => {
            try {
                const parsed = bot.interface.parseLog(log);
                return parsed && parsed.name === 'ArbitrageExecuted';
            } catch {
                return false;
            }
        });
        
        if (arbitrageEvents.length > 0) {
            const event = bot.interface.parseLog(arbitrageEvents[0]);
            const profit = event.args.profit;
            const strategy = event.args.isUndervaluedStrategy ? 'UNDERVALUED' : 'OVERVALUED';
            
            console.log(`\n💰 ARBITRAGE SUCCESSFUL!`);
            console.log(`Strategy: ${strategy}`);
            console.log(`Profit: ${ethers.formatUnits(profit, 6)} USDC`);
            console.log(`Profit %: ${(Number(profit) / Number(flashLoanAmount) * 100).toFixed(3)}%`);
            
            // Compare to expected
            const expectedProfit = ethers.parseUnits("0.07", 6);
            const difference = profit - expectedProfit;
            console.log(`Expected: ${ethers.formatUnits(expectedProfit, 6)} USDC`);
            console.log(`Difference: ${ethers.formatUnits(difference, 6)} USDC`);
            
        } else {
            // Look for failure events
            const failureEvents = receipt.logs.filter(log => {
                try {
                    const parsed = bot.interface.parseLog(log);
                    return parsed && parsed.name === 'ArbitrageFailed';
                } catch {
                    return false;
                }
            });
            
            if (failureEvents.length > 0) {
                const event = bot.interface.parseLog(failureEvents[0]);
                console.log(`❌ ARBITRAGE FAILED: ${event.args.reason}`);
            } else {
                console.log(`✅ Transaction confirmed but no arbitrage events found`);
                console.log("This might indicate the flash loan was repaid successfully but no profit was made");
            }
        }
        
        // Show final balance
        const finalBalance = await signer.provider.getBalance(signer.address);
        console.log(`\nFinal account balance: ${ethers.formatEther(finalBalance)} ETH`);
        
    } catch (error) {
        console.error("\n❌ EXECUTION FAILED!");
        console.error("===================");
        console.error("Error:", error.message);
        
        if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            console.error("\nThis usually means the transaction would fail.");
            console.error("Possible reasons:");
            console.error("- Insufficient liquidity in pools");
            console.error("- Price gap closed");
            console.error("- Slippage too high");
            console.error("- Contract interfaces changed");
        }
        
        if (error.reason) {
            console.error("Revert reason:", error.reason);
        }
        
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main()
        .then(() => {
            console.log("\n🎯 Arbitrage execution completed!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n💥 Execution failed:", error);
            process.exit(1);
        });
}

module.exports = { main };
