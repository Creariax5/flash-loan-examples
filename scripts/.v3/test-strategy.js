// Deployment and Testing Script for PodETHArbitrageTestScript
// Run with Hardhat or similar framework

const { ethers } = require("hardhat");
require('dotenv').config(); // Load .env file

// Base Mainnet Addresses for podETH arbitrage
const ADDRESSES = {
    // Base network tokens
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    WETH: "0x4200000000000000000000000000000000000006", // WETH on Base
    
    // podETH ecosystem addresses (from Peapods on Base)
    POD_ETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C", // podETH token
    PF_USDC_VAULT: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04", // pfUSDC-108 vault (paired LP token & underlying USDC vault)
    PF_USDC_POD_ETH_PAIR: "0xEd988C42840517989ca99458153fD204899Af09b", // podETH/pfUSDC-108 LP pair
    
    // Additional podETH contracts
    S_POD_ETH: "0x6f7f8436C9014ab4A26bb4DEcbC457117348a1bE", // spodETH (staked podETH)
    AS_POD_ETH: "0xF064e1F5617dca198DF8d132eF6e05820436D17e", // aspodETH (auto-staked podETH)
    
    // Peapods utilities
    INDEX_UTILS: "0x490b03c6afe733576cf1f5d2a821cf261b15826d", // IndexUtils contract for bonding/debonding
    
    // Base DEX pairs (corrected addresses)
    WETH_USDC_PAIR: "0xd0b53D9277642d899DF5C87A3966A349A798F224", // Correct WETH/USDC pair on Base
    
    // Base DEX Routers
    UNISWAP_V3_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap V3 SwapRouter02 on Base
    SUSHISWAP_V2_ROUTER: "0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891", // SushiSwap V2 Router on Base
    BASESWAP_ROUTER: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86", // BaseSwap Router on Base
    
    // Aave V3 on Base (if needed for flash loans)
    AAVE_POOL_PROVIDER: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D", // Aave V3 Pool Provider on Base
    AAVE_POOL: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Aave V3 Pool on Base
    
    // Pod metrics from the UI
    POD_PRICE: 3933, // $3,933 current pod price
    FAIR_PRICE: 4287, // $4,287 fair price
    PRICE_GAP: 8.99, // 8.99% price gap
    POD_TVL: 107400, // $107.4k Pod TVL
    LP_TVL: 102800, // $102.8k LP TVL
};

async function deployTestContract() {
    console.log("🚀 Deploying PodETHArbitrageTestScript...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account from .env PRIVATE_KEY:", process.env.PRIVATE_KEY ? "✅ Loaded" : "❌ Missing");
    
    // Check current nonce
    const nonce = await deployer.provider.getTransactionCount(deployer.address, "pending");
    const latestNonce = await deployer.provider.getTransactionCount(deployer.address, "latest");
    console.log(`📊 Nonce status - Latest: ${latestNonce}, Pending: ${nonce}`);
    
    if (nonce > latestNonce) {
        console.log("⚠️  There are pending transactions. Waiting for them to clear...");
    }
    
    // Deploy the test contract with explicit gas settings
    const TestScript = await ethers.getContractFactory("PodETHArbitrageTestScript");
    const testScript = await TestScript.deploy({
        gasPrice: ethers.parseUnits("0.01", "gwei"), // Very low gas price for Base (0.01 gwei)
        gasLimit: 1500000 // Reduced gas limit
    });
    await testScript.waitForDeployment();
    
    console.log("✅ Test contract deployed to:", await testScript.getAddress());
    
    // Set contract addresses with explicit gas settings
    console.log("⚙️ Setting contract addresses...");
    const addressTx = await testScript.setContractAddresses(
        ADDRESSES.USDC,
        ADDRESSES.WETH,
        ADDRESSES.POD_ETH,
        ADDRESSES.PF_USDC_VAULT,
        ADDRESSES.PF_USDC_POD_ETH_PAIR,
        ADDRESSES.WETH_USDC_PAIR,
        {
            gasPrice: ethers.parseUnits("0.01", "gwei"),
            gasLimit: 100000
        }
    );
    await addressTx.wait();
    
    console.log("✅ Contract addresses configured");
    return testScript;
}

