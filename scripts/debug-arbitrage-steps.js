const hre = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🧪 Step-by-Step Arbitrage Component Testing");
    console.log("=" .repeat(55));
    
    const [deployer] = await hre.ethers.getSigners();
    
    // Test 1: USDC → WETH → PEAS swap path
    console.log("🔄 Step 1: Testing USDC → WETH → PEAS swap path");
    
    const routerAbi = [
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
    ];
    const uniswapRouter = new hre.ethers.Contract(ARBITRUM_ADDRESSES.UNISWAP_V3_ROUTER, routerAbi, deployer);
    
    // Test tiny amount first
    const testAmount = hre.ethers.parseUnits("0.01", 6); // 0.01 USDC
    
    const usdcAbi = [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
    ];
    const usdc = new hre.ethers.Contract(ARBITRUM_ADDRESSES.USDC, usdcAbi, deployer);
    
    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log(`  Your USDC balance: ${hre.ethers.formatUnits(usdcBalance, 6)} USDC`);
    
    if (usdcBalance >= testAmount) {
        try {
            // Check and set approval
            const currentAllowance = await usdc.allowance(deployer.address, ARBITRUM_ADDRESSES.UNISWAP_V3_ROUTER);
            if (currentAllowance < testAmount) {
                console.log("  📝 Approving USDC for Uniswap router...");
                const approveTx = await usdc.approve(ARBITRUM_ADDRESSES.UNISWAP_V3_ROUTER, hre.ethers.parseUnits("1", 6));
                await approveTx.wait();
                console.log("  ✅ USDC approval confirmed");
            }
            
            // Test USDC → WETH swap
            console.log("  🔄 Testing USDC → WETH...");
            const usdcToWethParams = {
                tokenIn: ARBITRUM_ADDRESSES.USDC,
                tokenOut: ARBITRUM_ADDRESSES.WETH,
                fee: 500, // 0.05%
                recipient: deployer.address,
                deadline: Math.floor(Date.now() / 1000) + 300,
                amountIn: testAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            };
            
            // Simulate the swap first (static call)
            try {
                const expectedWeth = await uniswapRouter.exactInputSingle.staticCall(usdcToWethParams);
                console.log(`  📊 Expected WETH output: ${hre.ethers.formatEther(expectedWeth)} WETH`);
                
                if (expectedWeth > 0n) {
                    console.log("  ✅ USDC → WETH swap simulation successful");
                } else {
                    console.log("  ❌ USDC → WETH swap would return 0");
                }
            } catch (error) {
                console.log(`  ❌ USDC → WETH swap simulation failed:`, error.message.substring(0, 100));
            }
            
        } catch (error) {
            console.log(`  ❌ USDC → WETH test failed:`, error.message.substring(0, 100));
        }
    } else {
        console.log("  ⚠️  Insufficient USDC for testing");
    }
    
    // Test 2: Check PEAS/WETH pool directly
    console.log("\n🦄 Step 2: Testing PEAS/WETH Pool Status");
    const poolAbi = [
        "function token0() view returns (address)",
        "function token1() view returns (address)",
        "function fee() view returns (uint24)",
        "function liquidity() view returns (uint128)",
        "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
    ];
    
    const peasWethPool = new hre.ethers.Contract(ARBITRUM_ADDRESSES.PEAS_WETH_V3_POOL, poolAbi, hre.ethers.provider);
    
    try {
        const token0 = await peasWethPool.token0();
        const token1 = await peasWethPool.token1();
        const fee = await peasWethPool.fee();
        const liquidity = await peasWethPool.liquidity();
        const slot0 = await peasWethPool.slot0();
        
        console.log(`  Token0: ${token0} ${token0.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase() ? '(PEAS)' : token0.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase() ? '(WETH)' : ''}`);
        console.log(`  Token1: ${token1} ${token1.toLowerCase() === ARBITRUM_ADDRESSES.PEAS.toLowerCase() ? '(PEAS)' : token1.toLowerCase() === ARBITRUM_ADDRESSES.WETH.toLowerCase() ? '(WETH)' : ''}`);
        console.log(`  Fee: ${fee / 10000}%`);
        console.log(`  Liquidity: ${liquidity.toString()}`);
        console.log(`  Current Price (sqrt): ${slot0[0].toString()}`);
        console.log(`  Pool Unlocked: ${slot0[6]}`);
        
        if (liquidity > 0n && slot0[6]) {
            console.log("  ✅ Pool is active and has liquidity");
        } else {
            console.log("  ❌ Pool has issues - no liquidity or locked");
        }
        
    } catch (error) {
        console.log(`  ❌ Pool check failed:`, error.message);
    }
    
    // Test 3: Check pPEAS pod interfaces
    console.log("\n🏭 Step 3: Testing pPEAS Pod Interface");
    const podAbi = [
        "function asset() view returns (address)",
        "function totalAssets() view returns (uint256)",
        "function totalSupply() view returns (uint256)",
        "function convertToShares(uint256 assets) view returns (uint256)",
        "function convertToAssets(uint256 shares) view returns (uint256)"
    ];
    
    try {
        const pod = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pPEAS, podAbi, hre.ethers.provider);
        const asset = await pod.asset();
        const totalAssets = await pod.totalAssets();
        const totalSupply = await pod.totalSupply();
        
        console.log(`  pPEAS underlying asset: ${asset}`);
        console.log(`  Expected pfUSDC-6: ${ARBITRUM_ADDRESSES.pfUSDC6}`);
        console.log(`  Total Assets: ${hre.ethers.formatEther(totalAssets)}`);
        console.log(`  Total Supply: ${hre.ethers.formatEther(totalSupply)}`);
        
        if (asset.toLowerCase() === ARBITRUM_ADDRESSES.pfUSDC6.toLowerCase()) {
            console.log("  ✅ pPEAS asset matches pfUSDC-6");
            
            // Test conversion functions
            const testShares = hre.ethers.parseEther("1");
            const assetsForShares = await pod.convertToAssets(testShares);
            const sharesForAssets = await pod.convertToShares(assetsForShares);
            
            console.log(`  📊 1 pPEAS = ${hre.ethers.formatEther(assetsForShares)} pfUSDC-6`);
            console.log(`  ✅ pPEAS conversion functions working`);
        } else {
            console.log("  ❌ pPEAS asset mismatch!");
        }
    } catch (error) {
        console.log(`  ❌ pPEAS pod test failed:`, error.message);
    }
    
    // Test 4: Check pfUSDC-6 vault
    console.log("\n🏛️ Step 4: Testing pfUSDC-6 Vault Interface");
    try {
        const vault = new hre.ethers.Contract(ARBITRUM_ADDRESSES.pfUSDC6, podAbi, hre.ethers.provider);
        const asset = await vault.asset();
        const totalAssets = await vault.totalAssets();
        const totalSupply = await vault.totalSupply();
        
        console.log(`  pfUSDC-6 underlying: ${asset}`);
        console.log(`  Expected USDC: ${ARBITRUM_ADDRESSES.USDC}`);
        console.log(`  Total Assets: ${hre.ethers.formatUnits(totalAssets, 6)} USDC`);
        console.log(`  Total Supply: ${hre.ethers.formatUnits(totalSupply, 6)} pfUSDC-6`);
        
        if (asset.toLowerCase() === ARBITRUM_ADDRESSES.USDC.toLowerCase()) {
            console.log("  ✅ pfUSDC-6 asset matches USDC");
        } else {
            console.log("  ❌ pfUSDC-6 asset mismatch!");
        }
    } catch (error) {
        console.log(`  ❌ pfUSDC-6 vault test failed:`, error.message);
    }
    
    console.log("\n🎯 DIAGNOSIS SUMMARY:");
    console.log("The arbitrage is failing likely due to:");
    console.log("1. ❓ Actual Peapods protocol interfaces may differ from ERC4626 standard");
    console.log("2. ❓ Price slippage during execution");
    console.log("3. ❓ Liquidity pool routing issues");
    console.log("4. ❓ Access control or timing issues");
    
    console.log("\n💡 NEXT STEPS:");
    console.log("1. Check Peapods documentation for exact interfaces");
    console.log("2. Test individual swaps manually before full arbitrage");
    console.log("3. Use Peapods frontend to understand actual transaction flow");
    console.log("4. Consider smaller test amounts or manual execution");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
