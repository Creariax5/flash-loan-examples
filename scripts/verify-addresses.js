const { ethers } = require('ethers');
require('dotenv').config();

async function verifyAddresses() {
    console.log('🔍 VERIFYING AND CORRECTING ADDRESSES');
    console.log('====================================\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
    
    // Test known good addresses first
    const knownGoodAddresses = {
        'USDC (correct)': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'WETH (correct)': '0x4200000000000000000000000000000000000006',
        'CIRCLE (provided)': '0x5baBfc2F240bc5De90Eb7e19D789412dB1dEc402',
        'pCircle (provided)': '0x55A81dA2a319dD60fB028c53Cb4419493B56f6c0',
        'pfUSDC vault (provided)': '0x8e792B54A8Ff4D6441DB65e9c52dCe35249732f4'
    };
    
    console.log('🧪 Testing contract interfaces for each address:\n');
    
    for (const [name, address] of Object.entries(knownGoodAddresses)) {
        console.log(`\n🔍 Testing ${name}: ${address}`);
        
        // Check if contract exists
        try {
            const code = await provider.getCode(address);
            if (code === '0x') {
                console.log(`   ❌ No contract code at address`);
                continue;
            } else {
                console.log(`   ✅ Contract code found`);
            }
            
            // Test ERC20 interface
            try {
                const tokenContract = new ethers.Contract(
                    address,
                    [
                        'function name() external view returns (string)',
                        'function symbol() external view returns (string)',
                        'function decimals() external view returns (uint8)',
                        'function totalSupply() external view returns (uint256)'
                    ],
                    provider
                );
                
                const name_result = await tokenContract.name();
                const symbol = await tokenContract.symbol();
                const decimals = await tokenContract.decimals();
                console.log(`   ✅ ERC20: ${name_result} (${symbol}) - ${decimals} decimals`);
            } catch (erc20Error) {
                console.log(`   ❌ ERC20 interface failed: ${erc20Error.message}`);
                
                // Test if it might be a different type
                try {
                    // Test if it's a vault
                    const vaultContract = new ethers.Contract(
                        address,
                        ['function asset() external view returns (address)'],
                        provider
                    );
                    
                    const asset = await vaultContract.asset();
                    console.log(`   ✅ Vault detected! Underlying asset: ${asset}`);
                } catch (vaultError) {
                    console.log(`   ❌ Vault interface failed: ${vaultError.message}`);
                    
                    // Test if it's a pod/index
                    try {
                        const podContract = new ethers.Contract(
                            address,
                            ['function getAllAssets() external view returns (tuple(address,uint256,uint256,address,uint256)[] memory)'],
                            provider
                        );
                        
                        const assets = await podContract.getAllAssets();
                        console.log(`   ✅ Pod detected! Contains ${assets.length} asset(s)`);
                        assets.forEach((asset, i) => {
                            console.log(`     Asset ${i}: ${asset[0]}`);
                        });
                    } catch (podError) {
                        console.log(`   ❌ Pod interface failed: ${podError.message}`);
                    }
                }
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
    
    // Now let's look up correct Base addresses from reliable sources
    console.log('\n\n🔍 LOOKING UP CORRECT BASE MAINNET ADDRESSES');
    console.log('==============================================');
    
    console.log('\n📌 USDC on Base should be: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    console.log('📌 WETH on Base should be: 0x4200000000000000000000000000000000000006');
    
    // Try alternative USDC formats/names
    const alternativeUSDCs = [
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Standard
        '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca' // USDbC (different version)
    ];
    
    console.log('\n🧪 Testing alternative USDC addresses:');
    for (const usdcAddr of alternativeUSDCs) {
        console.log(`\nTesting: ${usdcAddr}`);
        try {
            const contract = new ethers.Contract(
                usdcAddr,
                ['function symbol() external view returns (string)', 'function decimals() external view returns (uint8)'],
                provider
            );
            const symbol = await contract.symbol();
            const decimals = await contract.decimals();
            console.log(`   ✅ ${symbol} - ${decimals} decimals`);
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }
    
    // Check if the provided addresses might be on a different chain
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('===================');
    console.log('1. Verify you are on Base Mainnet (Chain ID: 8453)');
    console.log('2. Double-check addresses from official sources:');
    console.log('   - Base bridge: https://bridge.base.org/');  
    console.log('   - Peapods docs or their contracts');
    console.log('3. Some addresses might be on testnet or different chain');
    
    return true;
}

verifyAddresses().catch(console.error);
