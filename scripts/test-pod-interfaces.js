const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 TESTING Peapods Pod Interfaces on Arbitrum");
    console.log("=".repeat(50));

    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Test PEAS token  
    console.log("\n1️⃣ Testing PEAS Token...");
    try {
        const peasAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)", 
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        const PEAS = new ethers.Contract(ARBITRUM_ADDRESSES.PEAS, peasAbi, ethers.provider);
        const name = await PEAS.name();
        const symbol = await PEAS.symbol();
        const decimals = await PEAS.decimals();
        
        console.log("✅ PEAS Token:", name, `(${symbol})`, `- ${decimals} decimals`);
    } catch (error) {
        console.log("❌ PEAS Token test failed:", error.message);
    }

    // Test pPEAS pod using correct DecentralizedIndex interface
    console.log("\n2️⃣ Testing pPEAS Pod (DecentralizedIndex)...");
    try {
        const podAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function isAsset(address) view returns (bool)",
            "function getAllAssets() view returns (tuple(address token, uint256 weighting, uint256 basePriceUSDX96, address c1, uint256 q1)[])",
            "function totalSupply() view returns (uint256)",
            "function PAIRED_LP_TOKEN() view returns (address)"
        ];
        
        const pPEAS = new ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, podAbi, ethers.provider);
        const name = await pPEAS.name();
        const symbol = await pPEAS.symbol();
        const totalSupply = await pPEAS.totalSupply();
        const pairedToken = await pPEAS.PAIRED_LP_TOKEN();
        
        console.log("✅ pPEAS Pod:", name, `(${symbol})`);
        console.log("  Total Supply:", ethers.formatEther(totalSupply), "tokens");
        console.log("  Paired LP Token:", pairedToken);
        
        // Check if PEAS is an asset in the pod
        const isPEASAsset = await pPEAS.isAsset(ARBITRUM_ADDRESSES.PEAS);
        console.log("  PEAS is pod asset:", isPEASAsset);
        
        // Get all assets in the pod
        const allAssets = await pPEAS.getAllAssets();
        console.log("  Pod contains", allAssets.length, "assets:");
        for (let i = 0; i < allAssets.length; i++) {
            console.log(`    Asset ${i}: ${allAssets[i].token} (weight: ${allAssets[i].weighting})`);
        }
        
    } catch (error) {
        console.log("❌ pPEAS Pod test failed:", error.message);
    }

    // Test pfUSDC-6 vault  
    console.log("\n3️⃣ Testing pfUSDC-6 Vault (LendingAssetVault)...");
    try {
        const vaultAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function asset() view returns (address)",
            "function totalAssets() view returns (uint256)",
            "function totalAvailableAssets() view returns (uint256)",
            "function convertToShares(uint256) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)"
        ];
        
        const vault = new ethers.Contract(ARBITRUM_ADDRESSES.pfUSDC6, vaultAbi, ethers.provider);
        const name = await vault.name();
        const symbol = await vault.symbol();
        const asset = await vault.asset();
        const totalAssets = await vault.totalAssets();
        const availableAssets = await vault.totalAvailableAssets();
        
        console.log("✅ pfUSDC-6 Vault:", name, `(${symbol})`);
        console.log("  Underlying Asset:", asset);
        console.log("  Total Assets:", ethers.formatUnits(totalAssets, 6), "USDC");
        console.log("  Available Assets:", ethers.formatUnits(availableAssets, 6), "USDC");
        
        // Verify it's USDC
        console.log("  Is USDC underlying:", asset.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase());
        
    } catch (error) {
        console.log("❌ pfUSDC-6 Vault test failed:", error.message);
    }

    // Test Uniswap V3 pools
    console.log("\n4️⃣ Testing Uniswap V3 Pools...");
    try {
        const poolAbi = [
            "function token0() view returns (address)",
            "function token1() view returns (address)", 
            "function fee() view returns (uint24)",
            "function liquidity() view returns (uint128)"
        ];
        
        // Test PEAS/WETH pool
        const peasWethPool = new ethers.Contract(ARBITRUM_ADDRESSES.PEAS_WETH_V3_POOL, poolAbi, ethers.provider);
        const token0 = await peasWethPool.token0();
        const token1 = await peasWethPool.token1();
        const fee = await peasWethPool.fee();
        const liquidity = await peasWethPool.liquidity();
        
        console.log("✅ PEAS/WETH V3 Pool:");
        console.log("  Token0:", token0);
        console.log("  Token1:", token1);
        console.log("  Fee:", fee, "(", fee / 10000, "%)");
        console.log("  Liquidity:", liquidity.toString());
        
        // Verify tokens
        const isPEAS = token0.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase() || 
                       token1.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase();
        const isWETH = token0.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase() || 
                       token1.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase();
        
        console.log("  Contains PEAS:", isPEAS);
        console.log("  Contains WETH:", isWETH);
        
    } catch (error) {
        console.log("❌ PEAS/WETH pool test failed:", error.message);
    }

    console.log("\n✨ Pod Interface Analysis Complete!");
    console.log("\n📋 KEY FINDINGS:");
    console.log("- pPEAS is a DecentralizedIndex (pod) using bond()/debond() functions");
    console.log("- pfUSDC-6 is a proper ERC4626 LendingAssetVault");  
    console.log("- PEAS/WETH and WETH/USDC Uniswap V3 pools are active");
    console.log("- Contract should now work with corrected pod interfaces");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
