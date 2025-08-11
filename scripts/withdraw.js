const { ethers } = require('ethers');
require('dotenv').config();

const ADDRESSES = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  pfUSDCVault: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04"
};

async function withdrawPfUSDCToUSDC() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  try {
    // Setup contracts
    const usdc = new ethers.Contract(ADDRESSES.usdc, [
      "function balanceOf(address) external view returns (uint256)"
    ], provider);
    
    const vault = new ethers.Contract(ADDRESSES.pfUSDCVault, [
      "function balanceOf(address) external view returns (uint256)",
      "function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)"
    ], wallet);

    // Check pfUSDC balance
    const pfUsdcBalance = await vault.balanceOf(wallet.address);
    if (pfUsdcBalance === 0n) {
      throw new Error("No pfUSDC balance to withdraw");
    }

    // Use small amount or all if we have less (pfUSDC uses 6 decimals like USDC)
    const withdrawAmount = pfUsdcBalance > ethers.parseUnits("0.05", 6) 
      ? ethers.parseUnits("0.05", 6)  
      : pfUsdcBalance;

    console.log(`Withdrawing ${ethers.formatUnits(withdrawAmount, 6)} pfUSDC...`);

    // Get initial USDC balance
    const initialUsdcBalance = await usdc.balanceOf(wallet.address);

    // Execute redeem
    const redeemTx = await vault.redeem(
      withdrawAmount,     // shares to redeem
      wallet.address,     // receiver
      wallet.address      // owner
    );
    
    const receipt = await redeemTx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // Wait a moment for balance to update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check results
    const finalUsdcBalance = await usdc.balanceOf(wallet.address);
    const usdcReceived = finalUsdcBalance - initialUsdcBalance;

    console.log(`✅ Withdrawal completed!`);
    console.log(`USDC received: ${ethers.formatUnits(usdcReceived, 6)}`);
    
    return {
      success: true,
      usdcReceived: ethers.formatUnits(usdcReceived, 6),
      txHash: redeemTx.hash
    };

  } catch (error) {
    console.error(`❌ Withdrawal failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the withdrawal
withdrawPfUSDCToUSDC();