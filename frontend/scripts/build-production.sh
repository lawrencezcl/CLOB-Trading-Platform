#!/bin/bash

# CLOB Trading Platform - Production Build Script
# Optimized build process for Vercel deployment

set -e

echo "🚀 Starting CLOB Trading Platform production build..."

# Environment Setup
export NODE_ENV=production
export REACT_APP_ENVIRONMENT=production
export GENERATE_SOURCEMAP=false
export CI=false

# Build Information
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_VERSION="1.0.0"

echo "📦 Build Information:"
echo "  - Version: $BUILD_VERSION"
echo "  - Hash: $BUILD_HASH"
echo "  - Time: $BUILD_TIME"
echo "  - Environment: $NODE_ENV"

# Install dependencies with CI optimization
echo "📥 Installing dependencies..."
npm ci --only=production --silent

# Build the application
echo "🔨 Building React application..."
npm run build

# Optimize build output
echo "⚡ Optimizing build output..."

# Remove source maps if they exist
find build/static -name "*.map" -delete 2>/dev/null || true

# Create build info file
cat > build/build-info.json << EOF
{
  "version": "$BUILD_VERSION",
  "buildHash": "$BUILD_HASH",
  "buildTime": "$BUILD_TIME",
  "environment": "$NODE_ENV",
  "aptos": {
    "network": "$REACT_APP_APTOS_NETWORK",
    "nodeUrl": "$REACT_APP_APTOS_NODE_URL",
    "contractAddress": "$REACT_APP_CONTRACT_ADDRESS"
  }
}
EOF

# Analyze bundle size
echo "📊 Analyzing bundle size..."
if command -v npx &> /dev/null; then
    npx --yes bundle-analyzer build/static/js/*.js --no-open --format text || echo "Bundle analyzer not available"
fi

# Verify critical files exist
echo "✅ Verifying build output..."
if [ ! -f "build/index.html" ]; then
    echo "❌ Build failed: index.html not found"
    exit 1
fi

if [ ! -d "build/static" ]; then
    echo "❌ Build failed: static directory not found"
    exit 1
fi

# Calculate build size
BUILD_SIZE=$(du -sh build | cut -f1)
echo "📦 Build size: $BUILD_SIZE"

# List important files
echo "📋 Build contents:"
ls -la build/
echo ""
ls -la build/static/

echo "✅ Production build completed successfully!"
echo "🎯 Ready for deployment to Vercel"