async function fundTestContract(testScript, usdcAmount = "100000") { // $0.10 worth (100,000 = 0.1 USDC with 6 decimals)
    console.log("💰 Funding test contract with USDC...");
    
    const [deployer] = await ethers.getSigners();
    const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
    
    // Check if deployer has USDC
    const balance = await usdc.balanceOf(deployer.address);
    console.log(`Deployer USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);
    
    if (balance.lt(usdcAmount)) {
        console.log("❌ Insufficient USDC balance. Need to acquire USDC first.");
        console.log(`💡 Required: ${ethers.formatUnits(usdcAmount, 6)} USDC ($0.10)`);
        console.log(`💡 Current: ${ethers.formatUnits(balance, 6)} USDC`);
        return false;
    }
    
    // Approve and fund
    await usdc.approve(await testScript.getAddress(), usdcAmount);
    await testScript.fundWithUSDC(usdcAmount);
    
    console.log(`✅ Funded contract with ${ethers.formatUnits(usdcAmount, 6)} USDC ($0.10)`);
    return true;
}

async function runFullTest(testScript) {
    console.log("\n🧪 Running Full Arbitrage Test...");
    console.log("=" * 50);
    
    try {
        // Get initial balances
        const initialBalances = await testScript.getCurrentBalances();
        console.log("📊 Initial Balances:");
        console.log(`  USDC: ${ethers.formatUnits(initialBalances.usdcBalance, 6)}`);
        console.log(`  pfUSDC: ${ethers.formatUnits(initialBalances.pfUsdcBalance, 18)}`);
        console.log(`  podETH: ${ethers.formatUnits(initialBalances.podEthBalance, 18)}`);
        console.log(`  WETH: ${ethers.formatUnits(initialBalances.wethBalance, 18)}`);
        
        // Run the full test
        const tx = await testScript.runFullArbitrageTest();
        const receipt = await tx.wait();
        
        // Parse events to see what happened
        console.log("\n📋 Test Execution Log:");
        for (const event of receipt.events) {
            if (event.event === "TestStarted") {
                console.log(`🚀 ${event.args.testName} - Input: ${ethers.formatUnits(event.args.inputAmount, 6)} USD`);
            } else if (event.event === "TestCompleted") {
                console.log(`✅ ${event.args.testName} - Output: ${ethers.formatEther(event.args.outputAmount)} - Fee: ${event.args.feePercent/100}%`);
            } else if (event.event === "TestFailed") {
                console.log(`❌ ${event.args.testName} - Failed: ${event.args.reason}`);
            } else if (event.event === "BalanceCheck") {
                console.log(`💼 ${event.args.token}: ${ethers.formatEther(event.args.balance)}`);
            } else if (event.event === "ContractValidation") {
                console.log(`🔍 ${event.args.contractName}: ${event.args.isValid ? "✅" : "❌"}`);
            }
        }
        
        // Get final balances
        const finalBalances = await testScript.getCurrentBalances();
        console.log("\n📊 Final Balances:");
        console.log(`  USDC: ${ethers.formatUnits(finalBalances.usdcBalance, 6)}`);
        console.log(`  pfUSDC: ${ethers.formatUnits(finalBalances.pfUsdcBalance, 18)}`);
        console.log(`  podETH: ${ethers.formatUnits(finalBalances.podEthBalance, 18)}`);
        console.log(`  WETH: ${ethers.formatUnits(finalBalances.wethBalance, 18)}`);
        
        // Calculate profit/loss
        const initialUSDC = parseFloat(ethers.formatUnits(initialBalances.usdcBalance, 6));
        const finalUSDC = parseFloat(ethers.formatUnits(finalBalances.usdcBalance, 6));
        const profitLoss = finalUSDC - initialUSDC;
        
        console.log("\n💰 Test Results:");
        console.log(`  Initial USDC: $${initialUSDC}`);
        console.log(`  Final USDC: $${finalUSDC}`);
        console.log(`  Profit/Loss: $${profitLoss.toFixed(6)} (${((profitLoss/initialUSDC)*100).toFixed(2)}%)`);
        
        return profitLoss > 0;
        
    } catch (error) {
        console.log("❌ Full test failed:", error.message);
        return false;
    }
}

async function runIndividualStepTests(testScript) {
    console.log("\n🔬 Running Individual Step Tests...");
    console.log("=" * 50);
    
    for (let step = 1; step <= 4; step++) {
        console.log(`\n🧪 Testing Step ${step}...`);
        
        try {
            const tx = await testScript.testIndividualStep(step);
            const receipt = await tx.wait();
            
            // Parse result from transaction (this is simplified - you'd need to decode the return value properly)
            console.log(`✅ Step ${step} completed successfully`);
            
        } catch (error) {
            console.log(`❌ Step ${step} failed:`, error.message);
            
            // Try to identify the specific failure
            if (error.message.includes("Insufficient")) {
                console.log("💡 Likely cause: Insufficient balance or liquidity");
            } else if (error.message.includes("Vault")) {
                console.log("💡 Likely cause: Vault configuration issue");
            } else if (error.message.includes("pair")) {
                console.log("💡 Likely cause: Uniswap pair not found or no liquidity");
            } else if (error.message.includes("debond")) {
                console.log("💡 Likely cause: Pod unwrapping failed - check if podETH is single-asset");
            }
            
            break; // Stop testing if a step fails
        }
    }
}

async function checkPrerequisites(testScript) {
    console.log("\n🔍 Checking Prerequisites...");
    console.log("=" * 30);
    
    try {
        // Check vault capacity
        const vaultInfo = await testScript.checkVaultCapacity();
        console.log(`📦 Vault Info:`);
        console.log(`  Total Assets: ${ethers.formatUnits(vaultInfo.totalAssets, 6)} USDC`);
        console.log(`  Available: ${ethers.formatUnits(vaultInfo.availableAssets, 6)} USDC`);
        
        if (vaultInfo.availableAssets.eq(0)) {
            console.log("⚠️  WARNING: No available assets in vault for lending");
        }
        
        // Check pair reserves
        const pfUsdcPodEthPair = await ethers.getContractAt("IUniswapV2Pair", ADDRESSES.PF_USDC_POD_ETH_PAIR);
        const reserves1 = await pfUsdcPodEthPair.getReserves();
        console.log(`🏊 pfUSDC/podETH Pair Reserves: ${ethers.formatEther(reserves1.reserve0)} / ${ethers.formatEther(reserves1.reserve1)}`);
        
        const wethUsdcPair = await ethers.getContractAt("IUniswapV2Pair", ADDRESSES.WETH_USDC_PAIR);
        const reserves2 = await wethUsdcPair.getReserves();
        console.log(`🏊 WETH/USDC Pair Reserves: ${ethers.formatEther(reserves2.reserve0)} / ${ethers.formatUnits(reserves2.reserve1, 6)}`);
        
        return true;
        
    } catch (error) {
        console.log("❌ Prerequisites check failed:", error.message);
        return false;
    }
}

// Main execution function
async function main() {
    console.log("🧪 PodETH Arbitrage Test Suite");
    console.log("=" * 40);
    
    // Check environment variables
    if (!process.env.PRIVATE_KEY) {
        console.log("❌ PRIVATE_KEY not found in .env file");
        return;
    }
    
    console.log("✅ Using .env configuration:");
    console.log(`   Private Key: ${process.env.PRIVATE_KEY.substring(0, 8)}...`);
    console.log(`   Base RPC: ${process.env.BASE_RPC_URL || 'default'}`);
    
    try {
        // Check network
        const [deployer] = await ethers.getSigners();
        const network = await deployer.provider.getNetwork();
        console.log(`\n🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
        console.log(`💼 Account: ${deployer.address}`);
        console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
        
        if (network.chainId !== 8453) {
            console.log("⚠️  Warning: Not on Base mainnet (Chain ID: 8453)");
            console.log("   Make sure you're using --network base");
        }
        
        // Step 1: Deploy test contract
        const testScript = await deployTestContract();
        
        // Step 2: Fund with test USDC ($0.10)
        console.log("\n💵 Testing with $0.10 USDC (minimum viable amount)");
        const funded = await fundTestContract(testScript);
        if (!funded) {
            console.log("❌ Could not fund contract. Exiting.");
            console.log("\n💡 To get USDC on Base:");
            console.log("   1. Bridge from Ethereum using https://bridge.base.org/");
            console.log("   2. Buy directly on Base using a DEX");
            console.log("   3. Use a faucet if available");
            return;
        }
        
        // Step 3: Check prerequisites
        const prereqsOk = await checkPrerequisites(testScript);
        if (!prereqsOk) {
            console.log("⚠️  Prerequisites failed, but continuing with tests...");
        }
        
        // Step 4: Run individual step tests (safer)
        await runIndividualStepTests(testScript);
        
        // Step 5: Run full test if individual steps work
        console.log("\n🎯 Attempting full arbitrage test...");
        const success = await runFullTest(testScript);
        
        if (success) {
            console.log("\n🎉 ALL TESTS PASSED! Arbitrage strategy is viable.");
        } else {
            console.log("\n⚠️  Tests completed with issues. Review logs above.");
        }
        
    } catch (error) {
        console.log("💥 Test suite failed:", error.message);
        console.log(error.stack);
    }
}

// Utility function for manual testing
async function manualStepTest(contractAddress, stepNumber) {
    const testScript = await ethers.getContractAt("PodETHArbitrageTestScript", contractAddress);
    
    console.log(`🧪 Manual test of Step ${stepNumber}...`);
    
    try {
        const result = await testScript.testIndividualStep(stepNumber);
        console.log("✅ Step completed successfully");
        return result;
    } catch (error) {
        console.log("❌ Step failed:", error.message);
        return null;
    }
}

// Export functions for manual use
module.exports = {
    main,
    deployTestContract,
    fundTestContract,
    runFullTest,
    runIndividualStepTests,
    checkPrerequisites,
    manualStepTest,
    ADDRESSES
};

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}