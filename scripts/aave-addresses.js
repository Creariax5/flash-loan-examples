// Official Aave V3 Sepolia Contract Addresses
// Source: https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses

const AAVE_V3_SEPOLIA = {
    // Core Protocol Contracts
    Pool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    PoolAddressesProvider: "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A",
    PoolConfigurator: "0x7Ee6dD7ed72474CE5a8132C7AB07d6b2B814F2B8",
    AaveProtocolDataProvider: "0x3e9708d80f7B3e43118013075F7e95CE3AB31F31",
    
    // Gateways and Helpers
    WrappedTokenGateway: "0x387d311e47e80b498169e6fb51d3193167d89F7D",
    WalletBalanceProvider: "0xCD4e0d6D2b1252E2A709B8aE97DBA31164C5a709",
    UiPoolDataProvider: "0x69529987FA4A075D0C00B0128fa848dc9ebbe9CE",
    UiIncentiveDataProvider: "0xBA25de9a7DC623B30799F33B770d31B44c2e3b77",
    UiGHODataProvider: "0x69B9843A16a6E9933125EBD97659BA3CCbE2Ef8A",
    
    // Access Control and Governance
    ACLManager: "0x7F2b99aa99D7c2dd0259f15b1B7D6dB82c5b4Dd",
    ACLAdmin: "0xfA0e305E0f46AB04f00ab6cbd7D2eeFfC213E000",
    
    // Incentives and Treasury
    DefaultIncentivesController: "0x4DA5c4E1888f78C24b98a1E8fe83d32d0C1c3483",
    IncentivesEmissionManager: "0x098a00C6Afd5eF2f6EE27C19bAF7EDBC8C8C9C62",
    TreasuryCollector: "0x6042D8e2c5f5E900e1EdfF99ac6fBD33A37F980B5",
    
    // Oracle
    AaveOracle: "0x2da88497588bf89281816106C7259e31AF45a663",
    
    // Reserve Assets (with liquidity for flash loans)
    Assets: {
        WETH: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
        USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
        DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
        LINK: "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5",
        USDT: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
        AAVE: "0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a"
    }
};

// Asset decimals for proper formatting
const ASSET_DECIMALS = {
    [AAVE_V3_SEPOLIA.Assets.WETH]: 18,
    [AAVE_V3_SEPOLIA.Assets.USDC]: 6,
    [AAVE_V3_SEPOLIA.Assets.DAI]: 18,
    [AAVE_V3_SEPOLIA.Assets.LINK]: 18,
    [AAVE_V3_SEPOLIA.Assets.USDT]: 6,
    [AAVE_V3_SEPOLIA.Assets.AAVE]: 18
};

// Asset symbols for display
const ASSET_SYMBOLS = {
    [AAVE_V3_SEPOLIA.Assets.WETH]: "WETH",
    [AAVE_V3_SEPOLIA.Assets.USDC]: "USDC",
    [AAVE_V3_SEPOLIA.Assets.DAI]: "DAI",
    [AAVE_V3_SEPOLIA.Assets.LINK]: "LINK",
    [AAVE_V3_SEPOLIA.Assets.USDT]: "USDT",
    [AAVE_V3_SEPOLIA.Assets.AAVE]: "AAVE"
};

module.exports = {
    AAVE_V3_SEPOLIA,
    ASSET_DECIMALS,
    ASSET_SYMBOLS
};