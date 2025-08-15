// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IDecentralizedIndex {
    function flashMint(address _recipient, uint256 _amount, bytes calldata _data) external;
}

interface IFlashLoanRecipient {
    function callback(bytes calldata _data) external;
}

interface ISimpleMultiWrapper {
    function wrap() external payable;
    function unwrap(uint256 amount) external;
    function deposit(uint256 amount) external;
    function withdraw(uint256 shares) external;
}

interface IPodETH {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PodFlashMintTester is IFlashLoanRecipient, Ownable {
    address public constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address constant WRAPPER = 0xAdb65cA86cC17BEB094A3B2A094f75642DFA45a2;
    
    uint256 public lastFlashMintAmount;
    uint256 public lastFlashMintFee;
    bool public flashMintInProgress;

    event FlashMintExecuted(uint256 amount, uint256 fee, bool success);
    event EmergencyWithdraw(address indexed asset, uint256 amount);

    constructor() {
        _transferOwnership(msg.sender);
    }

    function callback(bytes calldata _data) external override {
        require(msg.sender == POD_ETH, "Caller must be Pod contract");
        require(flashMintInProgress, "No flash mint in progress");

        uint256 currentBalance = IERC20(POD_ETH).balanceOf(address(this));
        
        uint256 fee = lastFlashMintAmount / 1000;
        fee = fee == 0 ? 1 : fee;
        lastFlashMintFee = fee;

        bool success = _executeSimpleLogic(lastFlashMintAmount, fee, currentBalance);

        uint256 amountToRepay = lastFlashMintAmount + fee;
        
        require(currentBalance >= amountToRepay, "Insufficient balance to repay flash mint");

        IERC20(POD_ETH).transfer(msg.sender, amountToRepay);

        emit FlashMintExecuted(lastFlashMintAmount, fee, success);
    }

    function requestFlashMint(uint256 amount) external onlyOwner {
        require(!flashMintInProgress, "Flash mint already in progress");
        
        flashMintInProgress = true;
        lastFlashMintAmount = amount;
        
        bytes memory data = abi.encode(amount);
        
        try IDecentralizedIndex(POD_ETH).flashMint(address(this), amount, data) {
            // Success
        } catch {
            flashMintInProgress = false;
            lastFlashMintAmount = 0;
            revert();
        }
        
        flashMintInProgress = false;
    }

    function _executeSimpleLogic(uint256 amount, uint256 fee, uint256 balance) private returns (bool) {
        require(balance >= amount, "Flash mint amount not received");
        require(balance >= amount + fee, "Insufficient balance for repayment");
        
        uint256 testAmount = amount / 10; // Use only 10% for testing to ensure enough left for repayment
        uint256 podBalanceBefore = IERC20(POD_ETH).balanceOf(address(this));
        
        IPodETH(POD_ETH).approve(WRAPPER, testAmount);
        ISimpleMultiWrapper(WRAPPER).unwrap(testAmount);
        
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            ISimpleMultiWrapper(WRAPPER).wrap{value: ethBalance}();
        }
        
        uint256 podBalanceAfter = IERC20(POD_ETH).balanceOf(address(this));
        require(podBalanceAfter >= amount + fee, "Not enough POD_ETH after wrap/unwrap cycle");
        
        return true;
    }

    function calculateFlashMintFee(uint256 amount) public pure returns (uint256) {
        uint256 fee = amount / 1000;
        return fee == 0 ? 1 : fee;
    }

    function getTotalRepaymentAmount(uint256 amount) public pure returns (uint256) {
        return amount + calculateFlashMintFee(amount);
    }

    function emergencyWithdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        IERC20(asset).transfer(owner(), balance);
        emit EmergencyWithdraw(asset, balance);
    }

    function getPodETHBalance() external view returns (uint256) {
        return IERC20(POD_ETH).balanceOf(address(this));
    }

    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function canCoverFlashMint(uint256 amount) external view returns (bool) {
        uint256 feeNeeded = calculateFlashMintFee(amount);
        uint256 balance = IERC20(POD_ETH).balanceOf(address(this));
        return balance >= feeNeeded;
    }

    function depositPodETH(uint256 amount) external onlyOwner {
        IERC20(POD_ETH).transferFrom(msg.sender, address(this), amount);
    }

    function resetFlashMintState() external onlyOwner {
        flashMintInProgress = false;
        lastFlashMintAmount = 0;
        lastFlashMintFee = 0;
    }

    function testWrapUnwrapCycle(uint256 podAmount) external payable onlyOwner {
        require(podAmount > 0, "Amount must be > 0");
        
        uint256 podBalanceBefore = IERC20(POD_ETH).balanceOf(address(this));
        uint256 ethBalanceBefore = address(this).balance;
        
        IPodETH(POD_ETH).approve(WRAPPER, podAmount);
        ISimpleMultiWrapper(WRAPPER).unwrap(podAmount);
        
        uint256 ethReceived = address(this).balance - ethBalanceBefore;
        
        if (ethReceived > 0) {
            ISimpleMultiWrapper(WRAPPER).wrap{value: ethReceived}();
        }
        
        uint256 podBalanceAfter = IERC20(POD_ETH).balanceOf(address(this));
        
        emit TestCycleResult(podAmount, ethReceived, podBalanceAfter - podBalanceBefore);
    }

    event TestCycleResult(uint256 podUsed, uint256 ethReceived, uint256 podReceived);
}