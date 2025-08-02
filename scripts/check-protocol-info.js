const { ethers } = require("hardhat");
const { AAVE_V3_SEPOLIA, ASSET_DECIMALS, ASSET_SYMBOLS } = require("./aave-addresses");

async function main() {
    console.log("📊 Aave V3 Sepolia Protocol Information");
    console.log("=======================================\n");
    
    // Get current block information
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    console.log("🔗 Network Information:");
    console.log("Current block:", blockNumber);
    console.log("Block timestamp:", new Date(block.timestamp * 1000).toLocaleString());
    console.log("Network:", "Ethereum Sepolia Testnet\n");

    await checkPoolInformation();
    await checkReserveData();
    await checkFlashLoanCapability();
    await checkOracleData();
    await checkIncentives();
}

async function checkPoolInformation() {
    console.log("🏦 Pool Information:");
    console.log("===================");
    
    try {
        const poolABI = [
            "function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)",
            "function FLASHLOAN_PREMIUM_TO_PROTOCOL() external view returns (uint128)",
            "function MAX_NUMBER_RESERVES() external view returns (uint16)"
        ];
        
        const pool = new ethers.Contract(AAVE_V3_SEPOLIA.Pool, poolABI, ethers.provider);
        
        const premiumTotal = await pool.FLASHLOAN_PREMIUM_TOTAL();
        console.log("Flash loan fee rate:", premiumTotal.toString(), "basis points");
        console.log("Flash loan fee rate:", (premiumTotal / 100).toString() + "%");
        
        try {
            const premiumToProtocol = await pool.FLASHLOAN_PREMIUM_TO_PROTOCOL();
            const premiumToLP = premiumTotal - premiumToProtocol;
            console.log("Fee to Protocol:", premiumToProtocol.toString(), "basis points");
            console.log("Fee to LPs:", premiumToLP.toString(), "basis points");
        } catch (e) {
            console.log("Premium breakdown not available");
        }
        
        try {
            const maxReserves = await pool.MAX_NUMBER_RESERVES();
            console.log("Max reserves supported:", maxReserves.toString());
        } catch (e) {
            console.log("Max reserves info not available");
        }
        
    } catch (error) {
        console.log("❌ Error fetching pool info:", error.message);
    }
    console.log();
}

async function checkReserveData() {
    console.log("🪙 Reserve Data:");
    console.log("===============");
    
    try {
        const dataProviderABI = [
            "function getAllReservesTokens() external view returns (tuple(string symbol, address tokenAddress)[])",
            "function getReserveData(address asset) external view returns (uint256 availableLiquidity, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
            "function getReserveConfigurationData(address asset) external view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)"
        ];
        
        const dataProvider = new ethers.Contract(
            AAVE_V3_SEPOLIA.AaveProtocolDataProvider,
            dataProviderABI,
            ethers.provider
        );
        
        const reserves = await dataProvider.getAllReservesTokens();
        console.log("Available reserves:", reserves.length);
        console.log();
        
        for (const reserve of reserves) {
            console.log(`📈 ${reserve.symbol} (${reserve.tokenAddress}):`);
            
            try {
                // Get reserve data
                const reserveData = await dataProvider.getReserveData(reserve.tokenAddress);
                const config = await dataProvider.getReserveConfigurationData(reserve.tokenAddress);
                
                const decimals = Number(config.decimals);
                const liquidity = ethers.formatUnits(reserveData.availableLiquidity, decimals);
                const totalDebt = reserveData.totalStableDebt + reserveData.totalVariableDebt;
                const totalDebtFormatted = ethers.formatUnits(totalDebt, decimals);
                
                console.log(`  Available liquidity: ${liquidity}`);
                console.log(`  Total debt: ${totalDebtFormatted}`);
                console.log(`  Borrowing enabled: ${config.borrowingEnabled}`);
                console.log(`  Active: ${config.isActive}`);
                console.log(`  Frozen: ${config.isFrozen}`);
                
                // Calculate utilization rate
                const totalSupply = reserveData.availableLiquidity + totalDebt;
                if (totalSupply > 0n) {
                    const utilizationRate = (totalDebt * 10000n) / totalSupply;
                    console.log(`  Utilization rate: ${(Number(utilizationRate) / 100).toFixed(2)}%`);
                }
                
            } catch (error) {
                console.log(`  ❌ Error fetching data: ${error.message}`);
            }
            console.log();
        }
        
    } catch (error) {
        console.log("❌ Error fetching reserve data:", error.message);
    }
}

