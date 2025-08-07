# Flash Loan with Uniswap Integration - Refactored Architecture

This project demonstrates Aave V3 flash loans integrated with Uniswap V2 swaps using a clean, modular architecture.

## 📁 Project Structure

```
contracts/
├── interfaces/
│   ├── IAave.sol           # Aave V3 protocol interfaces
│   └── IUniswap.sol        # Uniswap V2 protocol interfaces
├── libraries/
│   └── SwapLibrary.sol     # Reusable swap calculation functions
├── AaveFlashBorrowerV2.sol # Main flash loan contract with swap integration
└── UniswapV2SimpleSwap.sol # Dedicated swap execution contract
```

## 🏗️ Architecture Overview

### **Separation of Concerns**

1. **Interfaces** (`interfaces/`)
   - Clean interface definitions for external protocols
   - Well-documented function signatures
   - Easy to update when protocols change

2. **Libraries** (`libraries/`)
   - Pure functions for calculations
   - Reusable across multiple contracts
   - Gas-efficient library linking

3. **Core Contracts**
   - **AaveFlashBorrowerV2**: Orchestrates flash loans and swaps
   - **UniswapV2SimpleSwap**: Handles swap execution logic

## 🚀 Key Improvements

### **Readability & Maintainability**
- ✅ Clear function organization with sections
- ✅ Comprehensive documentation
- ✅ Consistent naming conventions
- ✅ Modular file structure

### **Security Enhancements**
- ✅ ReentrancyGuard protection
- ✅ Input validation functions
- ✅ Structured error handling
- ✅ Access control patterns

### **Gas Optimization**
- ✅ Library functions for reusable logic
- ✅ Struct packing for parameters
- ✅ Efficient storage patterns

### **Developer Experience**
- ✅ Rich event logging
- ✅ Preview functions for testing
- ✅ Emergency functions for safety
- ✅ Deployment automation

## 📋 Usage Examples

### **Simple Flash Loan (No Swap)**
```solidity
// Just borrow and repay with fee
flashBorrower.requestFlashLoan(
    USDC_ADDRESS,  // Asset to borrow
    1000000        // Amount (1 USDC)
);
```

### **Flash Loan with Swap**
```solidity
// Borrow USDC, swap some to WETH, repay loan
flashBorrower.requestFlashLoanWithSwap(
    USDC_ADDRESS,      // Asset to flash loan
    1000000,           // Amount to borrow (1 USDC)
    USDC_WETH_PAIR,    // Uniswap pair address
    WETH_ADDRESS,      // Token to swap to
    500000             // Amount to swap (0.5 USDC)
);
```

### **Preview Swap Output**
```solidity
// Check expected output before executing
uint256 expectedOut = simpleSwap.previewSwapOut(
    USDC_WETH_PAIR,  // Pair address
    USDC_ADDRESS,    // Input token
    500000           // Input amount
);
```

## 🔧 Deployment

Run the deployment script:
```bash
npx hardhat run scripts/deploy-refactored.js --network <network-name>
```

This will deploy contracts in the correct order and save deployment info to `deployments/`.

## 🧪 Testing Strategy

### **Unit Tests**
- Test each contract in isolation
- Mock external dependencies
- Test edge cases and error conditions

### **Integration Tests**
- Test full flash loan + swap workflow
- Test with real Uniswap pairs (on forks)
- Test gas costs and slippage

### **Security Tests**
- Reentrancy attack prevention
- Access control enforcement
- Input validation effectiveness

## 🎯 Benefits of This Architecture

### **For Developers:**
- Easy to understand and modify
- Clear separation of concerns
- Comprehensive documentation
- Type-safe interfaces

### **For Auditors:**
- Focused contract responsibilities
- Clear data flow
- Explicit security measures
- Well-defined interfaces

### **For Users:**
- Reliable and tested code
- Emergency safety features
- Transparent event logging
- Predictable gas costs

## 🔄 Future Extensions

This modular architecture makes it easy to:

1. **Add New DEX Support**
   - Create new interfaces in `interfaces/`
   - Add swap logic to libraries
   - Minimal changes to main contracts

2. **Add New Flash Loan Providers**
   - Create provider-specific interfaces
   - Implement provider-specific logic
   - Reuse existing swap infrastructure

3. **Add Advanced Features**
   - Multi-hop swaps
   - Slippage protection
   - MEV protection
   - Batch operations

## ⚡ Contract Interaction Flow

```
User Request → AaveFlashBorrower → Aave Pool
     ↓                ↓               ↓
Execute Logic ← Flash Loan Sent ← Flash Loan
     ↓
UniswapV2SimpleSwap → Uniswap Pair
     ↓                      ↓
Swap Executed ← Tokens Swapped
     ↓
Repay Flash Loan → Aave Pool
```

## 📊 Gas Optimization Tips

1. **Use Libraries**: Mathematical operations are more gas-efficient
2. **Struct Parameters**: Pack related parameters into structs
3. **View Functions**: Use for calculations that don't modify state
4. **Event Indexing**: Use indexed parameters for efficient filtering
5. **Batch Operations**: Combine multiple operations when possible

This refactored architecture provides a solid foundation for complex DeFi operations while maintaining clarity and security.
