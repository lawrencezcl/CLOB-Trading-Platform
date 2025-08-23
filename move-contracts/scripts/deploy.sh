#!/bin/bash

# CLOB Trading Platform - Testnet Deployment Script
# This script deploys the Move contracts to Aptos testnet

set -e

echo "🚀 Starting CLOB Trading Platform Testnet Deployment..."

# Configuration
TESTNET_ACCOUNT="0x0cb059f1b02c44a9f485f6a529106c0ace6635da6c148dd1f66ee40502e4bb6e"
TESTNET_URL="https://fullnode.testnet.aptoslabs.com/v1"
FAUCET_URL="https://faucet.testnet.aptoslabs.com"

# Change to the move-contracts directory
cd "$(dirname "$0")/.."

echo "📍 Current directory: $(pwd)"
echo "🔑 Testnet Account: $TESTNET_ACCOUNT"

# Step 1: Check Aptos CLI installation
if ! command -v aptos &> /dev/null; then
    echo "❌ Aptos CLI not found. Please install from https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli"
    exit 1
fi

echo "✅ Aptos CLI found: $(aptos --version)"

# Step 2: Check configuration
echo "🔍 Checking Aptos CLI configuration..."
if aptos config show-profiles > /dev/null 2>&1; then
    echo "✅ Aptos CLI configuration found"
    aptos config show-profiles
else
    echo "❌ Aptos CLI not configured. Please run 'aptos init --network testnet' first"
    exit 1
fi

# Step 3: Check account balance
echo "💰 Checking account balance..."
BALANCE=$(aptos account list --query balance --account $TESTNET_ACCOUNT | jq '."Result"[0]' 2>/dev/null || echo "0")
echo "Current balance: $BALANCE APT"

if [ "$BALANCE" -lt "100000000" ]; then
    echo "⚠️  Low balance detected. Attempting to fund from faucet..."
    
    # Try multiple faucet methods
    echo "🚰 Trying faucet method 1..."
    if aptos account fund-with-faucet --account $TESTNET_ACCOUNT --faucet-url $FAUCET_URL/v1/mint; then
        echo "✅ Funding successful via CLI"
    else
        echo "⚠️  CLI faucet failed, trying curl method..."
        
        # Try curl method
        CURL_RESPONSE=$(curl -s -X POST "$FAUCET_URL/mint" \
            -H "Content-Type: application/json" \
            -d "{\"address\":\"$TESTNET_ACCOUNT\",\"amount\":100000000}")
        
        if echo "$CURL_RESPONSE" | grep -q "success\|Success"; then
            echo "✅ Funding successful via curl"
        else
            echo "❌ Automatic funding failed. Please fund manually:"
            echo "   Visit: https://aptos.dev/network/faucet?address=$TESTNET_ACCOUNT"
            echo "   Or run: aptos account fund-with-faucet --account $TESTNET_ACCOUNT"
            read -p "Press Enter after funding the account..."
        fi
    fi
    
    # Recheck balance
    sleep 3
    NEW_BALANCE=$(aptos account list --query balance --account $TESTNET_ACCOUNT | jq '."Result"[0]' 2>/dev/null || echo "0")
    echo "New balance: $NEW_BALANCE APT"
fi

# Step 4: Compile contracts
echo "🔨 Compiling Move contracts..."
if aptos move compile --named-addresses aptos_clob=$TESTNET_ACCOUNT; then
    echo "✅ Compilation successful"
else
    echo "❌ Compilation failed"
    exit 1
fi

# Step 5: Run tests (optional but recommended)
echo "🧪 Running Move tests..."
if aptos move test --named-addresses aptos_clob=$TESTNET_ACCOUNT; then
    echo "✅ All tests passed"
else
    echo "⚠️  Some tests failed, but continuing with deployment..."
fi

# Step 6: Deploy contracts
echo "🚀 Deploying contracts to testnet..."
if aptos move publish --named-addresses aptos_clob=$TESTNET_ACCOUNT --assume-yes; then
    echo "✅ Deployment successful!"
    
    # Step 7: Verify deployment
    echo "🔍 Verifying deployment..."
    MODULES=$(aptos account list --query modules --account $TESTNET_ACCOUNT)
    echo "Deployed modules:"
    echo "$MODULES" | jq -r '.Result[]' 2>/dev/null || echo "$MODULES"
    
    # Step 8: Initialize contracts
    echo "🔧 Initializing contracts..."
    
    # Initialize CLOB Core
    echo "Initializing CLOB Core..."
    if aptos move run --function-id ${TESTNET_ACCOUNT}::ClobCore::initialize_clob --assume-yes; then
        echo "✅ CLOB Core initialized"
    else
        echo "⚠️  CLOB Core initialization failed (may already be initialized)"
    fi
    
    # Initialize Liquidation Guard
    echo "Initializing Liquidation Guard..."
    if aptos move run --function-id ${TESTNET_ACCOUNT}::LiquidationGuard::initialize --assume-yes; then
        echo "✅ Liquidation Guard initialized"
    else
        echo "⚠️  Liquidation Guard initialization failed (may already be initialized)"
    fi
    
    # Initialize Parallel Execution
    echo "Initializing Parallel Execution..."
    if aptos move run --function-id ${TESTNET_ACCOUNT}::ParallelExecution::initialize --assume-yes; then
        echo "✅ Parallel Execution initialized"
    else
        echo "⚠️  Parallel Execution initialization failed (may already be initialized)"
    fi
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📍 Contract Address: $TESTNET_ACCOUNT"
    echo "🌐 Network: Aptos Testnet"
    echo "🔗 Explorer: https://explorer.aptoslabs.com/account/$TESTNET_ACCOUNT?network=testnet"
    echo ""
    echo "📝 Available Modules:"
    echo "   • OrderVerification: ${TESTNET_ACCOUNT}::OrderVerification"
    echo "   • ClobCore: ${TESTNET_ACCOUNT}::ClobCore"  
    echo "   • LiquidationGuard: ${TESTNET_ACCOUNT}::LiquidationGuard"
    echo "   • ParallelExecution: ${TESTNET_ACCOUNT}::ParallelExecution"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Update frontend/.env with CONTRACT_ADDRESS=$TESTNET_ACCOUNT"
    echo "   2. Test contract interactions via frontend"
    echo "   3. Run E2E tests with deployed contracts"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
else
    echo "❌ Deployment failed"
    echo "📋 Common solutions:"
    echo "   • Check account has sufficient APT balance"
    echo "   • Verify network connectivity"
    echo "   • Try again in a few minutes (network congestion)"
    exit 1
fi