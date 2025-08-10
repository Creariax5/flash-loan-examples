const { ethers } = require('ethers');
require('dotenv').config();

// Base addresses
const ADDRESSES = {
  podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
  weth: "0x4200000000000000000000000000000000000006"
};

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("🔄 podETH → WETH Unwrap Test");
  console.log(`📍 Wallet: ${wallet.address}\n`);

  // Contracts
  const podETH = new ethers.Contract(ADDRESSES.podETH, [
    "function balanceOf(address) external view returns (uint256)",
    "function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external"
  ], wallet);
  
  const weth = new ethers.Contract(ADDRESSES.weth, [
    "function balanceOf(address) external view returns (uint256)"
  ], provider);

  // Check balances
  const podBal = await podETH.balanceOf(wallet.address);
  const wethBal = await weth.balanceOf(wallet.address);
  
  console.log(`podETH: ${ethers.formatEther(podBal)}`);
  console.log(`WETH: ${ethers.formatEther(wethBal)}`);

  if (podBal === 0n) {
    console.log("❌ No podETH to unwrap");
    return;
  }

  // Unwrap small amount for testing
  const unwrapAmount = podBal > ethers.parseEther("0.001") 
    ? ethers.parseEther("0.001")  // 0.001 podETH if we have enough
    : podBal;                     // or all if we have less

  console.log(`\n🔄 Unwrapping ${ethers.formatEther(unwrapAmount)} podETH → WETH...`);

  try {
    // Debond (unwrap) - 100% to WETH since podETH is single-asset
    const debondTx = await podETH.debond(
      unwrapAmount,           // amount to unwrap
      [ADDRESSES.weth],       // tokens to receive (only WETH)
      [100],                  // percentages (100% to WETH)
      { gasLimit: 300000 }
    );
    
    const receipt = await debondTx.wait();
    console.log(`✅ Unwrapped! Tx: ${debondTx.hash}`);
    
    // Check new balances
    const newWethBal = await weth.balanceOf(wallet.address);
    const newPodBal = await podETH.balanceOf(wallet.address);
    const received = newWethBal - wethBal;
    
    console.log(`📊 Results:`);
    console.log(`   Received: ${ethers.formatEther(received)} WETH`);
    console.log(`   Remaining podETH: ${ethers.formatEther(newPodBal)}`);
    console.log(`   New WETH balance: ${ethers.formatEther(newWethBal)}`);
    
    // Calculate conversion rate
    const rate = received * 10000n / unwrapAmount; // basis points
    console.log(`   Conversion rate: ${Number(rate)/100}% (${ethers.formatEther(received)} WETH per ${ethers.formatEther(unwrapAmount)} podETH)`);
    
  } catch (error) {
    console.log(`❌ Unwrap failed: ${error.message}`);
    
    // Common error explanations
    if (error.message.includes("revert")) {
      console.log("💡 Possible reasons:");
      console.log("   - Pod has unwrap cooldown period");
      console.log("   - Pod is paused or restricted");
      console.log("   - Insufficient pod balance");
      console.log("   - Contract interaction issue");
    }
  }
}

main();