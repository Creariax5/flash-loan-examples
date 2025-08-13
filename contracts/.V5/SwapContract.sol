// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
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
    
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
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

contract SwapContract {
    address constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PF_USDC_VAULT = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    address constant V2_ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;

    function swapPfUsdcToPodEth(uint256 amount) external {
        IERC20(PF_USDC_VAULT).transferFrom(msg.sender, address(this), amount);
        IERC20(PF_USDC_VAULT).approve(V2_ROUTER, amount);
        
        address[] memory path = new address[](2);
        path[0] = PF_USDC_VAULT;
        path[1] = POD_ETH;
        
        IUniswapV2Router(V2_ROUTER).swapExactTokensForTokens(
            amount,
            0,
            path,
            msg.sender,
            block.timestamp + 1800
        );
    }

    function swapPodEthToPfUsdc(uint256 amount) external {
        IERC20(POD_ETH).transferFrom(msg.sender, address(this), amount);
        IERC20(POD_ETH).approve(V2_ROUTER, amount);
        
        address[] memory path = new address[](2);
        path[0] = POD_ETH;
        path[1] = PF_USDC_VAULT;
        
        IUniswapV2Router(V2_ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount,
            0,
            path,
            msg.sender,
            block.timestamp + 1800
        );
    }

    function swapUsdcToEth(uint256 amount) external {
        IERC20(USDC).transferFrom(msg.sender, address(this), amount);
        IERC20(USDC).approve(V3_ROUTER, amount);
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: USDC,
            tokenOut: WETH,
            fee: 500,
            recipient: msg.sender,
            amountIn: amount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        ISwapRouter(V3_ROUTER).exactInputSingle(params);
    }

    function swapEthToUsdc() external payable {
        IWETH(WETH).deposit{value: msg.value}();
        IWETH(WETH).approve(V3_ROUTER, msg.value);
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 500,
            recipient: msg.sender,
            amountIn: msg.value,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        ISwapRouter(V3_ROUTER).exactInputSingle(params);
    }
}