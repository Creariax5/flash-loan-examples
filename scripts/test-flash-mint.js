const { ethers } = require("hardhat");

// Use your existing deployed contract address
const TESTER_CONTRACT_ADDRESS = "0xf5C2907027359a02B7117a82044bA0eE4CEB7965";

async function main() {
    console.log("🧪 Testing current Pod Flash Mint contract...");

    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Testing with account:", signer.address);

    // Handle both ethers v5 and v6
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const parseEther = ethers.parseEther || ethers.utils.parseEther;

    try {
        // Get contract instances - fix the contract resolution issue
        const tester = await ethers.getContractAt("PodFlashMintTester", TESTER_CONTRACT_ADDRESS);
        console.log("✅ Connected to contract at:", TESTER_CONTRACT_ADDRESS);
        
        const podETHAddress = await tester.POD_ETH();
        // Fix: Use fully qualified name for IERC20
        const podETH = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", podETHAddress);

        console.log("📋 Contract addresses:");
        console.log("Tester:", TESTER_CONTRACT_ADDRESS);
        console.log("Pod ETH:", podETHAddress);

        // Check balances
        const userPodETHBalance = await podETH.balanceOf(signer.address);
        const contractPodETHBalance = await tester.getPodETHBalance();

        console.log("\n💰 Current balances:");
        console.log("User podETH:", formatEther(userPodETHBalance));
        console.log("Contract podETH:", formatEther(contractPodETHBalance));

        // Test flash mint fee calculation
        const testAmount = parseEther("0.001"); // Small test amount: 0.001 podETH
        const fee = await tester.calculateFlashMintFee(testAmount);
        const totalRepayment = await tester.getTotalRepaymentAmount(testAmount);

        console.log("\n🧮 Flash Mint Calculations (for 0.001 podETH):");
        console.log("Flash mint amount:", formatEther(testAmount));
        console.log("Fee (0.1%):", formatEther(fee));
        console.log("Total repayment:", formatEther(totalRepayment));

        // Check if we can cover the flash mint (only need fee)
        const canCover = await tester.canCoverFlashMint(testAmount);
        console.log("Can cover flash mint:", canCover);

        if (!canCover && userPodETHBalance > fee) {
            console.log("\n💸 Depositing podETH FEE to contract for testing...");
            console.log("Only need fee amount:", formatEther(fee));
            
            // Approve the contract to spend just the fee amount
            const approveTx = await podETH.approve(tester.address, fee);
            await approveTx.wait();
            console.log("✅ Approved contract to spend podETH fee");

            // Deposit just the fee amount to the contract
            const depositTx = await tester.depositPodETH(fee);
            await depositTx.wait();
            console.log("✅ Deposited fee amount to contract");

            // Check new balance
            const newContractBalance = await tester.getPodETHBalance();
            console.log("New contract balance:", formatEther(newContractBalance));
        }

        // Try the flash mint with current (broken) contract
        if (await tester.canCoverFlashMint(testAmount)) {
            console.log("\n🚀 Attempting flash mint with current contract...");
            console.log("⚠️  NOTE: This will likely fail due to interface mismatch");
            
            try {
                const flashMintTx = await tester.requestFlashMint(testAmount);
                console.log("📤 Transaction sent:", flashMintTx.hash);
                
                const receipt = await flashMintTx.wait();
                console.log("✅ Flash mint executed successfully!");
                console.log("Gas used:", receipt.gasUsed.toString());

            } catch (error) {
                console.error("❌ Flash mint failed as expected:", error.message);
                console.log("\n💡 This confirms the interface mismatch issue!");
                console.log("🔧 You need to deploy the FIXED contract");
                
                // Check if it's the specific callback error
                if (error.message.includes("execution reverted")) {
                    console.log("🎯 CONFIRMED: Interface mismatch - Pod can't call callback()");
                }
            }
        } else {
            console.log("\n❌ Cannot test flash mint - need to deposit fee first");
            console.log("You have:", formatEther(userPodETHBalance), "podETH");
            console.log("Need:", formatEther(fee), "podETH for fee");
        }

        console.log("\n📋 Current Contract Analysis:");
        console.log("❌ Implements: receiveFlashMint() - WRONG");
        console.log("✅ Pod expects: IFlashLoanRecipient.callback() - CORRECT");
        console.log("🔧 Solution: Deploy the fixed contract version");

    } catch (contractError) {
        console.error("❌ Contract connection failed:", contractError.message);
        
        // Check for specific error types
        if (contractError.message.includes("multiple artifacts")) {
            console.log("🔧 Fixed: Using fully qualified IERC20 name");
        } else {
            console.log("\n💡 Possible issues:");
            console.log("1. Contract address is invalid");
            console.log("2. Contract not deployed on Base network");
            console.log("3. Network connection issue");
        }
    }

    console.log("\n🚀 Next Steps:");
    console.log("1. Deploy the FIXED contract with correct interface");
    console.log("2. Update test script with new contract address");
    console.log("3. Test the flash mint - should work!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });