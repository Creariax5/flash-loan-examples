const { ethers } = require("hardhat");
const { AAVE_V3_SEPOLIA, ASSET_DECIMALS, ASSET_SYMBOLS } = require("./aave-addresses");

// Replace with your deployed contract address after deployment
const BORROWER_ADDRESS = "0x..."; // UPDATE THIS WITH YOUR DEPLOYED CONTRACT

async function main() {
    console.log("🧪 Testing Aave Flash Loans on Sepolia...");
    console.log("Using Official Aave V3 Addresses\n");
    
    const [signer] = await ethers.getSigners();
    console.log("Testing with account:", signer.address);
    console.log("Account balance:", ethers.utils.formatEther(await signer.getBalance()), "ETH\n");
    
    if (BORROWER_ADDRESS === "0x...") {
        console.log("❌ Please update BORROWER_ADDRESS with your deployed contract address!");
        console.log("Deploy first with: npx hardhat run scripts/deploy-aave.js --network sepolia");
        return;
    }
    
    // Get contract instances
    const borrower = await ethers.getContractAt("AaveFlashBorrower", BORROWER_ADDRESS);
    const WETH = await ethers.getContractAt("IERC20", AAVE_V3_SEPOLIA.Assets.WETH);
    const USDC = await ethers.getContractAt("IERC20", AAVE_V3_SEPOLIA.Assets.USDC);
    const DAI = await ethers.getContractAt("IERC20", AAVE_V3_SEPOLIA.Assets.DAI);

    // Verify ownership
    const owner = await borrower.owner();
    console.log("📋 Contract Information:");
    console.log("========================");
    console.log("Contract address:", borrower.address);
    console.log("Contract owner:", owner);
    console.log("Your address:", signer.address);
    console.log("Connected pool:", await borrower.getPool());
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log("❌ You are not the owner of this contract!");
        return;
    }

    // Check Aave pool liquidity
    console.log("\n🏦 Aave Pool Liquidity:");
    console.log("=======================");
    
    const assets = [
        { name: "WETH", contract: WETH, decimals: 18 },
        { name: "USDC", contract: USDC, decimals: 6 },
        { name: "DAI", contract: DAI, decimals: 18 }
    ];
    
    for (const asset of assets) {
        const liquidity = await asset.contract.balanceOf(AAVE_V3_SEPOLIA.Pool);
        const formatted = ethers.utils.formatUnits(liquidity, asset.decimals);
        console.log(`${asset.name} available: ${formatted}`);
    }

    // Check borrower balances
    console.log("\n💰 Borrower Token Balances:");
    console.log("===========================");
    for (const asset of assets) {
        const balance = await asset.contract.balanceOf(borrower.address);
        const formatted = ethers.utils.formatUnits(balance, asset.decimals);
        console.log(`${asset.name}: ${formatted}`);
    }

    // Get current flash loan fee rate
    console.log("\n💸 Flash Loan Fee Information:");
    console.log("==============================");
    const feeRate = await borrower.getFlashLoanPremiumTotal();
    console.log("Current fee rate:", feeRate.toString(), "basis points");
    console.log("Current fee rate:", (feeRate / 100).toString() + "%");

    // Test flash loan with WETH
    await testFlashLoan("WETH", WETH, "1", 18);
    
    // Test flash loan with USDC
    await testFlashLoan("USDC", USDC, "100", 6);
    
    // Test flash loan with DAI
    await testFlashLoan("DAI", DAI, "500", 18);

    console.log("\n✨ All tests completed!");
}

