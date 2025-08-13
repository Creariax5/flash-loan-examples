const { ethers } = require("hardhat");

const CONTRACT_ADDRESS = "0x7C9dc0d95fd50FAbd69191Be7Db37b7548046b32";

async function main() {
    console.log("Checking contract at:", CONTRACT_ADDRESS);
    
    // Check if contract exists
    const code = await ethers.provider.getCode(CONTRACT_ADDRESS);
    console.log("Contract code exists:", code !== "0x");
    console.log("Code length:", code.length);
    
    if (code === "0x") {
        console.log("❌ No contract found at this address");
        return;
    }
    
    // Try different contract interfaces to see what was actually deployed
    const interfaces = [
        "SimpleArbitrage",
        "PodFlashMintTester"  // Maybe you deployed the old one?
    ];
    
    for (const interfaceName of interfaces) {
        try {
            console.log(`\nTrying interface: ${interfaceName}`);
            const contract = await ethers.getContractAt(interfaceName, CONTRACT_ADDRESS);
            
            // Try calling owner() function
            try {
                const owner = await contract.owner();
                console.log(`✓ ${interfaceName} - Owner:`, owner);
            } catch (e) {
                console.log(`❌ ${interfaceName} - No owner() function`);
            }
            
            // Try other functions specific to each interface
            if (interfaceName === "SimpleArbitrage") {
                try {
                    // The SimpleArbitrage should have an arbitrage function
                    // We can't call it, but we can check if the interface matches
                    console.log(`✓ ${interfaceName} interface matches`);
                } catch (e) {
                    console.log(`❌ ${interfaceName} interface doesn't match`);
                }
            }
            
            if (interfaceName === "PodFlashMintTester") {
                try {
                    const canCover = await contract.canCoverFlashMint(ethers.parseEther("0.001"));
                    console.log(`✓ ${interfaceName} - Can cover flash mint:`, canCover);
                } catch (e) {
                    console.log(`❌ ${interfaceName} - No canCoverFlashMint function`);
                }
            }
            
        } catch (error) {
            console.log(`❌ ${interfaceName} interface failed:`, error.message.substring(0, 100));
        }
    }
}

main().catch(console.error);