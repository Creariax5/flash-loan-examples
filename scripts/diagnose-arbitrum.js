const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 Diagnosing pPEAS Pod Interface on Arbitrum");
    console.log("=" .repeat(50));

    // Basic ERC20 interface test first
    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function name() view returns (string)"
    ];

    console.log("\n📋 Testing pPEAS as ERC20...");
    try {
        const pPEAS = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, erc20Abi, hre.ethers.provider);
        
        const name = await pPEAS.name();
        const symbol = await pPEAS.symbol();
        const decimals = await pPEAS.decimals();
        const totalSupply = await pPEAS.totalSupply();
        
        console.log(`✅ pPEAS ERC20 Details:`);
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Total Supply: ${hre.ethers.formatUnits(totalSupply, decimals)}`);
        
    } catch (error) {
        console.log("❌ pPEAS ERC20 error:", error.message);
        return;
    }

    console.log("\n📋 Testing pfUSDC-6 as ERC20...");
    try {
        const pfUSDC6 = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pfUSDC6, erc20Abi, hre.ethers.provider);
        
        const name = await pfUSDC6.name();
        const symbol = await pfUSDC6.symbol();
        const decimals = await pfUSDC6.decimals();
        const totalSupply = await pfUSDC6.totalSupply();
        
        console.log(`✅ pfUSDC-6 ERC20 Details:`);
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Total Supply: ${hre.ethers.formatUnits(totalSupply, decimals)}`);
        
    } catch (error) {
        console.log("❌ pfUSDC6 ERC20 error:", error.message);
        return;
    }

    console.log("\n📋 Testing PEAS/USDC Pool...");
    try {
        const poolV3Abi = [
            "function token0() view returns (address)",
            "function token1() view returns (address)",
            "function fee() view returns (uint24)"
        ];
        
        const peasUsdcPool = new hre.ethers.Contract(ARBITRUM_ADDRESSES.PEAS_USDC_V3_POOL, poolV3Abi, hre.ethers.provider);
        const token0 = await peasUsdcPool.token0();
        const token1 = await peasUsdcPool.token1();
        const fee = await peasUsdcPool.fee();
        
        console.log(`✅ PEAS/USDC Pool Details:`);
        console.log(`   Token0: ${token0}`);
        console.log(`   Token1: ${token1}`);
        console.log(`   Fee: ${fee / 10000}%`);
        
        // Check if tokens match
        const tokens = [token0.toLowerCase(), token1.toLowerCase()];
        const hasUSDC = tokens.includes(ARBITRUM_ADDRESSES.USDC.toLowerCase());
        const hasPEAS = tokens.includes(ARBITRUM_ADDRESSES.PEAS.toLowerCase());
        
        console.log(`   Contains USDC: ${hasUSDC}`);
        console.log(`   Contains PEAS: ${hasPEAS}`);
        
    } catch (error) {
        console.log("❌ Pool error:", error.message);
    }

    console.log("\n📋 Contract Code Check...");
    try {
        const pPEASCode = await hre.ethers.provider.getCode(ARBITRUM_ADDRESSES.pPEAS);
        const pfUSDC6Code = await hre.ethers.provider.getCode(ARBITRUM_ADDRESSES.pfUSDC6);
        const poolCode = await hre.ethers.provider.getCode(ARBITRUM_ADDRESSES.PEAS_USDC_V3_POOL);
        
        console.log(`✅ Contract Deployments:`);
        console.log(`   pPEAS has code: ${pPEASCode !== '0x'} (${pPEASCode.length} bytes)`);
        console.log(`   pfUSDC-6 has code: ${pfUSDC6Code !== '0x'} (${pfUSDC6Code.length} bytes)`);
        console.log(`   PEAS/USDC Pool has code: ${poolCode !== '0x'} (${poolCode.length} bytes)`);
        
    } catch (error) {
        console.log("❌ Code check error:", error.message);
    }

    console.log("\n💡 Next Steps:");
    console.log("- All addresses need to be verified as active contracts");
    console.log("- pPEAS might use custom interface (not standard ERC4626)");
    console.log("- Check Peapods documentation for correct interfaces");
    console.log("- Consider using multicall for batch interface discovery");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
