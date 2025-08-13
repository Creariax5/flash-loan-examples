const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  // Addresses
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const WETH = "0x4200000000000000000000000000000000000006";
  const V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";

  console.log("🔄 Direct USDC → ETH Swap Test");

  // Contracts
  const usdc = new ethers.Contract(USDC, [
    "function approve(address,uint256) external returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], wallet);
  
  const router = new ethers.Contract(V3_ROUTER, [
    "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)"
  ], wallet);

  // Check balance
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`USDC balance: ${ethers.formatUnits(balance, 6)}`);

  if (balance === 0n) {
    console.log("❌ No USDC to swap");
    return;
  }

  const amount = ethers.parseUnits("0.001", 6); // 0.001 USDC

  // Define params outside try block so it's accessible in catch
  const params = [
    USDC,           // tokenIn
    WETH,           // tokenOut
    500,            // fee
    wallet.address, // recipient
    amount,         // amountIn
    0,              // amountOutMinimum
    0               // sqrtPriceLimitX96
  ];

  try {
    console.log("Approving USDC...");
    await (await usdc.approve(V3_ROUTER, amount)).wait();
    
    console.log("Swapping USDC → ETH...");
    
    const tx = await router.exactInputSingle(params);
    await tx.wait();
    
    console.log(`✅ Success! Tx: ${tx.hash}`);
    
  } catch (error) {
    console.log("❌ Direct swap failed:", error.message);
    
    // Try alternative V3 router
    console.log("\n🔄 Trying alternative V3 router...");
    const ALT_V3_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
    
    const altRouter = new ethers.Contract(ALT_V3_ROUTER, [
      "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) external payable returns (uint256)"
    ], wallet);
    
    try {
      await (await usdc.approve(ALT_V3_ROUTER, amount)).wait();
      const tx2 = await altRouter.exactInputSingle(params);
      await tx2.wait();
      console.log(`✅ Alternative router works! Tx: ${tx2.hash}`);
    } catch (error2) {
      console.log("❌ Alternative router also failed:", error2.message);
    }
  }
}

main().catch(console.error);