const { ethers } = require('ethers');
require('dotenv').config();

// Base addresses
const ADDRESSES = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  pfUSDCVault: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04"
};

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("🔄 Minimal pfUSDC → USDC Withdraw Test");
  console.log(`📍 Wallet: ${wallet.address}\n`);

  try {
    // Create minimal contracts (only functions we need)
    const usdc = new ethers.Contract(ADDRESSES.usdc, [
      "function balanceOf(address) external view returns (uint256)"
    ], provider);
    
    const vault = new ethers.Contract(ADDRESSES.pfUSDCVault, [
      "function balanceOf(address) external view returns (uint256)",
      "function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)"
    ], wallet);

    // Check current balances
    console.log("💰 Checking balances...");
    let pfUsdcBalance = 0n;
    let usdcBalance = 0n;
    
    try {
      pfUsdcBalance = await vault.balanceOf(wallet.address);
      console.log(`   pfUSDC balance: ${ethers.formatUnits(pfUsdcBalance, 18)}`);
    } catch (e) {
      console.log(`   ⚠️ Could not get pfUSDC balance: ${e.message}`);
    }
    
    try {
      usdcBalance = await usdc.balanceOf(wallet.address);
      console.log(`   USDC balance: ${ethers.formatUnits(usdcBalance, 6)}`);
    } catch (e) {
      console.log(`   ⚠️ Could not get USDC balance: ${e.message}`);
    }

    if (pfUsdcBalance === 0n) {
      console.log("❌ No pfUSDC to withdraw");
      console.log("💡 Run deposit script first to get pfUSDC shares");
      return;
    }

    // Withdraw amount - use small amount or all if we have less
    const withdrawAmount = pfUsdcBalance > ethers.parseEther("0.05") 
      ? ethers.parseEther("0.05")  // 0.05 pfUSDC if we have enough
      : pfUsdcBalance;             // or all if we have less

    console.log(`\n🔄 Withdrawing ${ethers.formatUnits(withdrawAmount, 18)} pfUSDC...`);
    console.log(`   Based on website tx pattern: redeem(shares, receiver, owner)`);

    // Execute redeem (same pattern as website)
    const redeemTx = await vault.redeem(
      withdrawAmount,     // shares to redeem
      wallet.address,     // receiver
      wallet.address,     // owner
      {
        gasLimit: 300000,
        gasPrice: ethers.parseUnits("0.01", "gwei")
      }
    );
    
    console.log(`   Redeem tx: ${redeemTx.hash}`);
    const redeemReceipt = await redeemTx.wait();
    console.log(`   ✅ Withdrawn (Block: ${redeemReceipt.blockNumber})`);

    // Parse withdraw event to see USDC received
    for (const log of redeemReceipt.logs) {
      if (log.address.toLowerCase() === ADDRESSES.pfUSDCVault.toLowerCase()) {
        try {
          // Withdraw event signature: Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
          if (log.topics[0] === "0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db") {
            const assets = ethers.toBigInt("0x" + log.data.slice(2, 66));
            const shares = ethers.toBigInt("0x" + log.data.slice(66, 130));
            
            console.log(`\n📊 Withdraw Results:`);
            console.log(`   Shares redeemed: ${ethers.formatUnits(shares, 18)} pfUSDC`);
            console.log(`   Assets received: ${ethers.formatUnits(assets, 6)} USDC`);
            
            // Calculate redemption rate (USDC per pfUSDC)
            const rate = assets * ethers.parseEther("1") / shares;
            console.log(`   Redemption rate: ${ethers.formatUnits(rate, 18)} USDC per pfUSDC`);
            
            console.log(`\n📋 Expected rates:`);
            console.log(`   Deposit rate: ~0.9999 pfUSDC per USDC`);
            console.log(`   Withdraw rate: ~1.0001 USDC per pfUSDC (inverse)`);
            console.log(`   Your rate: ${ethers.formatUnits(rate, 18)} USDC per pfUSDC`);
            
            // Calculate fees
            if (shares > 0n) {
              const expectedUsdc = shares * 1000000n / ethers.parseEther("1"); // 1:1 conversion
              const actualUsdc = assets;
              const feeDiff = expectedUsdc - actualUsdc;
              const feePercent = Number(feeDiff * 10000n / expectedUsdc) / 100;
              
              console.log(`\n💸 Fee Analysis:`);
              console.log(`   Expected USDC (1:1): ${ethers.formatUnits(expectedUsdc, 6)}`);
              console.log(`   Actual USDC: ${ethers.formatUnits(actualUsdc, 6)}`);
              console.log(`   Fee: ${ethers.formatUnits(feeDiff, 6)} USDC (${feePercent.toFixed(4)}%)`);
            }
          }
        } catch (e) {
          console.log(`   Event parsing failed: ${e.message}`);
        }
      }
    }

    console.log(`\n🎉 WITHDRAWAL SUCCESSFUL!`);
    console.log(`✅ pfUSDC → USDC conversion working`);
    console.log(`✅ Vault redeem function confirmed`);
    
    // Check balances after
    console.log(`\n💰 Checking final balances...`);
    try {
      const newPfUsdcBalance = await vault.balanceOf(wallet.address);
      const newUsdcBalance = await usdc.balanceOf(wallet.address);
      
      console.log(`   pfUSDC balance: ${ethers.formatUnits(newPfUsdcBalance, 18)}`);
      console.log(`   USDC balance: ${ethers.formatUnits(newUsdcBalance, 6)}`);
      
      const usdcGained = newUsdcBalance - usdcBalance;
      console.log(`   USDC gained: ${ethers.formatUnits(usdcGained, 6)}`);
      
    } catch (e) {
      console.log(`   ⚠️ Could not check final balances`);
    }
    
    console.log(`\n📋 Arbitrage Progress:`);
    console.log(`   ✅ Step 1: USDC → pfUSDC (tested)`);
    console.log(`   ✅ Step 1 reverse: pfUSDC → USDC (tested)`);
    console.log(`   ❓ Step 2: pfUSDC → podETH (need to test)`);
    console.log(`   ✅ Step 3: podETH → WETH (you tested this)`);
    console.log(`   ❓ Step 4: WETH → USDC (need to test)`);
    
  } catch (error) {
    console.log(`❌ Withdraw failed: ${error.message}`);
    
    // Detailed error analysis
    if (error.message.includes("insufficient")) {
      console.log("💡 Insufficient pfUSDC shares or vault liquidity");
    } else if (error.message.includes("allowance")) {
      console.log("💡 Approval issue (though redeem shouldn't need approval)");
    } else if (error.message.includes("revert")) {
      console.log("💡 Vault rejected withdrawal");
      console.log("   Possible: paused, limits, cooldown period");
    } else if (error.message.includes("gas")) {
      console.log("💡 Gas estimation failed");
    } else {
      console.log("💡 Unknown error - check transaction details");
    }
    
    console.log(`\n🔍 Debug info:`);
    console.log(`   Your wallet: ${wallet.address}`);
    console.log(`   Withdraw amount: ${ethers.formatUnits(withdrawAmount || 0n, 18)} pfUSDC`);
    console.log(`   Function: redeem(shares, receiver, owner)`);
  }
}

main();