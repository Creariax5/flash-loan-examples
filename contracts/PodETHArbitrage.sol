// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces
interface IDecentralizedIndex {
    function flashMint(address _recipient, uint256 _amount, bytes calldata _data) external;
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
}

interface IFlashLoanRecipient {
    function callback(bytes calldata _data) external;
}

interface IERC4626 {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract PodETHArbitrage is IFlashLoanRecipient, Ownable {
    // Base network addresses
    address public constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address public constant PFUSDC = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant UNI_V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address public constant UNI_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    // State variables
    uint256 public lastFlashMintAmount;
    uint256 public lastProfit;
    bool public flashMintInProgress;

    event ArbitrageExecuted(uint256 amount, uint256 profit, bool success);
    event EmergencyWithdraw(address indexed asset, uint256 amount);

    constructor() {
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Execute arbitrage when podETH is cheap (below WETH)
     * Strategy: Flash mint podETH → Debond to WETH → Swap to USDC → Deposit to pfUSDC → Swap to podETH → Repay
     */
    function executeArbitrageWhenPodETHCheap(uint256 amount) external onlyOwner {
        require(!flashMintInProgress, "Flash mint already in progress");
        require(amount > 0, "Amount must be greater than 0");

        flashMintInProgress = true;
        lastFlashMintAmount = amount;

        // Encode strategy type (1 = buy cheap podETH)
        bytes memory data = abi.encode(1, amount);

        try IDecentralizedIndex(POD_ETH).flashMint(
            address(this),
            amount,
            data
        ) {
            // Success - state will be reset in callback
        } catch {
            flashMintInProgress = false;
            lastFlashMintAmount = 0;
            revert("Flash mint failed");
        }

        flashMintInProgress = false;
    }

    /**
     * @dev Flash mint callback - executes arbitrage strategy
     */
    function callback(bytes calldata _data) external override {
        require(msg.sender == POD_ETH, "Caller must be Pod contract");
        require(flashMintInProgress, "No flash mint in progress");

        // Decode strategy parameters
        (uint256 strategy, uint256 amount) = abi.decode(_data, (uint256, uint256));
        
        if (strategy == 1) {
            _executeBuyCheapPodETH(amount);
        } else {
            revert("Unknown strategy");
        }
    }

    /**
     * @dev Execute buy cheap podETH strategy
     */
    function _executeBuyCheapPodETH(uint256 amount) internal {
        uint256 initialBalance = IERC20(POD_ETH).balanceOf(address(this));
        
        // Step 1: Debond podETH → WETH (unwrap)
        address[] memory tokens = new address[](1);
        tokens[0] = WETH;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100; // 100% to WETH

        IERC20(POD_ETH).approve(POD_ETH, amount);
        IDecentralizedIndex(POD_ETH).debond(amount, tokens, percentages);

        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        require(wethBalance > 0, "No WETH received from debond");

        // Step 2: Swap WETH → USDC (Uniswap V3)
        IERC20(WETH).approve(UNI_V3_ROUTER, wethBalance);
        
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 500, // 0.05%
            recipient: address(this),
            amountIn: wethBalance,
            amountOutMinimum: 0, // Accept any amount (for simplicity)
            sqrtPriceLimitX96: 0
        });

        uint256 usdcReceived = ISwapRouter(UNI_V3_ROUTER).exactInputSingle(swapParams);
        require(usdcReceived > 0, "No USDC received from swap");

        // Step 3: Deposit USDC → pfUSDC (vault)
        IERC20(USDC).approve(PFUSDC, usdcReceived);
        uint256 pfUsdcReceived = IERC4626(PFUSDC).deposit(usdcReceived, address(this));
        require(pfUsdcReceived > 0, "No pfUSDC received from deposit");

        // Step 4: Swap pfUSDC → podETH (Uniswap V2)
        IERC20(PFUSDC).approve(UNI_V2_ROUTER, pfUsdcReceived);

        address[] memory path = new address[](2);
        path[0] = PFUSDC;
        path[1] = POD_ETH;

        uint256 deadline = block.timestamp + 1800; // 30 minutes

        IUniswapV2Router(UNI_V2_ROUTER).swapExactTokensForTokens(
            pfUsdcReceived,
            0, // Accept any amount (for simplicity)
            path,
            address(this),
            deadline
        );

        // Step 5: Calculate profit and repay flash mint
        uint256 finalBalance = IERC20(POD_ETH).balanceOf(address(this));
        uint256 fee = amount / 1000; // 0.1% fee
        if (fee == 0) fee = 1; // Minimum 1 wei fee
        
        uint256 totalRepayment = amount + fee;
        
        require(finalBalance >= totalRepayment, "Insufficient podETH for repayment");

        // Calculate profit (if any)
        if (finalBalance > totalRepayment) {
            lastProfit = finalBalance - totalRepayment;
        } else {
            lastProfit = 0;
        }

        // Repay flash mint
        IERC20(POD_ETH).transfer(msg.sender, totalRepayment);

        emit ArbitrageExecuted(amount, lastProfit, true);
    }

    /**
     * @dev Calculate flash mint fee
     */
    function calculateFlashMintFee(uint256 amount) public pure returns (uint256) {
        uint256 fee = amount / 1000; // 0.1%
        return fee == 0 ? 1 : fee;
    }

    /**
     * @dev Check if contract has enough podETH to cover flash mint fee
     */
    function canCoverFlashMint(uint256 amount) external view returns (bool) {
        uint256 feeNeeded = calculateFlashMintFee(amount);
        uint256 balance = IERC20(POD_ETH).balanceOf(address(this));
        return balance >= feeNeeded;
    }

    /**
     * @dev Emergency withdraw function
     */
    function emergencyWithdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");

        IERC20(asset).transfer(owner(), balance);
        emit EmergencyWithdraw(asset, balance);
    }

    /**
     * @dev Get contract's balance of any token
     */
    function getTokenBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    /**
     * @dev Reset flash mint state in case of emergency
     */
    function resetFlashMintState() external onlyOwner {
        flashMintInProgress = false;
        lastFlashMintAmount = 0;
        lastProfit = 0;
    }

    /**
     * @dev Fund contract with some podETH for fees (if needed)
     */
    function fundWithPodETH(uint256 amount) external onlyOwner {
        IERC20(POD_ETH).transferFrom(msg.sender, address(this), amount);
    }
}