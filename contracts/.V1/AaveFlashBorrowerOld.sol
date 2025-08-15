// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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

contract AaveFlashBorrowerOld is IFlashLoanSimpleReceiver, Ownable {
    IPoolAddressesProvider public immutable addressesProvider;
    IPool public immutable pool;

    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        bool success
    );

    event EmergencyWithdraw(address indexed asset, uint256 amount);

    constructor(address _addressesProvider) {
        addressesProvider = IPoolAddressesProvider(_addressesProvider);
        pool = IPool(addressesProvider.getPool());
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Called by Aave Pool after flash loan is sent to this contract
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata /* params */
    ) external override returns (bool) {
        // Security checks
        require(msg.sender == address(pool), "Caller must be Pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Verify we received the flash loan amount
        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "Did not receive flash loan amount"
        );

        // Execute simple logic - just verify we have the tokens
        bool success = _executeSimpleLogic(asset, amount, premium);

        // Calculate amount to repay (amount + premium)
        uint256 amountToRepay = amount + premium;
        
        // Ensure we have enough balance to repay
        require(
            IERC20(asset).balanceOf(address(this)) >= amountToRepay,
            "Insufficient balance to repay flash loan"
        );

        // Approve pool to pull the repayment
        IERC20(asset).approve(address(pool), amountToRepay);

        emit FlashLoanExecuted(asset, amount, premium, success);
        
        return true;
    }

    /**
     * @dev Request a simple flash loan from Aave
     */
    function requestFlashLoan(
        address asset,
        uint256 amount
    ) external onlyOwner {
        bytes memory params = ""; // No special params needed
        
        pool.flashLoanSimple(
            address(this), // receiverAddress
            asset,         // asset to borrow
            amount,        // amount to borrow
            params,        // custom params
            0              // referral code
        );
    }

    /**
     * @dev Simple logic - just verify we have the tokens
     */
    function _executeSimpleLogic(
        address asset,
        uint256 amount,
        uint256 premium
    ) private view returns (bool) {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance >= amount, "Flash loan amount not received");
        require(balance >= amount + premium, "Insufficient balance for repayment");
        return true;
    }

    /**
     * @dev Calculate flash loan fee for an amount
     */
    function calculateFlashLoanFee(uint256 amount) public view returns (uint256) {
        uint256 premiumTotal = pool.FLASHLOAN_PREMIUM_TOTAL();
        return (amount * premiumTotal) / 10000;
    }

    /**
     * @dev Emergency withdraw function
     */
    function emergencyWithdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        IERC20(asset).transfer(owner(), balance);
        emit EmergencyWithdraw(asset, balance);
    }

    /**
     * @dev Get contract's balance of a specific token
     */
    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }
}