const { ethers } = require('ethers');
require('dotenv').config();

const ADDRESSES = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  pfUSDCVault: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04"
};

async function depositUSDCToPfUSDC() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const depositAmount = ethers.parseUnits("0.1", 6); // 0.1 USDC
  
  try {
    // Setup contracts
    const usdc = new ethers.Contract(ADDRESSES.usdc, [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)"
    ], wallet);
    
    const vault = new ethers.Contract(ADDRESSES.pfUSDCVault, [
      "function balanceOf(address) external view returns (uint256)",
      "function deposit(uint256 assets, address receiver) external returns (uint256 shares)"
    ], wallet);

    // Check USDC balance
    const usdcBalance = await usdc.balanceOf(wallet.address);
    if (usdcBalance < depositAmount) {
      throw new Error(`Insufficient USDC: have ${ethers.formatUnits(usdcBalance, 6)}, need ${ethers.formatUnits(depositAmount, 6)}`);
    }

    console.log(`Depositing ${ethers.formatUnits(depositAmount, 6)} USDC...`);

    // Get initial pfUSDC balance
    const initialPfUsdcBalance = await vault.balanceOf(wallet.address);

    // Approve USDC
    const approveTx = await usdc.approve(ADDRESSES.pfUSDCVault, depositAmount);
    await approveTx.wait();

    // Execute deposit
    const depositTx = await vault.deposit(depositAmount, wallet.address);
    await depositTx.wait();

    // Check results
    const finalPfUsdcBalance = await vault.balanceOf(wallet.address);
    const pfUsdcReceived = finalPfUsdcBalance - initialPfUsdcBalance;

    console.log(`✅ Deposit completed!`);
    console.log(`pfUSDC received: ${ethers.formatUnits(pfUsdcReceived, 6)}`);
    
    return {
      success: true,
      pfUsdcReceived: ethers.formatUnits(pfUsdcReceived, 6),
      txHash: depositTx.hash
    };

  } catch (error) {
    console.error(`❌ Deposit failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the deposit
depositUSDCToPfUSDC();