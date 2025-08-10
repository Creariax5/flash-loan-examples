// Base mainnet addresses (for comparison - not optimal)
const BASE_ADDRESSES = {
    PoolAddressesProvider: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D",
    Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    USDbC: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", // USDbC alternative
    WETH: "0x4200000000000000000000000000000000000006", // WETH on Base
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",   // DAI on Base
    
    // OLD peaPEAS setup (Base) - Poor liquidity
    PEAS: "0x02f92800F57BCD74066F5709F1Daa1A4302Df875", // PEAS token  
    peaPEAS: "0x821a80CA29f52216DaE0E919412CbBB0A4CB9631", // peaPEAS pod (low TVL)
    pfpOHMo27: "0x70E0a9F7923988886D62DA8b13415E31Ce27ebb2", // pfpOHMo-27 vault (OHM-based)
    
    // NEW podETH setup (Base) - Good opportunity
    podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C", // podETH token (DecentralizedIndex)
    pfUSDC108: "0xAbE754EE72Be07F2707a26Da0724Ac5619295b04", // pfUSDC-108 vault (LendingAssetVault - ERC4626)
    podETH_pfUSDC_PAIR: "0xEd988C42840517989ca99458153fD204899Af09b", // podETH/pfUSDC-108 LP pair (Uniswap V2)
    spodETH: "0x6f7f8436C9014ab4A26bb4DEcbC457117348a1bE", // spodETH (staked podETH LP tokens)
    aspodETH: "0xF064e1F5617dca198DF8d132eF6e05820436D17e", // aspodETH (AutoCompoundingPodLp vault)
    
    // Peapods utilities
    INDEX_UTILS: "0x490b03c6afe733576cf1f5d2a821cf261b15826d", // IndexUtils contract for bonding/debonding
    
    // Missing addresses we may need to find:
    // ZAPPER: "0x???", // Zapper contract for token conversions
    // LP_STAKING_POOL: "0x???", // podETH LP staking pool address
    // DEX_ADAPTER: "0x???", // DexAdapter used by IndexUtils
    
    // DEX pairs and infrastructure
    WETH_USDC_PAIR: "0xd0b53D9277642d899DF5C87A3966A349A798F224", // Correct WETH/USDC pair on Base
    UNISWAP_V3_FACTORY: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    
    // DEX Routers on Base
    UNISWAP_V3_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap V3 SwapRouter02 on Base
    SUSHISWAP_V2_ROUTER: "0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891", // SushiSwap V2 Router on Base
    BASESWAP_ROUTER: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86", // BaseSwap Router on Base
};

// // Arbitrum addresses (OPTIMAL - $5.3M TVL!)
const ARBITRUM_ADDRESSES = {
    PoolAddressesProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb", // Aave V3 on Arbitrum
    Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool on Arbitrum
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum (native)
    USDbC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC.e on Arbitrum  
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",   // DAI on Arbitrum
    
    // pPEAS arbitrage setup (EXCELLENT OPPORTUNITY - 4.25% gap, $5.3M TVL!)
    PEAS: "0x02f92800F57BCD74066F5709F1Daa1A4302Df875", // PEAS token (same on all chains)
    pPEAS: "0x4548c7fAfeFd9e18dBfd583F2b43b67B3B4D4C0A", // pPEAS pod on Arbitrum
    pfUSDC6: "0x3a87Cf9af4d21778DAD1CE7D0bF053F4b8f2631f", // pfUSDC-6 vault (USDC-based!)
    pPEASPool: "0x66Fd4aE2C975706525D7bF29062D3ECCb1349b9f", // pPEAS/pfUSDC-6 LP
    spPEAS: "0xF590e50f5C69878350b7543F2e45F942A5EB351e", // spPEAS
    aspPEAS: "0x907c40006B43920bbc15e8DDa1C54Dc61c956da4", // aspPEAS
    
    // CRITICAL: PEAS Trading Pools (FOUND!)
    PEAS_WETH_V3_POOL: "0x23D17764F41AEa93fdbb5beffA83571f0bF3f8b2", // PEAS/WETH V3 pool (ACTIVE!)
    PEAS_WETH_FEE: 10000, // 1% fee tier (corrected)
    
    // WETH/USDC pool (for WETH → USDC conversion)
    WETH_USDC_V3_POOL: "0xC6962004f452bE9203591991D15f6b388e09E8D0", // Most liquid WETH/USDC pool
    WETH_USDC_FEE: 0.05, // 0.05% fee tier (most liquid)
    
    // Price info from Peapods (pPEAS on Arbitrum)
    pPEASPodPrice: 5.42, // $5.42 current (UNDERVALUED)
    pPEASFairPrice: 5.65, // $5.65 fair price  
    pPEASGap: 4.25, // 4.25% gap - EXCELLENT!
    pPEASTVL: 5300000, // $5.3M TVL - MASSIVE liquidity!
    
    // pPEAS Fee Structure (BETTER than old peaPEAS!)
    pPEASWrapFee: 0.2,      // 0.2% wrap fee (vs 0.3% before)
    pPEASBuyFee: 2.0,       // 2.0% buy fee  
    pPEASSellFee: 2.0,      // 2.0% sell fee
    pPEASUnwrapFee: 0.8,    // 0.8% unwrap fee (vs 1.2% before)
    
    // Arbitrum Uniswap addresses
    UNISWAP_V3_FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984", // Uniswap V3 Factory on Arbitrum
    UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router on Arbitrum
    
    // Updated Arbitrage Contracts
    OLD_ARBITRAGE_CONTRACT: "0x6adc5701EF1Ea449f3F046EBFF2Fc1c455140d57", // PeaPEASArbitrageBot (BROKEN - wrong PEAS_WETH_FEE=3000)
    ARBITRAGE_CONTRACT: "0xbAc1f16aC416A1b9053f6F85354d653edAde6727", // PeaPEASArbitrageBotCorrected (FIXED - correct fee tiers)
};

// Sepolia addresses (for testing)
const SEPOLIA_ADDRESSES = {
    PoolAddressesProvider: "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A",
    Pool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
    DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357"
};

module.exports = {
    BASE_ADDRESSES,
    ARBITRUM_ADDRESSES,
    SEPOLIA_ADDRESSES
};
