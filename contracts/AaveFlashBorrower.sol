// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Aave V3 interfaces based on official documentation
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
    
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes, // 0 = no debt, 1 = stable, 2 = variable
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
    
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

// Official Aave interface for simple flash loans
interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

contract AaveFlashBorrower is IFlashLoanSimpleReceiver, Ownable {
    enum Strategy {
        SIMPLE_TEST,
        ARBITRAGE,
        LIQUIDATION,
        REFINANCING
    }

    IPoolAddressesProvider public immutable addressesProvider;
    IPool public immutable pool;

    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        Strategy strategy,
        bool success
    );

    event EmergencyWithdraw(address indexed asset, uint256 amount);

    constructor(address _addressesProvider) {
        addressesProvider = IPoolAddressesProvider(_addressesProvider);
        pool = IPool(addressesProvider.getPool());
    }

    /**
     * @dev Called by Aave Pool after flash loan is sent to this contract
     * @param asset The address of the flash-borrowed asset
     * @param amount The amount of the flash-borrowed asset
     * @param premium The fee amount for the flash loan
     * @param initiator The address of the flashloan initiator
     * @param params Custom data passed when requesting the flash loan
     * @return True if operation was successful
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Security checks from official documentation
        require(msg.sender == address(pool), "Caller must be Pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Decode strategy from params
        Strategy strategy = abi.decode(params, (Strategy));

        // Verify we received the flash loan amount
        require(
            IERC20(asset).balanceOf(address(this)) >= amount,
            "Did not receive flash loan amount"
        );

        bool success = false;
        
        // Execute your business logic here with the borrowed tokens
        try this._executeStrategy(asset, amount, premium, strategy) {
            success = true;
        } catch {
            // Strategy failed, but we still need to repay the loan
            success = false;
        }

        // Calculate amount to repay (amount + premium)
        uint256 amountToRepay = amount + premium;
        
        // Ensure we have enough balance to repay
        require(
            IERC20(asset).balanceOf(address(this)) >= amountToRepay,
            "Insufficient balance to repay flash loan"
        );

        // Approve pool to pull the repayment
        // This is the key step from the documentation
        IERC20(asset).approve(address(pool), amountToRepay);

        emit FlashLoanExecuted(asset, amount, premium, strategy, success);
        
        return true;
    }

    /**
     * @dev Request a simple flash loan from Aave (single asset)
     * @param asset Address of the asset to borrow
     * @param amount Amount to borrow
     * @param strategy Strategy to execute
     */
    function requestFlashLoanSimple(
        address asset,
        uint256 amount,
        Strategy strategy
    ) external onlyOwner {
        bytes memory params = abi.encode(strategy);
        
        // Call flashLoanSimple as documented
        pool.flashLoanSimple(
            address(this), // receiverAddress
            asset,         // asset to borrow
            amount,        // amount to borrow
            params,        // custom params
            0              // referral code
        );
    }

    /**
     * @dev External function to execute strategy (for try/catch)
     */
    function _executeStrategy(
        address asset,
        uint256 amount,
        uint256 premium,
        Strategy strategy
    ) external {
        require(msg.sender == address(this), "Only self can call");
        
        if (strategy == Strategy.SIMPLE_TEST) {
            _executeSimpleTest(asset, amount, premium);
        } else if (strategy == Strategy.ARBITRAGE) {
            _executeArbitrage(asset, amount, premium);
        } else if (strategy == Strategy.LIQUIDATION) {
            _executeLiquidation(asset, amount, premium);
        } else if (strategy == Strategy.REFINANCING) {
            _executeRefinancing(asset, amount, premium);
        }
    }

    /**
     * @dev Get current Aave flash loan fee rate
     */
    function getFlashLoanPremiumTotal() external view returns (uint256) {
        return pool.FLASHLOAN_PREMIUM_TOTAL();
    }

    /**
     * @dev Calculate flash loan fee for an amount
     */
    function calculateFlashLoanFee(uint256 amount) public view returns (uint256) {
        uint256 premiumTotal = pool.FLASHLOAN_PREMIUM_TOTAL();
        return (amount * premiumTotal) / 10000;
    }

    /**
     * @dev Check if we can afford the flash loan fee
     */
    function canAffordFlashLoan(address asset, uint256 amount) external view returns (bool) {
        uint256 premium = calculateFlashLoanFee(amount);
        uint256 balance = IERC20(asset).balanceOf(address(this));
        return balance >= premium;
    }

    /**
     * @dev Emergency withdraw function - IMPORTANT: Never keep funds permanently!
     * As per documentation: "Never keep funds permanently on your FlashLoanReceiverBase 
     * contract as they could be exposed to a 'griefing' attack"
     */
    function emergencyWithdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        
        IERC20(asset).transfer(owner(), balance);
        emit EmergencyWithdraw(asset, balance);
    }

    // Strategy implementations
    function _executeSimpleTest(address asset, uint256 amount, uint256 premium) private {
        // Simple test: verify we received the tokens and can pay back
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance >= amount, "Flash loan amount not received");
        
        // Simulate some basic operation
        // In practice, this is where you'd implement your DeFi strategy
        
        // Ensure we have enough to pay back (amount + premium)
        require(balance >= amount + premium, "Insufficient balance for repayment");
    }

    function _executeArbitrage(address asset, uint256 amount, uint256 premium) private {
        // TODO: Implement arbitrage logic
        // Example: Buy low on DEX A, sell high on DEX B
        // Ensure profit > premium for profitability
        
        // For now, just a placeholder
        require(
            IERC20(asset).balanceOf(address(this)) >= amount + premium,
            "Arbitrage strategy failed to generate enough profit"
        );
    }

    function _executeLiquidation(address asset, uint256 amount, uint256 premium) private {
        // TODO: Implement liquidation logic
        // Example: Liquidate undercollateralized positions on lending protocols
        
        require(
            IERC20(asset).balanceOf(address(this)) >= amount + premium,
            "Liquidation strategy failed"
        );
    }

    function _executeRefinancing(address asset, uint256 amount, uint256 premium) private {
        // TODO: Implement refinancing logic
        // Example: Pay off high-interest loan, take new loan at better rate
        
        require(
            IERC20(asset).balanceOf(address(this)) >= amount + premium,
            "Refinancing strategy failed"
        );
    }

    /**
     * @dev Get the current Aave Pool address
     */
    function getPool() external view returns (address) {
        return address(pool);
    }

    /**
     * @dev Check contract's balance of a specific token
     */
    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }
}