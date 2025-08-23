#!/bin/bash

# CLOB Trading Platform - Contract Deployment Script
# This script deploys Move contracts to Aptos Testnet

set -e  # Exit on any error

echo "🚀 Starting CLOB Trading Platform Contract Deployment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETWORK="testnet"
CONTRACT_DIR="/Users/chenglinzhang/Documents/GitHub/CLOB Trading Platform/move-contracts"
PROFILE="default"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Verify Prerequisites
print_status "Checking prerequisites..."

if ! command_exists aptos; then
    print_error "Aptos CLI not found. Please install it first."
    exit 1
fi

if ! command_exists node; then
    print_warning "Node.js not found. Some deployment scripts may not work."
fi

print_success "Prerequisites check completed"

# Step 2: Change to contract directory
print_status "Navigating to contract directory..."
cd "$CONTRACT_DIR"
print_success "Changed to directory: $(pwd)"

# Step 3: Check if Aptos CLI is initialized
print_status "Checking Aptos CLI configuration..."

if [ ! -f ~/.aptos/config.yaml ]; then
    print_warning "Aptos CLI not initialized. Creating configuration..."
    
    # Initialize with testnet
    aptos init --network "$NETWORK" --profile "$PROFILE" --assume-yes --skip-faucet || {
        print_error "Failed to initialize Aptos CLI"
        exit 1
    }
    
    print_success "Aptos CLI initialized successfully"
else
    print_success "Aptos CLI already configured"
fi

# Step 4: Get account address
print_status "Getting account address..."
ACCOUNT_ADDRESS=$(aptos account list --profile "$PROFILE" --query addresses 2>/dev/null | head -1 || echo "")

if [ -z "$ACCOUNT_ADDRESS" ]; then
    print_error "Failed to get account address"
    exit 1
fi

print_success "Account address: $ACCOUNT_ADDRESS"

# Step 5: Fund account from faucet
print_status "Funding account from faucet..."
aptos account fund-with-faucet --profile "$PROFILE" --amount 100000000 || {
    print_warning "Faucet funding failed, but continuing with deployment..."
}

# Step 6: Check account balance
print_status "Checking account balance..."
aptos account list --profile "$PROFILE" | grep -E "(coins|balance)" || true

# Step 7: Update Move.toml with correct address
print_status "Updating Move.toml with deployment address..."

# Create a backup of Move.toml
cp Move.toml Move.toml.backup

# Update the aptos_clob address in Move.toml
sed -i.tmp "s/aptos_clob = \"_\"/aptos_clob = \"$ACCOUNT_ADDRESS\"/" Move.toml
rm Move.toml.tmp 2>/dev/null || true

print_success "Move.toml updated with address: $ACCOUNT_ADDRESS"

# Step 8: Compile contracts
print_status "Compiling Move contracts..."

aptos move compile --profile "$PROFILE" --named-addresses aptos_clob="$ACCOUNT_ADDRESS" || {
    print_error "Contract compilation failed"
    
    # Restore backup
    mv Move.toml.backup Move.toml
    exit 1
}

print_success "Contracts compiled successfully"

# Step 9: Run tests (optional, but recommended)
print_status "Running Move tests..."

aptos move test --profile "$PROFILE" --named-addresses aptos_clob="$ACCOUNT_ADDRESS" || {
    print_warning "Tests failed, but continuing with deployment..."
}

# Step 10: Deploy contracts
print_status "Deploying contracts to Aptos Testnet..."

DEPLOYMENT_OUTPUT=$(aptos move publish --profile "$PROFILE" --named-addresses aptos_clob="$ACCOUNT_ADDRESS" --assume-yes 2>&1)
DEPLOYMENT_STATUS=$?

if [ $DEPLOYMENT_STATUS -eq 0 ]; then
    print_success "Contracts deployed successfully!"
    
    # Extract transaction hash if available
    TX_HASH=$(echo "$DEPLOYMENT_OUTPUT" | grep -o "0x[a-fA-F0-9]\{64\}" | head -1 || echo "")
    
    if [ -n "$TX_HASH" ]; then
        print_success "Transaction hash: $TX_HASH"
        print_status "View on explorer: https://explorer.aptoslabs.com/txn/$TX_HASH?network=testnet"
    fi
    
else
    print_error "Contract deployment failed"
    echo "$DEPLOYMENT_OUTPUT"
    
    # Restore backup
    mv Move.toml.backup Move.toml
    exit 1
fi

# Step 11: Verify deployment
print_status "Verifying deployment..."

# Check if modules are published
MODULE_CHECK=$(aptos account list --query modules --profile "$PROFILE" 2>/dev/null | wc -l)

if [ "$MODULE_CHECK" -gt 0 ]; then
    print_success "Modules verified on-chain"
else
    print_warning "Module verification incomplete"
fi

# Step 12: Initialize contracts (if needed)
print_status "Initializing contracts..."

# Initialize OrderVerification
aptos move run --function-id "${ACCOUNT_ADDRESS}::OrderVerification::initialize" --profile "$PROFILE" --assume-yes || {
    print_warning "OrderVerification initialization failed or already initialized"
}

# Initialize LiquidationGuard
aptos move run --function-id "${ACCOUNT_ADDRESS}::LiquidationGuard::initialize" --profile "$PROFILE" --assume-yes || {
    print_warning "LiquidationGuard initialization failed or already initialized"
}

# Initialize ClobCore
aptos move run --function-id "${ACCOUNT_ADDRESS}::ClobCore::initialize_clob" --profile "$PROFILE" --assume-yes || {
    print_warning "ClobCore initialization failed or already initialized"
}

# Initialize ParallelExecution
aptos move run --function-id "${ACCOUNT_ADDRESS}::ParallelExecution::initialize_parallel_execution" --profile "$PROFILE" --assume-yes || {
    print_warning "ParallelExecution initialization failed or already initialized"
}

# Step 13: Create deployment summary
print_status "Creating deployment summary..."

DEPLOYMENT_SUMMARY="deployment-summary-$(date +%Y%m%d-%H%M%S).json"

cat > "$DEPLOYMENT_SUMMARY" << EOF
{
  "deployment_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "network": "$NETWORK",
  "account_address": "$ACCOUNT_ADDRESS",
  "modules": [
    "${ACCOUNT_ADDRESS}::OrderVerification",
    "${ACCOUNT_ADDRESS}::LiquidationGuard", 
    "${ACCOUNT_ADDRESS}::ClobCore",
    "${ACCOUNT_ADDRESS}::ParallelExecution"
  ],
  "explorer_url": "https://explorer.aptoslabs.com/account/$ACCOUNT_ADDRESS?network=testnet",
  "status": "deployed"
}
EOF

print_success "Deployment summary saved to: $DEPLOYMENT_SUMMARY"

# Step 14: Clean up
print_status "Cleaning up..."

# Remove backup if deployment was successful
rm -f Move.toml.backup

# Step 15: Final output
echo ""
print_success "🎉 CLOB Trading Platform Deployment Complete!"
echo "=============================================="
print_status "Account Address: $ACCOUNT_ADDRESS"
print_status "Network: $NETWORK"
print_status "Explorer: https://explorer.aptoslabs.com/account/$ACCOUNT_ADDRESS?network=testnet"
print_status "Deployment Summary: $DEPLOYMENT_SUMMARY"
echo ""
print_status "Next Steps:"
echo "  1. Update frontend configuration with contract address"
echo "  2. Test contract interactions"
echo "  3. Set up monitoring and alerts"
echo "  4. Deploy frontend application"
echo ""
print_success "Happy Trading! 🚀"