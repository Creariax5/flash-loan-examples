// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Aave V3 interfaces
interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
    
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

// Uniswap V2 interfaces
interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

/**
 * @title AaveFlashLoanWithSwap
 * @dev All-in-one contract: Aave flash loans + Uniswap V2 swaps
 */
contract AaveFlashLoanWithSwap is IFlashLoanSimpleReceiver, Ownable, ReentrancyGuard {
    
    // ============ State Variables ============
    
    IPoolAddressesProvider public immutable addressesProvider;
    IPool public immutable pool;

    // ============ Events ============
    
    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        bool success
    );

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        address indexed pool
    );

    event EmergencyWithdraw(address indexed asset, uint256 amount);

    // ============ Structs ============
    
    struct SwapParams {
        address uniswapPool;
        address tokenOut;
        uint256 swapAmount;
    }

    // ============ Constructor ============
    
    constructor(address _addressesProvider) {
        require(_addressesProvider != address(0), "Invalid addresses provider");
        
        addressesProvider = IPoolAddressesProvider(_addressesProvider);
        pool = IPool(addressesProvider.getPool());
        _transferOwnership(msg.sender);
    }

    // ============ Flash Loan Implementation ============

    /**
     * @notice Called by Aave Pool after flash loan is sent to this contract
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        _validateFlashLoanCallback(initiator);
        _verifyFlashLoanReceived(asset, amount);

        // Execute swap logic with the flash loaned tokens
        bool success = _executeSwapLogic(asset, amount, premium, params);

        // Prepare repayment
        uint256 amountToRepay = amount + premium;
        _prepareRepayment(asset, amountToRepay);

        emit FlashLoanExecuted(asset, amount, premium, success);
        return true;
    }

    // ============ External Functions ============

    /**
     * @notice Request a flash loan from Aave with swap parameters
     */
    function requestFlashLoanWithSwap(
        address asset,
        uint256 amount,
        address uniswapPool,
        address tokenOut,
        uint256 swapAmount
    ) external onlyOwner nonReentrant {
        _validateFlashLoanRequest(asset, amount);
        
        SwapParams memory swapParams = SwapParams({
            uniswapPool: uniswapPool,
            tokenOut: tokenOut,
            swapAmount: swapAmount
        });

        bytes memory params = abi.encode(swapParams);
        
        pool.flashLoanSimple(
            address(this), // receiverAddress
            asset,         // asset to borrow
            amount,        // amount to borrow
            params,        // custom params with swap info
            0              // referral code
        );
    }

    /**
     * @notice Request a simple flash loan from Aave (no swap)
     */
    function requestFlashLoan(
        address asset,
        uint256 amount
    ) external onlyOwner nonReentrant {
        _validateFlashLoanRequest(asset, amount);
        
        pool.flashLoanSimple(
            address(this), // receiverAddress
            asset,         // asset to borrow
            amount,        // amount to borrow
            "",            // empty params
            0              // referral code
        );
    }

    // ============ View Functions ============

    /**
     * @notice Calculate flash loan fee for an amount
     */
    function calculateFlashLoanFee(uint256 amount) external view returns (uint256) {
        uint256 premiumTotal = pool.FLASHLOAN_PREMIUM_TOTAL();
        return (amount * premiumTotal) / 10000;
    }

    /**
     * @notice Get contract's balance of a specific token
     */
    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    // ============ Owner Functions ============

    /**
     * @notice Emergency withdraw function
     */
    function emergencyWithdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        IERC20(asset).transfer(owner(), balance);
        emit EmergencyWithdraw(asset, balance);
    }

    // ============ Internal Functions ============

    /**
     * @dev Validate flash loan callback
     */
    function _validateFlashLoanCallback(address initiator) internal view {
        require(msg.sender == address(pool), "Caller must be Pool");
        require(initiator == address(this), "Initiator must be this contract");
    }

    /**
     * @dev Verify we received the flash loan amount
     */
    function _verifyFlashLoanReceived(address asset, uint256 amount) internal view {
        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "Did not receive flash loan amount"
        );
    }

    /**
     * @dev Prepare repayment for flash loan
     */
    function _prepareRepayment(address asset, uint256 amountToRepay) internal {
        require(
            IERC20(asset).balanceOf(address(this)) >= amountToRepay,
            "Insufficient balance to repay flash loan"
        );
        
        IERC20(asset).approve(address(pool), amountToRepay);
    }

    /**
     * @dev Validate flash loan request parameters
     */
    function _validateFlashLoanRequest(address asset, uint256 amount) internal pure {
        require(asset != address(0), "Invalid asset address");
        require(amount > 0, "Amount must be greater than 0");
    }

    /**
     * @dev Execute swap logic with flash loaned tokens
     */
    function _executeSwapLogic(
        address asset,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) internal returns (bool) {
        // If no params provided, just verify balance (no swap)
        if (params.length == 0) {
            return _executeSimpleLogic(asset, amount, premium);
        }

        // Decode swap parameters
        SwapParams memory swapParams = abi.decode(params, (SwapParams));
        
        return _executeSwapWithParams(asset, amount, premium, swapParams);
    }

    /**
     * @dev Execute swap with decoded parameters
     */
    function _executeSwapWithParams(
        address asset,
        uint256 amount,
        uint256 premium,
        SwapParams memory swapParams
    ) internal returns (bool) {
        // Validate swap parameters
        require(swapParams.uniswapPool != address(0), "Invalid Uniswap pool");
        require(swapParams.tokenOut != address(0), "Invalid output token");
        require(swapParams.swapAmount > 0, "Invalid swap amount");
        require(swapParams.swapAmount <= amount, "Swap amount exceeds flash loan amount");

        // Execute the swap (asset → tokenOut)
        _executeUniswapSwap(swapParams.uniswapPool, asset, swapParams.swapAmount);

        // For testing: swap back immediately (tokenOut → asset)
        uint256 tokenOutBalance = IERC20(swapParams.tokenOut).balanceOf(address(this));
        if (tokenOutBalance > 0) {
            _executeUniswapSwap(swapParams.uniswapPool, swapParams.tokenOut, tokenOutBalance);
        }

        emit SwapExecuted(asset, swapParams.tokenOut, swapParams.swapAmount, swapParams.uniswapPool);

        // Verify we can repay the flash loan
        uint256 totalRequired = amount + premium;
        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        
        require(currentBalance >= totalRequired, "Insufficient balance after swap");
        return true;
    }

    /**
     * @dev Execute Uniswap V2 swap
     */
    function _executeUniswapSwap(address pairAddress, address tokenIn, uint256 amountIn) internal {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        
        // Transfer tokens to pair
        IERC20(tokenIn).transfer(pairAddress, amountIn);
        
        // Get reserves and calculate output
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        address token0 = pair.token0();
        bool isToken0 = token0 == tokenIn;
        
        uint256 amountOut = _getAmountOut(
            amountIn, 
            isToken0 ? reserve0 : reserve1, 
            isToken0 ? reserve1 : reserve0
        );
        
        require(amountOut > 0, "Insufficient output amount");
        
        // Execute swap
        if (isToken0) {
            pair.swap(0, amountOut, address(this), "");
        } else {
            pair.swap(amountOut, 0, address(this), "");
        }
    }

    /**
     * @dev Calculate Uniswap V2 output amount
     */
    function _getAmountOut(
        uint256 amountIn, 
        uint256 reserveIn, 
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @dev Simple logic - just verify we have the tokens (no swap)
     */
    function _executeSimpleLogic(
        address asset,
        uint256 amount,
        uint256 premium
    ) internal view returns (bool) {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance >= amount, "Flash loan amount not received");
        require(balance >= amount + premium, "Insufficient balance for repayment");
        return true;
    }
}
