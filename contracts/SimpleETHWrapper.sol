// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IIndexUtils {
    function bond(address _indexFund, address _token, uint256 _amount, uint256 _amountMintMin) external;
}

interface IPodETH {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SimpleETHWrapper {
    address public constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant INDEX_UTILS = 0x490B03C6afe733576cF1f5D2A821cF261B15826d;
    
    receive() external payable {
        IWETH(WETH).deposit{value: msg.value}();
        IWETH(WETH).approve(INDEX_UTILS, msg.value);
        IIndexUtils(INDEX_UTILS).bond(POD_ETH, WETH, msg.value, 0);
        uint256 balance = IPodETH(POD_ETH).balanceOf(address(this));
        IPodETH(POD_ETH).transfer(msg.sender, balance);
    }
}