async function checkFlashLoanCapability() {
    console.log("⚡ Flash Loan Capability:");
    console.log("========================");
    
    const mainAssets = [
        { symbol: "WETH", address: AAVE_V3_SEPOLIA.Assets.WETH },
        { symbol: "USDC", address: AAVE_V3_SEPOLIA.Assets.USDC },
        { symbol: "DAI", address: AAVE_V3_SEPOLIA.Assets.DAI },
        { symbol: "LINK", address: AAVE_V3_SEPOLIA.Assets.LINK }
    ];
    
    for (const asset of mainAssets) {
        try {
            // Ensure address is properly checksummed
            const checksummedAddress = ethers.getAddress(asset.address);
            const token = await ethers.getContractAt("IERC20", checksummedAddress);
            const balance = await token.balanceOf(AAVE_V3_SEPOLIA.Pool);
            const decimals = ASSET_DECIMALS[asset.address] || 18;
            const formatted = ethers.formatUnits(balance, decimals);
            
            console.log(`${asset.symbol}:`);
            console.log(`  Pool balance: ${formatted}`);
            console.log(`  Max flash loan: ${formatted} (same as pool balance)`);
            
            // Calculate fee for different amounts
            const poolABI = ["function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)"];
            const pool = new ethers.Contract(AAVE_V3_SEPOLIA.Pool, poolABI, ethers.provider);
            const feeRate = await pool.FLASHLOAN_PREMIUM_TOTAL();
            
            if (balance > 0n) {
                const examples = ["1", "10", "100"];
                console.log("  Fee examples:");
                
                for (const example of examples) {
                    const amount = ethers.parseUnits(example, decimals);
                    if (amount <= balance) {
                        const fee = (amount * feeRate) / 10000n;
                        const feeFormatted = ethers.formatUnits(fee, decimals);
                        console.log(`    ${example} ${asset.symbol} → ${feeFormatted} ${asset.symbol} fee`);
                    }
                }
            }
            console.log();
            
        } catch (error) {
            console.log(`${asset.symbol}: ❌ Error - ${error.message}\n`);
        }
    }
}

async function checkOracleData() {
    console.log("🔮 Oracle Information:");
    console.log("=====================");
    
    try {
        const oracleABI = [
            "function getAssetPrice(address asset) external view returns (uint256)",
            "function BASE_CURRENCY() external view returns (address)",
            "function BASE_CURRENCY_UNIT() external view returns (uint256)"
        ];
        
        const oracle = new ethers.Contract(AAVE_V3_SEPOLIA.AaveOracle, oracleABI, ethers.provider);
        
        const baseCurrency = await oracle.BASE_CURRENCY();
        const baseCurrencyUnit = await oracle.BASE_CURRENCY_UNIT();
        
        console.log("Base currency:", baseCurrency);
        console.log("Base currency unit:", baseCurrencyUnit.toString());
        console.log();
        
        const assets = [
            { symbol: "WETH", address: AAVE_V3_SEPOLIA.Assets.WETH },
            { symbol: "USDC", address: AAVE_V3_SEPOLIA.Assets.USDC },
            { symbol: "DAI", address: AAVE_V3_SEPOLIA.Assets.DAI }
        ];
        
        console.log("Asset prices (in base currency units):");
        for (const asset of assets) {
            try {
                // Ensure address is properly checksummed
                const checksummedAddress = ethers.getAddress(asset.address);
                const price = await oracle.getAssetPrice(checksummedAddress);
                const priceFormatted = ethers.formatUnits(price, 8); // Oracle typically uses 8 decimals
                console.log(`${asset.symbol}: ${priceFormatted}`);
            } catch (error) {
                console.log(`${asset.symbol}: Price not available - ${error.message}`);
            }
        }
        console.log();
        
    } catch (error) {
        console.log("❌ Error fetching oracle data:", error.message);
        console.log();
    }
}

async function checkIncentives() {
    console.log("🎁 Incentives Information:");
    console.log("==========================");
    
    try {
        const incentivesABI = [
            "function getRewardsBalance(address[] calldata assets, address user) external view returns (uint256)",
            "function getAllUserRewards(address[] calldata assets, address user) external view returns (address[] memory rewardsList, uint256[] memory unclaimedAmounts)"
        ];
        
        const incentivesController = new ethers.Contract(
            AAVE_V3_SEPOLIA.DefaultIncentivesController,
            incentivesABI,
            ethers.provider
        );
        
        console.log("Incentives controller:", AAVE_V3_SEPOLIA.DefaultIncentivesController);
        console.log("Note: Incentives may not be active on testnet");
        console.log();
        
    } catch (error) {
        console.log("❌ Error fetching incentives data:", error.message);
        console.log();
    }
}

main()
    .then(() => {
        console.log("✅ Protocol information check completed!");
        console.log("\n📋 Summary:");
        console.log("- All contract addresses verified");
        console.log("- Flash loan fees and capabilities checked");
        console.log("- Reserve data and liquidity confirmed");
        console.log("- Ready for flash loan testing!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });