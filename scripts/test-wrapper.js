const { ethers } = require("hardhat");

const WRAPPER_ADDRESS = "0xAdb65cA86cC17BEB094A3B2A094f75642DFA45a2";

async function main() {
    const [signer] = await ethers.getSigners();
    const wrapper = await ethers.getContractAt("SimpleMultiWrapper", WRAPPER_ADDRESS);
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
        const tx = await wrapper.wrap({value: testAmount});
        await tx.wait();
        console.log("✅ Wrap succeeded!");
    } catch (error) {
        console.log("❌ Wrap failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const podBalance = await podETH.balanceOf(signer.address);
        if (podBalance > 0) {
            await podETH.approve(WRAPPER_ADDRESS, podBalance);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const tx = await wrapper.unwrap(podBalance);
            await tx.wait();
            console.log("✅ Unwrap succeeded!");
        }
    } catch (error) {
        console.log("❌ Unwrap failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const usdcBalance = await usdc.balanceOf(signer.address);
        if (usdcBalance > 0) {
            const depositAmount = usdcBalance > ethers.parseUnits("0.01", 6) 
                ? ethers.parseUnits("0.01", 6) 
                : usdcBalance;
            await usdc.approve(WRAPPER_ADDRESS, depositAmount);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const tx = await wrapper.deposit(depositAmount);
            await tx.wait();
            console.log("✅ Deposit succeeded!");
        }
    } catch (error) {
        console.log("❌ Deposit failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const vaultBalance = await vault.balanceOf(signer.address);
        if (vaultBalance > 0) {
            await vault.approve(WRAPPER_ADDRESS, vaultBalance);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const tx = await wrapper.withdraw(vaultBalance);
            await tx.wait();
            console.log("✅ Withdraw succeeded!");
        }
    } catch (error) {
        console.log("❌ Withdraw failed:", error.message);
    }
}

main().catch(console.error);