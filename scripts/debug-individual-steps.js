const { ethers } = require("hardhat");
const { BASE_ADDRESSES } = require("./addresses");

// Contract address of our deployed bot
const CONTRACT_ADDRESS = "0xa8628d8163C0262C89A4544624D2A5382bAe9aF0";

async function debugEachStep() {
    console.log("🔍 DEBUGGING EACH ARBITRAGE STEP");
    console.log("================================");
    
    const [signer] = await ethers.getSigners();
    console.log("Debug account:", signer.address);
    console.log("Account balance:", ethers.formatEther(await signer.provider.getBalance(signer.address)), "ETH");
    
    // Test parameters
    const testAmount = ethers.parseUnits("1", 6); // $1 USDC for testing
    
    console.log("\n🧪 TESTING INDIVIDUAL CONTRACT INTERACTIONS");
    console.log("============================================");
    
    // Test 1: USDC Token
    await testUSDCToken();
    
    // Test 2: PEAS Token  
    await testPEASToken();
    
    // Test 3: peaPEAS Contract
    await testPeaPEASContract();
    
    // Test 4: pfpOHMo27 Vault
    await testPfpOHMo27Vault();
    
    // Test 5: Liquidity Pool
    await testLiquidityPool();
    
    // Test 6: Uniswap V3 Router
    await testUniswapV3Router();
}

async function testUSDCToken() {
    console.log("\n1️⃣ TESTING USDC TOKEN");
    console.log("=====================");
    
    try {
        // Create USDC contract instance
        const usdcAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)", 
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)"
        ];
        
        const usdc = new ethers.Contract(BASE_ADDRESSES.USDC, usdcAbi, ethers.provider);
        
        console.log(`✅ USDC Address: ${BASE_ADDRESSES.USDC}`);
        console.log(`✅ Name: ${await usdc.name()}`);
        console.log(`✅ Symbol: ${await usdc.symbol()}`);
        console.log(`✅ Decimals: ${await usdc.decimals()}`);
        console.log(`✅ Total Supply: ${ethers.formatUnits(await usdc.totalSupply(), 6)} USDC`);
        console.log(`✅ Contract Balance: ${ethers.formatUnits(await usdc.balanceOf(CONTRACT_ADDRESS), 6)} USDC`);
        
    } catch (error) {
        console.log(`❌ USDC Token Error: ${error.message}`);
    }
}

async function testPEASToken() {
    console.log("\n2️⃣ TESTING PEAS TOKEN");
    console.log("=====================");
    
    try {
        const peasAbi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)"
        ];
        
        const peas = new ethers.Contract(BASE_ADDRESSES.PEAS, peasAbi, ethers.provider);
        
        console.log(`✅ PEAS Address: ${BASE_ADDRESSES.PEAS}`);
        console.log(`✅ Name: ${await peas.name()}`);
        console.log(`✅ Symbol: ${await peas.symbol()}`);
        console.log(`✅ Decimals: ${await peas.decimals()}`);
        console.log(`✅ Total Supply: ${ethers.formatUnits(await peas.totalSupply(), 18)} PEAS`);
        console.log(`✅ Contract Balance: ${ethers.formatUnits(await peas.balanceOf(CONTRACT_ADDRESS), 18)} PEAS`);
        
    } catch (error) {
        console.log(`❌ PEAS Token Error: ${error.message}`);
    }
}

