#!/usr/bin/env node

const axios = require('axios');

/**
 * API Integration Test Script
 * Tests connectivity and data format from external trading APIs
 */

const APIs = {
  // Note: These are example endpoints - actual APIs may differ
  MERKLE_TRADE: 'https://api.merkletrade.com/api/v1/orderbook?symbol=APT-USDC&depth=20',
  HYPERION: 'https://api.hyperion.xyz/v2/liquidity/pools?asset=APT',
  TAPP_EXCHANGE: 'https://api.tappexchange.com/v1/market/orderbook/APTUSDC',
  APTOS_GRAPHQL: 'https://fullnode.testnet.aptoslabs.com/v1/graphql'
};

async function testAPI(name, url, options = {}) {
  console.log(`\n🔍 Testing ${name}...`);
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Aptos-CLOB-Platform/1.0',
        ...options.headers
      },
      ...options
    });
    
    console.log(`✅ ${name} - Status: ${response.status}`);
    console.log(`📊 Data preview:`, JSON.stringify(response.data).substring(0, 200) + '...');
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 100)}...`);
    }
    return { success: false, error: error.message };
  }
}

async function testAptosGraphQL() {
  console.log(`\n🔍 Testing Aptos GraphQL...`);
  const query = `
    query {
      processor_status {
        processor
        last_success_version
        last_updated
      }
    }
  `;

  try {
    const response = await axios.post(APIs.APTOS_GRAPHQL, {
      query: query
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`✅ Aptos GraphQL - Status: ${response.status}`);
    console.log(`📊 Data:`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`❌ Aptos GraphQL - Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting API Integration Tests\n');
  console.log('=' .repeat(50));

  const results = {};

  // Test individual APIs
  results.merkle = await testAPI('Merkle Trade', APIs.MERKLE_TRADE);
  results.hyperion = await testAPI('Hyperion', APIs.HYPERION);
  results.tapp = await testAPI('Tapp Exchange', APIs.TAPP_EXCHANGE);
  results.aptosGraphQL = await testAptosGraphQL();

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📋 TEST SUMMARY');
  console.log('=' .repeat(50));

  const successCount = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n✅ Successful: ${successCount}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - successCount}/${totalTests}`);

  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${name}: ${result.success ? 'OK' : result.error}`);
  });

  if (successCount === totalTests) {
    console.log('\n🎉 All API tests passed! Ready for integration.');
  } else {
    console.log('\n⚠️  Some APIs failed. Check configurations or use mock data for development.');
  }

  return results;
}

// Export for use in other modules
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testAPI, testAptosGraphQL, runTests };