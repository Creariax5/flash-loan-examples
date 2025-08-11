const { ethers } = require('ethers');
require('dotenv').config();

const ADDRESSES = {
  podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
  weth: "0x4200000000000000000000000000000000000006", 
  indexUtils: "0x490b03c6afe733576cf1f5d2a821cf261b15826d"
};

async function wrapWETHToPodETH() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const wrapAmount = ethers.parseEther("0.00001"); // 0.00001 WETH
  
  try {
    // Setup contracts
    const indexUtils = new ethers.Contract(ADDRESSES.indexUtils, [
      "function bond(address _indexFund, address _token, uint256 _amount, uint256 _amountMintMin) external"
    ], wallet);
    
    const weth = new ethers.Contract(ADDRESSES.weth, [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address,uint256) external returns (bool)"
    ], wallet);
    
    const podETH = new ethers.Contract(ADDRESSES.podETH, [
      "function balanceOf(address) external view returns (uint256)"
    ], provider);

    // Check WETH balance
    const wethBalance = await weth.balanceOf(wallet.address);
    if (wethBalance < wrapAmount) {
      throw new Error(`Insufficient WETH: have ${ethers.formatEther(wethBalance)}, need ${ethers.formatEther(wrapAmount)}`);
    }

    console.log(`Wrapping ${ethers.formatEther(wrapAmount)} WETH...`);

    // Get initial podETH balance
    const initialPodBalance = await podETH.balanceOf(wallet.address);

    // Approve WETH
    const approveTx = await weth.approve(ADDRESSES.indexUtils, wrapAmount);
    await approveTx.wait();

    // Execute bond (wrap)
    const bondTx = await indexUtils.bond(
      ADDRESSES.podETH,  // index fund
      ADDRESSES.weth,    // token to bond
      wrapAmount,        // amount
      0                  // min output (0 for testing)
    );
    
    await bondTx.wait();

    // Check results
    const finalPodBalance = await podETH.balanceOf(wallet.address);
    const podReceived = finalPodBalance - initialPodBalance;

    console.log(`✅ Wrap completed!`);
    console.log(`podETH received: ${ethers.formatEther(podReceived)}`);
    
    return {
      success: true,
      podReceived: ethers.formatEther(podReceived),
      txHash: bondTx.hash
    };

  } catch (error) {
    console.error(`❌ Wrap failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the wrap
wrapWETHToPodETH();