async function testFlashLoan(symbol, tokenContract, amount, decimals) {
    console.log(`\n🚀 Testing ${symbol} Flash Loan:`);
    console.log("================================");
    
    const borrower = await ethers.getContractAt("AaveFlashBorrower", BORROWER_ADDRESS);
    const loanAmount = ethers.utils.parseUnits(amount, decimals);
    
    console.log(`Loan amount: ${amount} ${symbol}`);
    
    // Calculate expected fee
    const expectedFee = await borrower.calculateFlashLoanFee(loanAmount);
    const feeFormatted = ethers.utils.formatUnits(expectedFee, decimals);
    console.log(`Expected fee: ${feeFormatted} ${symbol}`);
    
    // Check if borrower can afford the fee
    const canAfford = await borrower.canAffordFlashLoan(tokenContract.address, loanAmount);
    console.log(`Can afford fee: ${canAfford}`);
    
    if (!canAfford) {
        console.log(`❌ Insufficient ${symbol} balance for fees!`);
        console.log("💡 Get tokens from: https://staging.aave.com/faucet/");
        console.log(`   Send some ${symbol} to: ${borrower.address}`);
        return;
    }
    
    // Check initial balances
    const initialBalance = await tokenContract.balanceOf(borrower.address);
    console.log(`Initial balance: ${ethers.utils.formatUnits(initialBalance, decimals)} ${symbol}`);
    
    try {
        console.log("⏳ Executing flash loan...");
        
        // Execute flash loan with SIMPLE_TEST strategy (enum value 0)
        const tx = await borrower.requestFlashLoanSimple(
            tokenContract.address,
            loanAmount,
            0 // Strategy.SIMPLE_TEST
        );
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("✅ Flash loan executed successfully!");
        console.log("📊 Transaction details:");
        console.log("   Block number:", receipt.blockNumber);
        console.log("   Gas used:", receipt.gasUsed.toString());
        console.log("   Gas price:", ethers.utils.formatUnits(receipt.effectiveGasPrice, "gwei"), "gwei");
        
        // Check for FlashLoanExecuted event
        const events = receipt.events?.filter(event => event.event === "FlashLoanExecuted");
        if (events && events.length > 0) {
            const event = events[0];
            const eventAmount = ethers.utils.formatUnits(event.args.amount, decimals);
            const eventPremium = ethers.utils.formatUnits(event.args.premium, decimals);
            
            console.log("📝 Flash loan event details:");
            console.log(`   Amount: ${eventAmount} ${symbol}`);
            console.log(`   Premium: ${eventPremium} ${symbol}`);
            console.log("   Strategy:", event.args.strategy.toString());
            console.log("   Success:", event.args.success);
        }
        
        // Check final balance
        const finalBalance = await tokenContract.balanceOf(borrower.address);
        const finalFormatted = ethers.utils.formatUnits(finalBalance, decimals);
        console.log(`Final balance: ${finalFormatted} ${symbol}`);
        
        // Calculate fees paid
        const feesPaid = initialBalance.sub(finalBalance);
        const feesFormatted = ethers.utils.formatUnits(feesPaid, decimals);
        console.log(`Fees paid: ${feesFormatted} ${symbol}`);
        
        // Verify fee calculation
        if (feesPaid.eq(expectedFee)) {
            console.log("✅ Fee calculation verified!");
        } else {
            console.log("⚠️ Fee mismatch:");
            console.log("   Expected:", feeFormatted);
            console.log("   Actual:", feesFormatted);
        }
        
    } catch (error) {
        console.error(`❌ ${symbol} flash loan failed:`);
        console.error("Error:", error.message);
        
        // Parse common error types
        if (error.message.includes("Insufficient balance")) {
            console.log("💡 Need more tokens for fees");
        } else if (error.message.includes("execution reverted")) {
            console.log("💡 Contract execution failed - check your strategy logic");
        } else if (error.message.includes("insufficient funds")) {
            console.log("💡 Not enough ETH for gas fees");
        }
        
        // Try to decode revert reason
        if (error.data) {
            try {
                const reason = ethers.utils.toUtf8String("0x" + error.data.substr(138));
                console.log("Revert reason:", reason);
            } catch (e) {
                // Could not decode revert reason
            }
        }
    }
}

async function checkProtocolHealth() {
    console.log("\n🔍 Protocol Health Check:");
    console.log("=========================");
    
    try {
        // Check if Aave pool is operational
        const pool = await ethers.getContractAt("IPool", AAVE_V3_SEPOLIA.Pool);
        
        // This should not revert if pool is healthy
        const feeRate = await pool.FLASHLOAN_PREMIUM_TOTAL();
        console.log("✅ Aave Pool is operational");
        console.log("Current fee rate:", feeRate.toString(), "basis points");
        
    } catch (error) {
        console.log("❌ Aave Pool issue:", error.message);
    }
}

async function demonstrateMultipleStrategies() {
    console.log("\n🎯 Strategy Demonstration:");
    console.log("==========================");
    
    const borrower = await ethers.getContractAt("AaveFlashBorrower", BORROWER_ADDRESS);
    const strategies = [
        { name: "SIMPLE_TEST", value: 0 },
        { name: "ARBITRAGE", value: 1 },
        { name: "LIQUIDATION", value: 2 },
        { name: "REFINANCING", value: 3 }
    ];
    
    console.log("Available strategies:");
    strategies.forEach(strategy => {
        console.log(`  ${strategy.value}: ${strategy.name}`);
    });
    
    console.log("\n💡 To implement custom strategies:");
    console.log("1. Modify the _executeStrategy function in your contract");
    console.log("2. Add your business logic (DEX swaps, liquidations, etc.)");
    console.log("3. Ensure you always have enough tokens to repay loan + fee");
    console.log("4. Test thoroughly before using real funds!");
}

// Add contract state debugging function
async function debugContractState() {
    console.log("\n🐛 Contract State Debug:");
    console.log("========================");
    
    const borrower = await ethers.getContractAt("AaveFlashBorrower", BORROWER_ADDRESS);
    
    try {
        console.log("Contract address:", borrower.address);
        console.log("Owner:", await borrower.owner());
        console.log("Connected pool:", await borrower.getPool());
        console.log("Expected pool:", AAVE_V3_SEPOLIA.Pool);
        
        // Check if contract has any ETH (shouldn't have any)
        const ethBalance = await ethers.provider.getBalance(borrower.address);
        console.log("Contract ETH balance:", ethers.utils.formatEther(ethBalance));
        
        // Check allowances (should be 0 when not in flash loan)
        const assets = [AAVE_V3_SEPOLIA.Assets.WETH, AAVE_V3_SEPOLIA.Assets.USDC];
        for (const asset of assets) {
            const token = await ethers.getContractAt("IERC20", asset);
            const allowance = await token.allowance(borrower.address, AAVE_V3_SEPOLIA.Pool);
            const symbol = ASSET_SYMBOLS[asset];
            console.log(`${symbol} allowance to pool:`, allowance.toString());
        }
        
    } catch (error) {
        console.log("Error checking contract state:", error.message);
    }
}

// Run all tests
main()
    .then(() => checkProtocolHealth())
    .then(() => demonstrateMultipleStrategies())
    .then(() => debugContractState())
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });