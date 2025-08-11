// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Pod protocol interface
interface IDecentralizedIndex {
    function flashMint(address _recipient, uint256 _amount, bytes calldata _data) external;
}

interface IFlashMintReceiver {
    function receiveFlashMint(address token, uint256 amount, uint256 fee, bytes calldata data) external;
}

contract PodFlashMintTester is IFlashMintReceiver, Ownable {
    // Pod contract address (podETH on Base)
    address public constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    
    event FlashMintExecuted(
        address indexed token,
        uint256 amount,
        uint256 fee,
        bool success
    );

    event EmergencyWithdraw(address indexed asset, uint256 amount);

    constructor() {
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Called by Pod contract after flash mint is sent to this contract
     * @param token The token that was flash minted (should be POD_ETH)
     * @param amount The amount that was flash minted
     * @param fee The fee that needs to be paid (0.1% of amount)
     */
    function receiveFlashMint(
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override {
        // Security checks
        require(msg.sender == POD_ETH, "Caller must be Pod contract");
        require(token == POD_ETH, "Token must be POD_ETH");

        // Verify we received the flash mint amount
        require(
            IERC20(token).balanceOf(address(this)) >= amount,
            "Did not receive flash mint amount"
        );

        // Execute simple test logic
        bool success = _executeSimpleLogic(token, amount, fee);

        // Calculate amount to repay (amount + fee)
        uint256 amountToRepay = amount + fee;
        
        // Ensure we have enough balance to repay
        require(
            IERC20(token).balanceOf(address(this)) >= amountToRepay,
            "Insufficient balance to repay flash mint"
        );

        // Transfer the repayment back to the Pod contract
        IERC20(token).transfer(msg.sender, amountToRepay);

        emit FlashMintExecuted(token, amount, fee, success);
    }

    /**
     * @dev Request a flash mint from Pod protocol
     * @param amount Amount of podETH to flash mint
     */
    function requestFlashMint(uint256 amount) external onlyOwner {
        bytes memory data = ""; // No special params needed for test
        
        IDecentralizedIndex(POD_ETH).flashMint(
            address(this), // recipient
            amount,        // amount to flash mint
            data          // custom data
        );
    }

    /**
     * @dev Simple test logic - just verify we have the tokens
     */
    function _executeSimpleLogic(
        address token,
        uint256 amount,
        uint256 fee
    ) private view returns (bool) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Flash mint amount not received");
        require(balance >= amount + fee, "Insufficient balance for repayment");
        
        // In a real strategy, you would do arbitrage logic here
        // For testing, we just verify the flash mint worked
        return true;
    }

    /**
     * @dev Calculate flash mint fee (0.1% of amount)
     */
    function calculateFlashMintFee(uint256 amount) public pure returns (uint256) {
        return (amount * 10) / 10000; // 0.1% = 10 basis points
    }

    /**
     * @dev Get the total amount needed for repayment
     */
    function getTotalRepaymentAmount(uint256 amount) public pure returns (uint256) {
        return amount + calculateFlashMintFee(amount);
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
     * @dev Get contract's balance of podETH
     */
    function getPodETHBalance() external view returns (uint256) {
        return IERC20(POD_ETH).balanceOf(address(this));
    }

    /**
     * @dev Get contract's balance of any token
     */
    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    /**
     * @dev Check if this contract has enough podETH to cover a flash mint
     * This is useful for testing - you can deposit some podETH first
     */
    function canCoverFlashMint(uint256 amount) external view returns (bool) {
        uint256 totalNeeded = getTotalRepaymentAmount(amount);
        uint256 balance = IERC20(POD_ETH).balanceOf(address(this));
        return balance >= totalNeeded;
    }

    /**
     * @dev Deposit podETH to this contract (for testing purposes)
     * You'll need to approve this contract first
     */
    function depositPodETH(uint256 amount) external onlyOwner {
        IERC20(POD_ETH).transferFrom(msg.sender, address(this), amount);
    }
}