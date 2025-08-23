/**
 * Complete Trading Workflow E2E Tests
 * 
 * Tests the complete user journey from wallet connection
 * through order placement and management.
 */

describe('Complete Trading Workflow', () => {
  let testData;

  before(() => {
    cy.fixture('testData').then((data) => {
      testData = data;
    });
  });

  beforeEach(() => {
    // Set up test environment
    cy.mockUserBalance(testData.userBalances.moderate.apt_balance, testData.userBalances.moderate.usdc_balance);
    cy.mockOrderBook(testData.orderBook.default);
    cy.mockMarketData(testData.marketData.default);
    cy.mockWebSocket();
    
    cy.visit('/');
  });

  describe('Wallet Connection Flow', () => {
    it('should guide user through wallet connection process', () => {
      // Initial state - no wallet connected
      cy.get('[data-cy=wallet-connection-status]').should('contain', 'Not Connected');
      
      // Click connect wallet button
      cy.get('[data-cy=connect-wallet-button]').click();
      
      // Should show wallet selection modal
      cy.get('[data-cy=wallet-selection-modal]').should('be.visible');
      
      // Select Petra wallet
      cy.get('[data-cy=petra-wallet-option]').click();
      
      // Mock wallet connection
      cy.connectMockWallet('petra');
      
      // Should show connected status
      cy.get('[data-cy=wallet-connection-status]').should('contain', 'Connected');
      cy.get('[data-cy=wallet-address]').should('contain', '0x1234...5678');
      
      // Should show user balance
      cy.get('[data-cy=user-balance]').within(() => {
        cy.get('[data-cy=apt-balance]').should('contain', '1000');
        cy.get('[data-cy=usdc-balance]').should('contain', '8500');
      });
    });

    it('should handle wallet connection rejection', () => {
      cy.get('[data-cy=connect-wallet-button]').click();
      cy.get('[data-cy=petra-wallet-option]').click();
      
      // Simulate rejection
      cy.window().then((win) => {
        const rejectionError = new Error('User rejected connection');
        cy.stub(win, 'aptos').rejects(rejectionError);
      });
      
      // Should show error message
      cy.contains('Wallet connection failed').should('be.visible');
      cy.get('[data-cy=wallet-connection-status]').should('contain', 'Not Connected');
    });

    it('should handle wallet disconnection', () => {
      // First connect
      cy.connectMockWallet('petra');
      cy.get('[data-cy=wallet-connection-status]').should('contain', 'Connected');
      
      // Disconnect
      cy.get('[data-cy=disconnect-wallet-button]').click();
      
      // Should confirm disconnection
      cy.get('[data-cy=confirm-disconnect-modal]').within(() => {
        cy.get('[data-cy=confirm-button]').click();
      });
      
      // Should be disconnected
      cy.get('[data-cy=wallet-connection-status]').should('contain', 'Not Connected');
    });
  });

  describe('Order Placement Workflow', () => {
    beforeEach(() => {
      cy.connectMockWallet('petra');
    });

    it('should place a limit buy order successfully', () => {
      const orderData = testData.testOrders.validBuyOrder;
      
      // Navigate to trading interface
      cy.get('[data-cy=trading-dashboard]').should('be.visible');
      
      // Fill order form
      cy.get('[data-cy=order-side-select]').select(orderData.side);
      cy.get('[data-cy=order-type-select]').select(orderData.type);
      cy.get('[data-cy=order-price-input]').clear().type(orderData.price.toString());
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      
      // Verify order value calculation
      const expectedValue = orderData.price * orderData.quantity;
      cy.get('[data-cy=order-total-value]').should('contain', expectedValue.toString());
      
      // Verify sufficient balance
      cy.get('[data-cy=balance-check]').should('contain', 'Sufficient Balance');
      
      // Submit order
      cy.get('[data-cy=place-order-button]').click();
      
      // Should show confirmation modal
      cy.get('[data-cy=order-confirmation-modal]').should('be.visible');
      cy.get('[data-cy=confirm-order-details]').within(() => {
        cy.contains(orderData.side.toUpperCase()).should('be.visible');
        cy.contains(orderData.quantity.toString()).should('be.visible');
        cy.contains(orderData.price.toString()).should('be.visible');
      });
      
      // Confirm order
      cy.get('[data-cy=confirm-order-button]').click();
      
      // Should show success message
      cy.contains('Order placed successfully').should('be.visible');
      
      // Should update user orders list
      cy.get('[data-cy=user-orders-tab]').click();
      cy.get('[data-cy=user-orders-list]').within(() => {
        cy.contains(orderData.side.toUpperCase()).should('be.visible');
        cy.contains(orderData.quantity.toString()).should('be.visible');
        cy.contains('Pending').should('be.visible');
      });
    });

    it('should place a limit sell order successfully', () => {
      const orderData = testData.testOrders.validSellOrder;
      
      cy.get('[data-cy=order-side-select]').select(orderData.side);
      cy.get('[data-cy=order-type-select]').select(orderData.type);
      cy.get('[data-cy=order-price-input]').clear().type(orderData.price.toString());
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      
      cy.get('[data-cy=place-order-button]').click();
      cy.get('[data-cy=confirm-order-button]').click();
      
      cy.contains('Order placed successfully').should('be.visible');
    });

    it('should place a market order successfully', () => {
      const orderData = testData.testOrders.marketBuyOrder;
      
      cy.get('[data-cy=order-side-select]').select(orderData.side);
      cy.get('[data-cy=order-type-select]').select(orderData.type);
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      
      // Market orders should show estimated price
      cy.get('[data-cy=estimated-price]').should('be.visible');
      cy.get('[data-cy=slippage-warning]').should('be.visible');
      
      cy.get('[data-cy=place-order-button]').click();
      cy.get('[data-cy=confirm-order-button]').click();
      
      cy.contains('Order placed successfully').should('be.visible');
    });

    it('should validate order input and show errors', () => {
      // Test zero quantity
      cy.get('[data-cy=order-quantity-input]').clear().type('0');
      cy.get('[data-cy=place-order-button]').click();
      cy.contains('Quantity must be greater than 0').should('be.visible');
      
      // Test zero price for limit order
      cy.get('[data-cy=order-type-select]').select('limit');
      cy.get('[data-cy=order-price-input]').clear().type('0');
      cy.get('[data-cy=place-order-button]').click();
      cy.contains('Price must be greater than 0').should('be.visible');
      
      // Test insufficient balance
      cy.get('[data-cy=order-quantity-input]').clear().type('999999');
      cy.get('[data-cy=order-price-input]').clear().type('100');
      cy.get('[data-cy=place-order-button]').click();
      cy.contains('Insufficient balance').should('be.visible');
    });

    it('should handle order placement failures gracefully', () => {
      // Mock order placement failure
      cy.intercept('POST', '**/api/orders', {
        statusCode: 500,
        body: { error: 'Order placement failed' }
      }).as('failedOrder');
      
      const orderData = testData.testOrders.validBuyOrder;
      cy.get('[data-cy=order-side-select]').select(orderData.side);
      cy.get('[data-cy=order-price-input]').clear().type(orderData.price.toString());
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      
      cy.get('[data-cy=place-order-button]').click();
      cy.get('[data-cy=confirm-order-button]').click();
      
      cy.wait('@failedOrder');
      cy.contains('Order placement failed').should('be.visible');
    });
  });

  describe('Order Management Workflow', () => {
    beforeEach(() => {
      cy.connectMockWallet('petra');
      
      // Mock existing orders
      cy.intercept('GET', '**/api/user/orders', {
        statusCode: 200,
        body: [
          {
            orderId: 'order_123',
            side: 'buy',
            price: 8.50,
            quantity: 100,
            status: 'pending',
            timestamp: Date.now() - 300000
          },
          {
            orderId: 'order_456',
            side: 'sell',
            price: 8.55,
            quantity: 150,
            status: 'pending',
            timestamp: Date.now() - 600000
          }
        ]
      }).as('getUserOrders');
    });

    it('should view and manage existing orders', () => {
      // Navigate to orders tab
      cy.get('[data-cy=user-orders-tab]').click();
      cy.wait('@getUserOrders');
      
      // Should show orders list
      cy.get('[data-cy=user-orders-list]').within(() => {
        cy.get('[data-cy=order-row]').should('have.length', 2);
        
        // Check first order details
        cy.get('[data-cy=order-row]').first().within(() => {
          cy.contains('BUY').should('be.visible');
          cy.contains('8.50').should('be.visible');
          cy.contains('100').should('be.visible');
          cy.contains('Pending').should('be.visible');
        });
      });
      
      // Should be able to sort orders
      cy.get('[data-cy=sort-by-time]').click();
      cy.get('[data-cy=order-row]').first().should('contain', 'order_123');
      
      // Should be able to filter orders
      cy.get('[data-cy=filter-by-side]').select('buy');
      cy.get('[data-cy=order-row]').should('have.length', 1);
    });

    it('should cancel an order successfully', () => {
      cy.get('[data-cy=user-orders-tab]').click();
      cy.wait('@getUserOrders');
      
      // Mock order cancellation
      cy.intercept('DELETE', '**/api/orders/order_123', {
        statusCode: 200,
        body: { status: 'cancelled' }
      }).as('cancelOrder');
      
      // Cancel first order
      cy.get('[data-cy=order-row]').first().within(() => {
        cy.get('[data-cy=cancel-order-button]').click();
      });
      
      // Should show confirmation dialog
      cy.get('[data-cy=cancel-confirmation-modal]').should('be.visible');
      cy.get('[data-cy=confirm-cancel-button]').click();
      
      cy.wait('@cancelOrder');
      cy.contains('Order cancelled successfully').should('be.visible');
      
      // Order should be removed from list or marked as cancelled
      cy.get('[data-cy=user-orders-list]').should('not.contain', 'order_123');
    });

    it('should handle bulk order cancellation', () => {
      cy.get('[data-cy=user-orders-tab]').click();
      cy.wait('@getUserOrders');
      
      // Select multiple orders
      cy.get('[data-cy=select-order-checkbox]').first().check();
      cy.get('[data-cy=select-order-checkbox]').last().check();
      
      // Cancel selected orders
      cy.get('[data-cy=cancel-selected-button]').click();
      cy.get('[data-cy=confirm-bulk-cancel-button]').click();
      
      cy.contains('2 orders cancelled successfully').should('be.visible');
    });
  });

  describe('Real-time Updates Workflow', () => {
    beforeEach(() => {
      cy.connectMockWallet('petra');
    });

    it('should handle real-time order book updates', () => {
      // Initial order book should be displayed
      cy.get('[data-cy=order-book-bids]').should('be.visible');
      cy.get('[data-cy=order-book-asks]').should('be.visible');
      
      // Simulate order book update
      const updatedOrderBook = {
        bids: [
          { price: 8.52, size: 120, orderId: 11, user: '0x123' },
          { price: 8.51, size: 150, orderId: 12, user: '0x456' }
        ],
        asks: [
          { price: 8.53, size: 130, orderId: 13, user: '0x789' },
          { price: 8.54, size: 160, orderId: 14, user: '0xabc' }
        ]
      };
      
      cy.simulateMarketUpdate({ type: 'orderbook', data: updatedOrderBook });
      
      // Order book should update
      cy.get('[data-cy=order-book-bids]').within(() => {
        cy.contains('8.52').should('be.visible');
        cy.contains('120').should('be.visible');
      });
    });

    it('should handle real-time price updates', () => {
      // Check initial price
      cy.get('[data-cy=last-price]').should('contain', '8.50');
      
      // Simulate price update
      cy.simulateMarketUpdate({
        type: 'price',
        data: { lastPrice: 8.75, change24h: 5.2 }
      });
      
      // Price should update
      cy.get('[data-cy=last-price]').should('contain', '8.75');
      cy.get('[data-cy=change-24h]').should('contain', '5.2');
      
      // Should show price animation
      cy.get('[data-cy=price-change-indicator]').should('have.class', 'price-up');
    });

    it('should handle real-time trade updates', () => {
      // Navigate to recent trades
      cy.get('[data-cy=recent-trades-tab]').click();
      
      // Simulate new trade
      cy.simulateMarketUpdate({
        type: 'trade',
        data: {
          price: 8.52,
          quantity: 50,
          side: 'buy',
          timestamp: Date.now()
        }
      });
      
      // Trade should appear in recent trades
      cy.get('[data-cy=recent-trades-list]').within(() => {
        cy.get('[data-cy=trade-row]').first().within(() => {
          cy.contains('8.52').should('be.visible');
          cy.contains('50').should('be.visible');
          cy.should('have.class', 'trade-buy');
        });
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      cy.connectMockWallet('petra');
    });

    it('should handle network connection loss gracefully', () => {
      // Simulate network failure
      cy.intercept('GET', '**/api/**', { forceNetworkError: true }).as('networkFailure');
      
      // Try to place an order
      const orderData = testData.testOrders.validBuyOrder;
      cy.get('[data-cy=order-price-input]').clear().type(orderData.price.toString());
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      cy.get('[data-cy=place-order-button]').click();
      
      // Should show network error
      cy.contains('Network connection failed').should('be.visible');
      
      // Should show retry option
      cy.get('[data-cy=retry-button]').should('be.visible');
    });

    it('should handle wallet disconnection during trading', () => {
      // Place an order
      const orderData = testData.testOrders.validBuyOrder;
      cy.get('[data-cy=order-price-input]').clear().type(orderData.price.toString());
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      
      // Simulate wallet disconnection
      cy.disconnectWallet();
      
      // Try to submit order
      cy.get('[data-cy=place-order-button]').click();
      
      // Should prompt to reconnect wallet
      cy.contains('Please connect your wallet').should('be.visible');
      cy.get('[data-cy=reconnect-wallet-button]').should('be.visible');
    });

    it('should handle session timeout gracefully', () => {
      // Mock session timeout
      cy.intercept('POST', '**/api/orders', {
        statusCode: 401,
        body: { error: 'Session expired' }
      }).as('sessionTimeout');
      
      // Try to place order
      const orderData = testData.testOrders.validBuyOrder;
      cy.get('[data-cy=order-price-input]').clear().type(orderData.price.toString());
      cy.get('[data-cy=order-quantity-input]').clear().type(orderData.quantity.toString());
      cy.get('[data-cy=place-order-button]').click();
      cy.get('[data-cy=confirm-order-button]').click();
      
      cy.wait('@sessionTimeout');
      
      // Should prompt to reconnect
      cy.contains('Session expired').should('be.visible');
      cy.get('[data-cy=reconnect-session-button]').should('be.visible');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid order placement', () => {
      cy.connectMockWallet('petra');
      
      // Place multiple orders rapidly
      for (let i = 0; i < 5; i++) {
        cy.get('[data-cy=order-price-input]').clear().type('8.5' + i);
        cy.get('[data-cy=order-quantity-input]').clear().type('10');
        cy.get('[data-cy=place-order-button]').click();
        cy.get('[data-cy=confirm-order-button]').click();
        
        // Wait for confirmation before next order
        cy.contains('Order placed successfully', { timeout: 5000 }).should('be.visible');
      }
      
      // All orders should be processed
      cy.get('[data-cy=user-orders-tab]').click();
      cy.get('[data-cy=order-row]').should('have.length.at.least', 5);
    });

    it('should maintain performance with large order book', () => {
      // Mock large order book
      const largeOrderBook = {
        bids: Array.from({ length: 500 }, (_, i) => ({
          price: 8.5 - i * 0.001,
          size: Math.random() * 1000 + 10,
          orderId: i + 1000
        })),
        asks: Array.from({ length: 500 }, (_, i) => ({
          price: 8.51 + i * 0.001,
          size: Math.random() * 1000 + 10,
          orderId: i + 2000
        }))
      };
      
      cy.mockOrderBook(largeOrderBook);
      cy.visit('/');
      
      // Order book should render without performance issues
      cy.get('[data-cy=order-book]', { timeout: 10000 }).should('be.visible');
      
      // Should be scrollable and interactive
      cy.get('[data-cy=order-book-bids]').scrollTo('bottom');
      cy.get('[data-cy=order-book-bids] [data-cy=bid-row]').last().should('be.visible');
    });
  });
});