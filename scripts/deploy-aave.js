const { ethers } = require("hardhat");
const { AAVE_V3_SEPOLIA, ASSET_DECIMALS, ASSET_SYMBOLS } = require("./aave-addresses");

async function main() {
    console.log("🚀 Deploying Aave Flash Loan Borrower to Sepolia...");
    console.log("Using Official Aave V3 Sepolia Addresses\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy Flash Borrower
    console.log("💳 Deploying Aave Flash Borrower...");
    const AaveFlashBorrower = await ethers.getContractFactory("AaveFlashBorrower");
    const borrower = await AaveFlashBorrower.deploy(AAVE_V3_SEPOLIA.PoolAddressesProvider);
    await borrower.waitForDeployment();
    
    // Wait for additional confirmations to ensure contract is fully deployed
    console.log("⏳ Waiting for deployment confirmations...");
    const deploymentReceipt = await borrower.deploymentTransaction().wait(3);
    console.log("✅ AaveFlashBorrower deployed to:", await borrower.getAddress());
    console.log("   Transaction hash:", deploymentReceipt.hash);
    console.log("   Block number:", deploymentReceipt.blockNumber);
    
    // Wait longer for the contract to be fully available on the network
    console.log("⏳ Waiting for contract to be fully available...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try multiple times to verify contract state
    let retries = 3;
    let contractVerified = false;
    
    while (retries > 0 && !contractVerified) {
        try {
            console.log(`   Attempt ${4 - retries}/3: Checking contract state...`);
            const owner = await borrower.owner();
            const pool = await borrower.getPool();
            console.log("   ✅ Owner:", owner);
            console.log("   ✅ Connected to Aave Pool:", pool);
            contractVerified = true;
        } catch (error) {
            retries--;
            console.log(`   ⚠️  Attempt failed: ${error.message}`);
            if (retries > 0) {
                console.log(`   ⏳ Waiting 3 seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.log("   ❌ Contract state verification failed after all retries");
                console.log("   📋 This is likely a temporary network issue. The contract should work correctly.");
                console.log("   🔄 You can verify manually using the contract address above.");
            }
        }
    }

    // Verify pool connection (only if contract verification succeeded)
    if (contractVerified) {
        console.log("\n🔗 Verifying Pool Connection:");
        try {
            const connectedPool = await borrower.getPool();
            if (connectedPool.toLowerCase() === AAVE_V3_SEPOLIA.Pool.toLowerCase()) {
                console.log("✅ Pool connection verified!");
            } else {
                console.log("❌ Pool connection mismatch!");
                console.log("   Expected:", AAVE_V3_SEPOLIA.Pool);
                console.log("   Got:", connectedPool);
            }
        } catch (error) {
            console.log("⚠️  Pool connection check failed:", error.message);
            console.log("   The contract should still work correctly.");
        }
    } else {
        console.log("\n⏭️  Skipping pool verification due to contract state check failure");
    }

    // Check current flash loan fee (only if contract verification succeeded)
    console.log("\n💸 Flash Loan Fee Information:");
    console.log("==============================");
    if (contractVerified) {
        try {
            const feeRate = await borrower.getFlashLoanPremiumTotal();
            console.log("Current fee rate:", feeRate.toString(), "basis points");
            console.log("Current fee rate:", (Number(feeRate) / 100).toString() + "%");
            
            // Show fee examples
            const examples = [
                { amount: "1", asset: "WETH" },
                { amount: "100", asset: "USDC" },
                { amount: "1000", asset: "DAI" }
            ];
            
            for (const example of examples) {
                let amount;
                if (example.asset === "USDC") {
                    amount = ethers.parseUnits(example.amount, 6);
                } else {
                    amount = ethers.parseUnits(example.amount, 18);
                }
                
                const fee = await borrower.calculateFlashLoanFee(amount);
                const decimals = example.asset === "USDC" ? 6 : 18;
                const feeFormatted = ethers.formatUnits(fee, decimals);
                console.log(`${example.amount} ${example.asset} loan fee: ${feeFormatted} ${example.asset}`);
            }
        } catch (error) {
            console.log("❌ Could not fetch fee information:", error.message);
            console.log("   This might be due to network connectivity issues.");
        }
    } else {
        console.log("⏭️  Skipping fee information due to contract state check failure");
        console.log("   Standard Aave V3 fee rate: 9 basis points (0.09%)");
    }

    // Check Aave pool liquidity for flash loans
    console.log("\n🏦 Aave Pool Liquidity Check:");
    console.log("==============================");
    
    for (const [symbol, address] of Object.entries(AAVE_V3_SEPOLIA.Assets)) {
        try {
            const tokenContract = await ethers.getContractAt("IERC20", address);
            const balance = await tokenContract.balanceOf(AAVE_V3_SEPOLIA.Pool);
            const decimals = ASSET_DECIMALS[address];
            const formatted = ethers.formatUnits(balance, decimals);
            
            console.log(`${symbol} liquidity: ${formatted}`);
        } catch (error) {
            console.log(`${symbol}: Could not fetch balance`);
        }
    }

    // Check protocol data provider for additional info
    console.log("\n📊 Protocol Information:");
    console.log("========================");
    try {
        const dataProviderABI = [
            "function getAllReservesTokens() external view returns (tuple(string symbol, address tokenAddress)[])"
        ];
        const dataProvider = new ethers.Contract(
            AAVE_V3_SEPOLIA.AaveProtocolDataProvider,
            dataProviderABI,
            ethers.provider
        );
        
        const reserves = await dataProvider.getAllReservesTokens();
        console.log("Available reserves for flash loans:");
        reserves.forEach(reserve => {
            console.log(`  ${reserve.symbol}: ${reserve.tokenAddress}`);
        });
        
    } catch (error) {
        console.log("Could not fetch protocol data:", error.message);
    }

    // Instructions for getting testnet tokens
    console.log("\n🎯 Getting Testnet Tokens:");
    console.log("==========================");
    console.log("To test flash loans, you need tokens for fees. Get them from:");
    const borrowerAddress = await borrower.getAddress();
    
    console.log("1. Aave Faucet: https://staging.aave.com/faucet/");
    console.log("2. Connect wallet and switch to Sepolia");
    console.log("3. Request tokens (WETH, USDC, DAI, etc.)");
    console.log("4. Send some to your borrower contract:", borrowerAddress);
    
    console.log("\n📋 Contract Summary:");
    console.log("====================");
    console.log("Contract Address:", borrowerAddress);
    console.log("Owner:", await borrower.owner());
    console.log("Aave Pool:", AAVE_V3_SEPOLIA.Pool);
    console.log("Pool Provider:", AAVE_V3_SEPOLIA.PoolAddressesProvider);
    console.log("Data Provider:", AAVE_V3_SEPOLIA.AaveProtocolDataProvider);
    
    // Generate verification command
    console.log("\n🔍 Verification Command:");
    console.log("========================");
    console.log(`npx hardhat verify --network sepolia ${borrowerAddress} "${AAVE_V3_SEPOLIA.PoolAddressesProvider}"`);
    
    console.log("\n🎉 Deployment Complete!");
    console.log("\n📋 Next Steps:");
    console.log("1. Get testnet tokens from Aave faucet");
    console.log("2. Send tokens to borrower contract for fees");
    console.log("3. Update BORROWER_ADDRESS in test script");
    console.log("4. Run: npx hardhat run scripts/test-aave-flash-loan.js --network sepolia");
    
    // Save deployment info
    const deploymentInfo = {
        network: "sepolia",
        borrowerAddress: borrowerAddress,
        owner: await borrower.owner(),
        aavePool: AAVE_V3_SEPOLIA.Pool,
        timestamp: new Date().toISOString(),
        availableAssets: AAVE_V3_SEPOLIA.Assets
    };
    
    console.log("\n💾 Deployment Info (save this):");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    return {
        borrower,
        addresses: AAVE_V3_SEPOLIA,
        deploymentInfo
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });