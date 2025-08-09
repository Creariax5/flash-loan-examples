const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🚀 Deploying PeaPEASArbitrageBot to Arbitrum for pPEAS arbitrage...");
    console.log("📊 Target: pPEAS pod with $5.3M TVL and 4.25% price gap!");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

    // Verify we're on Arbitrum
    const network = await hre.ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);
    if (Number(network.chainId) !== 42161) {
        throw new Error("Not on Arbitrum mainnet! Use --network arbitrum");
    }

    console.log("\n📋 Arbitrum pPEAS Configuration:");
    console.log("- Aave Pool:", ARBITRUM_ADDRESSES.Pool);
    console.log("- USDC:", ARBITRUM_ADDRESSES.USDC);
    console.log("- PEAS:", ARBITRUM_ADDRESSES.PEAS);
    console.log("- pPEAS Pod:", ARBITRUM_ADDRESSES.pPEAS);
    console.log("- pfUSDC-6 Vault:", ARBITRUM_ADDRESSES.pfUSDC6);
    console.log("- PEAS/USDC Pool:", ARBITRUM_ADDRESSES.PEAS_USDC_V3_POOL);
    console.log("- Uniswap V3 Factory:", ARBITRUM_ADDRESSES.UNISWAP_V3_FACTORY);

    console.log("\n💰 Economic Opportunity:");
    console.log(`- pPEAS TVL: $${(ARBITRUM_ADDRESSES.pPEASTVL / 1000000).toFixed(1)}M (MASSIVE!)`);
    console.log(`- Price Gap: ${ARBITRUM_ADDRESSES.pPEASGap}% (${ARBITRUM_ADDRESSES.pPEASPodPrice} vs ${ARBITRUM_ADDRESSES.pPEASFairPrice})`);
    console.log(`- PEAS/USDC TVL: $${(ARBITRUM_ADDRESSES.PEAS_USDC_TVL / 1000).toFixed(1)}K`);
    console.log(`- Fee Structure: ${ARBITRUM_ADDRESSES.pPEASWrapFee}% wrap, ${ARBITRUM_ADDRESSES.pPEASUnwrapFee}% unwrap`);

    const PeaPEASArbitrageBot = await hre.ethers.getContractFactory("PeaPEASArbitrageBot");
    
    console.log("\n⏳ Deploying contract...");
    const arbitrageBot = await PeaPEASArbitrageBot.deploy(
        ARBITRUM_ADDRESSES.PoolAddressesProvider
    );

    await arbitrageBot.waitForDeployment();
    const deployedAddress = await arbitrageBot.getAddress();
    
    console.log("✅ PeaPEASArbitrageBot deployed to:", deployedAddress);
    console.log("🔗 Arbitrum Explorer:", `https://arbiscan.io/address/${deployedAddress}`);

    // Let's do a quick simulation check
    console.log("\n🧪 Testing pPEAS simulation...");
    try {
        const simulationAmount = hre.ethers.parseUnits("1.0", 6); // 1 USDC
        
        const result = await arbitrageBot.simulatePeaPEASArbitrage(simulationAmount);
        const profit = result - simulationAmount;
        const profitPercent = (parseFloat(hre.ethers.formatUnits(profit, 6)) / 1.0) * 100;
        
        console.log(`📈 Simulation Result:`);
        console.log(`   Input: ${hre.ethers.formatUnits(simulationAmount, 6)} USDC`);
        console.log(`   Output: ${hre.ethers.formatUnits(result, 6)} USDC`);
        console.log(`   Profit: ${hre.ethers.formatUnits(profit, 6)} USDC (${profitPercent.toFixed(2)}%)`);
        
        if (profit > 0n) {
            console.log("🎉 PROFITABLE! pPEAS arbitrage simulation successful!");
        } else {
            console.log("⚠️  Not profitable in simulation - check prices");
        }
    } catch (error) {
        console.log("⚠️ Simulation failed:", error.message);
        console.log("This might be due to network conditions, but contract deployed successfully");
    }

    console.log("\n🎯 Next Steps:");
    console.log("1. Fund the contract with USDC for flash loan fees");
    console.log("2. Monitor pPEAS price gaps using Peapods dashboard");
    console.log("3. Execute arbitrage when gap > 2% for profitability");
    console.log("4. Remember: $5.3M TVL means this can handle large trades!");

    // Save deployment info
    const deployment = {
        network: "arbitrum",
        contractAddress: deployedAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        configuration: {
            target: "pPEAS",
            tvl: ARBITRUM_ADDRESSES.pPEASTVL,
            priceGap: ARBITRUM_ADDRESSES.pPEASGap,
            poolAddresses: {
                aavePool: ARBITRUM_ADDRESSES.Pool,
                pPEAS: ARBITRUM_ADDRESSES.pPEAS,
                pfUSDC6: ARBITRUM_ADDRESSES.pfUSDC6,
                peasWethPool: ARBITRUM_ADDRESSES.PEAS_WETH_V3_POOL,
                wethUsdcPool: ARBITRUM_ADDRESSES.WETH_USDC_V3_POOL
            }
        }
    };

    console.log("\n📝 Deployment Record:");
    console.log(JSON.stringify(deployment, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
