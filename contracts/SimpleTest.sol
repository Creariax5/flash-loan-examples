// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleTest {
    uint256 public testValue;
    address public owner;
    
    constructor() {
        testValue = 42;
        owner = msg.sender;
    }
    
    function setValue(uint256 _value) external {
        testValue = _value;
    }
    
    function getValue() external view returns (uint256) {
        return testValue;
    }
}
