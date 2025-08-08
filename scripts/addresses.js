// Base mainnet addresses
const BASE_ADDRESSES = {
    PoolAddressesProvider: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D",
    Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    WETH: "0x4200000000000000000000000000000000000006", // WETH on Base
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",   // DAI on Base
    // podETH related addresses
    podETH: "0x433aA366c4dc76aaB00C02E17531ca1A8570De0C", // podETH contract address
    indexUtils: "0x490b03c6afe733576cf1f5d2a821cf261b15826d", // IndexUtils contract
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
    SEPOLIA_ADDRESSES
};
