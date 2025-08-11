const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying PodFlashMintTester to Base network...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

    // Deploy the contract
    const PodFlashMintTester = await ethers.getContractFactory("PodFlashMintTester");
    const tester = await PodFlashMintTester.deploy();

    await tester.deployed();

    console.log("✅ PodFlashMintTester deployed to:", tester.address);
    console.log("✅ Transaction hash:", tester.deployTransaction.hash);

    // Wait for a few block confirmations
    console.log("⏳ Waiting for block confirmations...");
    await tester.deployTransaction.wait(3);

    // Get some useful info
    const podETHAddress = await tester.POD_ETH();
    console.log("📋 Pod ETH Address:", podETHAddress);
    console.log("👤 Owner:", await tester.owner());

    console.log("\n📝 Contract Info:");
    console.log("Contract Address:", tester.address);
    console.log("Network: Base");
    console.log("Pod ETH Token:", podETHAddress);

    console.log("\n🧪 Testing Functions Available:");
    console.log("- requestFlashMint(amount)");
    console.log("- calculateFlashMintFee(amount)");
    console.log("- getPodETHBalance()");
    console.log("- canCoverFlashMint(amount)");
    console.log("- depositPodETH(amount)");
    console.log("- emergencyWithdraw(asset)");

    console.log("\n💡 Next Steps:");
    console.log("1. Verify the contract on BaseScan");
    console.log("2. Deposit some podETH to test flash mints");
    console.log("3. Call requestFlashMint(amount) to test");

    // Verify contract on BaseScan
    if (process.env.BASESCAN_API_KEY) {
        console.log("\n🔍 Verifying contract on BaseScan...");
        try {
            await hre.run("verify:verify", {
                address: tester.address,
                constructorArguments: [],
            });
            console.log("✅ Contract verified on BaseScan");
        } catch (error) {
            console.log("❌ Verification failed:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });