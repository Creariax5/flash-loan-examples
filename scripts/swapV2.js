const { ethers } = require('ethers');
require('dotenv').config();

// Addresses
const pfUSDC = "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04";
const podETH = "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C";
const v2Router = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("🔄 pfUSDC → podETH Swap");

  // Contracts
  const pfUsdcContract = new ethers.Contract(pfUSDC, [
    "function approve(address,uint256) external returns (bool)",
    "function decimals() view returns (uint8)"
  ], wallet);
  
  const router = new ethers.Contract(v2Router, [
    "function swapExactTokensForTokens(uint,uint,address[],address,uint) external returns (uint[])"
  ], wallet);

  // Setup
  const decimals = await pfUsdcContract.decimals();
  const amount = ethers.parseUnits("0.001", decimals);
  const path = [pfUSDC, podETH];
  const deadline = Math.floor(Date.now() / 1000) + 1800;

  // Gas config to avoid replacement fee error
  const gasConfig = {
    gasPrice: ethers.parseUnits("0.01", "gwei"), // Higher gas price
    gasLimit: 100000
  };

  // Approve
  console.log("Approving...");
  await (await pfUsdcContract.approve(v2Router, amount, gasConfig)).wait();
  
  // Swap
  console.log("Swapping...");
  const tx = await router.swapExactTokensForTokens(
    amount,
    0,
    path,
    wallet.address,
    deadline,
    { ...gasConfig, gasLimit: 300000 }
  );
  
  await tx.wait();
  console.log(`✅ Done! Tx: ${tx.hash}`);
}

main().catch(console.error);