// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode) external;
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

interface IFlashLoanSimpleReceiver {
    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool);
}

interface IERC20Extended {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
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
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

interface IIndexUtils {
    function bond(address _indexFund, address _token, uint256 _amount, uint256 _amountMintMin) external;
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

/**
 * @title podETH Arbitrage Buy Contract
 * @dev Strategy: Buy underpriced pod tokens
 * @dev Flow: USDC → WETH → podETH → pfUSDC → USDC
 */
contract podETHArbitrageBuy is IFlashLoanSimpleReceiver, Ownable {
    IPool public immutable pool;
    
    // Contract addresses
    address constant POD_TOKEN = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address constant UNDERLYING_TOKEN = 0x4200000000000000000000000000000000000006;
    address constant PF_USDC_VAULT = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    address constant V2_POOL = 0xEd988C42840517989ca99458153fD204899Af09b;
    
    // Base network constants
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant INDEX_UTILS = 0x490B03C6afe733576cF1f5D2A821cF261B15826d;
    address constant V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    // V3 pool constants (direct USDC pair)
    uint24 constant UNDERLYING_USDC_FEE = 500;
    
    event ArbitrageExecuted(uint256 profit);
    event StepCompleted(string step, uint256 amount);

    constructor(address _addressesProvider) {
        pool = IPool(IPoolAddressesProvider(_addressesProvider).getPool());
        _transferOwnership(msg.sender);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata
    ) external override returns (bool) {
        require(msg.sender == address(pool), "Unauthorized");
        require(initiator == address(this), "Unauthorized initiator");
        require(asset == USDC, "Wrong asset");
        
        uint256 repayAmount = amount + premium;
        
        // Execute arbitrage logic
        _executeArbitrage(amount);
        
        // Ensure we have enough to repay
        uint256 finalBalance = IERC20Extended(USDC).balanceOf(address(this));
        require(finalBalance >= repayAmount, "Insufficient balance to repay");
        
        // Approve repayment
        IERC20Extended(USDC).approve(address(pool), repayAmount);
        
        // Calculate and emit profit
        uint256 profit = finalBalance - repayAmount;
        emit ArbitrageExecuted(profit);
        
        return true;
    }
    
    function _executeArbitrage(uint256 amount) internal {
        // Step 1: USDC → WETH (V3)
        IERC20Extended(USDC).approve(V3_ROUTER, amount);
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: USDC,
            tokenOut: UNDERLYING_TOKEN,
            fee: UNDERLYING_USDC_FEE,
            recipient: address(this),
            amountIn: amount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        ISwapRouter(V3_ROUTER).exactInputSingle(params);
        uint256 wethBalance = IERC20Extended(UNDERLYING_TOKEN).balanceOf(address(this));
        emit StepCompleted("USDC to WETH", wethBalance);
        
        // Step 2: WETH → podETH (IndexUtils)
        IERC20Extended(UNDERLYING_TOKEN).approve(INDEX_UTILS, wethBalance);
        IIndexUtils(INDEX_UTILS).bond(POD_TOKEN, UNDERLYING_TOKEN, wethBalance, 0);
        uint256 podBalance = IERC20Extended(POD_TOKEN).balanceOf(address(this));
        emit StepCompleted("WETH to podETH", podBalance);
        
        // Step 3: podETH → pfUSDC (V2)
        IERC20Extended(POD_TOKEN).approve(V2_ROUTER, podBalance);
        
        address[] memory path = new address[](2);
        path[0] = POD_TOKEN;
        path[1] = PF_USDC_VAULT;
        
        IUniswapV2Router(V2_ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            podBalance,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
        uint256 pfUsdcBalance = IERC20Extended(PF_USDC_VAULT).balanceOf(address(this));
        emit StepCompleted("podETH to pfUSDC", pfUsdcBalance);
        
        // Step 4: pfUSDC → USDC (Vault redeem)
        IVault(PF_USDC_VAULT).redeem(pfUsdcBalance, address(this), address(this));
        uint256 finalUsdcBalance = IERC20Extended(USDC).balanceOf(address(this));
        emit StepCompleted("pfUSDC to USDC", finalUsdcBalance);
    }
    
    /**
     * @dev Request flash loan to execute arbitrage
     * @param amount Amount to borrow
     */
    function requestFlashLoan(uint256 amount) external onlyOwner {
        pool.flashLoanSimple(address(this), USDC, amount, "", 0);
    }
    
    /**
     * @dev Calculate flash loan fee
     * @param amount Loan amount
     * @return fee amount
     */
    function calculateFee(uint256 amount) external view returns (uint256) {
        return (amount * pool.FLASHLOAN_PREMIUM_TOTAL()) / 10000;
    }
    
    /**
     * @dev Withdraw profits
     * @param asset Token address to withdraw
     */
    function withdraw(address asset) external onlyOwner {
        uint256 balance = IERC20Extended(asset).balanceOf(address(this));
        require(balance > 0, "No balance");
        IERC20Extended(asset).transfer(owner(), balance);
    }
    
    /**
     * @dev Get contract balance
     * @param asset Token address
     * @return balance
     */
    function getBalance(address asset) external view returns (uint256) {
        return IERC20Extended(asset).balanceOf(address(this));
    }
    
    /**
     * @dev Emergency function to recover stuck tokens
     * @param token Token address
     * @param amount Amount to recover
     */
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        IERC20Extended(token).transfer(owner(), amount);
    }
}