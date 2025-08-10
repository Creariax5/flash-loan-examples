const { ethers } = require("hardhat");

// Base network addresses
const ADDRESSES = {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006", 
    POD_ETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C",
    PF_USDC_VAULT: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04",
    PF_USDC_POD_ETH_PAIR: "0xEd988C42840517989ca99458153fD204899Af09b",
    WETH_USDC_PAIR: "0xd0b53D9277642d899DF5C87A3966A349A798F224"
};

async function main() {
    console.log("🧪 Minimal PodETH Test");
    
    const [deployer] = await ethers.getSigners();
    const network = await deployer.provider.getNetwork();
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString(), ")");
    console.log("Account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    
    // Deploy minimal contract
    console.log("\n🚀 Deploying minimal test contract...");
    const Test = await ethers.getContractFactory("MinimalPodETHTest");
    const test = await Test.deploy({
        gasPrice: ethers.parseUnits("0.001", "gwei"), // Super low gas price
        gasLimit: 500000 // Reasonable limit for small contract
    });
    await test.waitForDeployment();
    
    const contractAddress = await test.getAddress();
    console.log("✅ Deployed to:", contractAddress);
    
    // Get deployment cost
    const deployTx = test.deploymentTransaction();
    if (deployTx) {
        const receipt = await deployTx.wait();
        const cost = receipt.gasUsed * receipt.gasPrice;
        console.log("💰 Deployment cost:", ethers.formatEther(cost), "ETH");
    }
    
    // Setup addresses
    console.log("\n⚙️ Setting up addresses...");
    await test.setup(
        ADDRESSES.USDC,
        ADDRESSES.WETH,
        ADDRESSES.POD_ETH,
        ADDRESSES.PF_USDC_VAULT,
        ADDRESSES.PF_USDC_POD_ETH_PAIR,
        ADDRESSES.WETH_USDC_PAIR,
        {
            gasPrice: ethers.parseUnits("0.001", "gwei"),
            gasLimit: 100000
        }
    );
    
    // Check if we have USDC
    const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");
    
    if (usdcBalance < 100000n) { // Less than $0.1
        console.log("❌ Need at least $0.1 USDC to test");
        console.log("Contract deployed at:", contractAddress);
        console.log("Fund it manually and run individual tests");
        return;
    }
    
    // Fund contract
    console.log("\n💰 Funding contract...");
    await usdc.approve(contractAddress, 100000n, {
        gasPrice: ethers.parseUnits("0.001", "gwei"),
        gasLimit: 50000
    });
    await test.fund({
        gasPrice: ethers.parseUnits("0.001", "gwei"),
        gasLimit: 100000
    });
    
    // Test each step
    console.log("\n🧪 Testing steps...");
    
    try {
        const step1 = await test.testStep1({
            gasPrice: ethers.parseUnits("0.001", "gwei"),
            gasLimit: 200000
        });
        console.log("Step 1 (USDC → pfUSDC):", step1 ? "✅" : "❌");
        
        if (step1) {
            const step2 = await test.testStep2({
                gasPrice: ethers.parseUnits("0.001", "gwei"),
                gasLimit: 200000
            });
            console.log("Step 2 (pfUSDC → podETH):", step2 ? "✅" : "❌");
            
            if (step2) {
                const step3 = await test.testStep3({
                    gasPrice: ethers.parseUnits("0.001", "gwei"),
                    gasLimit: 200000
                });
                console.log("Step 3 (podETH → WETH):", step3 ? "✅" : "❌");
                
                if (step3) {
                    const step4 = await test.testStep4({
                        gasPrice: ethers.parseUnits("0.001", "gwei"),
                        gasLimit: 200000
                    });
                    console.log("Step 4 (WETH → USDC):", step4 ? "✅" : "❌");
                    
                    if (step4) {
                        console.log("\n🎉 ALL STEPS PASSED!");
                    }
                }
            }
        }
    } catch (error) {
        console.error("❌ Test execution failed:", error.message);
    }
    
    // Check final balances
    const balances = await test.balances();
    console.log("\n📊 Final Balances:");
    console.log("USDC:", ethers.formatUnits(balances[0], 6));
    console.log("pfUSDC:", ethers.formatUnits(balances[1], 18));
    console.log("podETH:", ethers.formatUnits(balances[2], 18));
    console.log("WETH:", ethers.formatUnits(balances[3], 18));
    
    console.log("\n📋 Recovery Info:");
    console.log("Contract address:", contractAddress);
    console.log("Use: await contract.withdraw(tokenAddress) to recover funds");
    
    console.log("\n🔍 Manual Testing:");
    console.log("npx hardhat console --network", network.name.toLowerCase());
    console.log(`const test = await ethers.getContractAt("MinimalPodETHTest", "${contractAddress}");`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
