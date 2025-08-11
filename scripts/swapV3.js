const { ethers } = require('ethers');
require('dotenv').config();

// Base addresses
const ADDRESSES = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  weth: "0x4200000000000000000000000000000000000006",
  // SwapRouter02 on Base (different struct - NO deadline parameter!)
  swapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481",
  // ETH/USDC 0.05% pool they specified
  ethUsdcPool: "0xd0b53d9277642d899df5c87a3966a349a798f224"
};

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("🔄 USDC → WETH Swap Test (Uniswap V3 - SwapRouter02)");
  console.log(`📍 Wallet: ${wallet.address}`);
  console.log(`🏊 Pool: ${ADDRESSES.ethUsdcPool} (ETH/USDC 0.05%)`);
  console.log(`🔧 Router: SwapRouter02 (NO deadline parameter!)\n`);

  // Target: Get a small but reasonable amount of WETH 
  // Use 1 USDC for testing (more realistic minimum trade size)
  const testUSDC = ethers.parseUnits("1", 6); // 1 USDC
  
  console.log(`🎯 Test amount: ${ethers.formatUnits(testUSDC, 6)} USDC\n`);

  try {
    // Contracts
    const usdc = new ethers.Contract(ADDRESSES.usdc, [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)"
    ], wallet);
    
    const weth = new ethers.Contract(ADDRESSES.weth, [
      "function balanceOf(address) external view returns (uint256)"
    ], provider);
    
    const swapRouter = new ethers.Contract(ADDRESSES.swapRouter, [
      // Simplified SwapRouter02 ABI  
      "function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)"
    ], wallet);

    // Check balances before
    const usdcBalance = await usdc.balanceOf(wallet.address);
    const wethBalance = await weth.balanceOf(wallet.address);
    
    console.log("💰 Balances Before:");
    console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
    console.log(`   WETH: ${ethers.formatEther(wethBalance)}`);

    if (usdcBalance < testUSDC) {
      console.log(`❌ Insufficient USDC balance`);
      console.log(`   Need: ${ethers.formatUnits(testUSDC, 6)} USDC`);
      console.log(`   Have: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
      return;
    }

    // Step 1: Approve USDC
    console.log("\n1️⃣ Approving USDC...");
    const approveTx = await usdc.approve(ADDRESSES.swapRouter, testUSDC, {
      gasLimit: 100000,
      gasPrice: ethers.parseUnits("0.01", "gwei")
    });
    
    console.log(`   Approve tx: ${approveTx.hash}`);
    await approveTx.wait();
    console.log(`   ✅ USDC approved`);

    // Step 2: Execute swap
    console.log("2️⃣ Swapping USDC → WETH...");
    
    // SwapRouter02 exactInputSingle parameters (7 parameters exactly)
    const swapParams = [
      ADDRESSES.usdc,           // tokenIn
      ADDRESSES.weth,           // tokenOut  
      500,                      // fee (0.05%)
      wallet.address,           // recipient
      testUSDC,                 // amountIn
      0,                        // amountOutMinimum
      0                         // sqrtPriceLimitX96
    ];

    console.log(`   Swapping ${ethers.formatUnits(testUSDC, 6)} USDC for WETH...`);
    console.log(`   Using pool: ${ADDRESSES.ethUsdcPool}`);
    console.log(`   Fee tier: 0.05%`);
    console.log(`   SwapRouter02 params: [tokenIn, tokenOut, fee, recipient, amountIn, amountOutMin, sqrtPriceLimit]`);
    console.log(`   ⚠️  Note: SwapRouter02 has NO deadline parameter!`);

    const swapTx = await swapRouter.exactInputSingle(swapParams, {
      gasLimit: 300000,
      gasPrice: ethers.parseUnits("0.01", "gwei")
    });
    
    console.log(`   Swap tx: ${swapTx.hash}`);
    const swapReceipt = await swapTx.wait();
    console.log(`   ✅ Swapped (Block: ${swapReceipt.blockNumber})`);

    // Check balances after
    const newUsdcBalance = await usdc.balanceOf(wallet.address);
    const newWethBalance = await weth.balanceOf(wallet.address);
    
    const usdcUsed = usdcBalance - newUsdcBalance;
    const wethReceived = newWethBalance - wethBalance;
    
    console.log("\n📊 Swap Results:");
    console.log(`   USDC spent: ${ethers.formatUnits(usdcUsed, 6)}`);
    console.log(`   WETH received: ${ethers.formatEther(wethReceived)}`);
    console.log(`   Target was: ${ethers.formatUnits(testUSDC, 6)} USDC → WETH`);
    
    // Calculate effective price
    if (wethReceived > 0n) {
      const effectivePrice = usdcUsed * ethers.parseEther("1") / wethReceived;
      console.log(`   Effective ETH price: ${ethers.formatUnits(effectivePrice, 6)}`);
    }

    console.log("\n💰 Final Balances:");
    console.log(`   USDC: ${ethers.formatUnits(newUsdcBalance, 6)}`);
    console.log(`   WETH: ${ethers.formatEther(newWethBalance)}`);

    console.log(`\n🎉 SWAP SUCCESSFUL!`);
    console.log(`✅ Uniswap V3 USDC → WETH working`);
    console.log(`✅ Pool: ${ADDRESSES.ethUsdcPool}`);
    console.log(`✅ Ready for arbitrage step 4: WETH → USDC`);
    
  } catch (error) {
    console.log(`❌ Swap failed: ${error.message}`);
    
    if (error.message.includes("insufficient")) {
      console.log("💡 Insufficient USDC balance or allowance");
    } else if (error.message.includes("revert")) {
      console.log("💡 Swap reverted");
      console.log("   Possible reasons:");
      console.log("   - Price moved too much (add slippage protection)");
      console.log("   - Pool liquidity issues");
      console.log("   - Wrong pool address or fee tier");
    } else if (error.message.includes("gas")) {
      console.log("💡 Gas estimation failed");
    } else {
      console.log("💡 Check router address and pool parameters");
    }
    
    console.log(`\n🔍 Debug info:`);
    console.log(`   Router: ${ADDRESSES.swapRouter} (SwapRouter02)`);
    console.log(`   Pool: ${ADDRESSES.ethUsdcPool}`);
    console.log(`   Amount: ${ethers.formatUnits(testUSDC, 6)} USDC`);
    console.log(`   ⚠️  Base uses SwapRouter02 which has different struct (no deadline)`);
  }
}

main();