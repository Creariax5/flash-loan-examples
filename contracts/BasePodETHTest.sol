// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BasePodETHTest
 * @dev Minimal podETH test for Base network - no imports to avoid size limit
 */
contract BasePodETHTest {
    address public owner;
    
    // Base addresses
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant POD_ETH = 0x433aA366c4dc76aaB00C02E17531ca1A8570De0C;
    address public constant PF_USDC_VAULT = 0xAbE754EE72Be07F2707a26Da0724Ac5619295b04;
    address public constant PF_USDC_POD_ETH_PAIR = 0xEd988C42840517989ca99458153fD204899Af09b;
    address public constant WETH_USDC_PAIR = 0xd0b53D9277642d899DF5C87A3966A349A798F224;
    
    event Step(uint8 step, bool success, string reason);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // Fund contract with USDC
    function fund() external onlyOwner {
        // Transfer 0.1 USDC from owner to contract
        (bool success,) = USDC.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), 100000)
        );
        require(success, "USDC transfer failed");
    }
    
    // Step 1: USDC → pfUSDC (deposit in vault)
    function testStep1() external onlyOwner returns (bool) {
        try this.step1() {
            emit Step(1, true, "Success");
            return true;
        } catch Error(string memory reason) {
            emit Step(1, false, reason);
            return false;
        } catch {
            emit Step(1, false, "Unknown error");
            return false;
        }
    }
    
    function step1() external {
        require(msg.sender == address(this), "Only self");
        
        // Check USDC balance
        (bool success, bytes memory data) = USDC.call(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(success, "USDC balance check failed");
        uint256 usdcBalance = abi.decode(data, (uint256));
        require(usdcBalance >= 100000, "Need 0.1 USDC");
        
        // Check vault asset
        (success, data) = PF_USDC_VAULT.call(abi.encodeWithSignature("asset()"));
        require(success, "Vault asset check failed");
        address vaultAsset = abi.decode(data, (address));
        require(vaultAsset == USDC, "Vault doesn't use USDC");
        
        // Approve vault
        (success,) = USDC.call(
            abi.encodeWithSignature("approve(address,uint256)", PF_USDC_VAULT, 100000)
        );
        require(success, "USDC approve failed");
        
        // Deposit in vault
        (success, data) = PF_USDC_VAULT.call(
            abi.encodeWithSignature("deposit(uint256,address)", 100000, address(this))
        );
        require(success, "Vault deposit failed");
        uint256 shares = abi.decode(data, (uint256));
        require(shares > 0, "No shares received");
    }
    
    // Step 2: pfUSDC → podETH (swap on Uniswap)
    function testStep2() external onlyOwner returns (bool) {
        try this.step2() {
            emit Step(2, true, "Success");
            return true;
        } catch Error(string memory reason) {
            emit Step(2, false, reason);
            return false;
        } catch {
            emit Step(2, false, "Unknown error");
            return false;
        }
    }
    
    function step2() external {
        require(msg.sender == address(this), "Only self");
        
        // Get pfUSDC balance
        (bool success, bytes memory data) = PF_USDC_VAULT.call(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(success, "pfUSDC balance check failed");
        uint256 pfUsdcAmount = abi.decode(data, (uint256));
        require(pfUsdcAmount > 0, "No pfUSDC");
        
        // Check pair reserves
        (success, data) = PF_USDC_POD_ETH_PAIR.call(abi.encodeWithSignature("getReserves()"));
        require(success, "Pair reserves check failed");
        (uint112 reserve0, uint112 reserve1,) = abi.decode(data, (uint112, uint112, uint32));
        require(reserve0 > 0 && reserve1 > 0, "No liquidity");
        
        // Get token0
        (success, data) = PF_USDC_POD_ETH_PAIR.call(abi.encodeWithSignature("token0()"));
        require(success, "Token0 check failed");
        address token0 = abi.decode(data, (address));
        
        // Calculate swap output
        bool isToken0 = (token0 == PF_USDC_VAULT);
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;
        uint256 amountOut = (pfUsdcAmount * 997 * reserveOut) / (reserveIn * 1000 + pfUsdcAmount * 997);
        require(amountOut > 0, "No output");
        
        // Transfer to pair
        (success,) = PF_USDC_VAULT.call(
            abi.encodeWithSignature("transfer(address,uint256)", PF_USDC_POD_ETH_PAIR, pfUsdcAmount)
        );
        require(success, "Transfer to pair failed");
        
        // Swap
        (uint256 amount0Out, uint256 amount1Out) = isToken0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        (success,) = PF_USDC_POD_ETH_PAIR.call(
            abi.encodeWithSignature("swap(uint256,uint256,address,bytes)", amount0Out, amount1Out, address(this), "")
        );
        require(success, "Swap failed");
    }
    
    // Step 3: podETH → WETH (debond)
    function testStep3() external onlyOwner returns (bool) {
        try this.step3() {
            emit Step(3, true, "Success");
            return true;
        } catch Error(string memory reason) {
            emit Step(3, false, reason);
            return false;
        } catch {
            emit Step(3, false, "Unknown error");
            return false;
        }
    }
    
    function step3() external {
        require(msg.sender == address(this), "Only self");
        
        // Get podETH balance
        (bool success, bytes memory data) = POD_ETH.call(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(success, "podETH balance check failed");
        uint256 podEthAmount = abi.decode(data, (uint256));
        require(podEthAmount > 0, "No podETH");
        
        // Check if WETH is in pod
        (success, data) = POD_ETH.call(
            abi.encodeWithSignature("isAsset(address)", WETH)
        );
        require(success, "WETH asset check failed");
        bool hasWeth = abi.decode(data, (bool));
        require(hasWeth, "WETH not in pod");
        
        // Debond to WETH
        address[] memory tokens = new address[](1);
        tokens[0] = WETH;
        uint8[] memory percentages = new uint8[](1);
        percentages[0] = 100;
        
        (success,) = POD_ETH.call(
            abi.encodeWithSignature("debond(uint256,address[],uint8[])", podEthAmount, tokens, percentages)
        );
        require(success, "Debond failed");
    }
    
    // Step 4: WETH → USDC (swap)
    function testStep4() external onlyOwner returns (bool) {
        try this.step4() {
            emit Step(4, true, "Success");
            return true;
        } catch Error(string memory reason) {
            emit Step(4, false, reason);
            return false;
        } catch {
            emit Step(4, false, "Unknown error");
            return false;
        }
    }
    
    function step4() external {
        require(msg.sender == address(this), "Only self");
        
        // Get WETH balance
        (bool success, bytes memory data) = WETH.call(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(success, "WETH balance check failed");
        uint256 wethAmount = abi.decode(data, (uint256));
        require(wethAmount > 0, "No WETH");
        
        // Check pair reserves
        (success, data) = WETH_USDC_PAIR.call(abi.encodeWithSignature("getReserves()"));
        require(success, "WETH/USDC pair reserves failed");
        (uint112 reserve0, uint112 reserve1,) = abi.decode(data, (uint112, uint112, uint32));
        require(reserve0 > 0 && reserve1 > 0, "No WETH/USDC liquidity");
        
        // Get token0
        (success, data) = WETH_USDC_PAIR.call(abi.encodeWithSignature("token0()"));
        require(success, "WETH/USDC token0 failed");
        address token0 = abi.decode(data, (address));
        
        // Calculate swap
        bool isToken0 = (token0 == WETH);
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;
        uint256 amountOut = (wethAmount * 997 * reserveOut) / (reserveIn * 1000 + wethAmount * 997);
        require(amountOut > 0, "No USDC output");
        
        // Transfer WETH to pair
        (success,) = WETH.call(
            abi.encodeWithSignature("transfer(address,uint256)", WETH_USDC_PAIR, wethAmount)
        );
        require(success, "WETH transfer failed");
        
        // Swap
        (uint256 amount0Out, uint256 amount1Out) = isToken0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        (success,) = WETH_USDC_PAIR.call(
            abi.encodeWithSignature("swap(uint256,uint256,address,bytes)", amount0Out, amount1Out, address(this), "")
        );
        require(success, "WETH to USDC swap failed");
    }
    
    // Test all steps
    function testAll() external onlyOwner returns (uint8) {
        if (!this.testStep1()) return 1;
        if (!this.testStep2()) return 2;
        if (!this.testStep3()) return 3;
        if (!this.testStep4()) return 4;
        return 0; // All passed
    }
    
    // Check balances
    function balances() external view returns (uint256 usdc, uint256 pfUsdc, uint256 podEth, uint256 weth) {
        (bool success, bytes memory data) = USDC.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (success) usdc = abi.decode(data, (uint256));
        
        (success, data) = PF_USDC_VAULT.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (success) pfUsdc = abi.decode(data, (uint256));
        
        (success, data) = POD_ETH.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (success) podEth = abi.decode(data, (uint256));
        
        (success, data) = WETH.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (success) weth = abi.decode(data, (uint256));
    }
    
    // Emergency withdraw
    function withdraw(address token) external onlyOwner {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (success) {
            uint256 balance = abi.decode(data, (uint256));
            if (balance > 0) {
                token.call(abi.encodeWithSignature("transfer(address,uint256)", owner, balance));
            }
        }
    }
}
