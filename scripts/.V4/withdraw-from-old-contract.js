const { ethers } = require("hardhat");

// Your current deployed contract with the old logic
const OLD_CONTRACT_ADDRESS = "0xf5C2907027359a02B7117a82044bA0eE4CEB7965";

async function main() {
    console.log("💸 Withdrawing podETH from old contract...");

    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Handle both ethers v5 and v6
    const formatEther = ethers.formatEther || ethers.utils.formatEther;

    // Get contract instances
    const oldTester = await ethers.getContractAt("PodFlashMintTester", OLD_CONTRACT_ADDRESS);
    const podETHAddress = await oldTester.POD_ETH();
    const podETH = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", podETHAddress);

    // Check balances before withdrawal
    const contractBalance = await oldTester.getPodETHBalance();
    const userBalanceBefore = await podETH.balanceOf(signer.address);

    console.log("\n💰 Current balances:");
    console.log("Old contract podETH:", formatEther(contractBalance));
    console.log("Your podETH (before):", formatEther(userBalanceBefore));

    if (contractBalance === 0n || contractBalance === 0) {
        console.log("✅ No podETH in old contract to withdraw");
        return;
    }

    try {
        console.log("\n🚀 Executing emergency withdraw...");
        
        const withdrawTx = await oldTester.emergencyWithdraw(podETHAddress);
        
        // const withdrawTx = await oldTester.emergencyWithdraw(podETHAddress, {
        //     gasPrice: ethers.parseUnits("0.1", "gwei"), // higher than the pending tx
        //     nonce: await signer.getNonce(),          // explicitly reuse nonce
        // });

        console.log("📤 Transaction sent:", withdrawTx.hash);
        
        const receipt = await withdrawTx.wait();
        console.log("✅ Emergency withdraw executed successfully!");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check balances after withdrawal
        const contractBalanceAfter = await oldTester.getPodETHBalance();
        const userBalanceAfter = await podETH.balanceOf(signer.address);

        console.log("\n💰 Balances after withdrawal:");
        console.log("Old contract podETH:", formatEther(contractBalanceAfter));
        console.log("Your podETH (after):", formatEther(userBalanceAfter));
        
        const recovered = userBalanceAfter - userBalanceBefore;
        console.log("💵 Recovered:", formatEther(recovered), "podETH");

        console.log("\n✅ Successfully recovered your podETH!");
        console.log("🔄 Now you can redeploy the contract with fixed logic");

    } catch (error) {
        console.error("❌ Withdrawal failed:", error.message);
        
        if (error.reason) {
            console.error("Reason:", error.reason);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Withdrawal failed:", error);
        process.exit(1);
    });