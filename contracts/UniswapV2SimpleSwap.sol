// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IUniswap.sol";
import "./libraries/SwapLibrary.sol";

/**
 * @title SimpleV2Swap
 * @dev A simple contract for executing Uniswap V2 swaps
 * @author Your Team
 */
contract SimpleV2Swap is ReentrancyGuard {
    using SwapLibrary for uint256;

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed caller
    );

    /**
     * @notice Execute a token swap via Uniswap V2
     * @param pool The Uniswap V2 pair address
     * @param tokenA The input token address
     * @param amountIn The amount of tokenA to swap
     */
    function swap(address pool, address tokenA, uint256 amountIn) external nonReentrant {
        _validateSwapInputs(pool, tokenA, amountIn);
        
        IUniswapV2Pair pair = IUniswapV2Pair(pool);
        
        // Verify we have the tokens to swap
        uint256 balance = IERC20(tokenA).balanceOf(address(this));
        require(balance >= amountIn, "SimpleV2Swap: Insufficient token balance");
        
        // Transfer input tokens to pair
        _safeTransfer(tokenA, pool, amountIn);
        
        // Get reserves and calculate output
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        address token1 = pair.token1();
        bool isToken0 = token0 == tokenA;
        
        uint256 amountOut = SwapLibrary.getAmountOut(
            amountIn, 
            isToken0 ? reserve0 : reserve1, 
            isToken0 ? reserve1 : reserve0
        );
        
        require(amountOut > 0, "SimpleV2Swap: Insufficient output amount");
        
        // Execute swap - send tokens back to calling contract
        if (isToken0) {
            pair.swap(0, amountOut, msg.sender, "");
            emit SwapExecuted(tokenA, token1, amountIn, amountOut, msg.sender);
        } else {
            pair.swap(amountOut, 0, msg.sender, "");
            emit SwapExecuted(tokenA, token0, amountIn, amountOut, msg.sender);
        }
    }
    
    /**
     * @notice Preview the output amount for a given input
     * @param pool The Uniswap V2 pair address
     * @param tokenA The input token address
     * @param amountIn The input amount
     * @return amountOut The expected output amount
     */
    function previewSwapOut(
        address pool, 
        address tokenA, 
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(pool);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        bool isToken0 = pair.token0() == tokenA;
        amountOut = SwapLibrary.getAmountOut(
            amountIn,
            isToken0 ? reserve0 : reserve1,
            isToken0 ? reserve1 : reserve0
        );
    }

    /**
     * @dev Validate swap inputs
     */
    function _validateSwapInputs(address pool, address tokenA, uint256 amountIn) private view {
        require(pool != address(0), "SimpleV2Swap: Invalid pool address");
        require(tokenA != address(0), "SimpleV2Swap: Invalid token address");
        require(amountIn > 0, "SimpleV2Swap: Amount must be greater than 0");
        
        // Verify tokenA is one of the pair tokens
        IUniswapV2Pair pair = IUniswapV2Pair(pool);
        address token0 = pair.token0();
        address token1 = pair.token1();
        require(tokenA == token0 || tokenA == token1, "SimpleV2Swap: Token not in pair");
    }

    /**
     * @dev Safe transfer function
     */
    function _safeTransfer(address token, address to, uint256 amount) private {
        require(IERC20(token).transfer(to, amount), "SimpleV2Swap: Transfer failed");
    }
}
