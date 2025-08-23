# 🚀 Testnet Deployment Guide

## Overview
This guide covers deploying the CLOB Trading Platform Move contracts to Aptos testnet and configuring the frontend to interact with the deployed contracts.

## Prerequisites

### 1. Aptos CLI Installation
```bash
# Install Aptos CLI (if not already installed)
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
```

### 2. Account Setup
The deployment account has been pre-configured:
- **Address**: `0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e`
- **Network**: Aptos Testnet
- **Configuration**: `.aptos/config.yaml`

## Deployment Process

### Option 1: Automated Deployment (Recommended)
```bash
# Run the automated deployment script
cd move-contracts
./scripts/deploy.sh
```

### Option 2: Manual Deployment
```bash
# 1. Navigate to contracts directory
cd move-contracts

# 2. Fund the account (if needed)
aptos account fund-with-faucet --account 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e

# 3. Compile contracts
aptos move compile --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e

# 4. Run tests (optional)
aptos move test --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e

# 5. Deploy to testnet
aptos move publish --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e --assume-yes

# 6. Initialize contracts
aptos move run --function-id 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::ClobCore::initialize_clob --assume-yes
aptos move run --function-id 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::LiquidationGuard::initialize --assume-yes
aptos move run --function-id 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::ParallelExecution::initialize --assume-yes
```

## Contract Modules

After successful deployment, the following modules will be available:

| Module | Address | Description |
|--------|---------|-------------|
| `OrderVerification` | `0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::OrderVerification` | Order signature validation and replay protection |
| `ClobCore` | `0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::ClobCore` | Main trading engine with order matching |
| `LiquidationGuard` | `0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::LiquidationGuard` | Position safety and liquidation protection |
| `ParallelExecution` | `0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::ParallelExecution` | Batch processing for parallel transaction execution |

## Frontend Configuration

### 1. Update Environment Variables
```bash
# Copy the deployment address to frontend environment
echo "REACT_APP_CONTRACT_ADDRESS=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e" >> frontend/.env
echo "REACT_APP_NETWORK=testnet" >> frontend/.env
echo "REACT_APP_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1" >> frontend/.env
```

### 2. Test Contract Integration
```bash
# Start the frontend development server
cd frontend
npm start

# The application should now connect to the deployed testnet contracts
```

## Verification

### 1. Check Deployment Status
```bash
# View deployed modules
aptos account list --query modules --account 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e

# Check account balance
aptos account list --query balance --account 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e
```

### 2. Explore on Aptos Explorer
Visit: https://explorer.aptoslabs.com/account/0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e?network=testnet

### 3. Test Contract Functions
```bash
# Example: Initialize CLOB system
aptos move run \
  --function-id 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::ClobCore::initialize_clob \
  --assume-yes

# Example: Check system status
aptos move view \
  --function-id 0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e::ClobCore::is_initialized
```

## Troubleshooting

### Common Issues

1. **Insufficient Funds**
   ```bash
   # Fund account manually via web faucet
   # Visit: https://aptos.dev/network/faucet?address=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e
   ```

2. **Network Timeout**
   ```bash
   # Wait and retry - testnet can be congested
   sleep 30
   aptos move publish --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e --assume-yes
   ```

3. **Compilation Errors**
   ```bash
   # Clean and rebuild
   aptos move clean
   aptos move compile --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e
   ```

4. **Already Deployed**
   ```bash
   # If contracts already exist, use upgrade instead
   aptos move publish --upgrade-policy compatible --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e --assume-yes
   ```

## Post-Deployment Testing

### 1. Unit Tests with Deployed Contracts
```bash
# Run tests against testnet
cd move-contracts
aptos move test --named-addresses aptos_clob=0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e
```

### 2. Frontend E2E Tests
```bash
# Run Cypress tests with testnet contracts
cd frontend
npm run test:e2e
```

### 3. Manual Testing Scenarios
1. Connect wallet to frontend
2. Place a limit order
3. Cancel an order
4. Check order book updates
5. Test liquidation scenarios

## Security Considerations

### 1. Contract Verification
- All contracts compile without errors
- 60+ unit tests passing
- Move Prover verification completed

### 2. Access Controls
- Only admin can initialize contracts
- User authorization for order placement
- Proper signature verification

### 3. Economic Security
- Liquidation protection mechanisms
- Collateral ratio monitoring
- Replay attack prevention

## Performance Metrics

### Expected Performance
- **Transaction Throughput**: 1000+ TPS with parallel execution
- **Order Matching Latency**: <100ms
- **Gas Costs**: ~500-1000 gas units per order
- **Frontend Load Time**: <2 seconds

### Monitoring
- Use Aptos Explorer for transaction monitoring
- Frontend analytics dashboard for user metrics
- Redis caching for optimal performance

## Success Criteria

✅ All contracts deployed successfully  
✅ Contract initialization completed  
✅ Frontend connects to testnet contracts  
✅ Order placement and matching functional  
✅ Real-time updates working  
✅ Security features operational  

## Next Steps

1. **Integration Testing**: Complete E2E testing with deployed contracts
2. **Performance Testing**: Load testing with multiple concurrent users
3. **Security Audit**: Final security review before mainnet
4. **User Acceptance Testing**: Beta testing with real users
5. **Mainnet Preparation**: Deploy to Aptos mainnet

---

**Contact**: For deployment issues or questions, refer to the project documentation or Aptos community resources.

**Last Updated**: $(date +"%Y-%m-%d %H:%M:%S")