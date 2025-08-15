const { ethers } = require("hardhat");

// Contract addresses
const CONTRACT_ADDRESS = "0xdf6FA881c7668813D38714B93f9a075BF74E4467";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PSIMMI_ADDRESS = "0x4707a4535df0e7589B4bfF2A7362FB114D05cC14";
const SIMMI_ADDRESS = "0x161e113B8E9BBAEfb846F73F31624F6f9607bd44";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const PF_USDC_VAULT = "0x02c9428716B6DC4062EB8ba1b2769704b9E24851";
const V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
const V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";

// Minimum profit threshold
const MIN_PROFIT_GAP = 7.0; // 7%
const TEST_AMOUNT = ethers.parseUnits("1", 6); // 1 USDC
const SCALE_AMOUNT = ethers.parseUnits("10", 6); // 10 USDC

class ArbitrageMonitor {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.usdcContract = null;
        this.v2Router = null;
        this.v3Router = null;
        this.isRunning = false;
    }

    async initialize() {
        console.log("🚀 Initializing Arbitrage Monitor...");
        
        [this.signer] = await ethers.getSigners();
        console.log("📝 Using signer:", this.signer.address);

        // Initialize contracts
        this.contract = await ethers.getContractAt("pSimmiArbitrage", CONTRACT_ADDRESS);
        this.usdcContract = await ethers.getContractAt("IERC20", USDC_ADDRESS);
        
        // V2 Router ABI (simplified)
        const v2Abi = [
            "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
        ];
        this.v2Router = new ethers.Contract(V2_ROUTER, v2Abi, this.signer);

        // V3 Router ABI (simplified)  
        const v3Abi = [
            "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)"
        ];
        this.v3Router = new ethers.Contract(V3_ROUTER, v3Abi, this.signer);

        console.log("✅ Contracts initialized");
    }

    async calculatePriceGap() {
        try {
            // 1. Get pfUSDC -> pSimmi rate (V2)
            const path1 = [PF_USDC_VAULT, PSIMMI_ADDRESS];
            const amountsOut1 = await this.v2Router.getAmountsOut(
                ethers.parseUnits("1", 18), // 1 pfUSDC (assuming 18 decimals)
                path1
            );
            const pSimmiAmount = amountsOut1[1];

            // 2. pSimmi -> SIMMI (debond) - assume 1:1.02 ratio based on previous tx
            const simmiAmount = pSimmiAmount * BigInt(102) / BigInt(100);

            // 3. SIMMI -> ETH rate estimation (this is the tricky part)
            // We'll use a mock calculation based on liquidity
            const simmiToEthRate = await this.estimateSimmiToEthRate(simmiAmount);

            // 4. ETH -> USDC rate
            const ethToUsdcRate = await this.estimateEthToUsdcRate(simmiToEthRate);

            // Calculate total expected return
            const expectedUsdc = ethToUsdcRate;
            const inputUsdc = ethers.parseUnits("1", 6); // 1 USDC input
            
            // Calculate profit percentage
            const profitPercentage = Number((expectedUsdc - inputUsdc) * BigInt(100) / inputUsdc);
            
            return {
                expectedUsdc,
                inputUsdc,
                profitPercentage,
                profitable: profitPercentage >= MIN_PROFIT_GAP
            };

        } catch (error) {
            console.log("❌ Error calculating price gap:", error.message);
            return { profitable: false, profitPercentage: 0 };
        }
    }

    async estimateSimmiToEthRate(simmiAmount) {
        // This is a simplified estimation - in practice you'd query the actual V3 pool
        // For now, we'll use a rough estimate based on the previous transaction
        const estimatedEthOutput = simmiAmount / BigInt(67000000); // Rough estimate
        return estimatedEthOutput;
    }

    async estimateEthToUsdcRate(ethAmount) {
        // Rough ETH to USDC conversion - you'd want to query actual V3 pool
        const ethPriceInUsdc = BigInt(4500); // Assume $4500 per ETH
        return ethAmount * ethPriceInUsdc / BigInt(10**12); // Adjust for decimals
    }

    async executeArbitrage(amount) {
        try {
            console.log(`\n💰 Executing arbitrage with ${ethers.formatUnits(amount, 6)} USDC...`);

            // Get USDC balance before
            const balanceBefore = await this.usdcContract.balanceOf(this.signer.address);
            console.log("📊 USDC balance before:", ethers.formatUnits(balanceBefore, 6));

            // Execute flash loan
            const tx = await this.contract.requestFlashLoan(USDC_ADDRESS, amount, {
                gasLimit: 2000000
            });

            console.log("⏳ Transaction hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("✅ Transaction confirmed! Gas used:", receipt.gasUsed.toString());

            // Get USDC balance after
            const balanceAfter = await this.usdcContract.balanceOf(this.signer.address);
            console.log("📊 USDC balance after:", ethers.formatUnits(balanceAfter, 6));

            // Calculate profit/loss
            const profit = balanceAfter - balanceBefore;
            const profitFormatted = ethers.formatUnits(profit, 6);
            
            if (profit > 0) {
                console.log("🎉 PROFIT:", profitFormatted, "USDC");
                return true;
            } else {
                console.log("📉 LOSS:", profitFormatted, "USDC");
                return false;
            }

        } catch (error) {
            console.log("❌ Arbitrage failed:", error.message);
            return false;
        }
    }

    async executeStrategy() {
        console.log("\n🔍 Checking arbitrage opportunity...");
        
        const priceAnalysis = await this.calculatePriceGap();
        
        if (!priceAnalysis.profitable) {
            console.log(`📊 Price gap: ${priceAnalysis.profitPercentage.toFixed(2)}% (below ${MIN_PROFIT_GAP}% threshold)`);
            return;
        }

        console.log(`🎯 OPPORTUNITY DETECTED! Price gap: ${priceAnalysis.profitPercentage.toFixed(2)}%`);

        // Step 1: Test with $1
        console.log("\n🧪 Step 1: Testing with $1 USDC...");
        const testSuccess = await this.executeArbitrage(TEST_AMOUNT);
        
        if (!testSuccess) {
            console.log("❌ $1 test failed - skipping scaling");
            return;
        }

        console.log("✅ $1 test successful!");

        // Step 2: Scale up to $10 and keep executing while profitable
        let consecutiveSuccess = 0;
        let attempt = 1;
        
        while (consecutiveSuccess < 3 && attempt <= 10) { // Max 10 attempts
            console.log(`\n🚀 Step 2.${attempt}: Executing $10 arbitrage...`);
            
            const scaleSuccess = await this.executeArbitrage(SCALE_AMOUNT);
            
            if (scaleSuccess) {
                consecutiveSuccess++;
                console.log(`✅ $10 arbitrage #${attempt} successful! (${consecutiveSuccess}/3 consecutive)`);
            } else {
                console.log(`❌ $10 arbitrage #${attempt} failed - opportunity may be exhausted`);
                break;
            }
            
            attempt++;
            
            // Wait 5 seconds between executions
            console.log("⏳ Waiting 5 seconds before next execution...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (consecutiveSuccess >= 3) {
            console.log("🎉 Successfully executed multiple profitable arbitrages!");
        }
    }

    async startMonitoring() {
        console.log("🔄 Starting arbitrage monitoring...");
        console.log(`📊 Monitoring for opportunities with >${MIN_PROFIT_GAP}% price gap`);
        console.log("⏰ Checking every 30 seconds...");
        console.log("⏹️  Press Ctrl+C to stop\n");
        
        this.isRunning = true;
        
        while (this.isRunning) {
            try {
                await this.executeStrategy();
            } catch (error) {
                console.log("❌ Monitor error:", error.message);
            }
            
            // Wait 30 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }

    stop() {
        console.log("\n🛑 Stopping arbitrage monitor...");
        this.isRunning = false;
    }
}

async function main() {
    const monitor = new ArbitrageMonitor();
    await monitor.initialize();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });

    await monitor.startMonitoring();
}

// Run single check mode if argument provided
if (process.argv[2] === 'once') {
    (async () => {
        const monitor = new ArbitrageMonitor();
        await monitor.initialize();
        await monitor.executeStrategy();
    })();
} else {
    main().catch(console.error);
}