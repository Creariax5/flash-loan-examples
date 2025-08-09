const { ethers } = require("hardhat");
const { ARBITRUM_ADDRESSES } = require("./addresses.js");

async function main() {
    console.log("🔍 CHECKING DEPLOYED CONTRACT FEE CONSTANTS");
    console.log("=" .repeat(50));
    
    const contractAddress = ARBITRUM_ADDRESSES.ARBITRAGE_CONTRACT;
    console.log("Contract:", contractAddress);
    
    // ABI to read fee constants
    const abi = [
        "function PEAS_WETH_FEE() view returns (uint24)",
        "function WETH_USDC_FEE() view returns (uint24)"
    ];
    
    const contract = new ethers.Contract(contractAddress, abi, ethers.provider);
    
    try {
        const peasWethFee = await contract.PEAS_WETH_FEE();
        const wethUsdcFee = await contract.WETH_USDC_FEE();
        
        console.log("📊 DEPLOYED CONTRACT FEE CONSTANTS:");
        console.log(`PEAS_WETH_FEE: ${peasWethFee} (${Number(peasWethFee)/10000}%)`);
        console.log(`WETH_USDC_FEE: ${wethUsdcFee} (${Number(wethUsdcFee)/10000}%)`);
        
        console.log("\n🔍 ACTUAL POOL VERIFICATION:");
        
        // Check if pools exist with these fees
        const factoryAbi = [
            "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
        ];
        
        const factory = new ethers.Contract(
            "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Uniswap V3 Factory on Arbitrum
            factoryAbi,
            ethers.provider
        );
        
        // Check PEAS/WETH pool with contract's fee
        const peasWethPoolAddress = await factory.getPool(
            ARBITRUM_ADDRESSES.PEAS,
            ARBITRUM_ADDRESSES.WETH,
            peasWethFee
        );
        
        console.log(`PEAS/WETH pool with fee ${peasWethFee}:`, peasWethPoolAddress);
        
        if (peasWethPoolAddress === "0x0000000000000000000000000000000000000000") {
            console.log("❌ PEAS/WETH pool with fee", peasWethFee, "does NOT exist!");
            
            // Check what fee tiers DO exist
            console.log("\n🔍 CHECKING EXISTING PEAS/WETH POOLS:");
            const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
            
            for (const fee of feeTiers) {
                const poolAddr = await factory.getPool(ARBITRUM_ADDRESSES.PEAS, ARBITRUM_ADDRESSES.WETH, fee);
                if (poolAddr !== "0x0000000000000000000000000000000000000000") {
                    console.log(`✅ Fee ${fee} (${fee/10000}%): ${poolAddr}`);
                } else {
                    console.log(`❌ Fee ${fee} (${fee/10000}%): NOT FOUND`);
                }
            }
        } else {
            console.log("✅ PEAS/WETH pool exists!");
        }
        
        // Check WETH/USDC pool with contract's fee
        const wethUsdcPoolAddress = await factory.getPool(
            ARBITRUM_ADDRESSES.WETH,
            ARBITRUM_ADDRESSES.USDC,
            wethUsdcFee
        );
        
        console.log(`WETH/USDC pool with fee ${wethUsdcFee}:`, wethUsdcPoolAddress);
        
        if (wethUsdcPoolAddress === "0x0000000000000000000000000000000000000000") {
            console.log("❌ WETH/USDC pool with fee", wethUsdcFee, "does NOT exist!");
        } else {
            console.log("✅ WETH/USDC pool exists!");
        }
        
    } catch (error) {
        console.error("Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
