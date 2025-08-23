// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global before hook for all tests
beforeEach(() => {
  // Set up default viewport
  cy.viewport(1280, 720);
  
  // Clear local storage and cookies
  cy.clearLocalStorage();
  cy.clearCookies();
  
  // Set up common test data
  cy.window().then((win) => {
    win.localStorage.setItem('cypress-test-mode', 'true');
  });
});

// Global after hook for cleanup
afterEach(() => {
  // Clean up any test data
  cy.window().then((win) => {
    // Clean up any test-specific data
    Object.keys(win.localStorage).forEach(key => {
      if (key.startsWith('test-')) {
        win.localStorage.removeItem(key);
      }
    });
  });
});

// Handle uncaught exceptions to prevent test failures from non-critical errors
Cypress.on('uncaught:exception', (err, runnable) => {
  // Log the error for debugging
  console.error('Uncaught exception:', err);
  
  // Don't fail the test for these specific errors
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes('Non-Error promise rejection captured') ||
    err.message.includes('ChunkLoadError') ||
    err.message.includes('Loading chunk')
  ) {
    return false;
  }
  
  // Allow the test to fail for other errors
  return true;
});

// Configure network request stubbing
Cypress.on('window:before:load', (win) => {
  // Mock console errors in test mode
  if (Cypress.env('coverage')) {
    win.console.error = cy.stub().as('consoleError');
  }
});

// Add custom assertions
chai.use((chai, utils) => {
  // Custom assertion for checking if element is visible in viewport
  chai.Assertion.addMethod('beInViewport', function() {
    const obj = this._obj;
    
    this.assert(
      obj.isVisible(),
      'expected #{this} to be in viewport',
      'expected #{this} not to be in viewport'
    );
  });
  
  // Custom assertion for checking wallet connection status
  chai.Assertion.addMethod('beConnectedToWallet', function() {
    const obj = this._obj;
    
    cy.window().then((win) => {
      const isConnected = win.localStorage.getItem('wallet-connected') === 'true';
      this.assert(
        isConnected,
        'expected wallet to be connected',
        'expected wallet not to be connected'
      );
    });
  });
});