async function testPeaPEASContract() {
    console.log("\n3️⃣ TESTING PEAPEAS CONTRACT");
    console.log("===========================");
    
    try {
        // Test basic ERC20 functions first
        const erc20Abi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)"
        ];
        
        const peaPEAS_ERC20 = new ethers.Contract(BASE_ADDRESSES.peaPEAS, erc20Abi, ethers.provider);
        
        console.log(`✅ peaPEAS Address: ${BASE_ADDRESSES.peaPEAS}`);
        console.log(`✅ Name: ${await peaPEAS_ERC20.name()}`);
        console.log(`✅ Symbol: ${await peaPEAS_ERC20.symbol()}`);
        console.log(`✅ Decimals: ${await peaPEAS_ERC20.decimals()}`);
        console.log(`✅ Total Supply: ${ethers.formatUnits(await peaPEAS_ERC20.totalSupply(), 18)} peaPEAS`);
        
        // Test vault-specific functions
        const vaultAbi = [
            "function asset() view returns (address)",
            "function convertToShares(uint256) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)",
            "function previewDeposit(uint256) view returns (uint256)",
            "function previewRedeem(uint256) view returns (uint256)"
        ];
        
        const peaPEAS_Vault = new ethers.Contract(BASE_ADDRESSES.peaPEAS, vaultAbi, ethers.provider);
        
        try {
            const underlyingAsset = await peaPEAS_Vault.asset();
            console.log(`✅ Underlying Asset: ${underlyingAsset}`);
            console.log(`✅ Asset matches PEAS: ${underlyingAsset.toLowerCase() === BASE_ADDRESSES.PEAS.toLowerCase()}`);
            
            // Test conversion functions
            const testShares = ethers.parseUnits("1", 18);
            const assetsForShares = await peaPEAS_Vault.convertToAssets(testShares);
            console.log(`✅ 1 peaPEAS = ${ethers.formatUnits(assetsForShares, 18)} PEAS`);
            
            const testAssets = ethers.parseUnits("1", 18);
            const sharesForAssets = await peaPEAS_Vault.convertToShares(testAssets);
            console.log(`✅ 1 PEAS = ${ethers.formatUnits(sharesForAssets, 18)} peaPEAS`);
            
        } catch (error) {
            console.log(`❌ peaPEAS Vault Functions Error: ${error.message}`);
        }
        
        // Test if wrap/unwrap functions exist
        try {
            const wrapAbi = [
                "function deposit(uint256, address) returns (uint256)",
                "function redeem(uint256, address, address) returns (uint256)"
            ];
            
            const peaPEAS_Wrap = new ethers.Contract(BASE_ADDRESSES.peaPEAS, wrapAbi, ethers.provider);
            console.log("✅ peaPEAS uses ERC4626 standard (deposit/redeem instead of wrap/unwrap)");
            
        } catch (error) {
            console.log(`❌ peaPEAS Standard Functions Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ peaPEAS Contract Error: ${error.message}`);
    }
}

async function testPfpOHMo27Vault() {
    console.log("\n4️⃣ TESTING PFPOHMO27 VAULT");
    console.log("==========================");
    
    try {
        const erc20Abi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)"
        ];
        
        const vault = new ethers.Contract(BASE_ADDRESSES.pfpOHMo27, erc20Abi, ethers.provider);
        
        console.log(`✅ pfpOHMo27 Address: ${BASE_ADDRESSES.pfpOHMo27}`);
        console.log(`✅ Name: ${await vault.name()}`);
        console.log(`✅ Symbol: ${await vault.symbol()}`);
        console.log(`✅ Decimals: ${await vault.decimals()}`);
        
        // Test vault functions
        const vaultAbi = [
            "function asset() view returns (address)",
            "function convertToShares(uint256) view returns (uint256)",
            "function convertToAssets(uint256) view returns (uint256)"
        ];
        
        const vaultContract = new ethers.Contract(BASE_ADDRESSES.pfpOHMo27, vaultAbi, ethers.provider);
        
        try {
            const underlyingAsset = await vaultContract.asset();
            console.log(`✅ Underlying Asset: ${underlyingAsset}`);
            console.log(`✅ Asset matches USDC: ${underlyingAsset.toLowerCase() === BASE_ADDRESSES.USDC.toLowerCase()}`);
            
            if (underlyingAsset.toLowerCase() !== BASE_ADDRESSES.USDC.toLowerCase()) {
                console.log(`⚠️  WARNING: pfpOHMo27 underlying is NOT USDC!`);
                console.log(`Expected: ${BASE_ADDRESSES.USDC}`);
                console.log(`Actual: ${underlyingAsset}`);
            }
            
        } catch (error) {
            console.log(`❌ pfpOHMo27 Vault Functions Error: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ pfpOHMo27 Vault Error: ${error.message}`);
    }
}

