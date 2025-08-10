// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title TinyPodETHTest
 * @dev Absolute minimal test - no imports, just basic logic
 */
contract TinyPodETHTest {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // Test if we can call external contracts
    function testCall(address target) external onlyOwner returns (bool success) {
        (success,) = target.call(abi.encodeWithSignature("balanceOf(address)", address(this)));
    }
    
    // Emergency withdrawal
    function withdraw(address token) external onlyOwner {
        // Call transfer function
        (bool success,) = token.call(abi.encodeWithSignature("transfer(address,uint256)", owner, 1));
        require(success, "Transfer failed");
    }
}
