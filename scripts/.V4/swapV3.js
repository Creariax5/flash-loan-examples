const { ethers } = require('ethers');
require('dotenv').config();

const ADDRESSES = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  weth: "0x4200000000000000000000000000000000000006",
  swapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481"
};

async function swapUSDCToWETH() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const swapAmount = ethers.parseUnits("0.01", 6); // 0.01 USDC

  try {
    // Setup contracts
    const usdc = new ethers.Contract(ADDRESSES.usdc, [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)"
    ], wallet);
    
    const weth = new ethers.Contract(ADDRESSES.weth, [
      "function balanceOf(address) external view returns (uint256)"
    ], provider);
    
    const swapRouter = new ethers.Contract(ADDRESSES.swapRouter, [
      "function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)"
    ], wallet);

    // Check balance
    const usdcBalance = await usdc.balanceOf(wallet.address);
    if (usdcBalance < swapAmount) {
      throw new Error(`Insufficient USDC: have ${ethers.formatUnits(usdcBalance, 6)}, need ${ethers.formatUnits(swapAmount, 6)}`);
    }

    console.log(`Swapping ${ethers.formatUnits(swapAmount, 6)} USDC to WETH...`);

    // Approve USDC
    const approveTx = await usdc.approve(ADDRESSES.swapRouter, swapAmount);
    await approveTx.wait();

    // Get initial WETH balance
    const initialWethBalance = await weth.balanceOf(wallet.address);

    // Execute swap
    const swapParams = [
      ADDRESSES.usdc,     // tokenIn
      ADDRESSES.weth,     // tokenOut
      500,                // fee (0.05%)
      wallet.address,     // recipient
      swapAmount,         // amountIn
      0,                  // amountOutMinimum
      0                   // sqrtPriceLimitX96
    ];

    const swapTx = await swapRouter.exactInputSingle(swapParams);
    await swapTx.wait();

    // Check results
    const finalWethBalance = await weth.balanceOf(wallet.address);
    const wethReceived = finalWethBalance - initialWethBalance;

    console.log(`✅ Swap completed!`);
    console.log(`WETH received: ${ethers.formatEther(wethReceived)}`);
    
    return {
      success: true,
      wethReceived: ethers.formatEther(wethReceived),
      txHash: swapTx.hash
    };

  } catch (error) {
    console.error(`❌ Swap failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the swap
swapUSDCToWETH();