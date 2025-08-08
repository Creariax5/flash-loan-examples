const { ethers } = require('ethers');

/**
 * Peapods Arbitrage Bot JavaScript Interface
 * 
 * This script demonstrates how to:
 * 1. Set up contract addresses for your specific deployment
 * 2. Monitor for arbitrage opportunities
 * 3. Execute profitable arbitrage trades
 */

class PeapodsArbitrageBot {
    constructor(provider, signer, contractAddresses) {
        this.provider = provider;
        this.signer = signer;
        this.addresses = contractAddresses;
        
        // Initialize contract instances
        this.arbitrageBot = new ethers.Contract(
            contractAddresses.arbitrageBot,
            ARBITRAGE_BOT_ABI,
            signer
        );
        
        this.usdcToken = new ethers.Contract(
            contractAddresses.usdc,
            ERC20_ABI,
            provider
        );
        
        this.toastToken = new ethers.Contract(
            contractAddresses.toast,
            ERC20_ABI,
            provider
        );
        
        this.podTOAST = new ethers.Contract(
            contractAddresses.podTOAST,
            DECENTRALIZED_INDEX_ABI,
            provider
        );
        
        this.pfUsdcVault = new ethers.Contract(
            contractAddresses.pfUsdcVault,
            LENDING_VAULT_ABI,
            provider
        );
    }

    /**
     * Monitor for arbitrage opportunities
     */
    async monitorOpportunities() {
        console.log('🔍 Monitoring arbitrage opportunities...');
        console.log(`📍 Wallet: ${await this.signer.getAddress()}`);
        console.log(`🏦 Arbitrage Bot: ${this.addresses.arbitrageBot}`);
        console.log(`🪙 podTOAST: ${this.addresses.podTOAST}\n`);
        
        setInterval(async () => {
            try {
                const opportunity = await this.checkArbitrageOpportunity();
                if (opportunity.isProfitable) {
                    console.log('💰 Profitable opportunity found!', opportunity);
                    await this.executeArbitrage(opportunity);
                } else {
                    // Only log if there's a reasonable gap but not profitable
                    if (Math.abs(opportunity.priceGapPercent) > 1.0) {
                        console.log(`📊 Gap: ${opportunity.priceGapPercent.toFixed(2)}% (not profitable)`);
                    }
                }
            } catch (error) {
                console.error('Error monitoring opportunities:', error.message);
            }
        }, 10000); // Check every 10 seconds
    }

    /**
     * Check for arbitrage opportunity
     */
    async checkArbitrageOpportunity() {
        // 1. Get current prices
        const toastPrice = await this.getToastPriceInUsdc();
        const podToastPrice = await this.getPodToastPriceInUsdc();
        
        // 2. Calculate price difference
        const priceDifference = toastPrice - podToastPrice;
        const priceGapPercent = (priceDifference / toastPrice) * 100;
        
        console.log(`TOAST Price: $${toastPrice.toFixed(4)}`);
        console.log(`podTOAST Price: $${podToastPrice.toFixed(4)}`);
        console.log(`Price Gap: ${priceGapPercent.toFixed(2)}%`);
        
        // 3. Estimate optimal flash loan amount
        const optimalFlashLoanAmount = await this.calculateOptimalFlashLoanAmount(Math.abs(priceGapPercent));
        
        // 4. Calculate potential profit
        const arbitrageParams = this.buildArbitrageParams(ethers.parseUnits('100', 6)); // Min profit: 100 USDC
        const profitEstimation = await this.arbitrageBot.calculatePotentialProfit(
            optimalFlashLoanAmount,
            arbitrageParams
        );
        
        return {
            toastPrice,
            podToastPrice,
            priceGapPercent,
            optimalFlashLoanAmount,
            estimatedProfit: profitEstimation.estimatedProfit,
            isProfitable: profitEstimation.isProfitable && Math.abs(priceGapPercent) > 2.5 // Minimum 2.5% gap from strategy
        };
    }

