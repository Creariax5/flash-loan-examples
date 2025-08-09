const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🎯 TESTING WITH CORRECTED UNDERSTANDING OF FEE TIERS");
    console.log("=" .repeat(60));
    
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);
    
    // Get current balance
    const ethBalance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.formatEther(ethBalance), "ETH");
    
    // Get USDC balance
    const usdcContract = new ethers.Contract(
        ARBITRUM_ADDRESSES.USDC,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        ethers.provider
    );
    
    const usdcBalance = await usdcContract.balanceOf(deployer.address);
    const usdcDecimals = await usdcContract.decimals();
    console.log("USDC Balance:", ethers.formatUnits(usdcBalance, usdcDecimals), "USDC");
    
    // Check if we have USDC to test
    if (usdcBalance == 0n) {
        console.log("❌ No USDC balance to test with!");
        return;
    }
    
    console.log("\n📊 KNOWN ISSUE ANALYSIS:");
    console.log("Our contract expects PEAS/WETH fee: 3000 (0.3%)");
    console.log("Actual PEAS/WETH pool fee: 10000 (1%)");
    console.log("This fee mismatch causes Uniswap V3 to revert the transaction!");
    
    console.log("\n🔧 SOLUTION:");
    console.log("We need to deploy a new contract with fee tier 10000 for PEAS/WETH");
    console.log("Or manually call the pool with correct parameters");
    
    // Let's try to manually calculate what would happen with correct fees
    console.log("\n🧮 MANUAL CALCULATION WITH CORRECT FEES:");
    
    // Test amount
    const testUSDC = ethers.parseUnits("2", usdcDecimals); // $2 test
    console.log("Test amount:", ethers.formatUnits(testUSDC, usdcDecimals), "USDC");
    
    // Show the issue clearly
    console.log("\n❌ CURRENT CONTRACT ISSUE:");
    console.log("1. Contract calls: swapRouter.exactInputSingle() with fee=3000");
    console.log("2. Uniswap checks: Does pool with fee=3000 exist?");
    console.log("3. Result: NO! Only pool with fee=10000 exists");
    console.log("4. Uniswap reverts: 'Pool not found' or similar error");
    
    console.log("\n✅ WHAT WE NEED TO FIX:");
    console.log("1. Update PEAS_WETH_FEE from 3000 to 10000");
    console.log("2. Redeploy the contract");
    console.log("3. Test again");
    
    console.log("\n💡 IMMEDIATE ACTION:");
    console.log("Deploy new contract with correct fee parameters!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
