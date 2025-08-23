/**
 * Cross-Chain Functionality E2E Tests
 * 
 * Tests cross-chain asset bridging, liquidity aggregation,
 * and multi-chain trading workflows.
 */

describe('Cross-Chain Functionality', () => {
  let testData;

  before(() => {
    cy.fixture('testData').then((data) => {
      testData = data;
    });
  });

  beforeEach(() => {
    cy.mockUserBalance(testData.userBalances.wealthy.apt_balance, testData.userBalances.wealthy.usdc_balance);
    cy.mockOrderBook(testData.orderBook.default);
    cy.mockMarketData(testData.marketData.default);
    cy.mockWebSocket();
    
    cy.visit('/');
    cy.connectMockWallet('petra');
  });

  describe('Cross-Chain Asset Bridge', () => {
    beforeEach(() => {
      // Navigate to cross-chain section
      cy.contains('Cross-Chain').click();
      cy.get('[data-cy=cross-chain-asset-manager]').should('be.visible');
    });

    it('should display bridge statistics correctly', () => {
      // Mock bridge statistics
      cy.intercept('GET', '**/api/bridge/stats', {
        statusCode: 200,
        body: {
          totalRoutes: 45,
          activeBridges: 3,
          supportedAssets: 12,
          supportedChains: 4
        }
      }).as('getBridgeStats');

      cy.visit('/');
      cy.contains('Cross-Chain').click();
      cy.wait('@getBridgeStats');

      // Verify statistics display
      cy.get('[data-cy=bridge-stats]').within(() => {
        cy.contains('45').should('be.visible'); // Total routes
        cy.contains('3').should('be.visible');  // Active bridges
        cy.contains('12').should('be.visible'); // Supported assets
        cy.contains('4').should('be.visible');  // Supported chains
      });
    });

    it('should complete a successful bridge transaction', () => {
      const bridgeData = testData.crossChainBridge.validBridge;

      // Click bridge assets button
      cy.get('[data-cy=bridge-assets-button]').click();
      cy.get('[data-cy=bridge-modal]').should('be.visible');

      // Fill bridge form
      cy.get('[data-cy=from-chain-select]').select(bridgeData.fromChain);
      cy.get('[data-cy=to-chain-select]').select(bridgeData.toChain);
      cy.get('[data-cy=asset-select]').select(bridgeData.asset);
      cy.get('[data-cy=amount-input]').clear().type(bridgeData.amount.toString());

      // Mock route calculation
      cy.intercept('POST', '**/api/bridge/route', {
        statusCode: 200,
        body: {
          provider: 'LayerZero',
          estimatedTime: 300,
          totalFee: bridgeData.amount * 0.001,
          estimatedOutput: bridgeData.amount * 0.999,
          priceImpact: 0.01
        }
      }).as('calculateRoute');

      // Calculate bridge route
      cy.get('[data-cy=calculate-route-button]').click();
      cy.wait('@calculateRoute');

      // Verify route details
      cy.get('[data-cy=route-details]').within(() => {
        cy.contains('LayerZero').should('be.visible');
        cy.contains('5 minutes').should('be.visible');
        cy.contains((bridgeData.amount * 0.001).toString()).should('be.visible');
      });

      // Mock bridge initiation
      cy.intercept('POST', '**/api/bridge/initiate', {
        statusCode: 200,
        body: {
          bridgeId: 'bridge_test_123',
          status: 'initiated',
          estimatedCompletion: Date.now() + 300000
        }
      }).as('initiateBridge');

      // Confirm bridge transaction
      cy.get('[data-cy=confirm-bridge-button]').click();
      cy.wait('@initiateBridge');

      // Should show success message
      cy.contains('Bridge initiated successfully').should('be.visible');
      cy.contains('bridge_test_123').should('be.visible');

      // Should add to active bridges list
      cy.get('[data-cy=active-bridges-table]').within(() => {
        cy.contains('bridge_test_123').should('be.visible');
        cy.contains(bridgeData.fromChain).should('be.visible');
        cy.contains(bridgeData.toChain).should('be.visible');
      });
    });

    it('should handle bridge validation errors', () => {
      cy.get('[data-cy=bridge-assets-button]').click();

      // Test invalid amount (too small)
      cy.get('[data-cy=from-chain-select]').select('ETHEREUM');
      cy.get('[data-cy=to-chain-select]').select('APTOS');
      cy.get('[data-cy=asset-select]').select('USDC');
      cy.get('[data-cy=amount-input]').clear().type('1'); // Below minimum

      cy.get('[data-cy=calculate-route-button]').click();
      cy.contains('Amount below minimum bridge limit').should('be.visible');

      // Test invalid amount (too large)
      cy.get('[data-cy=amount-input]').clear().type('99999999');
      cy.get('[data-cy=calculate-route-button]').click();
      cy.contains('Amount exceeds maximum bridge limit').should('be.visible');

      // Test same chain selection
      cy.get('[data-cy=from-chain-select]').select('APTOS');
      cy.get('[data-cy=to-chain-select]').select('APTOS');
      cy.get('[data-cy=calculate-route-button]').click();
      cy.contains('Source and destination chains cannot be the same').should('be.visible');
    });

    it('should handle bridge route not found', () => {
      cy.get('[data-cy=bridge-assets-button]').click();

      // Mock route not found
      cy.intercept('POST', '**/api/bridge/route', {
        statusCode: 404,
        body: { error: 'No bridge route available for this asset pair' }
      }).as('routeNotFound');

      cy.get('[data-cy=from-chain-select]').select('ETHEREUM');
      cy.get('[data-cy=to-chain-select]').select('SOLANA');
      cy.get('[data-cy=asset-select]').select('UNKNOWN_TOKEN');
      cy.get('[data-cy=amount-input]').clear().type('100');

      cy.get('[data-cy=calculate-route-button]').click();
      cy.wait('@routeNotFound');

      cy.contains('No bridge route available').should('be.visible');
    });

    it('should track bridge transaction progress', () => {
      // Complete a bridge transaction first
      cy.initiateBridge(testData.crossChainBridge.validBridge);

      // Check active bridges table
      cy.get('[data-cy=active-bridges-table]').within(() => {
        cy.get('[data-cy=bridge-row]').first().within(() => {
          cy.get('[data-cy=bridge-status]').should('contain', 'pending');
          cy.get('[data-cy=progress-bar]').should('be.visible');
          cy.get('[data-cy=estimated-time]').should('contain', 'remaining');
        });
      });

      // Simulate progress updates
      cy.simulateMarketUpdate({
        type: 'bridgeUpdate',
        data: {
          bridgeId: 'bridge_test_123',
          status: 'confirmed',
          progress: 50
        }
      });

      cy.get('[data-cy=bridge-status]').should('contain', 'confirmed');
      cy.get('[data-cy=progress-bar]').should('have.attr', 'aria-valuenow', '50');

      // Simulate completion
      cy.simulateMarketUpdate({
        type: 'bridgeUpdate',
        data: {
          bridgeId: 'bridge_test_123',
          status: 'completed',
          progress: 100,
          txHash: '0xabcdef123456'
        }
      });

      cy.get('[data-cy=bridge-status]').should('contain', 'completed');
      cy.get('[data-cy=completion-tx-hash]').should('contain', '0xabcdef123456');
    });

    it('should handle bridge timeout scenarios', () => {
      // Mock bridge timeout
      cy.intercept('POST', '**/api/bridge/initiate', {
        statusCode: 408,
        body: { error: 'Bridge transaction timeout' }
      }).as('bridgeTimeout');

      cy.get('[data-cy=bridge-assets-button]').click();
      
      // Fill form and initiate bridge
      const bridgeData = testData.crossChainBridge.validBridge;
      cy.get('[data-cy=from-chain-select]').select(bridgeData.fromChain);
      cy.get('[data-cy=to-chain-select]').select(bridgeData.toChain);
      cy.get('[data-cy=asset-select]').select(bridgeData.asset);
      cy.get('[data-cy=amount-input]').clear().type(bridgeData.amount.toString());

      cy.get('[data-cy=calculate-route-button]').click();
      cy.get('[data-cy=confirm-bridge-button]').click();

      cy.wait('@bridgeTimeout');
      cy.contains('Bridge transaction timeout').should('be.visible');
      cy.get('[data-cy=retry-bridge-button]').should('be.visible');
    });
  });

  describe('Liquidity Aggregation', () => {
    beforeEach(() => {
      // Navigate to liquidity aggregation dashboard
      cy.get('[data-cy=aggregated-liquidity-button]').click();
      cy.get('[data-cy=liquidity-aggregation-modal]').should('be.visible');
    });

    it('should display aggregated liquidity metrics', () => {
      const liquidityData = testData.liquidityAggregation.multipleSources;

      // Mock liquidity aggregation data
      cy.intercept('GET', '**/api/liquidity/aggregated', {
        statusCode: 200,
        body: liquidityData
      }).as('getLiquidityData');

      cy.wait('@getLiquidityData');

      // Verify metrics display
      cy.get('[data-cy=liquidity-metrics]').within(() => {
        cy.get('[data-cy=liquidity-score]').should('contain', liquidityData.liquidityMetrics.liquidityScore);
        cy.get('[data-cy=spread-percent]').should('contain', liquidityData.liquidityMetrics.spreadPercent);
        cy.get('[data-cy=total-depth]').should('contain', liquidityData.liquidityMetrics.totalDepth);
        cy.get('[data-cy=active-sources]').should('contain', liquidityData.liquidityMetrics.activeSources);
      });
    });

    it('should show aggregated order book from multiple sources', () => {
      const liquidityData = testData.liquidityAggregation.multipleSources;

      cy.get('[data-cy=aggregated-order-book-tab]').click();

      // Verify aggregated bids
      cy.get('[data-cy=aggregated-bids]').within(() => {
        liquidityData.aggregatedOrderBook.bids.forEach((bid, index) => {
          cy.get(`[data-cy=bid-row-${index}]`).within(() => {
            cy.contains(bid.price.toString()).should('be.visible');
            cy.contains(bid.size.toString()).should('be.visible');
            
            // Verify source tags
            bid.sources.forEach(source => {
              cy.contains(source).should('be.visible');
            });
          });
        });
      });

      // Verify aggregated asks
      cy.get('[data-cy=aggregated-asks]').within(() => {
        liquidityData.aggregatedOrderBook.asks.forEach((ask, index) => {
          cy.get(`[data-cy=ask-row-${index}]`).within(() => {
            cy.contains(ask.price.toString()).should('be.visible');
            cy.contains(ask.size.toString()).should('be.visible');
          });
        });
      });
    });

    it('should display liquidity source status', () => {
      const liquidityData = testData.liquidityAggregation.multipleSources;

      cy.get('[data-cy=liquidity-sources-tab]').click();

      // Verify source status table
      cy.get('[data-cy=sources-table]').within(() => {
        liquidityData.sources.forEach((source, index) => {
          cy.get(`[data-cy=source-row-${index}]`).within(() => {
            cy.contains(source.name).should('be.visible');
            cy.contains(source.chain).should('be.visible');
            
            // Check status indicator
            if (source.isActive) {
              cy.get('[data-cy=status-indicator]').should('have.class', 'status-active');
            } else {
              cy.get('[data-cy=status-indicator]').should('have.class', 'status-inactive');
            }
          });
        });
      });
    });

    it('should detect and display arbitrage opportunities', () => {
      // Mock arbitrage opportunities
      cy.intercept('GET', '**/api/liquidity/arbitrage', {
        statusCode: 200,
        body: [
          {
            buySource: 'Merkle Trade',
            sellSource: 'Uniswap V3',
            buyPrice: 8.45,
            sellPrice: 8.55,
            profitPercent: 1.18,
            estimatedVolume: 500,
            chains: ['APTOS', 'ETHEREUM']
          }
        ]
      }).as('getArbitrageOpportunities');

      cy.get('[data-cy=arbitrage-opportunities-tab]').click();
      cy.wait('@getArbitrageOpportunities');

      // Verify arbitrage opportunity display
      cy.get('[data-cy=arbitrage-table]').within(() => {
        cy.get('[data-cy=arbitrage-row]').first().within(() => {
          cy.contains('Merkle Trade').should('be.visible');
          cy.contains('Uniswap V3').should('be.visible');
          cy.contains('1.18%').should('be.visible');
          cy.contains('500').should('be.visible');
        });
      });

      // Should show profit indicator
      cy.get('[data-cy=profit-indicator]').should('have.class', 'profit-positive');
    });

    it('should handle liquidity source failures', () => {
      // Mock partial source failures
      cy.intercept('GET', '**/api/liquidity/aggregated', {
        statusCode: 200,
        body: {
          sources: [
            { name: 'Aptos CLOB', isActive: true },
            { name: 'Merkle Trade', isActive: false },
            { name: 'Uniswap V3', isActive: true }
          ],
          liquidityMetrics: {
            liquidityScore: 45, // Lower due to failed source
            activeSources: 2
          }
        }
      }).as('getPartialLiquidity');

      cy.wait('@getPartialLiquidity');

      // Should show warning for degraded liquidity
      cy.get('[data-cy=liquidity-warning]').should('be.visible');
      cy.contains('Limited Source Connectivity').should('be.visible');

      // Should show which sources are down
      cy.get('[data-cy=sources-table]').within(() => {
        cy.contains('Merkle Trade').parent().within(() => {
          cy.get('[data-cy=status-indicator]').should('have.class', 'status-inactive');
        });
      });
    });

    it('should update liquidity metrics in real-time', () => {
      // Initial metrics should be displayed
      cy.get('[data-cy=liquidity-score]').should('be.visible');

      // Simulate real-time liquidity update
      cy.simulateMarketUpdate({
        type: 'liquidityUpdate',
        data: {
          liquidityScore: 85.2,
          spreadPercent: 0.08,
          totalDepth: 150000,
          activeSources: 4
        }
      });

      // Metrics should update
      cy.get('[data-cy=liquidity-score]').should('contain', '85.2');
      cy.get('[data-cy=spread-percent]').should('contain', '0.08');
      cy.get('[data-cy=total-depth]').should('contain', '150000');
      cy.get('[data-cy=active-sources]').should('contain', '4');
    });
  });

  describe('Multi-Chain Trading Optimization', () => {
    it('should suggest optimal execution across chains', () => {
      // Navigate back to trading dashboard
      cy.get('[data-cy=close-modal]').click();
      cy.contains('Trading Dashboard').click();

      // Place a large order that requires cross-chain execution
      cy.get('[data-cy=order-quantity-input]').clear().type('10000'); // Large order
      cy.get('[data-cy=order-price-input]').clear().type('8.50');

      // Mock optimal execution plan
      cy.intercept('POST', '**/api/execution/optimize', {
        statusCode: 200,
        body: {
          feasible: true,
          totalCost: 85000,
          averagePrice: 8.52,
          slippage: 0.24,
          routes: [
            { source: 'Aptos CLOB', amount: 5000, price: 8.50 },
            { source: 'Uniswap V3', amount: 3000, price: 8.53 },
            { source: 'Merkle Trade', amount: 2000, price: 8.55 }
          ]
        }
      }).as('getOptimalExecution');

      cy.get('[data-cy=place-order-button]').click();
      cy.wait('@getOptimalExecution');

      // Should show execution optimization details
      cy.get('[data-cy=execution-optimization-modal]').should('be.visible');
      cy.get('[data-cy=optimization-details]').within(() => {
        cy.contains('Multi-chain execution recommended').should('be.visible');
        cy.contains('0.24% slippage').should('be.visible');
        cy.contains('3 sources').should('be.visible');
      });

      // Should show route breakdown
      cy.get('[data-cy=execution-routes]').within(() => {
        cy.contains('Aptos CLOB: 5000 @ 8.50').should('be.visible');
        cy.contains('Uniswap V3: 3000 @ 8.53').should('be.visible');
        cy.contains('Merkle Trade: 2000 @ 8.55').should('be.visible');
      });

      // Should allow user to accept or modify
      cy.get('[data-cy=accept-optimization-button]').should('be.visible');
      cy.get('[data-cy=modify-execution-button]').should('be.visible');
    });

    it('should handle cross-chain execution failures gracefully', () => {
      // Mock execution failure on one chain
      cy.intercept('POST', '**/api/execution/execute', {
        statusCode: 207, // Partial success
        body: {
          results: [
            { source: 'Aptos CLOB', status: 'success', amount: 5000 },
            { source: 'Uniswap V3', status: 'failed', error: 'Insufficient liquidity' },
            { source: 'Merkle Trade', status: 'success', amount: 2000 }
          ],
          totalExecuted: 7000,
          totalRequested: 10000
        }
      }).as('partialExecution');

      // Large order setup
      cy.get('[data-cy=order-quantity-input]').clear().type('10000');
      cy.get('[data-cy=place-order-button]').click();
      cy.get('[data-cy=accept-optimization-button]').click();

      cy.wait('@partialExecution');

      // Should show partial execution results
      cy.get('[data-cy=execution-results-modal]').should('be.visible');
      cy.contains('Partial execution completed').should('be.visible');
      cy.contains('7000 of 10000 executed').should('be.visible');

      // Should show failure details
      cy.get('[data-cy=failed-executions]').within(() => {
        cy.contains('Uniswap V3: Failed').should('be.visible');
        cy.contains('Insufficient liquidity').should('be.visible');
      });

      // Should offer options for remaining amount
      cy.get('[data-cy=retry-failed-button]').should('be.visible');
      cy.get('[data-cy=cancel-remaining-button]').should('be.visible');
    });
  });

  describe('Cross-Chain Portfolio Management', () => {
    it('should display assets across multiple chains', () => {
      // Navigate to wallet/portfolio section
      cy.contains('Wallet').click();

      // Mock multi-chain balance
      cy.intercept('GET', '**/api/user/multi-chain-balance', {
        statusCode: 200,
        body: {
          APTOS: { APT: 1000, USDC: 5000 },
          ETHEREUM: { ETH: 2.5, USDC: 3000 },
          SOLANA: { SOL: 100, USDC: 1500 },
          total_value_usd: 15750
        }
      }).as('getMultiChainBalance');

      cy.wait('@getMultiChainBalance');

      // Should show balances grouped by chain
      cy.get('[data-cy=multi-chain-portfolio]').within(() => {
        cy.get('[data-cy=chain-group-APTOS]').within(() => {
          cy.contains('1000 APT').should('be.visible');
          cy.contains('5000 USDC').should('be.visible');
        });

        cy.get('[data-cy=chain-group-ETHEREUM]').within(() => {
          cy.contains('2.5 ETH').should('be.visible');
          cy.contains('3000 USDC').should('be.visible');
        });
      });

      // Should show total portfolio value
      cy.get('[data-cy=total-portfolio-value]').should('contain', '$15,750');
    });

    it('should enable quick asset rebalancing', () => {
      cy.contains('Wallet').click();

      // Should show rebalancing suggestions
      cy.get('[data-cy=rebalancing-suggestions]').should('be.visible');
      cy.contains('Optimize portfolio allocation').should('be.visible');

      // Click rebalance button
      cy.get('[data-cy=rebalance-portfolio-button]').click();

      // Should show rebalancing modal
      cy.get('[data-cy=rebalancing-modal]').should('be.visible');
      cy.get('[data-cy=suggested-rebalancing]').within(() => {
        cy.contains('Bridge 1000 USDC from Ethereum to Aptos').should('be.visible');
        cy.contains('Bridge 50 SOL from Solana to Aptos').should('be.visible');
      });

      // Should allow accepting suggestions
      cy.get('[data-cy=accept-rebalancing-button]').should('be.visible');
    });
  });
});