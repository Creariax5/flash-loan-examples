// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Import your existing flash loan contract
import "./AaveFlashLoanWithSwap.sol";

// Peapods interfaces (based on the contracts you showed)
interface ILendingAssetVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function asset() external view returns (address);
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function totalAvailableAssets() external view returns (uint256);
}

interface IDecentralizedIndex {
    function bond(address token, uint256 amount, uint256 amountMintMin) external;
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
    function getAllAssets() external view returns (IndexAssetInfo[] memory);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    
    struct IndexAssetInfo {
        address token;
        uint256 weighting;
        uint256 basePriceUSDX96;
        address c1;
        uint256 q1;
    }
}

/**
 * @title PeapodsArbitrageBot
 * @dev Arbitrage bot for Peapods ecosystem using Aave flash loans
 * 
 * Strategy:
 * 1. Flash loan USDC
 * 2. Deposit USDC → pfUSDC (lending vault shares)
 * 3. Swap pfUSDC → podETH
 * 4. Debond podETH → WETH
 * 5. Swap WETH → USDC
 * 6. Repay flash loan + profit
 */
contract PeapodsArbitrageBot is AaveFlashLoanWithSwap {
    
    // ============ State Variables ============
    
    uint256 public constant MAX_SLIPPAGE = 300; // 3%
    uint256 public constant MIN_PROFIT_BASIS_POINTS = 10; // 0.1% minimum profit
    
    // ============ Events ============
    
    event ArbitrageExecuted(
        uint256 flashLoanAmount,
        uint256 profit,
        address indexed executor
    );
    
    event ArbitrageFailed(
        string reason,
        uint256 flashLoanAmount
    );

    // ============ Structs ============
    
    struct ArbitrageParams {
        address usdcToken;           // USDC token address
        address wethToken;           // WETH token address
        address usdcVault;           // USDC LendingAssetVault (pfUSDC)
        address podETH;              // podETH DecentralizedIndex
        address pfUsdcPodEthPair;    // Uniswap V2 pair: pfUSDC/podETH
        address wethUsdcPair;        // Uniswap V2 pair: WETH/USDC
        uint256 minProfitAmount;     // Minimum profit required
        uint256 maxSlippage;         // Maximum slippage tolerance (basis points)
    }

    // ============ Constructor ============
    
    constructor(address _addressesProvider) AaveFlashLoanWithSwap(_addressesProvider) {}

    // ============ External Functions ============

    /**
     * @notice Execute arbitrage strategy
     * @param flashLoanAmount Amount of USDC to flash loan
     * @param params Arbitrage parameters
     */
    function executeArbitrage(
        uint256 flashLoanAmount,
        ArbitrageParams memory params
    ) external onlyOwner nonReentrant {
        require(flashLoanAmount > 0, "Invalid flash loan amount");
        require(params.usdcToken != address(0), "Invalid USDC address");
        require(params.minProfitAmount > 0, "Invalid min profit");
        
        // Encode arbitrage parameters
        bytes memory data = abi.encode(params);
        
        // Request flash loan with arbitrage data
        pool.flashLoanSimple(
            address(this),
            params.usdcToken,
            flashLoanAmount,
            data,
            0
        );
    }

    /**
     * @notice Calculate potential profit for given parameters (view function)
     */
    function calculatePotentialProfit(
        uint256 flashLoanAmount,
        ArbitrageParams memory params
    ) external view returns (uint256 estimatedProfit, bool isProfitable) {
        // This is a simplified estimation - actual profits may vary due to slippage
        uint256 flashLoanFee = this.calculateFlashLoanFee(flashLoanAmount);
        uint256 totalCost = flashLoanAmount + flashLoanFee;
        
        // Simulate the arbitrage path (simplified)
        uint256 estimatedUsdcOut = _simulateArbitragePath(flashLoanAmount, params);
        
        if (estimatedUsdcOut > totalCost) {
            estimatedProfit = estimatedUsdcOut - totalCost;
            isProfitable = estimatedProfit >= params.minProfitAmount;
        } else {
            estimatedProfit = 0;
            isProfitable = false;
        }
    }

    // ============ Flash Loan Override ============

    /**
     * @notice Execute arbitrage logic during flash loan callback
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        _validateFlashLoanCallback(initiator);
        
        // Decode arbitrage parameters
        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));
        
        // Execute arbitrage strategy
        bool success = _executeArbitrageStrategy(asset, amount, premium, arbParams);
        
        if (!success) {
            emit ArbitrageFailed("Arbitrage execution failed", amount);
            // Still need to repay flash loan
        }
        
        // Prepare repayment
        uint256 amountToRepay = amount + premium;
        _prepareRepayment(asset, amountToRepay);
        
        return true;
    }

    // ============ Internal Functions ============

    /**
     * @dev Execute the complete arbitrage strategy
     */
    function _executeArbitrageStrategy(
        address asset,
        uint256 amount,
        uint256 premium,
        ArbitrageParams memory params
    ) internal returns (bool) {
        try this._internalArbitrageExecution(asset, amount, premium, params) {
            return true;
        } catch Error(string memory reason) {
            emit ArbitrageFailed(reason, amount);
            return false;
        } catch {
            emit ArbitrageFailed("Unknown error during arbitrage", amount);
            return false;
        }
    }

    /**
     * @dev Internal arbitrage execution that can be called with try-catch
     */
    function _internalArbitrageExecution(
        address /* asset */,
        uint256 amount,
        uint256 premium,
        ArbitrageParams memory params
    ) external {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Step 1: Deposit USDC → pfUSDC
        uint256 pfUsdcShares = _depositUsdcForPfUsdc(amount, params);
        
        // Step 2: Swap pfUSDC → podETH
        uint256 podEthAmount = _swapPfUsdcToPodEth(pfUsdcShares, params);
        
        // Step 3: Debond podETH → WETH
        uint256 wethAmount = _debondPodEthToWeth(podEthAmount, params);
        
        // Step 4: Swap WETH → USDC
        uint256 usdcReceived = _swapWethToUsdc(wethAmount, params);
        
        // Step 5: Verify profitability
        uint256 totalRequired = amount + premium;
        require(usdcReceived >= totalRequired, "Insufficient USDC for repayment");
        
        uint256 profit = usdcReceived - totalRequired;
        require(profit >= params.minProfitAmount, "Profit below minimum threshold");
        
        emit ArbitrageExecuted(amount, profit, tx.origin);
    }

    /**
     * @dev Step 1: Deposit USDC into lending vault to get pfUSDC shares
     */
    function _depositUsdcForPfUsdc(
        uint256 usdcAmount,
        ArbitrageParams memory params
    ) internal returns (uint256 pfUsdcShares) {
        IERC20(params.usdcToken).approve(params.usdcVault, usdcAmount);
        pfUsdcShares = ILendingAssetVault(params.usdcVault).deposit(usdcAmount, address(this));
        require(pfUsdcShares > 0, "Failed to receive pfUSDC shares");
    }

    /**
     * @dev Step 2: Swap pfUSDC → podETH on Uniswap V2
     */
    function _swapPfUsdcToPodEth(
        uint256 pfUsdcAmount,
        ArbitrageParams memory params
    ) internal returns (uint256 podEthReceived) {
        IUniswapV2Pair pair = IUniswapV2Pair(params.pfUsdcPodEthPair);
        
        // Transfer pfUSDC to pair
        address pfUsdcToken = params.usdcVault; // pfUSDC is the vault shares token
        IERC20(pfUsdcToken).transfer(params.pfUsdcPodEthPair, pfUsdcAmount);
        
        // Calculate output amount with slippage protection
        uint256 podEthOut = _calculateSwapOutput(
            pfUsdcAmount,
            params.pfUsdcPodEthPair,
            pfUsdcToken,
            params.podETH
        );
        
        uint256 minPodEthOut = (podEthOut * (10000 - params.maxSlippage)) / 10000;
        
        // Execute swap
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == pfUsdcToken 
            ? (uint256(0), podEthOut) 
            : (podEthOut, uint256(0));
            
        uint256 podEthBefore = IERC20(params.podETH).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        podEthReceived = IERC20(params.podETH).balanceOf(address(this)) - podEthBefore;
        
        require(podEthReceived >= minPodEthOut, "Excessive slippage in pfUSDC->podETH swap");
    }

    /**
     * @dev Step 3: Debond podETH to get WETH back
     * @notice Single-asset pod - guaranteed to return 100% WETH
     */
    function _debondPodEthToWeth(
        uint256 podEthAmount,
        ArbitrageParams memory params
    ) internal returns (uint256 wethReceived) {
        // Single-asset pod: debond 100% to WETH
        address[] memory tokens = new address[](1);
        uint8[] memory percentages = new uint8[](1);
        tokens[0] = params.wethToken;
        percentages[0] = 100;
        
        uint256 wethBefore = IERC20(params.wethToken).balanceOf(address(this));
        
        // Execute debond - guaranteed WETH output for single-asset pod
        IDecentralizedIndex(params.podETH).debond(podEthAmount, tokens, percentages);
        
        wethReceived = IERC20(params.wethToken).balanceOf(address(this)) - wethBefore;
        require(wethReceived > 0, "Failed to receive WETH from single-asset pod debond");
    }

    /**
     * @dev Step 4: Swap WETH → USDC on Uniswap V2
     */
    function _swapWethToUsdc(
        uint256 wethAmount,
        ArbitrageParams memory params
    ) internal returns (uint256 usdcReceived) {
        IUniswapV2Pair pair = IUniswapV2Pair(params.wethUsdcPair);
        
        // Transfer WETH to pair
        IERC20(params.wethToken).transfer(params.wethUsdcPair, wethAmount);
        
        // Calculate output amount with slippage protection
        uint256 usdcOut = _calculateSwapOutput(
            wethAmount,
            params.wethUsdcPair,
            params.wethToken,
            params.usdcToken
        );
        
        uint256 minUsdcOut = (usdcOut * (10000 - params.maxSlippage)) / 10000;
        
        // Execute swap
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == params.wethToken 
            ? (uint256(0), usdcOut) 
            : (usdcOut, uint256(0));
            
        uint256 usdcBefore = IERC20(params.usdcToken).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        usdcReceived = IERC20(params.usdcToken).balanceOf(address(this)) - usdcBefore;
        
        require(usdcReceived >= minUsdcOut, "Excessive slippage in WETH->USDC swap");
    }

    /**
     * @dev Calculate Uniswap V2 output amount
     */
    function _calculateSwapOutput(
        uint256 amountIn,
        address pairAddress,
        address tokenIn,
        address /* tokenOut */
    ) internal view returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        bool isToken0 = pair.token0() == tokenIn;
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;
        
        // Uniswap V2 formula with 0.3% fee
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @dev Simulate arbitrage path for profit estimation
     */
    function _simulateArbitragePath(
        uint256 flashLoanAmount,
        ArbitrageParams memory params
    ) internal view returns (uint256 estimatedUsdcOut) {
        // This is a simplified simulation
        // In practice, you'd need to account for all fees and slippage
        
        // Simulate pfUSDC conversion (1:1 ratio for simplification)
        uint256 pfUsdcShares = flashLoanAmount;
        
        // Simulate pfUSDC → podETH swap
        uint256 podEthAmount = _calculateSwapOutput(
            pfUsdcShares,
            params.pfUsdcPodEthPair,
            params.usdcVault,
            params.podETH
        );
        
        // Simulate podETH debond (assume small fee)
        uint256 wethAmount = (podEthAmount * 99) / 100; // Assume 1% debond fee
        
        // Simulate WETH → USDC swap
        estimatedUsdcOut = _calculateSwapOutput(
            wethAmount,
            params.wethUsdcPair,
            params.wethToken,
            params.usdcToken
        );
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency function to recover tokens
     */
    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        if (amount == 0) {
            amount = IERC20(token).balanceOf(address(this));
        }
        IERC20(token).transfer(owner(), amount);
    }
}
