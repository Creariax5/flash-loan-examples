// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IAave
 * @dev Aave V3 Protocol Interfaces
 */

interface IPoolAddressesProvider {
    /**
     * @notice Returns the address of the Pool proxy.
     * @return The Pool proxy address
     */
    function getPool() external view returns (address);
}

interface IPool {
    /**
     * @notice Allows smartcontracts to access the liquidity of the pool within one transaction,
     * as long as the amount taken plus a fee is returned.
     * @param receiverAddress The address of the contract receiving the funds
     * @param asset The address of the principal underlying asset to be borrowed
     * @param amount The amount to be borrowed
     * @param params Variadic packed params to pass to the receiver as extra information
     * @param referralCode Code used to register the integrator originating the operation
     */
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
    
    /**
     * @notice Returns the total fee on flash loans
     * @return The total fee expressed in bps
     */
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

interface IFlashLoanSimpleReceiver {
    /**
     * @notice Executes an operation after receiving the flash-borrowed asset
     * @param asset The address of the flash-borrowed asset
     * @param amount The amount of the flash-borrowed asset
     * @param premium The fee of the flash-borrowed asset
     * @param initiator The address of the flashloan initiator
     * @param params The byte-encoded params passed when initiating the flashloan
     * @return True if the execution of the operation succeeds, false otherwise
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
