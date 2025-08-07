// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IAave.sol";
import "./interfaces/IUniswap.sol";

/**
 * @title AaveFlashBorrower
 * @dev Flash loan contract with integrated Uniswap V2 swap functionality
 * @author Your Team
 */
contract AaveFlashBorrower is IFlashLoanSimpleReceiver, Ownable, ReentrancyGuard {
    
    // ============ State Variables ============
    
    IPoolAddressesProvider public immutable addressesProvider;
    IPool public immutable pool;
    ISimpleV2Swap public immutable swapContract;

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
    
    constructor(address _addressesProvider, address _swapContract) {
        require(_addressesProvider != address(0), "Invalid addresses provider");
        require(_swapContract != address(0), "Invalid swap contract");
        
        addressesProvider = IPoolAddressesProvider(_addressesProvider);
        pool = IPool(addressesProvider.getPool());
        swapContract = ISimpleV2Swap(_swapContract);
        _transferOwnership(msg.sender);
    }

    // ============ Flash Loan Implementation ============

    // ============ Flash Loan Implementation ============

    /**
     * @notice Called by Aave Pool after flash loan is sent to this contract
     * @param asset The address of the flash-borrowed asset
     * @param amount The amount of the flash-borrowed asset
     * @param premium The fee of the flash-borrowed asset
     * @param initiator The address of the flashloan initiator
     * @param params The byte-encoded params passed when initiating the flashloan
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

    // ============ External Functions ============

    /**
     * @notice Request a flash loan from Aave with swap parameters
     * @param asset Asset to flash loan
     * @param amount Amount to borrow
     * @param uniswapPool Uniswap V2 pair address
     * @param tokenOut Token to swap to
     * @param swapAmount Amount to swap
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
     * @param asset Asset to flash loan
     * @param amount Amount to borrow
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
     * @param amount The amount to calculate fee for
     * @return The fee amount
     */
    function calculateFlashLoanFee(uint256 amount) external view returns (uint256) {
        uint256 premiumTotal = pool.FLASHLOAN_PREMIUM_TOTAL();
        return (amount * premiumTotal) / 10000;
    }

    /**
     * @notice Get contract's balance of a specific token
     * @param asset The token address
     * @return The balance
     */
    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    // ============ Owner Functions ============

    /**
     * @notice Emergency withdraw function
     * @param asset The asset to withdraw
     */
    function emergencyWithdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        IERC20(asset).transfer(owner(), balance);
        emit EmergencyWithdraw(asset, balance);
    }

    // ============ Internal Functions ============

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

        // Transfer tokens to swap contract
        IERC20(asset).transfer(address(swapContract), swapParams.swapAmount);

        // Execute the swap
        swapContract.swap(swapParams.uniswapPool, asset, swapParams.swapAmount);

        emit SwapExecuted(asset, swapParams.tokenOut, swapParams.swapAmount, swapParams.uniswapPool);

        // Verify we can repay the flash loan
        uint256 totalRequired = amount + premium;
        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        
        require(currentBalance >= totalRequired, "Insufficient balance after swap");
        return true;
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