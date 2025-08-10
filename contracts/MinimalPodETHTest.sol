// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function asset() external view returns (address);
}

interface IPair {
    function token0() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IPod {
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
    function isAsset(address token) external view returns (bool);
}

/**
 * @title MinimalPodETHTest
 * @dev Ultra-minimal test contract - under 24KB limit
 */
contract MinimalPodETHTest {
    
    address public owner;
    address public usdc;
    address public weth;
    address public podETH;
    address public vault;
    address public pair1; // pfUSDC/podETH
    address public pair2; // WETH/USDC
    
    event Step(uint8 step, bool success, string reason);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function setup(
        address _usdc,
        address _weth, 
        address _podETH,
        address _vault,
        address _pair1,
        address _pair2
    ) external onlyOwner {
        usdc = _usdc;
        weth = _weth;
        podETH = _podETH;
        vault = _vault;
        pair1 = _pair1;
        pair2 = _pair2;
    }
    
    function fund() external onlyOwner {
        IERC20(usdc).transferFrom(msg.sender, address(this), 100000); // $0.1
    }
    
    function testStep1() external onlyOwner returns (bool) {
        try this.step1() {
            emit Step(1, true, "");
            return true;
        } catch Error(string memory reason) {
            emit Step(1, false, reason);
            return false;
        }
    }
    
    function testStep2() external onlyOwner returns (bool) {
        try this.step2() {
            emit Step(2, true, "");
            return true;
        } catch Error(string memory reason) {
            emit Step(2, false, reason);
            return false;
        }
    }
    
    function testStep3() external onlyOwner returns (bool) {
        try this.step3() {
            emit Step(3, true, "");
            return true;
        } catch Error(string memory reason) {
            emit Step(3, false, reason);
            return false;
        }
    }
    
    function testStep4() external onlyOwner returns (bool) {
        try this.step4() {
            emit Step(4, true, "");
            return true;
        } catch Error(string memory reason) {
            emit Step(4, false, reason);
            return false;
        }
    }
    
    function step1() external {
        require(msg.sender == address(this));
        uint256 amt = 100000; // $0.1
        require(IERC20(usdc).balanceOf(address(this)) >= amt, "No USDC");
        require(IVault(vault).asset() == usdc, "Wrong vault");
        IERC20(usdc).approve(vault, amt);
        IVault(vault).deposit(amt, address(this));
    }
    
    function step2() external {
        require(msg.sender == address(this));
        uint256 amt = IERC20(vault).balanceOf(address(this));
        require(amt > 0, "No vault shares");
        
        IPair pair = IPair(pair1);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        require(r0 > 0 && r1 > 0, "No liquidity");
        
        bool isToken0 = pair.token0() == vault;
        uint256 reserveIn = isToken0 ? r0 : r1;
        uint256 reserveOut = isToken0 ? r1 : r0;
        
        uint256 amountOut = (amt * 997 * reserveOut) / (reserveIn * 1000 + amt * 997);
        require(amountOut > 0, "No output");
        
        IERC20(vault).transfer(pair1, amt);
        
        if (isToken0) {
            pair.swap(0, amountOut, address(this), "");
        } else {
            pair.swap(amountOut, 0, address(this), "");
        }
    }
    
    function step3() external {
        require(msg.sender == address(this));
        uint256 amt = IERC20(podETH).balanceOf(address(this));
        require(amt > 0, "No podETH");
        require(IPod(podETH).isAsset(weth), "WETH not in pod");
        
        address[] memory tokens = new address[](1);
        tokens[0] = weth;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        
        IPod(podETH).debond(amt, tokens, percentages);
    }
    
    function step4() external {
        require(msg.sender == address(this));
        uint256 amt = IERC20(weth).balanceOf(address(this));
        require(amt > 0, "No WETH");
        
        IPair pair = IPair(pair2);
        (uint112 r0, uint112 r1,) = pair.getReserves();
        require(r0 > 0 && r1 > 0, "No liquidity");
        
        bool isToken0 = pair.token0() == weth;
        uint256 reserveIn = isToken0 ? r0 : r1;
        uint256 reserveOut = isToken0 ? r1 : r0;
        
        uint256 amountOut = (amt * 997 * reserveOut) / (reserveIn * 1000 + amt * 997);
        require(amountOut > 0, "No output");
        
        IERC20(weth).transfer(pair2, amt);
        
        if (isToken0) {
            pair.swap(0, amountOut, address(this), "");
        } else {
            pair.swap(amountOut, 0, address(this), "");
        }
    }
    
    function testAll() external onlyOwner returns (bool) {
        if (!this.testStep1()) return false;
        if (!this.testStep2()) return false;
        if (!this.testStep3()) return false;
        if (!this.testStep4()) return false;
        return true;
    }
    
    function balances() external view returns (uint256, uint256, uint256, uint256) {
        return (
            IERC20(usdc).balanceOf(address(this)),
            IERC20(vault).balanceOf(address(this)),
            IERC20(podETH).balanceOf(address(this)),
            IERC20(weth).balanceOf(address(this))
        );
    }
    
    function withdraw(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) IERC20(token).transfer(owner, bal);
    }
}
