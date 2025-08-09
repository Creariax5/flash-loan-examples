// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Import your existing flash loan contract
import "./AaveFlashLoanWithSwap.sol";

// Peapods interfaces
interface ILendingAssetVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function asset() external view returns (address);
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
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
 * @title PeapodsToastArbitrageBot
 * @dev Arbitrage bot for pToastLVF pod using Aave flash loans
 * 
 * Corrected Strategy for pToastLVF:
 * 1. Flash loan USDC
 * 2. Deposit USDC → pfUSDC (lending vault shares)
 * 3. Swap pfUSDC → pToastLVF
 * 4. Debond pToastLVF → TOAST
 * 5. Swap TOAST → WETH → USDC (via TOAST/WETH pair + oracle/calculation)
 * 6. Repay flash loan + profit
 */
contract PeapodsToastArbitrageBot is AaveFlashLoanWithSwap {
    
    // ============ State Variables ============
    
    uint256 public constant MAX_SLIPPAGE = 300; // 3%
    uint256 public constant MIN_PROFIT_BASIS_POINTS = 10; // 0.1% minimum profit
    
    // ============ Events ============
    
    event ArbitrageExecuted(uint256 flashLoanAmount, uint256 profit, address indexed executor);
    event ArbitrageFailed(string reason, uint256 flashLoanAmount);

    // ============ Structs ============
    
    struct ToastArbitrageParams {
        address usdcToken;           // USDC token address
        address toastToken;          // TOAST token address (underlying of pToastLVF)
        address wethToken;           // WETH token address
        address usdcVault;           // pfUSDC LendingAssetVault
        address podToast;            // pToastLVF DecentralizedIndex
        address pfUsdcPodToastPair;  // Uniswap V2 pair: pfUSDC/pToastLVF
        address toastWethPair;       // Uniswap V2 pair: TOAST/WETH
        uint256 minProfitAmount;     // Minimum profit required
        uint256 maxSlippage;         // Maximum slippage tolerance (basis points)
    }

    // ============ Constructor ============
    
    constructor(address _addressesProvider) AaveFlashLoanWithSwap(_addressesProvider) {}

    // ============ External Functions ============

    /**
     * @notice Execute TOAST arbitrage strategy
     */
    function executeToastArbitrage(
        uint256 flashLoanAmount,
        ToastArbitrageParams memory params
    ) external onlyOwner nonReentrant {
        require(flashLoanAmount > 0, "Invalid flash loan amount");
        require(params.usdcToken != address(0), "Invalid USDC address");
        require(params.minProfitAmount > 0, "Invalid min profit");
        
        bytes memory data = abi.encode(params);
        
        pool.flashLoanSimple(
            address(this),
            params.usdcToken,
            flashLoanAmount,
            data,
            0
        );
    }

    // ============ Flash Loan Override ============

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        _validateFlashLoanCallback(initiator);
        
        ToastArbitrageParams memory arbParams = abi.decode(params, (ToastArbitrageParams));
        
        bool success = _executeToastArbitrageStrategy(asset, amount, premium, arbParams);
        
        if (!success) {
            emit ArbitrageFailed("Arbitrage execution failed", amount);
        }
        
        uint256 amountToRepay = amount + premium;
        _prepareRepayment(asset, amountToRepay);
        
        return true;
    }

    // ============ Internal Functions ============

    function _executeToastArbitrageStrategy(
        address asset,
        uint256 amount,
        uint256 premium,
        ToastArbitrageParams memory params
    ) internal returns (bool) {
        try this._internalToastArbitrageExecution(asset, amount, premium, params) {
            return true;
        } catch Error(string memory reason) {
            emit ArbitrageFailed(reason, amount);
            return false;
        } catch {
            emit ArbitrageFailed("Unknown error during arbitrage", amount);
            return false;
        }
    }

    function _internalToastArbitrageExecution(
        address /* asset */,
        uint256 amount,
        uint256 premium,
        ToastArbitrageParams memory params
    ) external {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Step 1: Deposit USDC → pfUSDC
        uint256 pfUsdcShares = _depositUsdcForPfUsdc(amount, params);
        
        // Step 2: Swap pfUSDC → pToastLVF
        uint256 podToastAmount = _swapPfUsdcToPodToast(pfUsdcShares, params);
        
        // Step 3: Debond pToastLVF → TOAST
        uint256 toastAmount = _debondPodToastToToast(podToastAmount, params);
        
        // Step 4: Swap TOAST → WETH
        uint256 wethAmount = _swapToastToWeth(toastAmount, params);
        
        // Step 5: Swap WETH → USDC (you'll need to implement WETH/USDC swap or use price oracle)
        uint256 usdcReceived = _swapWethToUsdcViaOracle(wethAmount, params);
        
        // Step 6: Verify profitability
        uint256 totalRequired = amount + premium;
        require(usdcReceived >= totalRequired, "Insufficient USDC for repayment");
        
        uint256 profit = usdcReceived - totalRequired;
        require(profit >= params.minProfitAmount, "Profit below minimum threshold");
        
        emit ArbitrageExecuted(amount, profit, tx.origin);
    }

    function _depositUsdcForPfUsdc(
        uint256 usdcAmount,
        ToastArbitrageParams memory params
    ) internal returns (uint256 pfUsdcShares) {
        IERC20(params.usdcToken).approve(params.usdcVault, usdcAmount);
        pfUsdcShares = ILendingAssetVault(params.usdcVault).deposit(usdcAmount, address(this));
        require(pfUsdcShares > 0, "Failed to receive pfUSDC shares");
    }

    function _swapPfUsdcToPodToast(
        uint256 pfUsdcAmount,
        ToastArbitrageParams memory params
    ) internal returns (uint256 podToastReceived) {
        IUniswapV2Pair pair = IUniswapV2Pair(params.pfUsdcPodToastPair);
        
        // Transfer pfUSDC to pair
        IERC20(params.usdcVault).transfer(params.pfUsdcPodToastPair, pfUsdcAmount);
        
        // Calculate and execute swap
        uint256 podToastOut = _calculateSwapOutput(
            pfUsdcAmount,
            params.pfUsdcPodToastPair,
            params.usdcVault,
            params.podToast
        );
        
        uint256 minPodToastOut = (podToastOut * (10000 - params.maxSlippage)) / 10000;
        
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == params.usdcVault 
            ? (uint256(0), podToastOut) 
            : (podToastOut, uint256(0));
            
        uint256 podToastBefore = IERC20(params.podToast).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        podToastReceived = IERC20(params.podToast).balanceOf(address(this)) - podToastBefore;
        
        require(podToastReceived >= minPodToastOut, "Excessive slippage in pfUSDC->pToastLVF swap");
    }

    function _debondPodToastToToast(
        uint256 podToastAmount,
        ToastArbitrageParams memory params
    ) internal returns (uint256 toastReceived) {
        // pToastLVF is single-asset pod containing TOAST
        address[] memory tokens = new address[](1);
        uint8[] memory percentages = new uint8[](1);
        tokens[0] = params.toastToken;
        percentages[0] = 100;
        
        uint256 toastBefore = IERC20(params.toastToken).balanceOf(address(this));
        
        IDecentralizedIndex(params.podToast).debond(podToastAmount, tokens, percentages);
        
        toastReceived = IERC20(params.toastToken).balanceOf(address(this)) - toastBefore;
        require(toastReceived > 0, "Failed to receive TOAST from pToastLVF debond");
    }

    function _swapToastToWeth(
        uint256 toastAmount,
        ToastArbitrageParams memory params
    ) internal returns (uint256 wethReceived) {
        IUniswapV2Pair pair = IUniswapV2Pair(params.toastWethPair);
        
        // Transfer TOAST to pair
        IERC20(params.toastToken).transfer(params.toastWethPair, toastAmount);
        
        // Calculate and execute swap
        uint256 wethOut = _calculateSwapOutput(
            toastAmount,
            params.toastWethPair,
            params.toastToken,
            params.wethToken
        );
        
        uint256 minWethOut = (wethOut * (10000 - params.maxSlippage)) / 10000;
        
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == params.toastToken 
            ? (uint256(0), wethOut) 
            : (wethOut, uint256(0));
            
        uint256 wethBefore = IERC20(params.wethToken).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        wethReceived = IERC20(params.wethToken).balanceOf(address(this)) - wethBefore;
        
        require(wethReceived >= minWethOut, "Excessive slippage in TOAST->WETH swap");
    }

    function _swapWethToUsdcViaOracle(
        uint256 wethAmount,
        ToastArbitrageParams memory params
    ) internal returns (uint256 usdcReceived) {
        // For now, we'll use a simple conversion based on approximate WETH price
        // In production, you'd want to use Chainlink oracle or find a WETH/USDC pair
        uint256 wethPriceInUsdc = 2500 * 1e6; // $2500 USDC per WETH (6 decimals)
        
        usdcReceived = (wethAmount * wethPriceInUsdc) / 1e18;
        
        // Simulate "buying" USDC with WETH by minting equivalent USDC
        // NOTE: This is a PLACEHOLDER - you need actual WETH->USDC swap
        require(usdcReceived > 0, "Failed WETH->USDC conversion");
    }

    // Helper function from original contract
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
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        if (amount == 0) {
            amount = IERC20(token).balanceOf(address(this));
        }
        IERC20(token).transfer(owner(), amount);
    }
}