async function testLiquidityPool() {
    console.log("\n5️⃣ TESTING LIQUIDITY POOL");
    console.log("==========================");
    
    try {
        const pairAbi = [
            "function token0() view returns (address)",
            "function token1() view returns (address)",
            "function getReserves() view returns (uint112, uint112, uint32)",
            "function factory() view returns (address)"
        ];
        
        const pair = new ethers.Contract(BASE_ADDRESSES.peaPEASPool, pairAbi, ethers.provider);
        
        console.log(`✅ Pool Address: ${BASE_ADDRESSES.peaPEASPool}`);
        
        const token0 = await pair.token0();
        const token1 = await pair.token1();
        console.log(`✅ Token0: ${token0}`);
        console.log(`✅ Token1: ${token1}`);
        
        // Check if tokens match our expectations
        const expectedTokens = [BASE_ADDRESSES.peaPEAS.toLowerCase(), BASE_ADDRESSES.pfpOHMo27.toLowerCase()];
        const actualTokens = [token0.toLowerCase(), token1.toLowerCase()];
        
        const token0Match = expectedTokens.includes(actualTokens[0]);
        const token1Match = expectedTokens.includes(actualTokens[1]);
        
        console.log(`✅ Token0 matches expected: ${token0Match}`);
        console.log(`✅ Token1 matches expected: ${token1Match}`);
        
        if (!token0Match || !token1Match) {
            console.log(`⚠️  WARNING: Pool tokens don't match expectations!`);
            console.log(`Expected: peaPEAS (${BASE_ADDRESSES.peaPEAS}) & pfpOHMo27 (${BASE_ADDRESSES.pfpOHMo27})`);
            console.log(`Actual: ${token0} & ${token1}`);
        }
        
        const reserves = await pair.getReserves();
        console.log(`✅ Reserve0: ${ethers.formatUnits(reserves[0], 18)}`);
        console.log(`✅ Reserve1: ${ethers.formatUnits(reserves[1], 18)}`);
        
        try {
            const factory = await pair.factory();
            console.log(`✅ Factory: ${factory}`);
        } catch (error) {
            console.log(`⚠️  Could not get factory: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ Liquidity Pool Error: ${error.message}`);
    }
}

async function testUniswapV3Router() {
    console.log("\n6️⃣ TESTING UNISWAP V3 ROUTER");
    console.log("=============================");
    
    try {
        const routerAbi = [
            "function factory() view returns (address)",
            "function WETH9() view returns (address)"
        ];
        
        const router = new ethers.Contract("0x2626664c2603336E57B271c5C0b26F421741e481", routerAbi, ethers.provider);
        
        console.log(`✅ Router Address: 0x2626664c2603336E57B271c5C0b26F421741e481`);
        console.log(`✅ Factory: ${await router.factory()}`);
        console.log(`✅ WETH9: ${await router.WETH9()}`);
        
        // Test if PEAS/USDC pool exists
        const factoryAbi = [
            "function getPool(address, address, uint24) view returns (address)"
        ];
        
        const factory = new ethers.Contract(await router.factory(), factoryAbi, ethers.provider);
        const poolAddress = await factory.getPool(BASE_ADDRESSES.PEAS, BASE_ADDRESSES.USDC, 2700);
        
        console.log(`✅ PEAS/USDC Pool: ${poolAddress}`);
        console.log(`✅ Pool matches expected: ${poolAddress.toLowerCase() === BASE_ADDRESSES.PEAS_USDC_V3_POOL.toLowerCase()}`);
        
        if (poolAddress === "0x0000000000000000000000000000000000000000") {
            console.log(`❌ PEAS/USDC pool does not exist at 0.27% fee tier!`);
        }
        
    } catch (error) {
        console.log(`❌ Uniswap V3 Router Error: ${error.message}`);
    }
}

async function generateDiagnosisReport() {
    console.log("\n📋 GENERATING DIAGNOSIS REPORT");
    console.log("==============================");
    
    console.log("Based on the tests above, here's what to look for:");
    console.log("");
    console.log("🔍 COMMON ISSUES:");
    console.log("1. peaPEAS uses ERC4626 (deposit/redeem) not custom (wrap/unwrap)");
    console.log("2. pfpOHMo27 underlying asset is NOT USDC");
    console.log("3. Liquidity pool tokens don't match our assumptions");
    console.log("4. PEAS/USDC pool doesn't exist at 0.27% fee tier");
    console.log("");
    console.log("🛠️  FIXES NEEDED:");
    console.log("1. Update peaPEAS interface to use deposit()/redeem()");
    console.log("2. Add conversion logic if pfpOHMo27 underlying != USDC");
    console.log("3. Verify liquidity pool token addresses");
    console.log("4. Check correct Uniswap V3 fee tier for PEAS/USDC");
    
    console.log("\n🎯 NEXT STEPS:");
    console.log("==============");
    console.log("1. Run this diagnostic script");
    console.log("2. Identify which tests fail");
    console.log("3. Update contract interfaces accordingly");
    console.log("4. Redeploy and test with smaller amounts");
}

// Execute debugging
debugEachStep()
    .then(() => {
        generateDiagnosisReport();
        console.log("\n✅ Debugging complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Debug failed:", error);
        process.exit(1);
    });
