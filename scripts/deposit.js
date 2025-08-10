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
  
  console.log("🔄 Minimal USDC → pfUSDC Deposit Test");
  console.log(`📍 Wallet: ${wallet.address}\n`);

  // Just test deposit directly (based on successful tx)
  const depositAmount = 100000n; // $0.1 USDC (same format as successful tx)
  
  console.log(`💰 Depositing ${ethers.formatUnits(depositAmount, 6)} USDC...`);
  console.log(`   Based on successful tx: 0xfdeba8a6c244a515e99fb7a3c8fa60e91c51553aaba4c882cd0a8e9295603eb3`);

  try {
    // Create minimal contracts (only functions we need)
    const usdc = new ethers.Contract(ADDRESSES.usdc, [
      "function approve(address spender, uint256 amount) external returns (bool)"
    ], wallet);
    
    const vault = new ethers.Contract(ADDRESSES.pfUSDCVault, [
      "function deposit(uint256 assets, address receiver) external returns (uint256 shares)"
    ], wallet);

    // Step 1: Approve USDC
    console.log("1️⃣ Approving USDC...");
    const approveTx = await usdc.approve(ADDRESSES.pfUSDCVault, depositAmount, {
      gasLimit: 100000,
      gasPrice: ethers.parseUnits("0.01", "gwei") // Low gas price for Base
    });
    
    console.log(`   Approve tx: ${approveTx.hash}`);
    const approveReceipt = await approveTx.wait();
    console.log(`   ✅ Approved (Block: ${approveReceipt.blockNumber})`);

    // Step 2: Deposit to vault
    console.log("2️⃣ Depositing to vault...");
    const depositTx = await vault.deposit(depositAmount, wallet.address, {
      gasLimit: 300000,
      gasPrice: ethers.parseUnits("0.01", "gwei")
    });
    
    console.log(`   Deposit tx: ${depositTx.hash}`);
    const depositReceipt = await depositTx.wait();
    console.log(`   ✅ Deposited (Block: ${depositReceipt.blockNumber})`);

    // Parse deposit event to see shares received
    for (const log of depositReceipt.logs) {
      if (log.address.toLowerCase() === ADDRESSES.pfUSDCVault.toLowerCase()) {
        try {
          // Deposit event signature: Deposit(address indexed sender, address indexed receiver, uint256 assets, uint256 shares)
          if (log.topics[0] === "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7") {
            const assets = ethers.toBigInt("0x" + log.data.slice(2, 66));
            const shares = ethers.toBigInt("0x" + log.data.slice(66, 130));
            
            console.log(`\n📊 Deposit Results:`);
            console.log(`   Assets deposited: ${ethers.formatUnits(assets, 6)} USDC`);
            console.log(`   Shares received: ${ethers.formatUnits(shares, 18)} pfUSDC`);
            
            // Calculate rate (shares per USDC)
            const rate = shares * 1000000n / assets; // Adjust for decimal difference
            console.log(`   Share rate: ${ethers.formatUnits(rate, 18)} pfUSDC per USDC`);
            
            // Compare to successful transaction
            console.log(`\n📋 Comparison to successful tx:`);
            console.log(`   Successful tx: 1.91 USDC → 1.909831 pfUSDC`);
            console.log(`   Rate was: ~0.9999 pfUSDC per USDC`);
            console.log(`   Your rate: ${ethers.formatUnits(rate, 18)} pfUSDC per USDC`);
          }
        } catch (e) {
          console.log(`   Event parsing failed: ${e.message}`);
        }
      }
    }

    console.log(`\n🎉 DEPOSIT SUCCESSFUL!`);
    console.log(`✅ Step 1 of arbitrage confirmed working`);
    console.log(`✅ Vault address: ${ADDRESSES.pfUSDCVault}`);
    console.log(`✅ USDC → pfUSDC conversion working`);
    
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Test pfUSDC → podETH swap (Step 2)`);
    console.log(`   2. Test podETH → WETH unwrap (Step 3) ✅ already tested`);
    console.log(`   3. Test WETH → USDC swap (Step 4)`);
    console.log(`   4. Combine all steps for full arbitrage`);
    
  } catch (error) {
    console.log(`❌ Deposit failed: ${error.message}`);
    
    // Detailed error analysis
    if (error.message.includes("insufficient")) {
      console.log("💡 Insufficient USDC balance");
      console.log("   Need at least $0.1 USDC to test");
    } else if (error.message.includes("allowance")) {
      console.log("💡 USDC approval failed");
      console.log("   Check if approval transaction succeeded");
    } else if (error.message.includes("revert")) {
      console.log("💡 Vault rejected deposit");
      console.log("   Possible reasons: paused, limits, blacklist");
    } else if (error.message.includes("gas")) {
      console.log("💡 Gas estimation failed");
      console.log("   Try increasing gas limit or price");
    } else {
      console.log("💡 Unknown error - check transaction details");
    }
    
    console.log(`\n🔍 Debug info:`);
    console.log(`   Your wallet: ${wallet.address}`);
    console.log(`   Successful wallet: 0x5A2Ccb5B0a4Dc5B7Ca9c0768e6E2082Be7bc6229`);
    console.log(`   Amount: ${ethers.formatUnits(depositAmount, 6)} USDC`);
    console.log(`   Successful amount: 1.91 USDC`);
  }
}

main();