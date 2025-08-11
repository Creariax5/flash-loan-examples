// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title UltraMinimalTest
 * @dev Absolutely minimal contract just to test deployment
 */
contract UltraMinimalTest {
    address public owner;
    uint256 public testValue;
    
    constructor() {
        owner = msg.sender;
        testValue = 42;
    }
    
    function setValue(uint256 _value) external {
        require(msg.sender == owner, "Not owner");
        testValue = _value;
    }
    
    function getValue() external view returns (uint256) {
        return testValue;
    }
}
