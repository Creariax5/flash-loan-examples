// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IDecentralizedIndex {
    function flashMint(address _recipient, uint256 _amount, bytes calldata _data) external;
}

interface IFlashLoanRecipient {
    function callback(bytes calldata _data) external;
}

interface IPodETH {
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
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
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

contract SimpleArbitrage is IFlashLoanRecipient {
    address constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PF_USDC_VAULT = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    address constant V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    address public owner;
    uint256 private flashAmount;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function arbitrage(uint256 amount) external onlyOwner {
        flashAmount = amount;
        IDecentralizedIndex(POD_ETH).flashMint(address(this), amount, "");
    }

    function callback(bytes calldata) external override {
        require(msg.sender == POD_ETH);
        
        // 1. podETH → WETH (debond)
        address[] memory tokens = new address[](1);
        tokens[0] = WETH;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        IPodETH(POD_ETH).debond(flashAmount, tokens, percentages);
        
        // 2. WETH → USDC (V3 swap)
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        IERC20(WETH).approve(V3_ROUTER, wethBalance);
        ISwapRouter(V3_ROUTER).exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 500,
            recipient: address(this),
            amountIn: wethBalance,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        }));
        
        // 3. USDC → pfUSDC (vault deposit)
        uint256 usdcBalance = IERC20(USDC).balanceOf(address(this));
        IERC20(USDC).approve(PF_USDC_VAULT, usdcBalance);
        IVault(PF_USDC_VAULT).deposit(usdcBalance, address(this));
        
        // 4. pfUSDC → podETH (V2 swap)
        uint256 pfUsdcBalance = IERC20(PF_USDC_VAULT).balanceOf(address(this));
        IERC20(PF_USDC_VAULT).approve(V2_ROUTER, pfUsdcBalance);
        address[] memory path = new address[](2);
        path[0] = PF_USDC_VAULT;
        path[1] = POD_ETH;
        IUniswapV2Router(V2_ROUTER).swapExactTokensForTokens(
            pfUsdcBalance,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
        
        // 5. Repay flash mint (amount + 0.1% fee)
        uint256 fee = flashAmount / 1000;
        if (fee == 0) fee = 1;
        IERC20(POD_ETH).transfer(POD_ETH, flashAmount + fee);
    }
    
    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
    }
}