    /**
     * Execute arbitrage trade
     */
    async executeArbitrage(opportunity) {
        try {
            console.log('🚀 Executing arbitrage...');
            
            const arbitrageParams = this.buildArbitrageParams(ethers.parseUnits('50', 6)); // Min profit: 50 USDC
            
            // Estimate gas
            const gasEstimate = await this.arbitrageBot.estimateGas.executeArbitrage(
                opportunity.optimalFlashLoanAmount,
                arbitrageParams
            );
            
            const gasPrice = await this.provider.getGasPrice();
            const gasCost = gasEstimate * gasPrice;
            
            console.log(`Gas cost: ${ethers.formatEther(gasCost)} ETH`);
            
            // Execute the arbitrage
            const tx = await this.arbitrageBot.executeArbitrage(
                opportunity.optimalFlashLoanAmount,
                arbitrageParams,
                {
                    gasLimit: gasEstimate * 120n / 100n, // 20% buffer
                    gasPrice: gasPrice * 110n / 100n // 10% higher for faster execution
                }
            );
            
            console.log(`Transaction submitted: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log('✅ Arbitrage executed successfully!');
            
            // Parse events to get actual profit
            const arbitrageEvent = receipt.logs?.find(log => {
                try {
                    const parsed = this.arbitrageBot.interface.parseLog(log);
                    return parsed.name === 'ArbitrageExecuted';
                } catch {
                    return false;
                }
            });
            
            if (arbitrageEvent) {
                const parsed = this.arbitrageBot.interface.parseLog(arbitrageEvent);
                const profit = ethers.formatUnits(parsed.args.profit, 6);
                console.log(`💰 Actual profit: ${profit} USDC`);
            }
            
        } catch (error) {
            console.error('❌ Arbitrage execution failed:', error);
        }
    }

    /**
     * Get TOAST price in USDC terms
     */
    async getToastPriceInUsdc() {
        // Get price from TOAST/USDC Uniswap pair
        const pair = new ethers.Contract(
            this.addresses.toastUsdcPair,
            UNISWAP_PAIR_ABI,
            this.provider
        );
        
        const reserves = await pair.getReserves();
        const token0 = await pair.token0();
        
        let toastReserve, usdcReserve;
        if (token0.toLowerCase() === this.addresses.toast.toLowerCase()) {
            toastReserve = reserves[0];
            usdcReserve = reserves[1];
        } else {
            toastReserve = reserves[1];
            usdcReserve = reserves[0];
        }
        
        // Price = USDC reserves / TOAST reserves
        const price = parseFloat(ethers.formatUnits(usdcReserve, 6)) / 
                     parseFloat(ethers.formatEther(toastReserve));
        
        return price;
    }

    /**
     * Get podTOAST price in USDC terms
     */
    async getPodToastPriceInUsdc() {
        // Method 1: Via pfUSDC-31/podTOAST pair
        const pair = new ethers.Contract(
            this.addresses.pfUsdcPodToastPair,
            UNISWAP_PAIR_ABI,
            this.provider
        );
        
        const reserves = await pair.getReserves();
        const token0 = await pair.token0();
        
        let pfUsdcReserve, podToastReserve;
        if (token0.toLowerCase() === this.addresses.pfUsdcVault.toLowerCase()) {
            pfUsdcReserve = reserves[0];
            podToastReserve = reserves[1];
        } else {
            pfUsdcReserve = reserves[1];
            podToastReserve = reserves[0];
        }
        
        // Convert pfUSDC to USDC equivalent
        const pfUsdcToUsdc = await this.pfUsdcVault.convertToAssets(pfUsdcReserve);
        
        // Price = USDC equivalent / podTOAST reserves
        const price = parseFloat(ethers.formatUnits(pfUsdcToUsdc, 6)) / 
                     parseFloat(ethers.formatEther(podToastReserve));
        
        return price;
    }

    /**
     * Calculate optimal flash loan amount based on price gap
     */
    async calculateOptimalFlashLoanAmount(priceGapPercent) {
        // Conservative sizing for smaller pools
        let optimalSize;
        if (priceGapPercent >= 8.0) {
            optimalSize = ethers.parseUnits('500', 6); // $500 for high gaps
        } else if (priceGapPercent >= 6.0) {
            optimalSize = ethers.parseUnits('300', 6); // $300
        } else if (priceGapPercent >= 4.0) {
            optimalSize = ethers.parseUnits('200', 6); // $200
        } else if (priceGapPercent >= 3.0) {
            optimalSize = ethers.parseUnits('100', 6); // $100
        } else {
            optimalSize = ethers.parseUnits('50', 6); // $50 default
        }
        
        // Check available liquidity in pfUSDC vault
        const vaultLiquidity = await this.pfUsdcVault.totalAvailableAssets();
        
        // Use max 5% of available liquidity (much more conservative)
        const maxAmount = vaultLiquidity / 20n;
        
        return optimalSize < maxAmount ? optimalSize : maxAmount;
    }

    /**
     * Build arbitrage parameters object
     */
    buildArbitrageParams(minProfitAmount) {
        return {
            usdcToken: this.addresses.usdc,
            wethToken: this.addresses.toast, // Using TOAST as the underlying asset
            usdcVault: this.addresses.pfUsdcVault,
            podETH: this.addresses.podTOAST, // Using podTOAST
            pfUsdcPodEthPair: this.addresses.pfUsdcPodToastPair,
            wethUsdcPair: this.addresses.toastUsdcPair,
            minProfitAmount: minProfitAmount,
            maxSlippage: 200 // 2%
        };
    }
}

// Contract addresses configuration - pToastLVF Pod
const CONTRACT_ADDRESSES = {
    // Core tokens
    usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC token
    toast: '0x21f8c472D1702919aF0AF57a9E2926f2c1FB67C5', // TOAST token (underlying asset)
    
    // Peapods contracts
    podTOAST: '0x3bd21199b84Dd0b4d573a58E28E919d8A084c0Cf', // pToastLVF (DecentralizedIndex)
    pfUsdcVault: '0x...', // pfUSDC-31 LendingAssetVault (need to find this address)
    
    // Uniswap V2 pairs
    pfUsdcPodToastPair: '0x6557B01F11d404d4DB9Af94469bF527D394d3072', // pfUSDC-31/pToastLVF pair
    toastUsdcPair: '0x...', // TOAST/USDC pair (need to find this)
    
    // Your deployed arbitrage bot
    arbitrageBot: '0x1a83859496f515c7d147a2f62a20bfa53C48700A', // Deployed on Base mainnet
    
    // Aave
    aaveAddressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb' // Aave AddressesProvider (Base)
};

// Usage example
async function main() {
    // Setup provider and signer (Ethers v6 syntax)
    const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
    const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
    
    // Initialize arbitrage bot
    const bot = new PeapodsArbitrageBot(provider, signer, CONTRACT_ADDRESSES);
    
    // Start monitoring
    await bot.monitorOpportunities();
}

// ABIs (simplified - you'll need the full ABIs)
const ARBITRAGE_BOT_ABI = [
    'function executeArbitrage(uint256 flashLoanAmount, tuple(address,address,address,address,address,address,uint256,uint256) params) external',
    'function calculatePotentialProfit(uint256 flashLoanAmount, tuple(address,address,address,address,address,address,uint256,uint256) params) external view returns (uint256, bool)',
    'event ArbitrageExecuted(uint256 flashLoanAmount, uint256 profit, address indexed executor)'
];

const ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)'
];

const DECENTRALIZED_INDEX_ABI = [
    'function debond(uint256 amount, address[] tokens, uint8[] percentages) external',
    'function totalSupply() external view returns (uint256)'
];

const LENDING_VAULT_ABI = [
    'function convertToAssets(uint256 shares) external view returns (uint256)',
    'function totalAvailableAssets() external view returns (uint256)'
];

const UNISWAP_PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)'
];

module.exports = { PeapodsArbitrageBot, CONTRACT_ADDRESSES };

// Uncomment to run
// main().catch(console.error);
