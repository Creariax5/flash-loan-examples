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

interface ISimpleMultiWrapper {
    function wrap() external payable;
    function unwrap(uint256 amount) external;
    function deposit(uint256 amount) external;
    function withdraw(uint256 shares) external;
}

interface ISwapContract {
    //V2
    function swapPfUsdcToPodEth(uint256 amount) external;
    function swapPodEthToPfUsdc(uint256 amount) external;
    //V3
    function swapUsdcToEth(uint256 amount) external;
    function swapEthToUsdc() external payable;
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IIndexUtils {
    function bond(address _indexFund, address _token, uint256 _amount, uint256 _amountMintMin) external;
}

interface IPodETH {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function debond(uint256 amount, address[] memory tokens, uint8[] memory percentages) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AaveFlashBorrower is IFlashLoanSimpleReceiver, Ownable {
    IPool public immutable pool;
    address constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant INDEX_UTILS = 0x490B03C6afe733576cF1f5D2A821cF261B15826d;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PF_USDC_VAULT = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    address constant WRAPPER = 0xAdb65cA86cC17BEB094A3B2A094f75642DFA45a2;
    address constant SWAPPER = 0x880081Ba74Eb121d825F7721FF90F30406DE5163;

    event Debug(string message);

    constructor(address _addressesProvider) {
        pool = IPool(IPoolAddressesProvider(_addressesProvider).getPool());
        _transferOwnership(msg.sender);
    }

    receive() external payable {}

    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata) external override returns (bool) {
        require(msg.sender == address(pool) && initiator == address(this));
        
        uint256 repayAmount = amount + premium;

        _executeSimpleLogic(asset, amount, premium);

        require(IERC20(asset).balanceOf(address(this)) >= repayAmount, "Insufficient balance to repay flash mint");
        IERC20(asset).approve(address(pool), repayAmount);
        return true;
    }

    function _executeSimpleLogic(
        address asset,
        uint256 amount,
        uint256 premium
    ) private returns (bool) {
        
        // USDC -> pfUSDC
        emit Debug("USDC -> pfUSDC");
        IUSDC(USDC).approve(PF_USDC_VAULT, amount);
        IVault(PF_USDC_VAULT).deposit(amount, address(this));
        uint256 pfUSDC_balance = IERC20(PF_USDC_VAULT).balanceOf(address(this));
        require(pfUSDC_balance > 0, "0 pfUSDC received");

        // pfUSDC -> PodETH
        emit Debug("pfUSDC -> PodETH");
        IERC20(PF_USDC_VAULT).approve(SWAPPER, pfUSDC_balance);
        ISwapContract(SWAPPER).swapPfUsdcToPodEth(pfUSDC_balance);
        uint256 podEth_balance = IERC20(POD_ETH).balanceOf(address(this));
        require(podEth_balance > 0, "0 PodETH received");

        // PodETH -> WETH (direct debond)
        emit Debug("PodETH -> WETH");
        address[] memory tokens = new address[](1);
        tokens[0] = WETH;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        IPodETH(POD_ETH).debond(podEth_balance, tokens, percentages);
        uint256 weth_balance = IWETH(WETH).balanceOf(address(this));
        require(weth_balance > 0, "0 WETH received from debond");

        // WETH -> ETH -> USDC
        emit Debug("WETH -> ETH -> USDC");
        IWETH(WETH).withdraw(weth_balance);
        ISwapContract(SWAPPER).swapEthToUsdc{value: weth_balance}();
        uint256 usdc_balance = IERC20(USDC).balanceOf(address(this));
        require(usdc_balance >= amount + premium, "Insufficient USDC balance after swap");

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
        require(balance > 0);
        IERC20(asset).transfer(owner(), balance);
    }

    function getBalance(address asset) external view returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }
}