const { ethers } = require("hardhat");

async function checkBalance() {
    console.log("💰 Checking current balance on Base...");
    
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    
    console.log(`📍 Address: ${deployer.address}`);
    console.log(`💰 Current balance: ${ethers.formatEther(balance)} ETH`);
    
    // Previous balance was 0.009260030708157032 ETH
    const previousBalance = ethers.parseEther("0.009260030708157032");
    const difference = previousBalance - balance;
    
    console.log(`💸 Gas used: ${ethers.formatEther(difference)} ETH`);
    
    // Convert to USD (rough estimate: 1 ETH = $2500)
    const usdCost = parseFloat(ethers.formatEther(difference)) * 2500;
    console.log(`💵 Estimated cost: ~$${usdCost.toFixed(4)} USD`);
    
    if (difference < ethers.parseEther("0.001")) {
        console.log("✅ Good news: You lost less than $2.50!");
    }
}

checkBalance().catch(console.error);
