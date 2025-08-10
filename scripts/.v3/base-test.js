const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Base podETH Test Deployment");
    
    const [deployer] = await ethers.getSigners();
    const network = await deployer.provider.getNetwork();
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    console.log("Account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    if (network.chainId !== 8453n) {
        console.log("⚠️ Warning: Expected Base mainnet (8453), got", network.chainId.toString());
        console.log("Make sure you're using --network base");
    }
    
    // Deploy contract
    console.log("\n🚀 Deploying BasePodETHTest...");
    const Test = await ethers.getContractFactory("BasePodETHTest");
    const test = await Test.deploy({
        gasPrice: ethers.parseUnits("0.001", "gwei"), // Super low for Base
        gasLimit: 800000 // Should be enough for no-import contract
    });
    await test.waitForDeployment();
    
    const contractAddress = await test.getAddress();
    console.log("✅ Deployed to:", contractAddress);
    
    // Get deployment cost
    const deployTx = test.deploymentTransaction();
    if (deployTx) {
        const receipt = await deployTx.wait();
        const cost = receipt.gasUsed * receipt.gasPrice;
        console.log("💰 Deployment cost:", ethers.formatEther(cost), "ETH (~$" + (parseFloat(ethers.formatEther(cost)) * 2500).toFixed(3) + ")");
        console.log("📊 Gas used:", receipt.gasUsed.toString());
    }
    
    // Check USDC balance
    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("\n💰 USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
    
    if (usdcBalance < 100000n) { // Less than $0.1
        console.log("❌ Need at least $0.1 USDC to test");
        console.log("🔗 Contract:", contractAddress);
        console.log("💡 Fund with USDC then run tests manually:");
        console.log(`   npx hardhat console --network base`);
        console.log(`   const test = await ethers.getContractAt("BasePodETHTest", "${contractAddress}");`);
        console.log(`   await test.fund(); // after approving USDC`);
        console.log(`   await test.testAll();`);
        return;
    }
    
    // Fund contract
    console.log("\n💰 Funding contract with 0.1 USDC...");
    try {
        await usdc.approve(contractAddress, 100000n, {
            gasPrice: ethers.parseUnits("0.001", "gwei"),
            gasLimit: 50000
        });
        await test.fund({
            gasPrice: ethers.parseUnits("0.001", "gwei"),
            gasLimit: 100000
        });
        console.log("✅ Contract funded");
    } catch (error) {
        console.log("❌ Funding failed:", error.message);
        console.log("Try funding manually");
    }
    
    // Test each step
    console.log("\n🧪 Testing podETH arbitrage steps...");
    
    try {
        // Test step 1: USDC → pfUSDC
        console.log("\n1️⃣ Testing USDC → pfUSDC...");
        const step1 = await test.testStep1({
            gasPrice: ethers.parseUnits("0.001", "gwei"),
            gasLimit: 300000
        });
        const receipt1 = await step1.wait();
        const step1Success = receipt1.logs.some(log => {
            try {
                const parsed = test.interface.parseLog(log);
                return parsed.name === "Step" && parsed.args.step === 1 && parsed.args.success;
            } catch { return false; }
        });
        console.log("Result:", step1Success ? "✅ SUCCESS" : "❌ FAILED");
        
        if (step1Success) {
            // Test step 2: pfUSDC → podETH
            console.log("\n2️⃣ Testing pfUSDC → podETH...");
            const step2 = await test.testStep2({
                gasPrice: ethers.parseUnits("0.001", "gwei"),
                gasLimit: 300000
            });
            const receipt2 = await step2.wait();
            const step2Success = receipt2.logs.some(log => {
                try {
                    const parsed = test.interface.parseLog(log);
                    return parsed.name === "Step" && parsed.args.step === 2 && parsed.args.success;
                } catch { return false; }
            });
            console.log("Result:", step2Success ? "✅ SUCCESS" : "❌ FAILED");
            
            if (step2Success) {
                // Test step 3: podETH → WETH
                console.log("\n3️⃣ Testing podETH → WETH...");
                const step3 = await test.testStep3({
                    gasPrice: ethers.parseUnits("0.001", "gwei"),
                    gasLimit: 300000
                });
                const receipt3 = await step3.wait();
                const step3Success = receipt3.logs.some(log => {
                    try {
                        const parsed = test.interface.parseLog(log);
                        return parsed.name === "Step" && parsed.args.step === 3 && parsed.args.success;
                    } catch { return false; }
                });
                console.log("Result:", step3Success ? "✅ SUCCESS" : "❌ FAILED");
                
                if (step3Success) {
                    // Test step 4: WETH → USDC
                    console.log("\n4️⃣ Testing WETH → USDC...");
                    const step4 = await test.testStep4({
                        gasPrice: ethers.parseUnits("0.001", "gwei"),
                        gasLimit: 300000
                    });
                    const receipt4 = await step4.wait();
                    const step4Success = receipt4.logs.some(log => {
                        try {
                            const parsed = test.interface.parseLog(log);
                            return parsed.name === "Step" && parsed.args.step === 4 && parsed.args.success;
                        } catch { return false; }
                    });
                    console.log("Result:", step4Success ? "✅ SUCCESS" : "❌ FAILED");
                    
                    if (step4Success) {
                        console.log("\n🎉 ALL STEPS PASSED! podETH arbitrage is viable!");
                    }
                }
            }
        }
        
        // Show final balances
        console.log("\n📊 Final Balances:");
        const balances = await test.balances();
        console.log("USDC:", ethers.formatUnits(balances[0], 6));
        console.log("pfUSDC:", ethers.formatUnits(balances[1], 18));
        console.log("podETH:", ethers.formatUnits(balances[2], 18));
        console.log("WETH:", ethers.formatUnits(balances[3], 18));
        
    } catch (error) {
        console.log("❌ Test execution failed:", error.message);
    }
    
    console.log("\n📋 Contract Info:");
    console.log("Address:", contractAddress);
    console.log("Network: Base mainnet");
    console.log("Purpose: Test podETH arbitrage strategy");
    
    console.log("\n🔧 Manual Testing:");
    console.log("npx hardhat console --network base");
    console.log(`const test = await ethers.getContractAt("BasePodETHTest", "${contractAddress}");`);
    console.log("await test.balances(); // Check balances");
    console.log("await test.testAll(); // Test all steps");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Failed:", error);
        process.exit(1);
    });
