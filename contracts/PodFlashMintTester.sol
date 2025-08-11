// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Pod protocol interface (corrected)
interface IDecentralizedIndex {
    function flashMint(address _recipient, uint256 _amount, bytes calldata _data) external;
}

// Pod uses the same interface for flash loans AND flash mints
interface IFlashLoanRecipient {
    function callback(bytes calldata _data) external;
}

contract PodFlashMintTester is IFlashLoanRecipient, Ownable {
    // Pod contract address (podETH on Base)
    address public constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    
    // Track flash mint state
    uint256 public lastFlashMintAmount;
    uint256 public lastFlashMintFee;
    bool public flashMintInProgress;

    event FlashMintExecuted(
        uint256 amount,
        uint256 fee,
        bool success
    );

    event EmergencyWithdraw(address indexed asset, uint256 amount);

    constructor() {
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Called by Pod contract after flash mint - USES THE CORRECT INTERFACE!
     * Pod calls callback(bytes) for both flash loans and flash mints
     * @param _data Encoded data (we'll decode this to get flash mint details)
     */
    function callback(bytes calldata _data) external override {
        require(msg.sender == POD_ETH, "Caller must be Pod contract");
        require(flashMintInProgress, "No flash mint in progress");

        // Get our current balance (should include the flash minted amount)
        uint256 currentBalance = IERC20(POD_ETH).balanceOf(address(this));
        
        // Calculate the fee (0.1% = amount / 1000, minimum 1)
        uint256 fee = lastFlashMintAmount / 1000;
        fee = fee == 0 ? 1 : fee;
        lastFlashMintFee = fee;

        // Execute simple test logic
        bool success = _executeSimpleLogic(lastFlashMintAmount, fee, currentBalance);

        // Calculate amount to repay (amount + fee)
        uint256 amountToRepay = lastFlashMintAmount + fee;
        
        // Ensure we have enough balance to repay
        require(
            currentBalance >= amountToRepay,
            "Insufficient balance to repay flash mint"
        );

        // Transfer the repayment back to the Pod contract
        // Pod expects: balanceOf(address(this)) >= _balance + _amount + _fee
        IERC20(POD_ETH).transfer(msg.sender, amountToRepay);

        emit FlashMintExecuted(lastFlashMintAmount, fee, success);
    }

    /**
     * @dev Request a flash mint from Pod protocol
     * @param amount Amount of podETH to flash mint
     */
    function requestFlashMint(uint256 amount) external onlyOwner {
        require(!flashMintInProgress, "Flash mint already in progress");
        
        flashMintInProgress = true;
        lastFlashMintAmount = amount;
        
        bytes memory data = abi.encode(amount); // Encode the amount for our callback
        
        try IDecentralizedIndex(POD_ETH).flashMint(
            address(this), // recipient
            amount,        // amount to flash mint
            data          // custom data
        ) {
            // Success - flashMintInProgress will be reset in callback
        } catch {
            // Reset state on failure
            flashMintInProgress = false;
            lastFlashMintAmount = 0;
            revert();
        }
        
        // Reset state after successful completion
        flashMintInProgress = false;
    }

    /**
     * @dev Simple test logic - verify we have the tokens
     */
    function _executeSimpleLogic(
        uint256 amount,
        uint256 fee,
        uint256 balance
    ) private pure returns (bool) {
        require(balance >= amount, "Flash mint amount not received");
        require(balance >= amount + fee, "Insufficient balance for repayment");
        
        // In a real strategy, you would do arbitrage logic here
        // For testing, we just verify the flash mint worked
        return true;
    }

    /**
     * @dev Calculate flash mint fee (0.1% of amount, minimum 1)
     */
    function calculateFlashMintFee(uint256 amount) public pure returns (uint256) {
        uint256 fee = amount / 1000; // 0.1%
        return fee == 0 ? 1 : fee;
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
     * @dev Check if this contract has enough podETH to cover a flash mint FEE
     * Only needs the fee amount, not the full repayment (flash mint provides the principal)
     */
    function canCoverFlashMint(uint256 amount) external view returns (bool) {
        uint256 feeNeeded = calculateFlashMintFee(amount);
        uint256 balance = IERC20(POD_ETH).balanceOf(address(this));
        return balance >= feeNeeded;
    }

    /**
     * @dev Deposit podETH to this contract (for testing purposes)
     * You'll need to approve this contract first
     */
    function depositPodETH(uint256 amount) external onlyOwner {
        IERC20(POD_ETH).transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @dev Reset flash mint state in case of emergency
     */
    function resetFlashMintState() external onlyOwner {
        flashMintInProgress = false;
        lastFlashMintAmount = 0;
        lastFlashMintFee = 0;
    }
}