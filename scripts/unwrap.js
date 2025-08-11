const { ethers } = require('ethers');
require('dotenv').config();

const ADDRESSES = {
  podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
  weth: "0x4200000000000000000000000000000000000006"
};

async function unwrapPodETHToWETH() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  try {
    // Setup contracts
    const podETH = new ethers.Contract(ADDRESSES.podETH, [
      "function balanceOf(address) external view returns (uint256)",
      "function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external"
    ], wallet);
    
    const weth = new ethers.Contract(ADDRESSES.weth, [
      "function balanceOf(address) external view returns (uint256)"
    ], provider);

    // Check podETH balance
    const podBalance = await podETH.balanceOf(wallet.address);
    if (podBalance === 0n) {
      throw new Error("No podETH balance to unwrap");
    }

    // Use small amount or all if we have less
    const unwrapAmount = podBalance > ethers.parseEther("0.001") 
      ? ethers.parseEther("0.001")  
      : podBalance;

    console.log(`Unwrapping ${ethers.formatEther(unwrapAmount)} podETH...`);

    // Get initial WETH balance
    const initialWethBalance = await weth.balanceOf(wallet.address);

    // Execute debond (unwrap) - 100% to WETH
    const debondTx = await podETH.debond(
      unwrapAmount,           // amount to unwrap
      [ADDRESSES.weth],       // tokens to receive (only WETH)
      [100]                   // percentages (100% to WETH)
    );
    
    await debondTx.wait();

    // Check results
    const finalWethBalance = await weth.balanceOf(wallet.address);
    const wethReceived = finalWethBalance - initialWethBalance;

    console.log(`✅ Unwrap completed!`);
    console.log(`WETH received: ${ethers.formatEther(wethReceived)}`);
    
    return {
      success: true,
      wethReceived: ethers.formatEther(wethReceived),
      txHash: debondTx.hash
    };

  } catch (error) {
    console.error(`❌ Unwrap failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the unwrap
unwrapPodETHToWETH();