// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Trading Platform Specific Commands

/**
 * Connect a mock wallet for testing
 */
Cypress.Commands.add('connectMockWallet', (walletType = 'petra') => {
  cy.window().then((win) => {
    // Mock wallet object
    const mockWallet = {
      isConnected: true,
      account: {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        publicKey: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      },
      network: 'testnet',
      signAndSubmitTransaction: cy.stub().resolves({
        hash: '0x1234567890abcdef',
        success: true
      }),
      signMessage: cy.stub().resolves({
        signature: '0xabcdef1234567890'
      })
    };

    // Set wallet on window object
    if (walletType === 'petra') {
      win.aptos = mockWallet;
    } else if (walletType === 'martian') {
      win.martian = mockWallet;
    }

    // Set connection status in localStorage
    win.localStorage.setItem('wallet-connected', 'true');
    win.localStorage.setItem('wallet-type', walletType);
    win.localStorage.setItem('wallet-address', mockWallet.account.address);
  });
});

/**
 * Disconnect wallet
 */
Cypress.Commands.add('disconnectWallet', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('wallet-connected');
    win.localStorage.removeItem('wallet-type');
    win.localStorage.removeItem('wallet-address');
    
    // Remove wallet objects
    delete win.aptos;
    delete win.martian;
  });
});

/**
 * Mock user balance for testing
 */
Cypress.Commands.add('mockUserBalance', (aptBalance = 1000, usdcBalance = 5000) => {
  cy.intercept('GET', '**/api/user/balance', {
    statusCode: 200,
    body: {
      apt_balance: aptBalance,
      usdc_balance: usdcBalance,
      last_updated: Date.now()
    }
  }).as('getUserBalance');
});

/**
 * Mock order book data
 */
Cypress.Commands.add('mockOrderBook', (customData = null) => {
  const defaultOrderBook = {
    bids: [
      { price: 8.50, size: 100, orderId: 1, user: '0x123' },
      { price: 8.49, size: 150, orderId: 2, user: '0x456' },
      { price: 8.48, size: 200, orderId: 3, user: '0x789' }
    ],
    asks: [
      { price: 8.51, size: 120, orderId: 4, user: '0xabc' },
      { price: 8.52, size: 180, orderId: 5, user: '0xdef' },
      { price: 8.53, size: 250, orderId: 6, user: '0x321' }
    ],
    lastUpdate: Date.now()
  };

  cy.intercept('GET', '**/api/orderbook/**', {
    statusCode: 200,
    body: customData || defaultOrderBook
  }).as('getOrderBook');
});

/**
 * Mock market data
 */
Cypress.Commands.add('mockMarketData', (customData = null) => {
  const defaultMarketData = {
    lastPrice: 8.50,
    volume24h: 125000,
    change24h: 2.5,
    high24h: 8.75,
    low24h: 8.25,
    lastUpdate: Date.now()
  };

  cy.intercept('GET', '**/api/market/**', {
    statusCode: 200,
    body: customData || defaultMarketData
  }).as('getMarketData');
});

/**
 * Place a test order
 */
Cypress.Commands.add('placeOrder', (orderData) => {
  const {
    side = 'buy',
    price = 8.50,
    quantity = 100,
    type = 'limit'
  } = orderData;

  // Fill in the order form
  cy.get('[data-cy=order-side-select]').select(side);
  cy.get('[data-cy=order-price-input]').clear().type(price.toString());
  cy.get('[data-cy=order-quantity-input]').clear().type(quantity.toString());
  cy.get('[data-cy=order-type-select]').select(type);

  // Mock the order placement API
  cy.intercept('POST', '**/api/orders', {
    statusCode: 200,
    body: {
      orderId: Math.random().toString(36).substr(2, 9),
      status: 'submitted',
      timestamp: Date.now()
    }
  }).as('placeOrder');

  // Submit the order
  cy.get('[data-cy=place-order-button]').click();

  // Wait for API call
  cy.wait('@placeOrder');
});

/**
 * Cancel an order
 */
Cypress.Commands.add('cancelOrder', (orderId) => {
  cy.intercept('DELETE', `**/api/orders/${orderId}`, {
    statusCode: 200,
    body: { status: 'cancelled' }
  }).as('cancelOrder');

  cy.get(`[data-cy=cancel-order-${orderId}]`).click();
  cy.wait('@cancelOrder');
});

/**
 * Navigate to a specific trading pair
 */
Cypress.Commands.add('selectTradingPair', (pair = 'APT-USDC') => {
  cy.get('[data-cy=trading-pair-selector]').select(pair);
  cy.url().should('include', pair.toLowerCase());
});

/**
 * Check order book state
 */
Cypress.Commands.add('verifyOrderBook', (expectedBids, expectedAsks) => {
  // Verify bids
  if (expectedBids) {
    cy.get('[data-cy=order-book-bids]').within(() => {
      expectedBids.forEach((bid, index) => {
        cy.get(`[data-cy=bid-${index}]`).within(() => {
          cy.get('[data-cy=price]').should('contain', bid.price);
          cy.get('[data-cy=size]').should('contain', bid.size);
        });
      });
    });
  }

  // Verify asks
  if (expectedAsks) {
    cy.get('[data-cy=order-book-asks]').within(() => {
      expectedAsks.forEach((ask, index) => {
        cy.get(`[data-cy=ask-${index}]`).should('contain', ask.price);
      });
    });
  }
});

/**
 * Mock WebSocket connection for real-time data
 */
Cypress.Commands.add('mockWebSocket', () => {
  cy.window().then((win) => {
    // Mock WebSocket
    const mockWS = {
      readyState: 1, // OPEN
      send: cy.stub(),
      close: cy.stub(),
      addEventListener: cy.stub(),
      removeEventListener: cy.stub()
    };

    // Override WebSocket constructor
    win.WebSocket = function(url) {
      Object.assign(this, mockWS);
      
      // Simulate connection
      setTimeout(() => {
        if (this.onopen) this.onopen();
      }, 100);

      return this;
    };
  });
});

/**
 * Simulate real-time market updates
 */
Cypress.Commands.add('simulateMarketUpdate', (updateData) => {
  cy.window().then((win) => {
    // Trigger custom event for market update
    const event = new CustomEvent('marketUpdate', {
      detail: updateData
    });
    win.dispatchEvent(event);
  });
});

/**
 * Check trading dashboard state
 */
Cypress.Commands.add('verifyDashboardState', (expectedState) => {
  const {
    lastPrice,
    volume24h,
    change24h,
    userBalance,
    activeOrders
  } = expectedState;

  if (lastPrice) {
    cy.get('[data-cy=last-price]').should('contain', lastPrice);
  }

  if (volume24h) {
    cy.get('[data-cy=volume-24h]').should('contain', volume24h);
  }

  if (change24h) {
    cy.get('[data-cy=change-24h]').should('contain', change24h);
  }

  if (userBalance) {
    cy.get('[data-cy=user-balance]').within(() => {
      if (userBalance.apt) {
        cy.get('[data-cy=apt-balance]').should('contain', userBalance.apt);
      }
      if (userBalance.usdc) {
        cy.get('[data-cy=usdc-balance]').should('contain', userBalance.usdc);
      }
    });
  }

  if (activeOrders !== undefined) {
    cy.get('[data-cy=active-orders-count]').should('contain', activeOrders);
  }
});

/**
 * Wait for page to be fully loaded
 */
Cypress.Commands.add('waitForPageLoad', () => {
  // Wait for main content to be visible
  cy.get('[data-cy=trading-dashboard]').should('be.visible');
  
  // Wait for any loading spinners to disappear
  cy.get('[data-cy=loading-spinner]').should('not.exist');
  
  // Wait for critical API calls to complete
  cy.wait(['@getUserBalance', '@getOrderBook', '@getMarketData'], { 
    timeout: 10000,
    requestTimeout: 5000
  });
});

/**
 * Handle cross-chain bridge operations
 */
Cypress.Commands.add('initiateBridge', (bridgeData) => {
  const {
    fromChain = 'ETHEREUM',
    toChain = 'APTOS',
    asset = 'USDC',
    amount = 1000
  } = bridgeData;

  // Open bridge modal
  cy.get('[data-cy=bridge-assets-button]').click();

  // Fill bridge form
  cy.get('[data-cy=from-chain-select]').select(fromChain);
  cy.get('[data-cy=to-chain-select]').select(toChain);
  cy.get('[data-cy=asset-select]').select(asset);
  cy.get('[data-cy=amount-input]').clear().type(amount.toString());

  // Mock bridge route calculation
  cy.intercept('POST', '**/api/bridge/route', {
    statusCode: 200,
    body: {
      provider: 'LayerZero',
      estimatedTime: 300,
      totalFee: amount * 0.001,
      estimatedOutput: amount * 0.999
    }
  }).as('calculateBridgeRoute');

  // Calculate route
  cy.get('[data-cy=calculate-route-button]').click();
  cy.wait('@calculateBridgeRoute');

  // Mock bridge initiation
  cy.intercept('POST', '**/api/bridge/initiate', {
    statusCode: 200,
    body: {
      bridgeId: 'bridge_' + Date.now(),
      status: 'initiated'
    }
  }).as('initiateBridge');

  // Confirm bridge
  cy.get('[data-cy=confirm-bridge-button]').click();
  cy.wait('@initiateBridge');
});

// Overwrite Cypress default commands if needed

/**
 * Enhanced visit command with better error handling
 */
Cypress.Commands.overwrite('visit', (originalFn, url, options = {}) => {
  const defaultOptions = {
    failOnStatusCode: false,
    timeout: 30000,
    ...options
  };

  return originalFn(url, defaultOptions);
});

/**
 * Enhanced type command for better input handling
 */
Cypress.Commands.overwrite('type', (originalFn, element, text, options = {}) => {
  const defaultOptions = {
    delay: 10,
    force: true,
    ...options
  };

  // Clear field first to ensure clean input
  cy.wrap(element).clear();
  
  return originalFn(element, text, defaultOptions);
});