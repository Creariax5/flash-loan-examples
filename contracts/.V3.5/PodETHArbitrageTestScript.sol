// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Minimal interfaces for testing
interface IPfUSDCVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function asset() external view returns (address);
    function totalAvailableAssets() external view returns (uint256);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IPodETH {
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
    function isAsset(address token) external view returns (bool);
}

/**
 * @title PodETHArbitrageTestScript
 * @dev Minimal test contract for podETH arbitrage - optimized for size
 */
contract PodETHArbitrageTestScript is Ownable {
    
    // Contract addresses
    address public usdcToken;
    address public wethToken;
    address public podETH;
    address public pfUSDCVault;
    address public pfUsdcPodEthPair;
    address public wethUsdcPair;
    
    // Events
    event TestStarted(string testName, uint256 inputAmount);
    event TestCompleted(string testName, uint256 outputAmount, uint256 feePercent);
    event TestFailed(string testName, string reason);
    event BalanceCheck(string token, uint256 balance);
    
    constructor() {
        // OpenZeppelin v4.x Ownable sets msg.sender as owner automatically
    }
    
    function setContractAddresses(
        address _usdcToken,
        address _wethToken,
        address _podETH,
        address _pfUSDCVault,
        address _pfUsdcPodEthPair,
        address _wethUsdcPair
    ) external onlyOwner {
        usdcToken = _usdcToken;
        wethToken = _wethToken;
        podETH = _podETH;
        pfUSDCVault = _pfUSDCVault;
        pfUsdcPodEthPair = _pfUsdcPodEthPair;
        wethUsdcPair = _wethUsdcPair;
    }
    
    // Step testing functions
    function testIndividualStep(uint8 stepNumber) external onlyOwner returns (bool success, uint256 outputAmount) {
        require(stepNumber >= 1 && stepNumber <= 4, "Invalid step");
        uint256 testAmount = 100000; // $0.1 USDC
        
        if (stepNumber == 1) {
            return _testStep1(testAmount);
        } else if (stepNumber == 2) {
            (, uint256 pfUsdcAmount) = _testStep1(testAmount);
            return _testStep2(pfUsdcAmount);
        } else if (stepNumber == 3) {
            (, uint256 pfUsdcAmount) = _testStep1(testAmount);
            (, uint256 podEthAmount) = _testStep2(pfUsdcAmount);
            return _testStep3(podEthAmount);
        } else {
            (, uint256 pfUsdcAmount) = _testStep1(testAmount);
            (, uint256 podEthAmount) = _testStep2(pfUsdcAmount);
            (, uint256 wethAmount) = _testStep3(podEthAmount);
            return _testStep4(wethAmount);
        }
    }
    
    function _testStep1(uint256 usdcAmount) internal returns (bool success, uint256 output) {
        emit TestStarted("Step 1: USDC -> pfUSDC", usdcAmount);
        
        try this._executeStep1(usdcAmount) returns (uint256 pfUsdcReceived) {
            success = true;
            output = pfUsdcReceived;
            emit TestCompleted("Step 1: USDC -> pfUSDC", pfUsdcReceived, 0);
        } catch Error(string memory reason) {
            emit TestFailed("Step 1: USDC -> pfUSDC", reason);
        }
    }
    
    function _testStep2(uint256 pfUsdcAmount) internal returns (bool success, uint256 output) {
        emit TestStarted("Step 2: pfUSDC -> podETH", pfUsdcAmount);
        
        try this._executeStep2(pfUsdcAmount) returns (uint256 podEthReceived) {
            success = true;
            output = podEthReceived;
            emit TestCompleted("Step 2: pfUSDC -> podETH", podEthReceived, 0);
        } catch Error(string memory reason) {
            emit TestFailed("Step 2: pfUSDC -> podETH", reason);
        }
    }
    
    function _testStep3(uint256 podEthAmount) internal returns (bool success, uint256 output) {
        emit TestStarted("Step 3: podETH -> WETH", podEthAmount);
        
        try this._executeStep3(podEthAmount) returns (uint256 wethReceived) {
            success = true;
            output = wethReceived;
            emit TestCompleted("Step 3: podETH -> WETH", wethReceived, 0);
        } catch Error(string memory reason) {
            emit TestFailed("Step 3: podETH -> WETH", reason);
        }
    }
    
    function _testStep4(uint256 wethAmount) internal returns (bool success, uint256 output) {
        emit TestStarted("Step 4: WETH -> USDC", wethAmount);
        
        try this._executeStep4(wethAmount) returns (uint256 usdcReceived) {
            success = true;
            output = usdcReceived;
            emit TestCompleted("Step 4: WETH -> USDC", usdcReceived, 0);
        } catch Error(string memory reason) {
            emit TestFailed("Step 4: WETH -> USDC", reason);
        }
    }
    
    // Execution functions
    function _executeStep1(uint256 usdcAmount) external returns (uint256 pfUsdcReceived) {
        require(msg.sender == address(this), "Only self-call");
        
        require(IERC20(usdcToken).balanceOf(address(this)) >= usdcAmount, "Insufficient USDC");
        require(IPfUSDCVault(pfUSDCVault).asset() == usdcToken, "Vault asset mismatch");
        
        IERC20(usdcToken).approve(pfUSDCVault, usdcAmount);
        pfUsdcReceived = IPfUSDCVault(pfUSDCVault).deposit(usdcAmount, address(this));
        require(pfUsdcReceived > 0, "Failed to receive pfUSDC");
        
        emit BalanceCheck("pfUSDC", pfUsdcReceived);
    }
    
    function _executeStep2(uint256 pfUsdcAmount) external returns (uint256 podEthReceived) {
        require(msg.sender == address(this), "Only self-call");
        
        require(IERC20(pfUSDCVault).balanceOf(address(this)) >= pfUsdcAmount, "Insufficient pfUSDC");
        
        IUniswapV2Pair pair = IUniswapV2Pair(pfUsdcPodEthPair);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        require(reserve0 > 0 && reserve1 > 0, "No liquidity");
        
        uint256 podEthOut = _calculateV2SwapOutput(pfUsdcAmount, pfUsdcPodEthPair, pfUSDCVault);
        require(podEthOut > 0, "Insufficient output");
        
        IERC20(pfUSDCVault).transfer(pfUsdcPodEthPair, pfUsdcAmount);
        
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == pfUSDCVault 
            ? (uint256(0), podEthOut) 
            : (podEthOut, uint256(0));
            
        uint256 podEthBefore = IERC20(podETH).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        podEthReceived = IERC20(podETH).balanceOf(address(this)) - podEthBefore;
        
        require(podEthReceived > 0, "Failed to receive podETH");
        emit BalanceCheck("podETH", podEthReceived);
    }
    
    function _executeStep3(uint256 podEthAmount) external returns (uint256 wethReceived) {
        require(msg.sender == address(this), "Only self-call");
        
        require(IERC20(podETH).balanceOf(address(this)) >= podEthAmount, "Insufficient podETH");
        require(IPodETH(podETH).isAsset(wethToken), "WETH not in pod");
        
        address[] memory tokens = new address[](1);
        tokens[0] = wethToken;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        
        uint256 wethBefore = IERC20(wethToken).balanceOf(address(this));
        IPodETH(podETH).debond(podEthAmount, tokens, percentages);
        wethReceived = IERC20(wethToken).balanceOf(address(this)) - wethBefore;
        
        require(wethReceived > 0, "Failed to receive WETH");
        emit BalanceCheck("WETH", wethReceived);
    }
    
    function _executeStep4(uint256 wethAmount) external returns (uint256 usdcReceived) {
        require(msg.sender == address(this), "Only self-call");
        
        require(IERC20(wethToken).balanceOf(address(this)) >= wethAmount, "Insufficient WETH");
        
        IUniswapV2Pair pair = IUniswapV2Pair(wethUsdcPair);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        require(reserve0 > 0 && reserve1 > 0, "No liquidity in WETH/USDC");
        
        uint256 usdcOut = _calculateV2SwapOutput(wethAmount, wethUsdcPair, wethToken);
        require(usdcOut > 0, "Insufficient USDC output");
        
        IERC20(wethToken).transfer(wethUsdcPair, wethAmount);
        
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == wethToken 
            ? (uint256(0), usdcOut) 
            : (usdcOut, uint256(0));
            
        uint256 usdcBefore = IERC20(usdcToken).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        usdcReceived = IERC20(usdcToken).balanceOf(address(this)) - usdcBefore;
        
        require(usdcReceived > 0, "Failed to receive USDC");
        emit BalanceCheck("USDC Final", usdcReceived);
    }
    
    // Helper functions
    function _calculateV2SwapOutput(
        uint256 amountIn,
        address pairAddress,
        address tokenIn
    ) internal view returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        bool isToken0 = pair.token0() == tokenIn;
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    // Full test
    function runFullArbitrageTest() external onlyOwner returns (bool success) {
        uint256 testAmount = 100000; // $0.1 USDC
        
        require(IERC20(usdcToken).balanceOf(address(this)) >= testAmount, "Insufficient USDC");
        emit TestStarted("Full Arbitrage Test", testAmount);
        
        try this._runFullTest(testAmount) returns (uint256 finalAmount) {
            success = finalAmount > 0;
            emit TestCompleted("Full Arbitrage Test", finalAmount, 0);
        } catch Error(string memory reason) {
            emit TestFailed("Full Arbitrage Test", reason);
        }
    }
    
    function _runFullTest(uint256 usdcAmount) external returns (uint256 finalUsdcAmount) {
        require(msg.sender == address(this), "Only self-call");
        
        uint256 pfUsdcAmount = this._executeStep1(usdcAmount);
        uint256 podEthAmount = this._executeStep2(pfUsdcAmount);
        uint256 wethAmount = this._executeStep3(podEthAmount);
        finalUsdcAmount = this._executeStep4(wethAmount);
    }
    
    // View functions
    function getCurrentBalances() external view returns (
        uint256 usdcBalance,
        uint256 pfUsdcBalance,
        uint256 podEthBalance,
        uint256 wethBalance
    ) {
        usdcBalance = IERC20(usdcToken).balanceOf(address(this));
        pfUsdcBalance = IERC20(pfUSDCVault).balanceOf(address(this));
        podEthBalance = IERC20(podETH).balanceOf(address(this));
        wethBalance = IERC20(wethToken).balanceOf(address(this));
    }
    
    function checkVaultCapacity() external view returns (
        uint256 totalAssets,
        uint256 availableAssets,
        uint256 maxDeposit
    ) {
        totalAssets = 0; // Simplified
        availableAssets = IPfUSDCVault(pfUSDCVault).totalAvailableAssets();
        maxDeposit = type(uint256).max;
    }
    
    // Emergency functions
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner(), balance);
        }
    }
    
    function fundWithUSDC(uint256 amount) external onlyOwner {
        IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);
    }
}
