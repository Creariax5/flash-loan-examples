const { ethers } = require('ethers');
require('dotenv').config();

// Addresses
const pfUSDC = "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04";
const podETH = "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C";
const v2Router = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // BaseSwap router

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("🔄 podETH → pfUSDC Swap (Fee-on-Transfer)");

  const podEthContract = new ethers.Contract(podETH, [
    "function approve(address,uint256) external returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], wallet);
  
  // Use fee-on-transfer supporting function
  const router = new ethers.Contract(v2Router, [
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint,uint,address[],address,uint) external"
  ], wallet);

  const balance = await podEthContract.balanceOf(wallet.address);
  console.log(`podETH balance: ${ethers.formatEther(balance)}`);

  const amount = ethers.parseUnits("0.0002", 18); // Adjust amount as needed
  const path = [podETH, pfUSDC];
  const deadline = Math.floor(Date.now() / 1000) + 1800;

  console.log("Approving...");
  await (await podEthContract.approve(v2Router, amount)).wait();
  
  console.log("Swapping with fee-on-transfer support...");
  const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    amount, 
    0,           // Accept any amount of pfUSDC out
    path, 
    wallet.address, 
    deadline
  );
  
  await tx.wait();
  console.log(`✅ Done! Tx: ${tx.hash}`);
  
  // Check final pfUSDC balance
  const pfUsdcContract = new ethers.Contract(pfUSDC, [
    "function balanceOf(address) view returns (uint256)"
  ], wallet);
  
  const pfUsdcBalance = await pfUsdcContract.balanceOf(wallet.address);
  console.log(`pfUSDC received: ${ethers.formatUnits(pfUsdcBalance, 6)}`);
}

main().catch(console.error);