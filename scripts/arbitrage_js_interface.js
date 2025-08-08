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
        
        this.wethToken = new ethers.Contract(
            contractAddresses.weth,
            ERC20_ABI,
            provider
        );
        
        this.podETH = new ethers.Contract(
            contractAddresses.podETH,
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
        console.log(`🪙 podETH: ${this.addresses.podETH}\n`);
        
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
        const wethPrice = await this.getWethPriceInUsdc();
        const podEthPrice = await this.getPodEthPriceInUsdc();
        
        // 2. Calculate price difference
        const priceDifference = wethPrice - podEthPrice;
        const priceGapPercent = (priceDifference / wethPrice) * 100;
        
        console.log(`WETH Price: $${wethPrice.toFixed(4)}`);
        console.log(`podETH Price: $${podEthPrice.toFixed(4)}`);
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
            wethPrice,
            podEthPrice,
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
     * Get WETH price in USDC terms
     */
    async getWethPriceInUsdc() {
        // Get price from WETH/USDC Uniswap pair
        const pair = new ethers.Contract(
            this.addresses.wethUsdcPair,
            UNISWAP_PAIR_ABI,
            this.provider
        );
        
        const reserves = await pair.getReserves();
        const token0 = await pair.token0();
        
        let wethReserve, usdcReserve;
        if (token0.toLowerCase() === this.addresses.weth.toLowerCase()) {
            wethReserve = reserves[0];
            usdcReserve = reserves[1];
        } else {
            wethReserve = reserves[1];
            usdcReserve = reserves[0];
        }
        
        // Price = USDC reserves / WETH reserves
        const price = parseFloat(ethers.formatUnits(usdcReserve, 6)) / 
                     parseFloat(ethers.formatEther(wethReserve));
        
        return price;
    }

    /**
     * Get podETH price in USDC terms
     */
    async getPodEthPriceInUsdc() {
        // Method 1: Via pfUSDC/podETH pair
        const pair = new ethers.Contract(
            this.addresses.pfUsdcPodEthPair,
            UNISWAP_PAIR_ABI,
            this.provider
        );
        
        const reserves = await pair.getReserves();
        const token0 = await pair.token0();
        
        let pfUsdcReserve, podEthReserve;
        if (token0.toLowerCase() === this.addresses.pfUsdcVault.toLowerCase()) {
            pfUsdcReserve = reserves[0];
            podEthReserve = reserves[1];
        } else {
            pfUsdcReserve = reserves[1];
            podEthReserve = reserves[0];
        }
        
        // Convert pfUSDC to USDC equivalent
        const pfUsdcToUsdc = await this.pfUsdcVault.convertToAssets(pfUsdcReserve);
        
        // Price = USDC equivalent / podETH reserves
        const price = parseFloat(ethers.formatUnits(pfUsdcToUsdc, 6)) / 
                     parseFloat(ethers.formatEther(podEthReserve));
        
        return price;
    }

    /**
     * Calculate optimal flash loan amount based on price gap
     */
    async calculateOptimalFlashLoanAmount(priceGapPercent) {
        // Use your strategy's optimal sizing
        let optimalSize;
        if (priceGapPercent >= 3.0 && priceGapPercent < 4.0) {
            optimalSize = ethers.parseUnits('30000', 6); // $30K
        } else if (priceGapPercent >= 4.0 && priceGapPercent < 5.0) {
            optimalSize = ethers.parseUnits('60000', 6); // $60K
        } else if (priceGapPercent >= 5.0 && priceGapPercent < 6.0) {
            optimalSize = ethers.parseUnits('95000', 6); // $95K
        } else if (priceGapPercent >= 6.0) {
            optimalSize = ethers.parseUnits('150000', 6); // $150K
        } else {
            optimalSize = ethers.parseUnits('10000', 6); // Default smaller size
        }
        
        // Check available liquidity in pfUSDC vault
        const vaultLiquidity = await this.pfUsdcVault.totalAvailableAssets();
        
        // Use max 50% of available liquidity
        const maxAmount = vaultLiquidity / 2n;
        
        return optimalSize < maxAmount ? optimalSize : maxAmount;
    }

    /**
     * Build arbitrage parameters object
     */
    buildArbitrageParams(minProfitAmount) {
        return {
            usdcToken: this.addresses.usdc,
            wethToken: this.addresses.weth,
            usdcVault: this.addresses.pfUsdcVault,
            podETH: this.addresses.podETH,
            pfUsdcPodEthPair: this.addresses.pfUsdcPodEthPair,
            wethUsdcPair: this.addresses.wethUsdcPair,
            minProfitAmount: minProfitAmount,
            maxSlippage: 200 // 2%
        };
    }
}

// Contract addresses configuration
// 🚨 REPLACE THESE WITH YOUR ACTUAL DEPLOYED CONTRACT ADDRESSES
const CONTRACT_ADDRESSES = {
    // Core tokens
    usdc: '0xA0b86a33E6441E60C675f0a5c32a3c5bDdEA5dD8', // USDC token
    weth: '0x4200000000000000000000000000000000000006', // WETH token
    
    // Peapods contracts (created by factories)
    podETH: '0x...', // DecentralizedIndex for WETH (created by WeightedIndexFactory)
    pfUsdcVault: '0x...', // LendingAssetVault for USDC (created by LendingAssetVaultFactory)
    
    // Uniswap V2 pairs
    pfUsdcPodEthPair: '0x...', // pfUSDC/podETH pair
    wethUsdcPair: '0x...', // WETH/USDC pair
    
    // Your deployed arbitrage bot
    arbitrageBot: '0x...', // Your deployed PeapodsArbitrageBot contract
    
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
