const { ethers } = require("hardhat");

async function main() {
    console.log("💰 Base Mainnet Cost Calculator");
    console.log("===============================\n");
    
    // Current Base gas price
    const gasPriceGwei = 0.02; // 0.02 gwei
    const gasPriceWei = ethers.parseUnits(gasPriceGwei.toString(), "gwei");
    
    console.log("Current gas price:", gasPriceGwei, "gwei");
    console.log("Current gas price:", ethers.formatUnits(gasPriceWei, "wei"), "wei\n");
    
    // Estimated gas costs based on our Sepolia deployment
    const deploymentGas = 800000; // Conservative estimate for contract deployment
    const flashLoanGas = 180000;  // Based on our successful test (177,449 gas)
    const transferGas = 21000;    // Standard ETH transfer
    const erc20TransferGas = 65000; // ERC20 transfer
    
    console.log("📊 Estimated Costs:");
    console.log("===================");
    
    // Calculate costs
    const deploymentCost = (deploymentGas * gasPriceGwei) / 1e9; // Convert to ETH
    const flashLoanCost = (flashLoanGas * gasPriceGwei) / 1e9;
    const transferCost = (transferGas * gasPriceGwei) / 1e9;
    const erc20Cost = (erc20TransferGas * gasPriceGwei) / 1e9;
    
    console.log("Contract Deployment:");
    console.log(`  Gas: ${deploymentGas.toLocaleString()}`);
    console.log(`  Cost: ${deploymentCost.toFixed(8)} ETH`);
    console.log(`  Cost: $${(deploymentCost * 2500).toFixed(4)} (assuming ETH = $2500)\n`);
    
    console.log("Flash Loan Execution:");
    console.log(`  Gas: ${flashLoanGas.toLocaleString()}`);
    console.log(`  Cost: ${flashLoanCost.toFixed(8)} ETH`);
    console.log(`  Cost: $${(flashLoanCost * 2500).toFixed(4)} (assuming ETH = $2500)\n`);
    
    console.log("USDC Transfer to Contract:");
    console.log(`  Gas: ${erc20TransferGas.toLocaleString()}`);
    console.log(`  Cost: ${erc20Cost.toFixed(8)} ETH`);
    console.log(`  Cost: $${(erc20Cost * 2500).toFixed(4)} (assuming ETH = $2500)\n`);
    
    const totalCost = deploymentCost + flashLoanCost + erc20Cost;
    console.log("💸 Total Estimated Cost:");
    console.log("========================");
    console.log(`Total ETH: ${totalCost.toFixed(8)} ETH`);
    console.log(`Total USD: $${(totalCost * 2500).toFixed(4)} (assuming ETH = $2500)\n`);
    
    console.log("🔍 Cost Breakdown:");
    console.log("==================");
    console.log("• Deploy contract: One time cost");
    console.log("• Send USDC to contract: One time cost");
    console.log("• Flash loan execution: Per transaction cost");
    console.log("\n💡 Note: These are estimates. Actual costs may vary based on:");
    console.log("• Network congestion");
    console.log("• Gas price fluctuations");
    console.log("• Contract complexity");
    
    // Compare with other networks
    console.log("\n🔄 Network Comparison (same gas amounts):");
    console.log("=========================================");
    
    const ethereumGasPrice = 20; // 20 gwei typical for Ethereum
    const ethereumCost = (deploymentGas * ethereumGasPrice) / 1e9;
    
    console.log(`Base (0.02 gwei): $${(totalCost * 2500).toFixed(4)}`);
    console.log(`Ethereum (~20 gwei): $${(ethereumCost * 2500).toFixed(2)} (1000x more expensive!)`);
    console.log("\n✅ Base is extremely cost-effective for flash loans!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
