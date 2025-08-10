// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Import your existing flash loan contract
import "./AaveFlashLoanWithSwap.sol";

// Uniswap V3 interfaces for PEAS/USDC trading
interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// Peapods peaPEAS interfaces
// Correct Peapods DecentralizedIndex interface (pods)
interface IPeaPEAS {
    function bond(address token, uint256 amount, uint256 amountMintMin) external;
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
    function isAsset(address token) external view returns (bool);
    function getAllAssets() external view returns (IndexAssetInfo[] memory);
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    
    struct IndexAssetInfo {
        address token;
        uint256 weighting;
        uint256 basePriceUSDX96;
        address c1;
        uint256 q1;
    }
}

// pfpOHMo-27 vault interface
interface IPfpOHMo27Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function asset() external view returns (address); // Should return underlying asset
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}

/**
 * @title PeaPEASArbitrageBot
 * @dev Arbitrage bot for peaPEAS ecosystem using Aave flash loans
 * 
 * Two Strategies:
 * 
 * UNDERVALUED (peaPEAS < fair price): Buy PEAS → Wrap → Sell peaPEAS
 * 1. Flash loan USDC
 * 2. USDC → PEAS (Uniswap V3)
 * 3. PEAS → peaPEAS (wrap - 0.3% fee)
 * 4. peaPEAS → pfpOHMo-27 (sell on LP - 1.95% + 0.3% DEX fee)
 * 5. pfpOHMo-27 → USDC (redeem from vault)
 * 6. Repay flash loan + profit
 * 
 * OVERVALUED (peaPEAS > fair price): Buy peaPEAS → Unwrap → Sell PEAS  
 * 1. Flash loan USDC
 * 2. USDC → pfpOHMo-27 (deposit to vault)
 * 3. pfpOHMo-27 → peaPEAS (buy on LP - 1.3% + 0.3% DEX fee)
 * 4. peaPEAS → PEAS (unwrap - 1.2% fee)
 * 5. PEAS → USDC (Uniswap V3)
 * 6. Repay flash loan + profit
 */
