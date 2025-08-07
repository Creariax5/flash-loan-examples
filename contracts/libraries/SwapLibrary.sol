// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SwapLibrary
 * @dev Library containing utility functions for Uniswap V2 calculations
 */
library SwapLibrary {
    /**
     * @notice Calculate output amount for a Uniswap V2 swap
     * @dev Uses the constant product formula: (x + Δx * 0.997) * (y - Δy) = x * y
     * @param amountIn Input amount
     * @param reserveIn Reserve of input token
     * @param reserveOut Reserve of output token
     * @return amountOut Output amount after accounting for 0.3% fee
     */
    function getAmountOut(
        uint256 amountIn, 
        uint256 reserveIn, 
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "SwapLibrary: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SwapLibrary: INSUFFICIENT_LIQUIDITY");
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @notice Calculate input amount for a desired output amount
     * @param amountOut Desired output amount
     * @param reserveIn Reserve of input token
     * @param reserveOut Reserve of output token
     * @return amountIn Required input amount
     */
    function getAmountIn(
        uint256 amountOut, 
        uint256 reserveIn, 
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "SwapLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SwapLibrary: INSUFFICIENT_LIQUIDITY");
        
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }
}
