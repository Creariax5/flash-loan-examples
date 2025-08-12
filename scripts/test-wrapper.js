const { ethers } = require("hardhat");

const TESTER_CONTRACT_ADDRESS = "0xe38433A313CF8770bF8E5DA7b3011B861B762A8F";

async function main() {
    const [signer] = await ethers.getSigners();

    const wrapper = await ethers.getContractAt("SimpleMultiWrapper", TESTER_CONTRACT_ADDRESS);
    const testAmount = ethers.parseEther("0.000001");

    // Setup token contracts with inline interfaces
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

    // Test wrap
    try {
        const tx = await wrapper.wrap({value: testAmount});
        await tx.wait();
        console.log("✅ Wrapping succeeded!");
    } catch (error) {
        console.log("❌ Wrapping failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test unwrap
    try {
        const podBalance = await podETH.balanceOf(signer.address);
        console.log("podETH balance:", ethers.formatEther(podBalance));
        
        if (podBalance > 0) {
            const approveTx = await podETH.approve(TESTER_CONTRACT_ADDRESS, podBalance);
            await approveTx.wait();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const tx = await wrapper.unwrap(podBalance);
            await tx.wait();
            console.log("✅ Unwrap succeeded!");
        } else {
            console.log("❌ No podETH to unwrap");
        }
    } catch (error) {
        console.log("❌ Unwrap failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test deposit
    try {
        const usdcBalance = await usdc.balanceOf(signer.address);
        console.log("USDC balance:", ethers.formatUnits(usdcBalance, 6));
        
        if (usdcBalance > 0) {
            const depositAmount = usdcBalance > ethers.parseUnits("0.1", 6) 
                ? ethers.parseUnits("0.1", 6) 
                : usdcBalance;
                
            const approveTx = await usdc.approve(TESTER_CONTRACT_ADDRESS, depositAmount);
            await approveTx.wait();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const tx = await wrapper.deposit(depositAmount);
            await tx.wait();
            console.log("✅ Deposit succeeded!");
        } else {
            console.log("❌ No USDC to deposit");
        }
    } catch (error) {
        console.log("❌ Deposit failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test withdraw
    try {
        const vaultBalance = await vault.balanceOf(signer.address);
        console.log("pfUSDC balance:", ethers.formatUnits(vaultBalance, 6));
        
        if (vaultBalance > 0) {
            const approveTx = await vault.approve(TESTER_CONTRACT_ADDRESS, vaultBalance);
            await approveTx.wait();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const tx = await wrapper.withdraw(vaultBalance);
            await tx.wait();
            console.log("✅ Withdraw succeeded!");
        } else {
            console.log("❌ No pfUSDC to withdraw");
        }
    } catch (error) {
        console.log("❌ Withdraw failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test swapPfUsdcToPodEth
    try {
        const vaultBalance = await vault.balanceOf(signer.address);
        console.log("pfUSDC balance:", ethers.formatUnits(vaultBalance, 6));
        
        if (vaultBalance > 0) {
            const swapAmount = vaultBalance > ethers.parseUnits("0.001", 6) 
                ? ethers.parseUnits("0.001", 6) 
                : vaultBalance;
                
            const approveTx = await vault.approve(TESTER_CONTRACT_ADDRESS, swapAmount);
            await approveTx.wait();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const tx = await wrapper.swapPfUsdcToPodEth(swapAmount);
            await tx.wait();
            console.log("✅ pfUSDC → podETH swap succeeded!");
        } else {
            console.log("❌ No pfUSDC to swap");
        }
    } catch (error) {
        console.log("❌ pfUSDC → podETH swap failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test swapPodEthToPfUsdc
    try {
        const podBalance = await podETH.balanceOf(signer.address);
        console.log("podETH balance:", ethers.formatEther(podBalance));
        
        if (podBalance > 0) {
            const approveTx = await podETH.approve(TESTER_CONTRACT_ADDRESS, podBalance);
            await approveTx.wait();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const tx = await wrapper.swapPodEthToPfUsdc(podBalance);
            await tx.wait();
            console.log("✅ podETH → pfUSDC swap succeeded!");
        } else {
            console.log("❌ No podETH to swap");
        }
    } catch (error) {
        console.log("❌ podETH → pfUSDC swap failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test swapUsdcToEth
    try {
        const usdcBalance = await usdc.balanceOf(signer.address);
        console.log("USDC balance:", ethers.formatUnits(usdcBalance, 6));
        
        if (usdcBalance > 0) {
            const swapAmount = usdcBalance > ethers.parseUnits("0.01", 6) 
                ? ethers.parseUnits("0.01", 6) 
                : usdcBalance;
                
            const approveTx = await usdc.approve(TESTER_CONTRACT_ADDRESS, swapAmount);
            await approveTx.wait();
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const tx = await wrapper.swapUsdcToEth(swapAmount);
            await tx.wait();
            console.log("✅ USDC → ETH swap succeeded!");
        } else {
            console.log("❌ No USDC to swap");
        }
    } catch (error) {
        console.log("❌ USDC → ETH swap failed:", error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test swapEthToUsdc
    try {
        const ethBalance = await ethers.provider.getBalance(signer.address);
        console.log("ETH balance:", ethers.formatEther(ethBalance));
        
        if (ethBalance > testAmount) {
            const tx = await wrapper.swapEthToUsdc({value: testAmount});
            await tx.wait();
            console.log("✅ ETH → USDC swap succeeded!");
        } else {
            console.log("❌ Not enough ETH to swap");
        }
    } catch (error) {
        console.log("❌ ETH → USDC swap failed:", error.message);
    }
}

main().catch(console.error);