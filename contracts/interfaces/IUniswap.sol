// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IUniswap
 * @dev Uniswap V2 Protocol Interfaces
 */

interface IUniswapV2Pair {
    /**
     * @notice Returns the address of token0
     */
    function token0() external view returns (address);
    
    /**
     * @notice Returns the address of token1
     */
    function token1() external view returns (address);
    
    /**
     * @notice Returns the reserves of token0 and token1 used to price trades and distribute liquidity
     * @return reserve0 Reserve of token0
     * @return reserve1 Reserve of token1
     * @return blockTimestampLast Timestamp of last block when reserves were updated
     */
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    
    /**
     * @notice Swap tokens. For regular swaps, data.length must be 0
     * @param amount0Out Amount of token0 to send to 'to'
     * @param amount1Out Amount of token1 to send to 'to'
     * @param to Address to receive the swapped tokens
     * @param data Used for flash swaps. For regular swaps, this should be empty
     */
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface ISimpleV2Swap {
    /**
     * @notice Execute a simple token swap via Uniswap V2
     * @param pool The Uniswap V2 pair address
     * @param tokenA The input token address
     * @param amountIn The amount of tokenA to swap
     */
    function swap(address pool, address tokenA, uint256 amountIn) external;
}
