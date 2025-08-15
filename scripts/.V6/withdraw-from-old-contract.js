const { ethers } = require("hardhat");

const CONTRACT_ADDRESS = "0xA98397Ca7DF49C04F611896d8A3892789Bfa9Bd9";
const POD_ETH = "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C";

async function main() {
    const [signer] = await ethers.getSigners();

    const contract = await ethers.getContractAt("DebugArbitrage", CONTRACT_ADDRESS);

    // Check balance before
    const podETH = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", POD_ETH);
    const balanceBefore = await podETH.balanceOf(CONTRACT_ADDRESS);
    
    console.log("Contract podETH balance:", ethers.formatEther(balanceBefore));
    
    if (balanceBefore === 0n) {
        console.log("No podETH to withdraw");
        return;
    }
    
    console.log("Withdrawing podETH...");
    
    const tx = await contract.withdraw(POD_ETH);
    await tx.wait();
    
    console.log("✅ Withdrawal complete:", tx.hash);
    
    // Check balance after
    const balanceAfter = await podETH.balanceOf(CONTRACT_ADDRESS);
    console.log("Remaining balance:", ethers.formatEther(balanceAfter));
}

main().catch(console.error);