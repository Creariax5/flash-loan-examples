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

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IPSIMMI {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
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

contract pSimmiArbitrage is IFlashLoanSimpleReceiver, Ownable {
    IPool public immutable pool;
    
    address constant PSIMMI = 0x4707a4535df0e7589B4bfF2A7362FB114D05cC14;
    address constant SIMMI = 0x161e113B8E9BBAEfb846F73F31624F6f9607bd44;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PF_USDC_VAULT = 0x02c9428716B6DC4062EB8ba1b2769704b9E24851;
    address constant V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    event Debug(string message);
    event ArbitrageStep(string step, uint256 amount);

    constructor(address _addressesProvider) {
        pool = IPool(IPoolAddressesProvider(_addressesProvider).getPool());
        _transferOwnership(msg.sender);
    }

    receive() external payable {}

    function executeOperation(
        address asset, 
        uint256 amount, 
        uint256 premium, 
        address initiator, 
        bytes calldata
    ) external override returns (bool) {
        require(msg.sender == address(pool) && initiator == address(this), "Unauthorized flash loan");
        
        uint256 repayAmount = amount + premium;

        _executeArbitrageLogic(asset, amount, premium);

        require(IERC20(asset).balanceOf(address(this)) >= repayAmount, "Insufficient balance to repay flash loan");
        IERC20(asset).approve(address(pool), repayAmount);
        return true;
    }

    function _executeArbitrageLogic(
        address asset,
        uint256 amount,
        uint256 premium
    ) private returns (bool) {
        
        // Step 1: USDC -> pfUSDC (deposit)
        emit Debug("Step 1: USDC -> pfUSDC");
        IUSDC(USDC).approve(PF_USDC_VAULT, amount);
        IVault(PF_USDC_VAULT).deposit(amount, address(this));
        uint256 pfUSDC_balance = IERC20(PF_USDC_VAULT).balanceOf(address(this));
        require(pfUSDC_balance > 0, "No pfUSDC received");
        emit ArbitrageStep("pfUSDC received", pfUSDC_balance);

        // Step 2: pfUSDC -> pSimmi (V2 swap)
        emit Debug("Step 2: pfUSDC -> pSimmi");
        IERC20(PF_USDC_VAULT).approve(V2_ROUTER, pfUSDC_balance);
        
        address[] memory path = new address[](2);
        path[0] = PF_USDC_VAULT;
        path[1] = PSIMMI;
        
        IUniswapV2Router(V2_ROUTER).swapExactTokensForTokens(
            pfUSDC_balance,
            0,
            path,
            address(this),
            block.timestamp + 1800
        );
        
        uint256 pSimmi_balance = IPSIMMI(PSIMMI).balanceOf(address(this));
        require(pSimmi_balance > 0, "No pSimmi received");
        emit ArbitrageStep("pSimmi received", pSimmi_balance);

        // Step 3: pSimmi -> simmi (debond/unwrap)
        emit Debug("Step 3: pSimmi -> simmi");
        address[] memory tokens = new address[](1);
        tokens[0] = SIMMI;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        IPSIMMI(PSIMMI).debond(pSimmi_balance, tokens, percentages);
        uint256 simmi_balance = IERC20(SIMMI).balanceOf(address(this));
        require(simmi_balance > 0, "No SIMMI received from debond");
        emit ArbitrageStep("SIMMI received", simmi_balance);

        // Step 4: simmi -> ETH (V3 swap with 1% fee)
        emit Debug("Step 4: simmi -> ETH");
        IERC20(SIMMI).approve(V3_ROUTER, simmi_balance);
        
        ISwapRouter.ExactInputSingleParams memory params1 = ISwapRouter.ExactInputSingleParams({
            tokenIn: SIMMI,
            tokenOut: WETH,
            fee: 10000, // 1% fee
            recipient: address(this),
            amountIn: simmi_balance,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        ISwapRouter(V3_ROUTER).exactInputSingle(params1);
        uint256 weth_balance = IWETH(WETH).balanceOf(address(this));
        require(weth_balance > 0, "No WETH received from swap");
        emit ArbitrageStep("WETH received", weth_balance);

        // Step 5: ETH -> USDC (V3 swap)
        emit Debug("Step 5: ETH -> USDC");
        IWETH(WETH).approve(V3_ROUTER, weth_balance);
        
        ISwapRouter.ExactInputSingleParams memory params2 = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 500, // 0.05% fee (same as original)
            recipient: address(this),
            amountIn: weth_balance,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        ISwapRouter(V3_ROUTER).exactInputSingle(params2);
        uint256 usdc_balance = IUSDC(USDC).balanceOf(address(this));
        require(usdc_balance >= amount + premium, "Insufficient USDC balance after arbitrage");
        emit ArbitrageStep("Final USDC balance", usdc_balance);

        return true;
    }

    function requestFlashLoan(address asset, uint256 amount) external onlyOwner {
        pool.flashLoanSimple(address(this), asset, amount, "", 0);
    }

    function calculateFee(uint256 amount) external view returns (uint256) {
        return (amount * pool.FLASHLOAN_PREMIUM_TOTAL()) / 10000;
    }

    function withdraw(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        IERC20(asset).transfer(owner(), balance);
    }

    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH balance to withdraw");
        payable(owner()).transfer(balance);
    }

    function getBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }

    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Emergency function to recover any stuck tokens
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}