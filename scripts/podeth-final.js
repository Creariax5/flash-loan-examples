const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Simple podETH Minting Script
 * 
 * IMPORTANT: podETH is an index fund requiring multiple underlying assets:
 * - WETH (Wrapped Ethereum) 
 * - cbETH (Coinbase Staked ETH)
 * - rETH (Rocket Pool ETH)
 * - And possibly others
 * 
 * You need ALL component tokens in the correct proportions to mint podETH.
 * Use a DEX aggregator or acquire these tokens first.
 */

const ADDRESSES = {
  podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
  weth: "0x4200000000000000000000000000000000000006", 
  indexUtils: "0x490b03c6afe733576cf1f5d2a821cf261b15826d"
};

const ABI = {
  bond: ["function bond(address _indexFund, address _token, uint256 _amount, uint256 _amountMintMin) external"],
  erc20: [
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address,uint256) external returns (bool)",
    "function allowance(address,address) external view returns (uint256)"
  ],
  weth: [
    "function deposit() external payable",
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address,uint256) external returns (bool)",
    "function allowance(address,address) external view returns (uint256)"
  ]
};

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Set PRIVATE_KEY in .env file");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("🏷️ podETH Index Fund Interaction");
  console.log(`📍 Wallet: ${wallet.address}\n`);

  // Contract instances
  const indexUtils = new ethers.Contract(ADDRESSES.indexUtils, ABI.bond, wallet);
  const weth = new ethers.Contract(ADDRESSES.weth, ABI.weth, wallet);
  const podETH = new ethers.Contract(ADDRESSES.podETH, ABI.erc20, provider);

  try {
    // Check balances
    console.log("💼 Current Balances:");
    const ethBalance = await provider.getBalance(wallet.address);
    const wethBalance = await weth.balanceOf(wallet.address);
    const podETHBalance = await podETH.balanceOf(wallet.address);
    
    console.log(`   ETH: ${ethers.formatEther(ethBalance)}`);
    console.log(`   WETH: ${ethers.formatEther(wethBalance)}`);
    console.log(`   podETH: ${ethers.formatEther(podETHBalance)}`);

    if (podETHBalance > 0) {
      console.log("\n🎉 You already have podETH tokens!");
      console.log("📋 Previous successful mint transaction:");
      console.log("    0x971e270e40c72c199441613580e03150fddd1caa2318854e8036871051d5b8fb");
      return;
    }

    console.log("\n⚠️  To mint podETH, you need:");
    console.log("   ✓ Multiple underlying ETH derivatives (WETH, cbETH, rETH, etc.)");
    console.log("   ✓ In correct proportions matching the index");
    console.log("   ✓ Sufficient gas for the transaction");
    console.log("\n💡 Recommended approach:");
    console.log("   1. Use a DEX aggregator to get component tokens");
    console.log("   2. Or use the official podETH app interface");
    console.log("   3. Your previous successful mint shows it's possible!");

    // If user wants to try anyway (will likely fail with just WETH)
    const tryAnyway = process.argv[2] === '--force';
    if (tryAnyway && wethBalance > 0) {
      console.log("\n🚨 Force mode: Attempting mint with available WETH only...");
      
      const mintAmount = wethBalance / 2n; // Use half available WETH
      const minOut = mintAmount * 95n / 100n; // 5% slippage tolerance

      console.log(`   Bonding: ${ethers.formatEther(mintAmount)} WETH`);
      
      // Check allowance
      const allowance = await weth.allowance(wallet.address, ADDRESSES.indexUtils);
      if (allowance < mintAmount) {
        console.log("   Approving WETH...");
        const tx = await weth.approve(ADDRESSES.indexUtils, mintAmount);
        await tx.wait();
      }

      // Attempt bond
      console.log("   Executing bond...");
      try {
        const bondTx = await indexUtils.bond(
          ADDRESSES.podETH,
          ADDRESSES.weth,
          mintAmount,
          minOut,
          { gasLimit: 500000 }
        );
        
        const receipt = await bondTx.wait();
        if (receipt.status === 1) {
          console.log(`   ✅ Success! Tx: ${bondTx.hash}`);
        } else {
          console.log("   ❌ Transaction failed");
        }
      } catch (error) {
        console.log(`   ❌ Bond failed: ${error.message}`);
        console.log("   💡 This confirms you need multiple component tokens");
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
