const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

// Replace with your deployed contract address
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xa8628d8163C0262C89A4544624D2A5382bAe9aF0";

async function main() {
    console.log("⚡ EXECUTING REAL PEAPEAS ARBITRAGE - $1 USDC TEST");
    console.log("===================================================");
    
    if (!CONTRACT_ADDRESS) {
        console.error("❌ Please set CONTRACT_ADDRESS environment variable or update the script");
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
    
    // Set up parameters for UNDERVALUED strategy with $1 USDC
    const params = {
        usdcToken: BASE_ADDRESSES.USDC,
        peasToken: BASE_ADDRESSES.PEAS,
        peaPEAS: BASE_ADDRESSES.peaPEAS,
        pfpOHMo27Vault: BASE_ADDRESSES.pfpOHMo27,
        peaPEASLiquidityPool: BASE_ADDRESSES.peaPEASPool,
        isUndervaluedStrategy: true, // peaPEAS is undervalued - buy PEAS → wrap → sell peaPEAS
        minProfitAmount: ethers.parseUnits("0.001", 6), // 0.1 cent minimum profit
        maxSlippage: 300 // 3% max slippage
    };
    
    const flashLoanAmount = ethers.parseUnits("1", 6); // $1 USDC (smaller test amount)
    
    console.log("\n📊 EXECUTION PARAMETERS:");
    console.log("========================");
    console.log(`Flash Loan Amount: ${ethers.formatUnits(flashLoanAmount, 6)} USDC`);
    console.log(`Strategy: ${params.isUndervaluedStrategy ? 'UNDERVALUED' : 'OVERVALUED'}`);
    console.log(`Min Profit: ${ethers.formatUnits(params.minProfitAmount, 6)} USDC`);
    console.log(`Max Slippage: ${params.maxSlippage / 100}%`);
    
    // Calculate potential profit (simulation)
    console.log("\n🧮 SIMULATING PROFIT...");
    try {
        const [estimatedProfit, isProfitable] = await bot.calculatePotentialProfit(flashLoanAmount, params);
        console.log(`Estimated profit: ${ethers.formatUnits(estimatedProfit, 6)} USDC`);
        console.log(`Is profitable: ${isProfitable}`);
        
        if (!isProfitable) {
            console.warn("⚠️  Simulation shows unprofitable trade - aborting");
            return;
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
            gasLimit: gasEstimate + BigInt(100000), // Add 100k gas buffer for smaller tx
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
            const expectedProfit = ethers.parseUnits("0.0147", 6);
            const difference = profit - expectedProfit;
            console.log(`Expected: ${ethers.formatUnits(expectedProfit, 6)} USDC`);
            console.log(`Difference: ${ethers.formatUnits(difference, 6)} USDC`);
            
            console.log("\n🎯 SUCCESS! Now try with larger amount:");
            console.log(`CONTRACT_ADDRESS=${CONTRACT_ADDRESS} npx hardhat run scripts/execute-peapeas-arbitrage.js --network base`);
            
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
            }
        }
        
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
            console.error("- Contract interfaces don't match real contracts");
        }
        
        if (error.reason) {
            console.error("Revert reason:", error.reason);
        }
        
        // If even $1 fails, the issue is fundamental
        console.error("\n🔍 DIAGNOSIS:");
        console.error("==============");
        console.error("Since even $1 USDC fails, the issue is likely:");
        console.error("1. Real peaPEAS contract interface doesn't match our expectations");
        console.error("2. pfpOHMo27 vault interaction is incorrect");
        console.error("3. LP pool structure is different than expected");
        console.error("4. Price oracle or conversion rates are wrong");
        
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main()
        .then(() => {
            console.log("\n🎯 Test arbitrage execution completed!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n💥 Execution failed:", error);
            process.exit(1);
        });
}

module.exports = { main };
