const { ethers } = require('ethers');
require('dotenv').config();

// Base addresses
const ADDRESSES = {
  podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
  weth: "0x4200000000000000000000000000000000000006", 
  indexUtils: "0x490b03c6afe733576cf1f5d2a821cf261b15826d"
};

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("🔄 WETH → podETH Wrap Test");
  console.log(`📍 Wallet: ${wallet.address}\n`);

  // Contracts
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

  // Check balances
  const wethBal = await weth.balanceOf(wallet.address);
  const podBal = await podETH.balanceOf(wallet.address);
  
  console.log(`WETH: ${ethers.formatEther(wethBal)}`);
  console.log(`podETH: ${ethers.formatEther(podBal)}`);

  if (wethBal === 0n) {
    console.log("❌ No WETH to wrap");
    return;
  }

  // Wrap small amount for testing
  const wrapAmount = ethers.parseEther("0.00001"); // 0.00001 WETH
  if (wethBal < wrapAmount) {
    console.log(`❌ Need at least ${ethers.formatEther(wrapAmount)} WETH`);
    return;
  }

  console.log(`\n🔄 Wrapping ${ethers.formatEther(wrapAmount)} WETH → podETH...`);

  try {
    // Approve
    const approveTx = await weth.approve(ADDRESSES.indexUtils, wrapAmount);
    await approveTx.wait();
    console.log("✅ WETH approved");

    // Bond (wrap)
    const bondTx = await indexUtils.bond(
      ADDRESSES.podETH,  // index fund
      ADDRESSES.weth,    // token to bond
      wrapAmount,        // amount
      0,                 // min output (0 for testing)
      { gasLimit: 300000 }
    );
    
    const receipt = await bondTx.wait();
    console.log(`✅ Wrapped! Tx: ${bondTx.hash}`);
    
    // Check new balances
    const newPodBal = await podETH.balanceOf(wallet.address);
    const received = newPodBal - podBal;
    console.log(`📊 Received: ${ethers.formatEther(received)} podETH`);
    
  } catch (error) {
    console.log(`❌ Wrap failed: ${error.message}`);
  }
}

main();