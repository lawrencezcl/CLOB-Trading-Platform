const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    // Test files configuration
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    
    // Environment variables
    env: {
      apiUrl: 'http://localhost:3001',
      testnetUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
      coverage: false
    },
    
    // Chrome browser configuration for better performance
    chromeWebSecurity: false,
    
    // Test isolation - start fresh for each test
    testIsolation: true,
    
    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Setup node events for plugins
    setupNodeEvents(on, config) {
      // Task registration for custom commands
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        
        // Custom task for generating test data
        generateTestData() {
          return {
            testUser: {
              address: '0x1234567890abcdef',
              privateKey: 'test_private_key',
              balance: {
                apt: 1000,
                usdc: 5000
              }
            },
            testOrders: [
              {
                side: 'buy',
                price: 8.5,
                quantity: 100,
                type: 'limit'
              },
              {
                side: 'sell',
                price: 8.6,
                quantity: 150,
                type: 'limit'
              }
            ]
          };
        },
        
        // Task for setting up test environment
        setupTestEnvironment() {
          // Initialize test database, mock services, etc.
          return 'Test environment ready';
        },
        
        // Task for cleaning up after tests
        cleanupTestData() {
          // Clean up test data, reset state, etc.
          return 'Cleanup completed';
        }
      });

      // Coverage plugin (if needed)
      if (config.env.coverage) {
        require('@cypress/code-coverage/task')(on, config);
      }

      return config;
    },
  },

  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
    specPattern: 'src/components/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.js',
  },

  // Global configuration
  watchForFileChanges: true,
  numTestsKeptInMemory: 50,
  
  // Experimental features
  experimentalStudio: false,
  experimentalWebKitSupport: false
});