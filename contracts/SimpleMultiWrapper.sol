// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IIndexUtils {
    function bond(address _indexFund, address _token, uint256 _amount, uint256 _amountMintMin) external;
}

interface IPodETH {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
}

interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract SimpleMultiWrapper {
    address constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant INDEX_UTILS = 0x490B03C6afe733576cF1f5D2A821cF261B15826d;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PF_USDC_VAULT = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    
    function wrap() external payable {
        IWETH(WETH).deposit{value: msg.value}();
        IWETH(WETH).approve(INDEX_UTILS, msg.value);
        IIndexUtils(INDEX_UTILS).bond(POD_ETH, WETH, msg.value, 0);
        uint256 balance = IPodETH(POD_ETH).balanceOf(address(this));
        IPodETH(POD_ETH).transfer(msg.sender, balance);
    }
    
    function unwrap(uint256 amount) external {
        IPodETH(POD_ETH).transferFrom(msg.sender, address(this), amount);
        address[] memory tokens = new address[](1);
        tokens[0] = WETH;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        IPodETH(POD_ETH).debond(amount, tokens, percentages);
        uint256 wethBalance = IWETH(WETH).balanceOf(address(this));
        IWETH(WETH).withdraw(wethBalance);
        payable(msg.sender).transfer(wethBalance);
    }
    
    function deposit(uint256 amount) external {
        IUSDC(USDC).transferFrom(msg.sender, address(this), amount);
        IUSDC(USDC).approve(PF_USDC_VAULT, amount);
        IVault(PF_USDC_VAULT).deposit(amount, msg.sender);
    }
    
    function withdraw(uint256 shares) external {
        IVault(PF_USDC_VAULT).transferFrom(msg.sender, address(this), shares);
        IVault(PF_USDC_VAULT).redeem(shares, msg.sender, address(this));
    }
}