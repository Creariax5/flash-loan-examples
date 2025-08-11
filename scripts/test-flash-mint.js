const { ethers } = require("hardhat");

// Replace with your deployed contract address
const TESTER_CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE";

async function main() {
    console.log("🧪 Testing Pod Flash Mint functionality...");

    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Testing with account:", signer.address);

    // Get contract instances
    const tester = await ethers.getContractAt("PodFlashMintTester", TESTER_CONTRACT_ADDRESS);
    const podETHAddress = await tester.POD_ETH();
    const podETH = await ethers.getContractAt("IERC20", podETHAddress);

    console.log("📋 Contract addresses:");
    console.log("Tester:", tester.address);
    console.log("Pod ETH:", podETHAddress);

    // Check balances
    const userPodETHBalance = await podETH.balanceOf(signer.address);
    const contractPodETHBalance = await tester.getPodETHBalance();

    console.log("\n💰 Current balances:");
    console.log("User podETH:", ethers.utils.formatEther(userPodETHBalance));
    console.log("Contract podETH:", ethers.utils.formatEther(contractPodETHBalance));

    // Test flash mint fee calculation
    const testAmount = ethers.utils.parseEther("1"); // 1 podETH
    const fee = await tester.calculateFlashMintFee(testAmount);
    const totalRepayment = await tester.getTotalRepaymentAmount(testAmount);

    console.log("\n🧮 Flash Mint Calculations (for 1 podETH):");
    console.log("Flash mint amount:", ethers.utils.formatEther(testAmount));
    console.log("Fee (0.1%):", ethers.utils.formatEther(fee));
    console.log("Total repayment:", ethers.utils.formatEther(totalRepayment));

    // Check if we can cover the flash mint
    const canCover = await tester.canCoverFlashMint(testAmount);
    console.log("Can cover flash mint:", canCover);

    if (!canCover && userPodETHBalance.gt(totalRepayment)) {
        console.log("\n💸 Depositing podETH to contract for testing...");
        
        // Approve the contract to spend our podETH
        const approveTx = await podETH.approve(tester.address, totalRepayment);
        await approveTx.wait();
        console.log("✅ Approved contract to spend podETH");

        // Deposit podETH to the contract
        const depositTx = await tester.depositPodETH(totalRepayment);
        await depositTx.wait();
        console.log("✅ Deposited podETH to contract");

        // Check new balance
        const newContractBalance = await tester.getPodETHBalance();
        console.log("New contract balance:", ethers.utils.formatEther(newContractBalance));
    }

    // Perform the flash mint test
    if (await tester.canCoverFlashMint(testAmount)) {
        console.log("\n🚀 Executing flash mint test...");
        
        try {
            const flashMintTx = await tester.requestFlashMint(testAmount);
            console.log("📤 Transaction sent:", flashMintTx.hash);
            
            const receipt = await flashMintTx.wait();
            console.log("✅ Flash mint executed successfully!");
            console.log("Gas used:", receipt.gasUsed.toString());

            // Check for events
            const events = receipt.events?.filter(e => e.event === "FlashMintExecuted");
            if (events && events.length > 0) {
                const event = events[0];
                console.log("\n📊 Flash Mint Event:");
                console.log("Token:", event.args.token);
                console.log("Amount:", ethers.utils.formatEther(event.args.amount));
                console.log("Fee:", ethers.utils.formatEther(event.args.fee));
                console.log("Success:", event.args.success);
            }

            // Check final balance
            const finalBalance = await tester.getPodETHBalance();
            console.log("Final contract balance:", ethers.utils.formatEther(finalBalance));

        } catch (error) {
            console.error("❌ Flash mint failed:", error.message);
            
            // Try to get more details about the error
            if (error.reason) {
                console.error("Reason:", error.reason);
            }
        }
    } else {
        console.log("\n❌ Cannot execute flash mint - insufficient podETH in contract");
        console.log("Need:", ethers.utils.formatEther(totalRepayment));
        console.log("Have:", ethers.utils.formatEther(contractPodETHBalance));
        
        if (userPodETHBalance.lt(totalRepayment)) {
            console.log("❌ User also doesn't have enough podETH");
            console.log("You need to acquire some podETH first to test flash mints");
        }
    }

    console.log("\n✅ Test completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });