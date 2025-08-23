/**
 * Basic Setup and Smoke Tests
 * 
 * These tests verify that the application loads correctly and
 * basic functionality is working before running more complex tests.
 */

describe('Basic Setup and Smoke Tests', () => {
  beforeEach(() => {
    // Set up mock data for each test
    cy.mockUserBalance(1000, 5000);
    cy.mockOrderBook();
    cy.mockMarketData();
    cy.mockWebSocket();
  });

  it('should load the application successfully', () => {
    cy.visit('/');
    
    // Check that the main page elements are present
    cy.get('[data-cy=trading-dashboard]').should('be.visible');
    cy.get('h1, h2').should('contain.text', 'CLOB Trading Platform');
    
    // Verify no critical errors in console
    cy.window().then((win) => {
      expect(win.console.error).to.not.have.been.called;
    });
  });

  it('should display market data correctly', () => {
    cy.visit('/');
    
    // Wait for page to load
    cy.waitForPageLoad();
    
    // Verify market data is displayed
    cy.get('[data-cy=last-price]').should('be.visible');
    cy.get('[data-cy=volume-24h]').should('be.visible');
    cy.get('[data-cy=change-24h]').should('be.visible');
    
    // Verify price format
    cy.get('[data-cy=last-price]').should('match', /\$\d+\.\d{2,4}/);
  });

  it('should handle navigation between sections', () => {
    cy.visit('/');
    
    // Test navigation to different sections
    const sections = ['Trading Dashboard', 'Order Book', 'Analytics', 'Cross-Chain'];
    
    sections.forEach((section) => {
      cy.contains(section).click();
      cy.url().should('include', section.toLowerCase().replace(' ', '-'));
    });
  });

  it('should be responsive on different screen sizes', () => {
    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.visit('/');
    cy.get('[data-cy=trading-dashboard]').should('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.visit('/');
    cy.get('[data-cy=trading-dashboard]').should('be.visible');
    
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.visit('/');
    cy.get('[data-cy=trading-dashboard]').should('be.visible');
  });

  it('should handle API failures gracefully', () => {
    // Mock API failures
    cy.intercept('GET', '**/api/user/balance', {
      statusCode: 500,
      body: { error: 'Server error' }
    });
    
    cy.intercept('GET', '**/api/orderbook/**', {
      statusCode: 503,
      body: { error: 'Service unavailable' }
    });
    
    cy.visit('/');
    
    // Application should still load with error handling
    cy.get('[data-cy=trading-dashboard]').should('be.visible');
    
    // Should show appropriate error messages
    cy.contains('Error').should('be.visible');
  });

  it('should persist user preferences', () => {
    cy.visit('/');
    
    // Change trading pair
    cy.selectTradingPair('APT-USDT');
    
    // Reload page
    cy.reload();
    
    // Preference should be persisted
    cy.get('[data-cy=trading-pair-selector]').should('have.value', 'APT-USDT');
  });

  it('should handle slow network conditions', () => {
    // Simulate slow network
    cy.intercept('GET', '**/api/**', (req) => {
      req.reply((res) => {
        res.delay(2000); // 2 second delay
      });
    });
    
    cy.visit('/');
    
    // Should show loading states
    cy.get('[data-cy=loading-spinner]').should('be.visible');
    
    // Should eventually load content
    cy.get('[data-cy=trading-dashboard]', { timeout: 15000 }).should('be.visible');
  });

  it('should have proper accessibility features', () => {
    cy.visit('/');
    
    // Check for proper ARIA labels
    cy.get('button').should('have.attr', 'aria-label').or('have.text');
    
    // Check for proper heading hierarchy
    cy.get('h1').should('exist');
    
    // Test keyboard navigation
    cy.get('body').tab();
    cy.focused().should('be.visible');
  });

  it('should handle browser back/forward navigation', () => {
    cy.visit('/');
    
    // Navigate to different sections
    cy.contains('Analytics').click();
    cy.url().should('include', 'analytics');
    
    // Use browser back
    cy.go('back');
    cy.url().should('not.include', 'analytics');
    
    // Use browser forward
    cy.go('forward');
    cy.url().should('include', 'analytics');
  });

  it('should validate environment setup', () => {
    cy.visit('/');
    
    // Check that environment variables are properly set
    cy.window().then((win) => {
      // Verify test mode
      expect(win.localStorage.getItem('cypress-test-mode')).to.equal('true');
    });
    
    // Verify API endpoints are accessible
    cy.request({
      url: Cypress.env('apiUrl') + '/health',
      failOnStatusCode: false
    }).then((response) => {
      // API should respond (even if with an error, it means it's reachable)
      expect(response.status).to.be.oneOf([200, 404, 500]);
    });
  });
});