contract PeaPEASArbitrageBot is AaveFlashLoanWithSwap {
    
    // ============ State Variables ============
    
    uint256 public constant MAX_SLIPPAGE = 300; // 3%
    uint256 public constant MIN_PROFIT_BASIS_POINTS = 10; // 0.1% minimum profit
    
    // Base mainnet addresses - UPDATED for Arbitrum
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564; // Arbitrum V3 Router
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // WETH on Arbitrum
    address public constant PEAS_WETH_V3_POOL = 0x23D17764F41AEa93fdbb5beffA83571f0bF3f8b2;  // PEAS/WETH pool
    address public constant WETH_USDC_V3_POOL = 0xC6962004f452bE9203591991D15f6b388e09E8D0;  // WETH/USDC pool
    uint24 public constant PEAS_WETH_FEE = 10000; // 1% fee tier for PEAS/WETH (CORRECTED for Arbitrum)
    uint24 public constant WETH_USDC_FEE = 500;  // 0.05% fee tier for WETH/USDC
    
    // ============ Events ============
    
    event ArbitrageExecuted(
        uint256 flashLoanAmount,
        uint256 profit,
        bool isUndervaluedStrategy,
        address indexed executor
    );
    
    event ArbitrageFailed(
        string reason,
        uint256 flashLoanAmount,
        bool isUndervaluedStrategy
    );

    // ============ Structs ============
    
    struct PeaPEASArbitrageParams {
        address usdcToken;           // USDC token address
        address peasToken;           // PEAS token address  
        address peaPEAS;             // peaPEAS pod address
        address pfpOHMo27Vault;      // pfpOHMo-27 vault address
        address peaPEASLiquidityPool; // peaPEAS/pfpOHMo-27 LP address
        bool isUndervaluedStrategy;  // true = buy PEAS→wrap, false = buy peaPEAS→unwrap
        uint256 minProfitAmount;     // Minimum profit required
        uint256 maxSlippage;         // Maximum slippage tolerance (basis points)
    }

    // ============ Constructor ============
    
    constructor(address _addressesProvider) AaveFlashLoanWithSwap(_addressesProvider) {}

    // ============ External Functions ============

    /**
     * @notice Execute peaPEAS arbitrage strategy
     * @param flashLoanAmount Amount of USDC to flash loan (e.g., 5 * 1e6 for $5 USDC)
     * @param params Arbitrage parameters
     */
    function executePeaPEASArbitrage(
        uint256 flashLoanAmount,
        PeaPEASArbitrageParams memory params
    ) external onlyOwner nonReentrant {
        require(flashLoanAmount > 0, "Invalid flash loan amount");
        require(params.usdcToken != address(0), "Invalid USDC address");
        require(params.peaPEAS != address(0), "Invalid peaPEAS address");
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
        PeaPEASArbitrageParams memory params
    ) external view returns (uint256 estimatedProfit, bool isProfitable) {
        uint256 flashLoanFee = this.calculateFlashLoanFee(flashLoanAmount);
        uint256 totalCost = flashLoanAmount + flashLoanFee;
        
        // Simulate the arbitrage path
        uint256 estimatedUsdcOut = _simulatePeaPEASArbitragePath(flashLoanAmount, params);
        
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
        PeaPEASArbitrageParams memory arbParams = abi.decode(params, (PeaPEASArbitrageParams));
        
        // Execute arbitrage strategy
        bool success = _executePeaPEASArbitrageStrategy(asset, amount, premium, arbParams);
        
        if (!success) {
            emit ArbitrageFailed("Arbitrage execution failed", amount, arbParams.isUndervaluedStrategy);
        }
        
        // Prepare repayment
        uint256 amountToRepay = amount + premium;
        _prepareRepayment(asset, amountToRepay);
        
        return true;
    }

    // ============ Internal Functions ============

    /**
     * @dev Execute the complete peaPEAS arbitrage strategy
     */
    function _executePeaPEASArbitrageStrategy(
        address asset,
        uint256 amount,
        uint256 premium,
        PeaPEASArbitrageParams memory params
    ) internal returns (bool) {
        try this._internalPeaPEASArbitrageExecution(asset, amount, premium, params) {
            return true;
        } catch Error(string memory reason) {
            emit ArbitrageFailed(reason, amount, params.isUndervaluedStrategy);
            return false;
        } catch {
            emit ArbitrageFailed("Unknown error during peaPEAS arbitrage", amount, params.isUndervaluedStrategy);
            return false;
        }
    }

    /**
     * @dev Internal peaPEAS arbitrage execution that can be called with try-catch
     */
    function _internalPeaPEASArbitrageExecution(
        address /* asset */,
        uint256 amount,
        uint256 premium,
        PeaPEASArbitrageParams memory params
    ) external {
        require(msg.sender == address(this), "Only self-call allowed");
        
        uint256 usdcReceived;
        
        if (params.isUndervaluedStrategy) {
            // UNDERVALUED: Buy PEAS → Wrap → Sell peaPEAS
            usdcReceived = _executeUndervaluedStrategy(amount, params);
        } else {
            // OVERVALUED: Buy peaPEAS → Unwrap → Sell PEAS
            usdcReceived = _executeOvervaluedStrategy(amount, params);
        }
        
        // Verify profitability
        uint256 totalRequired = amount + premium;
        require(usdcReceived >= totalRequired, "Insufficient USDC for repayment");
        
        uint256 profit = usdcReceived - totalRequired;
        require(profit >= params.minProfitAmount, "Profit below minimum threshold");
        
        emit ArbitrageExecuted(amount, profit, params.isUndervaluedStrategy, tx.origin);
    }

    /**
     * @dev Execute UNDERVALUED strategy: USDC → PEAS → peaPEAS → pfpOHMo-27 → USDC
     */
    function _executeUndervaluedStrategy(
        uint256 usdcAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 finalUsdcAmount) {
        
        // Step 1: USDC → PEAS (Uniswap V3)
        uint256 peasAmount = _swapUsdcToPeas(usdcAmount, params);
        
        // Step 2: PEAS → peaPEAS (wrap - 0.3% fee)
        uint256 peaPEASAmount = _wrapPeasToPeaPEAS(peasAmount, params);
        
        // Step 3: peaPEAS → pfpOHMo-27 (sell on LP - 1.95% + 0.3% DEX fee) 
        uint256 pfpOHMo27Amount = _sellPeaPEASForPfpOHMo27(peaPEASAmount, params);
        
        // Step 4: pfpOHMo-27 → USDC (redeem from vault)
        finalUsdcAmount = _redeemPfpOHMo27ForUsdc(pfpOHMo27Amount, params);
    }

    /**
     * @dev Execute OVERVALUED strategy: USDC → pfpOHMo-27 → peaPEAS → PEAS → USDC
     */
    function _executeOvervaluedStrategy(
        uint256 usdcAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 finalUsdcAmount) {
        
        // Step 1: USDC → pfpOHMo-27 (deposit to vault)
        uint256 pfpOHMo27Amount = _depositUsdcToPfpOHMo27(usdcAmount, params);
        
        // Step 2: pfpOHMo-27 → peaPEAS (buy on LP - 1.3% + 0.3% DEX fee)
        uint256 peaPEASAmount = _buyPeaPEASWithPfpOHMo27(pfpOHMo27Amount, params);
        
        // Step 3: peaPEAS → PEAS (unwrap - 1.2% fee)
        uint256 peasAmount = _unwrapPeaPEASToPeas(peaPEASAmount, params);
        
        // Step 4: PEAS → USDC (Uniswap V3) 
        finalUsdcAmount = _swapPeasToUsdc(peasAmount, params);
    }

    // ============ Strategy Step Functions ============

    /**
     * @dev Step: USDC → PEAS via USDC → WETH → PEAS (two hops)
     */
    function _swapUsdcToPeas(
        uint256 usdcAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 peasReceived) {
        // Two-step swap: USDC → WETH → PEAS
        
        // Step 1: USDC → WETH
        IERC20(params.usdcToken).approve(UNISWAP_V3_ROUTER, usdcAmount);
        
        ISwapRouter.ExactInputSingleParams memory usdcToWethParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: params.usdcToken,
            tokenOut: WETH,
            fee: WETH_USDC_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: usdcAmount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        uint256 wethReceived = ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(usdcToWethParams);
        require(wethReceived > 0, "Failed to receive WETH from USDC swap");
        
        // Step 2: WETH → PEAS
        IERC20(WETH).approve(UNISWAP_V3_ROUTER, wethReceived);
        
        ISwapRouter.ExactInputSingleParams memory wethToPeasParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: params.peasToken,
            fee: PEAS_WETH_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: wethReceived,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        peasReceived = ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(wethToPeasParams);
        require(peasReceived > 0, "Failed to receive PEAS from WETH swap");
    }

    /**
     * @dev Step: PEAS → USDC via PEAS → WETH → USDC (two hops)
     */
    function _swapPeasToUsdc(
        uint256 peasAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 usdcReceived) {
        // Two-step swap: PEAS → WETH → USDC
        
        // Step 1: PEAS → WETH
        IERC20(params.peasToken).approve(UNISWAP_V3_ROUTER, peasAmount);
        
        ISwapRouter.ExactInputSingleParams memory peasToWethParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: params.peasToken,
            tokenOut: WETH,
            fee: PEAS_WETH_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: peasAmount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        uint256 wethReceived = ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(peasToWethParams);
        require(wethReceived > 0, "Failed to receive WETH from PEAS swap");
        
        // Step 2: WETH → USDC
        IERC20(WETH).approve(UNISWAP_V3_ROUTER, wethReceived);
        
        ISwapRouter.ExactInputSingleParams memory wethToUsdcParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: params.usdcToken,
            fee: WETH_USDC_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: wethReceived,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        usdcReceived = ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(wethToUsdcParams);
        require(usdcReceived > 0, "Failed to receive USDC from WETH swap");
    }

    /**
     * @dev Step: PEAS → peaPEAS (bond/wrap using Peapods protocol)
     */
    function _wrapPeasToPeaPEAS(
        uint256 peasAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 peaPEASReceived) {
        // Get initial pPEAS balance
        uint256 initialBalance = IERC20(params.peaPEAS).balanceOf(address(this));
        
        // Approve PEAS to be spent by the pPEAS pod
        IERC20(params.peasToken).approve(params.peaPEAS, peasAmount);
        
        // Bond PEAS tokens to pPEAS pod (amountMintMin = 0 for max slippage tolerance)
        IPeaPEAS(params.peaPEAS).bond(params.peasToken, peasAmount, 0);
        
        // Calculate how many pPEAS tokens we received
        peaPEASReceived = IERC20(params.peaPEAS).balanceOf(address(this)) - initialBalance;
        require(peaPEASReceived > 0, "Failed to wrap PEAS to peaPEAS");
    }

    /**
     * @dev Step: peaPEAS → PEAS (debond/unwrap using Peapods protocol)
     */
    function _unwrapPeaPEASToPeas(
        uint256 peaPEASAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 peasReceived) {
        // Get initial PEAS balance
        uint256 initialBalance = IERC20(params.peasToken).balanceOf(address(this));
        
        // For debond, we need to specify which tokens we want to receive and in what percentages
        // Since pPEAS contains PEAS, we want 100% PEAS
        address[] memory tokens = new address[](1);
        tokens[0] = params.peasToken;
        uint8[] memory percentages = new uint8[](1); 
        percentages[0] = 100; // 100% to PEAS
        
        // Debond pPEAS tokens to get PEAS back
        IPeaPEAS(params.peaPEAS).debond(peaPEASAmount, tokens, percentages);
        
        // Calculate how many PEAS tokens we received
        peasReceived = IERC20(params.peasToken).balanceOf(address(this)) - initialBalance;
        require(peasReceived > 0, "Failed to unwrap peaPEAS to PEAS");
    }

    /**
     * @dev Step: USDC → pfpOHMo-27 (deposit to vault)  
     */
    function _depositUsdcToPfpOHMo27(
        uint256 usdcAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 pfpOHMo27Received) {
        // First need to check what the underlying asset of pfpOHMo27 vault is
        address underlyingAsset = IPfpOHMo27Vault(params.pfpOHMo27Vault).asset();
        
        if (underlyingAsset == params.usdcToken) {
            // Direct deposit if underlying is USDC
            IERC20(params.usdcToken).approve(params.pfpOHMo27Vault, usdcAmount);
            pfpOHMo27Received = IPfpOHMo27Vault(params.pfpOHMo27Vault).deposit(usdcAmount, address(this));
        } else {
            revert("pfpOHMo27 underlying asset is not USDC - need swap logic");
        }
        require(pfpOHMo27Received > 0, "Failed to deposit to pfpOHMo27 vault");
    }

    /**
     * @dev Step: pfpOHMo-27 → USDC (redeem from vault)
     */
    function _redeemPfpOHMo27ForUsdc(
        uint256 pfpOHMo27Amount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 usdcReceived) {
        usdcReceived = IPfpOHMo27Vault(params.pfpOHMo27Vault).redeem(pfpOHMo27Amount, address(this), address(this));
        require(usdcReceived > 0, "Failed to redeem pfpOHMo27 for USDC");
    }

    /**
     * @dev Step: peaPEAS → pfpOHMo-27 (sell on liquidity pool)
     */
    function _sellPeaPEASForPfpOHMo27(
        uint256 peaPEASAmount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 pfpOHMo27Received) {
        IUniswapV2Pair pair = IUniswapV2Pair(params.peaPEASLiquidityPool);
        
        // Transfer peaPEAS to pair
        IERC20(params.peaPEAS).transfer(params.peaPEASLiquidityPool, peaPEASAmount);
        
        // Calculate output amount
        uint256 pfpOHMo27Out = _calculateV2SwapOutput(
            peaPEASAmount,
            params.peaPEASLiquidityPool,
            params.peaPEAS,
            params.pfpOHMo27Vault
        );
        
        // Execute swap
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == params.peaPEAS 
            ? (uint256(0), pfpOHMo27Out) 
            : (pfpOHMo27Out, uint256(0));
            
        uint256 pfpOHMo27Before = IERC20(params.pfpOHMo27Vault).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        pfpOHMo27Received = IERC20(params.pfpOHMo27Vault).balanceOf(address(this)) - pfpOHMo27Before;
        
        require(pfpOHMo27Received > 0, "Failed to sell peaPEAS for pfpOHMo27");
    }

    /**
     * @dev Step: pfpOHMo-27 → peaPEAS (buy on liquidity pool)
     */
    function _buyPeaPEASWithPfpOHMo27(
        uint256 pfpOHMo27Amount,
        PeaPEASArbitrageParams memory params
    ) internal returns (uint256 peaPEASReceived) {
        IUniswapV2Pair pair = IUniswapV2Pair(params.peaPEASLiquidityPool);
        
        // Transfer pfpOHMo27 to pair
        IERC20(params.pfpOHMo27Vault).transfer(params.peaPEASLiquidityPool, pfpOHMo27Amount);
        
        // Calculate output amount
        uint256 peaPEASOut = _calculateV2SwapOutput(
            pfpOHMo27Amount,
            params.peaPEASLiquidityPool,
            params.pfpOHMo27Vault,
            params.peaPEAS
        );
        
        // Execute swap
        (uint256 amount0Out, uint256 amount1Out) = pair.token0() == params.pfpOHMo27Vault 
            ? (uint256(0), peaPEASOut) 
            : (peaPEASOut, uint256(0));
            
        uint256 peaPEASBefore = IERC20(params.peaPEAS).balanceOf(address(this));
        pair.swap(amount0Out, amount1Out, address(this), "");
        peaPEASReceived = IERC20(params.peaPEAS).balanceOf(address(this)) - peaPEASBefore;
        
        require(peaPEASReceived > 0, "Failed to buy peaPEAS with pfpOHMo27");
    }

    /**
     * @dev Calculate Uniswap V2 output amount
     */
    function _calculateV2SwapOutput(
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
     * @dev Simulate peaPEAS arbitrage path for profit estimation
     */
    function _simulatePeaPEASArbitragePath(
        uint256 flashLoanAmount,
        PeaPEASArbitrageParams memory /* params */
    ) internal pure returns (uint256 estimatedUsdcOut) {
        // Simplified simulation - in practice need to query actual pools
        // 
        // CRITICAL FIX: Include both fees AND price advantage!
        // Total fees: 2.91% (V3 0.27% + wrap 0.3% + sell 1.95% + DEX 0.3% + V3 0.09%)
        // Price advantage: 4.43% (peaPEAS undervalued by $5.42 vs $5.66 fair price)
        // Net advantage: 4.43% - 2.91% = 1.52%
        
        uint256 totalFeePercent = 291; // 2.91% total fees
        uint256 priceAdvantagePercent = 443; // 4.43% price advantage
        uint256 netAdvantagePercent = priceAdvantagePercent - totalFeePercent; // 1.52%
        
        estimatedUsdcOut = (flashLoanAmount * (10000 + netAdvantagePercent)) / 10000;
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
