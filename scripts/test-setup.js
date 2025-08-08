const { ethers } = require('ethers');
const { BASE_ADDRESSES } = require('./addresses');
require('dotenv').config();

async function testConnections() {
    console.log('🧪 Testing Peapods Arbitrage Bot Setup...\n');
    
    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log(`📍 Wallet: ${signer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await provider.getBalance(signer.address))} ETH\n`);
    
    // Test contract addresses
    console.log('🔍 Testing Contract Addresses:');
    console.log('================================');
    
    const contracts = {
        'USDC': BASE_ADDRESSES.USDC,
        'WETH': BASE_ADDRESSES.WETH, 
        'TOAST': BASE_ADDRESSES.TOAST,
        'podTOAST (pToastLVF)': BASE_ADDRESSES.podTOAST,
        'pfUSDC Vault': BASE_ADDRESSES.pfUsdcVault,
        'TOAST/WETH Pair': BASE_ADDRESSES.TOAST_WETH_PAIR,
        'pfUSDC/podTOAST Pair': BASE_ADDRESSES.pfUsdcPodToastPair,
        'Aave AddressesProvider': BASE_ADDRESSES.PoolAddressesProvider,
        'Arbitrage Bot': '0x1a83859496f515c7d147a2f62a20bfa53C48700A'
    };
    
    for (const [name, address] of Object.entries(contracts)) {
        try {
            const code = await provider.getCode(address);
            const hasCode = code !== '0x';
            console.log(`${hasCode ? '✅' : '❌'} ${name}: ${address}`);
        } catch (error) {
            console.log(`❌ ${name}: ${address} (Error: ${error.message})`);
        }
    }
    
    console.log('\n🎯 Testing TOAST/WETH Pair:');
    try {
        const toastWethPair = new ethers.Contract(
            BASE_ADDRESSES.TOAST_WETH_PAIR,
            ['function getReserves() external view returns (uint112, uint112, uint32)', 'function token0() external view returns (address)', 'function token1() external view returns (address)'],
            provider
        );
        
        const reserves = await toastWethPair.getReserves();
        const token0 = await toastWethPair.token0();
        const token1 = await toastWethPair.token1();
        
        console.log(`✅ Token0: ${token0}`);
        console.log(`✅ Token1: ${token1}`);
        console.log(`✅ Reserve0: ${ethers.formatEther(reserves[0])}`);
        console.log(`✅ Reserve1: ${ethers.formatEther(reserves[1])}`);
        
        // Calculate TOAST price in WETH
        const isToken0Toast = token0.toLowerCase() === BASE_ADDRESSES.TOAST.toLowerCase();
        const toastReserve = isToken0Toast ? reserves[0] : reserves[1];
        const wethReserve = isToken0Toast ? reserves[1] : reserves[0];
        
        const toastPriceInWeth = parseFloat(ethers.formatEther(wethReserve)) / parseFloat(ethers.formatEther(toastReserve));
        console.log(`💰 TOAST Price: ${toastPriceInWeth.toFixed(6)} WETH`);
        console.log(`💰 TOAST Price: ~$${(toastPriceInWeth * 2500).toFixed(4)} USD (assuming ETH = $2500)`);
        
    } catch (error) {
        console.log(`❌ Error testing TOAST/WETH pair: ${error.message}`);
    }
    
    console.log('\n🎯 Testing pfUSDC Vault:');
    try {
        const pfUsdcVault = new ethers.Contract(
            BASE_ADDRESSES.pfUsdcVault,
            ['function totalAvailableAssets() external view returns (uint256)', 'function asset() external view returns (address)'],
            provider
        );
        
        const availableAssets = await pfUsdcVault.totalAvailableAssets();
        const asset = await pfUsdcVault.asset();
        
        console.log(`✅ Underlying asset: ${asset}`);
        console.log(`✅ Available assets: ${ethers.formatUnits(availableAssets, 6)} USDC`);
        console.log(`✅ Asset matches USDC: ${asset.toLowerCase() === BASE_ADDRESSES.USDC.toLowerCase()}`);
        
    } catch (error) {
        console.log(`❌ Error testing pfUSDC vault: ${error.message}`);
    }
    
    console.log('\n🎉 Setup Test Complete!');
    console.log('Ready to run arbitrage bot with:');
    console.log('node scripts/arbitrage_js_interface.js');
}

testConnections().catch(console.error);
