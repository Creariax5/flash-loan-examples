const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    
    // Contract addresses
    const SWAP_ADDRESS = "0x880081Ba74Eb121d825F7721FF90F30406DE5163";
    const POD_ETH = "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C";
    const PF_USDC_VAULT = "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04";
    const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    
    // Get contracts
    const swapper = await ethers.getContractAt("SwapContract", SWAP_ADDRESS);
    const podETH = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], POD_ETH);
    const pfUSDC = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], PF_USDC_VAULT);
    const usdc = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], USDC);

    // Test 1: pfUSDC → podETH
    try {
        const pfUsdcBalance = await pfUSDC.balanceOf(signer.address);
        console.log(`pfUSDC balance: ${ethers.formatUnits(pfUsdcBalance, 6)}`);
        
        if (pfUsdcBalance > 0) {
            const amount = ethers.parseUnits("0.0001", 6); // Small amount
            await (await pfUSDC.approve(SWAP_ADDRESS, amount)).wait();
            await (await swapper.swapPfUsdcToPodEth(amount)).wait();
            console.log("✅ pfUSDC → podETH succeeded!");
        }
    } catch (error) {
        console.log("❌ pfUSDC → podETH failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: podETH → pfUSDC
    try {
        const podBalance = await podETH.balanceOf(signer.address);
        console.log(`podETH balance: ${ethers.formatEther(podBalance)}`);
        
        if (podBalance > 0) {
            const amount = ethers.parseUnits("0.00001", 18); // Small amount
            await (await podETH.approve(SWAP_ADDRESS, amount)).wait();
            await (await swapper.swapPodEthToPfUsdc(amount)).wait();
            console.log("✅ podETH → pfUSDC succeeded!");
        }
    } catch (error) {
        console.log("❌ podETH → pfUSDC failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: USDC → ETH
    try {
        const usdcBalance = await usdc.balanceOf(signer.address);
        console.log(`USDC balance: ${ethers.formatUnits(usdcBalance, 6)}`);
        
        if (usdcBalance > 0) {
            const amount = ethers.parseUnits("0.001", 6); // Small amount
            await (await usdc.approve(SWAP_ADDRESS, amount)).wait();
            await (await swapper.swapUsdcToEth(amount)).wait();
            console.log("✅ USDC → ETH succeeded!");
        }
    } catch (error) {
        console.log("❌ USDC → ETH failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: ETH → USDC
    try {
        const ethBalance = await ethers.provider.getBalance(signer.address);
        console.log(`ETH balance: ${ethers.formatEther(ethBalance)}`);
        
        const amount = ethers.parseEther("0.000001"); // Small amount
        if (ethBalance > amount) {
            await (await swapper.swapEthToUsdc({value: amount})).wait();
            console.log("✅ ETH → USDC succeeded!");
        }
    } catch (error) {
        console.log("❌ ETH → USDC failed:", error.message);
    }
}

main().catch(console.error);