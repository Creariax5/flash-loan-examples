const { ethers } = require("hardhat");

const SWAP_ADDRESS = "0xfd0d9C4F634745e3CF9a5A2962554bd3f93A86B0";

async function main() {
    const [signer] = await ethers.getSigners();
    const swapper = await ethers.getContractAt("SwapContract", SWAP_ADDRESS);
    const testAmount = ethers.parseEther("0.000001");

    const podETH = await ethers.getContractAt([
        "function balanceOf(address) external view returns (uint256)",
        "function approve(address,uint256) external returns (bool)"
    ], "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C");
    
    const usdc = await ethers.getContractAt([
        "function balanceOf(address) external view returns (uint256)",
        "function approve(address,uint256) external returns (bool)"
    ], "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    
    const vault = await ethers.getContractAt([
        "function balanceOf(address) external view returns (uint256)",
        "function approve(address,uint256) external returns (bool)"
    ], "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04");

    try {
        const vaultBalance = await vault.balanceOf(signer.address);
        console.log("pfUSDC balance:", ethers.formatUnits(vaultBalance, 6));
        
        if (vaultBalance > 0) {
            const swapAmount = vaultBalance > ethers.parseUnits("0.0001", 6) 
                ? ethers.parseUnits("0.0001", 6) 
                : vaultBalance;
            const approveTx = await vault.approve(SWAP_ADDRESS, swapAmount);
            await approveTx.wait();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const tx = await swapper.swapPfUsdcToPodEth(swapAmount);
            await tx.wait();
            console.log("✅ pfUSDC → podETH succeeded!");
        } else {
            console.log("❌ No pfUSDC to swap");
        }
    } catch (error) {
        console.log("❌ pfUSDC → podETH failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const podBalance = await podETH.balanceOf(signer.address);
        console.log("podETH balance:", ethers.formatEther(podBalance));
        
        if (podBalance > 0) {
            const approveTx = await podETH.approve(SWAP_ADDRESS, podBalance);
            await approveTx.wait();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const tx = await swapper.swapPodEthToPfUsdc(podBalance);
            await tx.wait();
            console.log("✅ podETH → pfUSDC succeeded!");
        } else {
            console.log("❌ No podETH to swap");
        }
    } catch (error) {
        console.log("❌ podETH → pfUSDC failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const usdcBalance = await usdc.balanceOf(signer.address);
        console.log("USDC balance:", ethers.formatUnits(usdcBalance, 6));
        
        if (usdcBalance > 0) {
            const swapAmount = usdcBalance > ethers.parseUnits("0.001", 6) 
                ? ethers.parseUnits("0.001", 6) 
                : usdcBalance;
            const approveTx = await usdc.approve(SWAP_ADDRESS, swapAmount);
            await approveTx.wait();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const tx = await swapper.swapUsdcToEth(swapAmount);
            await tx.wait();
            console.log("✅ USDC → ETH succeeded!");
        } else {
            console.log("❌ No USDC to swap");
        }
    } catch (error) {
        console.log("❌ USDC → ETH failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const ethBalance = await ethers.provider.getBalance(signer.address);
        console.log("ETH balance:", ethers.formatEther(ethBalance));
        
        if (ethBalance > testAmount) {
            const tx = await swapper.swapEthToUsdc({value: testAmount});
            await tx.wait();
            console.log("✅ ETH → USDC succeeded!");
        } else {
            console.log("❌ Not enough ETH to swap");
        }
    } catch (error) {
        console.log("❌ ETH → USDC failed:", error.message);
    }
}

main().catch(console.error);