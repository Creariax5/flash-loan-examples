const { ethers } = require("hardhat");

const PROXY_ADDRESS = "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C";
const IMPLEMENTATION_ADDRESS = "0x74e7cb40ba093b14a23628a5438ff2fc6f9a0e13";

async function main() {
    console.log("🔍 Analyzing Proxy Contract Setup...");

    const [signer] = await ethers.getSigners();
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const parseEther = ethers.parseEther || ethers.utils.parseEther;

    // Check both contracts exist
    const proxyCode = await ethers.provider.getCode(PROXY_ADDRESS);
    const implCode = await ethers.provider.getCode(IMPLEMENTATION_ADDRESS);

    console.log("\n📋 Contract Analysis:");
    console.log("Proxy contract exists:", proxyCode !== "0x");
    console.log("Implementation contract exists:", implCode !== "0x");
    console.log("Proxy address:", PROXY_ADDRESS);
    console.log("Implementation address:", IMPLEMENTATION_ADDRESS);

    // Try to read basic ERC20 info through proxy
    try {
        const erc20Interface = new ethers.Interface([
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function totalSupply() view returns (uint256)",
            "function decimals() view returns (uint8)"
        ]);

        const proxyContract = new ethers.Contract(PROXY_ADDRESS, erc20Interface, signer);
        
        const name = await proxyContract.name();
        const symbol = await proxyContract.symbol();
        const totalSupply = await proxyContract.totalSupply();
        const decimals = await proxyContract.decimals();

        console.log("\n📊 Token Info (via Proxy):");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Decimals:", decimals);
        console.log("Total Supply:", formatEther(totalSupply));

    } catch (error) {
        console.log("❌ Could not read basic token info:", error.message);
    }

    // Test flash mint interface through proxy
    try {
        console.log("\n🧪 Testing Flash Mint Interface...");
        
        const flashInterface = new ethers.Interface([
            "function flashMint(address _recipient, uint256 _amount, bytes calldata _data) external"
        ]);

        const flashContract = new ethers.Contract(PROXY_ADDRESS, flashInterface, signer);
        
        // Try to estimate gas for a very small flash mint
        const testAmount = parseEther("0.00001");
        
        try {
            const gasEstimate = await flashContract.flashMint.estimateGas(
                signer.address, // recipient
                testAmount,
                "0x"
            );
            console.log("✅ Flash mint function accessible! Gas estimate:", gasEstimate.toString());
            
        } catch (gasError) {
            console.log("❌ Flash mint gas estimation failed:", gasError.message);
            
            // Try to decode the error
            if (gasError.data) {
                console.log("Error data:", gasError.data);
                
                // Common error signatures
                const errorSignatures = {
                    "0x08c379a0": "Error(string)", // Generic revert with message
                    "0x4e487b71": "Panic(uint256)", // Panic errors
                };
                
                const errorSig = gasError.data.slice(0, 10);
                if (errorSignatures[errorSig]) {
                    console.log("Error type:", errorSignatures[errorSig]);
                    
                    if (errorSig === "0x08c379a0") {
                        try {
                            let decodedError;
                            if (ethers.AbiCoder) {
                                // ethers v6
                                const abiCoder = ethers.AbiCoder.defaultAbiCoder();
                                decodedError = abiCoder.decode(["string"], "0x" + gasError.data.slice(10));
                            } else {
                                // ethers v5
                                decodedError = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + gasError.data.slice(10));
                            }
                            console.log("Decoded error message:", decodedError[0]);
                        } catch {
                            console.log("Could not decode error message");
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.log("❌ Flash mint interface test failed:", error.message);
    }

    // Check if flash mint function exists by checking function selector
    try {
        console.log("\n🔍 Checking Function Selectors...");
        
        // flashMint(address,uint256,bytes) selector
        const flashMintSelector = "0x40c10f19"; // This might be wrong, let's calculate it
        const correctFlashMintSelector = (ethers.id || ethers.utils.id)("flashMint(address,uint256,bytes)").slice(0, 10);
        
        console.log("Flash mint selector:", correctFlashMintSelector);
        
        // Try calling with the selector
        const result = await ethers.provider.call({
            to: PROXY_ADDRESS,
            data: correctFlashMintSelector + "0".repeat(184) // padded call
        });
        
        console.log("Function call result length:", result.length);
        
    } catch (selectorError) {
        console.log("Function selector test result:", selectorError.message);
    }

    // Let's also check what's the current implementation
    try {
        console.log("\n🔧 Checking Proxy Implementation...");
        
        const implementationCall = await ethers.provider.call({
            to: IMPLEMENTATION_ADDRESS,
            data: "0x5c60da1b" // implementation() function selector
        });
        
        console.log("Implementation call result:", implementationCall);
        
    } catch (error) {
        console.log("Could not check implementation directly");
    }

    console.log("\n💡 Next Steps:");
    console.log("1. The proxy pattern might require specific initialization");
    console.log("2. Flash mint might be disabled or have access controls");
    console.log("3. There might be minimum amounts or other requirements");
    console.log("4. Check the Pod protocol documentation for flash mint usage");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Analysis failed:", error);
        process.exit(1);
    });