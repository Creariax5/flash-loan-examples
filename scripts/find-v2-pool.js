const { ethers } = require("hardhat");

// Common DEX factory addresses on Base
const SUSHISWAP_FACTORY = "0x71524B4f93c58fcbF659783284E38825f0622859"; // SushiSwap V2 Factory on Base
const UNISWAP_FACTORY = "0x8909dc15e40173ff4699343b6eb8132c65e18ec6";   // BaseSwap Factory

const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";   // USDC on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";   // WETH on Base

async function main() {
    console.log("🔍 Finding USDC/WETH V2 Pool on Base");
    console.log("===================================\n");
    
    const [signer] = await ethers.getSigners();
    
    // Function to get pair address from factory
    async function getPairAddress(factoryAddress, factoryName) {
        try {
            const factory = await ethers.getContractAt(
                ["function getPair(address tokenA, address tokenB) external view returns (address pair)"],
                factoryAddress,
                signer
            );
            
            const pairAddress = await factory.getPair(USDC_ADDRESS, WETH_ADDRESS);
            console.log(`${factoryName} pair:`, pairAddress);
            
            if (pairAddress !== "0x0000000000000000000000000000000000000000") {
                // Verify it's a valid pair
                const pair = await ethers.getContractAt(
                    [
                        "function token0() external view returns (address)",
                        "function token1() external view returns (address)",
                        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
                    ],
                    pairAddress,
                    signer
                );
                
                const token0 = await pair.token0();
                const token1 = await pair.token1();
                const [reserve0, reserve1] = await pair.getReserves();
                
                console.log(`  ✅ Valid pair found!`);
                console.log(`  Token0: ${token0}`);
                console.log(`  Token1: ${token1}`);
                console.log(`  Reserve0: ${token0 === USDC_ADDRESS ? ethers.formatUnits(reserve0, 6) + ' USDC' : ethers.formatEther(reserve0) + ' WETH'}`);
                console.log(`  Reserve1: ${token1 === USDC_ADDRESS ? ethers.formatUnits(reserve1, 6) + ' USDC' : ethers.formatEther(reserve1) + ' WETH'}`);
                
                return pairAddress;
            } else {
                console.log(`  ❌ No pair found`);
                return null;
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            return null;
        }
    }
    
    console.log("1. Checking SushiSwap V2 Factory...");
    const sushiPair = await getPairAddress(SUSHISWAP_FACTORY, "SushiSwap");
    
    console.log("\n2. Checking BaseSwap Factory...");
    const basePair = await getPairAddress(UNISWAP_FACTORY, "BaseSwap");
    
    // Also try some other known DEXes on Base
    const OTHER_FACTORIES = [
        { address: "0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E", name: "PancakeSwap" },
        { address: "0x420DD381b31aEf6683db96b3aaC8E0750F2C3e8C", name: "Aerodrome" }
    ];
    
    for (const factory of OTHER_FACTORIES) {
        console.log(`\n3. Checking ${factory.name} Factory...`);
        await getPairAddress(factory.address, factory.name);
    }
    
    console.log("\n🎯 RESULTS:");
    if (sushiPair) {
        console.log(`✅ Use SushiSwap pair: ${sushiPair}`);
    } else if (basePair) {
        console.log(`✅ Use BaseSwap pair: ${basePair}`);
    } else {
        console.log("❌ No V2 pairs found. Base might primarily use V3 pools.");
        console.log("\n💡 Alternative: Use a DEX aggregator or create a V3 swap instead");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
