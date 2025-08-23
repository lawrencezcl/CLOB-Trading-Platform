/**
 * Cross-Chain CLOB Liquidity Aggregator
 * 
 * This service aggregates order book data from multiple chains and DEX sources
 * to provide unified liquidity for optimal trade execution.
 * 
 * Features:
 * - Multi-chain order book aggregation
 * - Price improvement through liquidity consolidation
 * - Optimal execution routing
 * - Real-time synchronization
 * - Cross-chain arbitrage opportunities
 */

import EventEmitter from 'events';
import crossChainBridgeService from './CrossChainBridgeService';

// Supported liquidity sources
const LIQUIDITY_SOURCES = {
  APTOS_CLOB: {
    name: 'Aptos CLOB',
    chain: 'APTOS',
    endpoint: 'http://localhost:3001/api/orderbook',
    weight: 1.0,
    fees: 0.1
  },
  MERKLE_TRADE: {
    name: 'Merkle Trade',
    chain: 'APTOS',
    endpoint: 'https://api.merkletrade.com/api/v1/orderbook',
    weight: 0.8,
    fees: 0.15
  },
  TAPP_EXCHANGE: {
    name: 'Tapp Exchange',
    chain: 'APTOS',
    endpoint: 'https://api.tappexchange.com/v1/market/orderbook',
    weight: 0.7,
    fees: 0.12
  },
  UNISWAP_V3: {
    name: 'Uniswap V3',
    chain: 'ETHEREUM',
    endpoint: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    weight: 0.9,
    fees: 0.3
  },
  SERUM_DEX: {
    name: 'Serum',
    chain: 'SOLANA',
    endpoint: 'https://api.serum-vial.dev/orderbook',
    weight: 0.8,
    fees: 0.22
  }
};

// Order book aggregation strategies
const AGGREGATION_STRATEGIES = {
  BEST_PRICE: 'best_price',
  VOLUME_WEIGHTED: 'volume_weighted',
  LIQUIDITY_SPREAD: 'liquidity_spread',
  CROSS_CHAIN_ARBITRAGE: 'cross_chain_arbitrage'
};

class CLOBLiquidityAggregator extends EventEmitter {
  constructor() {
    super();
    this.aggregatedOrderBook = {
      bids: [],
      asks: [],
      lastUpdate: 0,
      totalVolume: 0,
      sources: new Set()
    };
    
    this.sourceOrderBooks = new Map();
    this.priceFeeds = new Map();
    this.liquidityMetrics = new Map();
    this.refreshInterval = null;
    this.isAggregating = false;
    
    this.initialize();
  }

  async initialize() {
    console.log('🔄 Initializing Cross-Chain CLOB Liquidity Aggregator...');
    
    // Initialize price feeds
    await this.initializePriceFeeds();
    
    // Start order book aggregation
    await this.startAggregation();
    
    // Setup periodic refresh
    this.refreshInterval = setInterval(() => {
      this.aggregateOrderBooks();
    }, 5000); // Refresh every 5 seconds
    
    console.log('✅ CLOB Liquidity Aggregator initialized');
  }

  async initializePriceFeeds() {
    const symbols = ['APT-USDC', 'APT-USDT', 'APT-ETH', 'ETH-USDC', 'SOL-USDC'];
    
    for (const symbol of symbols) {
      try {
        const priceData = await this.fetchPriceData(symbol);
        this.priceFeeds.set(symbol, priceData);
      } catch (error) {
        console.warn(`⚠️  Failed to initialize price feed for ${symbol}:`, error.message);
      }
    }
  }

  async fetchPriceData(symbol) {
    // Mock price data - in production, integrate with actual price oracles
    const mockPrices = {
      'APT-USDC': { mid: 8.50, spread: 0.02 },
      'APT-USDT': { mid: 8.48, spread: 0.03 },
      'APT-ETH': { mid: 0.00378, spread: 0.00001 },
      'ETH-USDC': { mid: 2250.00, spread: 0.50 },
      'SOL-USDC': { mid: 95.00, spread: 0.15 }
    };
    
    return mockPrices[symbol] || { mid: 1.0, spread: 0.01 };
  }

  async startAggregation() {
    this.isAggregating = true;
    
    // Fetch order books from all sources
    for (const [sourceId, source] of Object.entries(LIQUIDITY_SOURCES)) {
      try {
        const orderBook = await this.fetchOrderBookFromSource(source);
        this.sourceOrderBooks.set(sourceId, {
          ...orderBook,
          source: sourceId,
          lastUpdate: Date.now()
        });
        
        console.log(`📊 Loaded order book from ${source.name}`);
      } catch (error) {
        console.warn(`⚠️  Failed to load order book from ${source.name}:`, error.message);
      }
    }
    
    // Perform initial aggregation
    await this.aggregateOrderBooks();
  }

  async fetchOrderBookFromSource(source) {
    // Mock order book data - in production, fetch from actual APIs
    return this.generateMockOrderBook(source);
  }

  generateMockOrderBook(source) {
    const bids = [];
    const asks = [];
    
    // Generate realistic bid/ask data
    const basePrice = 8.50; // APT-USDC base price
    const spread = 0.02;
    
    // Generate bids (buy orders)
    for (let i = 0; i < 20; i++) {
      const price = basePrice - spread - (i * 0.01);
      const size = Math.random() * 1000 + 100;
      bids.push({
        price,
        size,
        total: price * size,
        source: source.name,
        chain: source.chain,
        timestamp: Date.now()
      });
    }
    
    // Generate asks (sell orders)
    for (let i = 0; i < 20; i++) {
      const price = basePrice + spread + (i * 0.01);
      const size = Math.random() * 1000 + 100;
      asks.push({
        price,
        size,
        total: price * size,
        source: source.name,
        chain: source.chain,
        timestamp: Date.now()
      });
    }
    
    return { bids, asks };
  }

  async aggregateOrderBooks() {
    if (!this.isAggregating) return;
    
    try {
      // Collect all orders from all sources
      const allBids = [];
      const allAsks = [];
      const activeSources = new Set();
      
      for (const [sourceId, orderBook] of this.sourceOrderBooks.entries()) {
        if (Date.now() - orderBook.lastUpdate < 30000) { // Only use recent data
          allBids.push(...orderBook.bids.map(bid => ({ ...bid, sourceId })));
          allAsks.push(...orderBook.asks.map(ask => ({ ...ask, sourceId })));
          activeSources.add(sourceId);
        }
      }
      
      // Apply aggregation strategy
      const aggregatedBids = this.applyAggregationStrategy(allBids, 'bids');
      const aggregatedAsks = this.applyAggregationStrategy(allAsks, 'asks');
      
      // Calculate total volume
      const totalVolume = [...aggregatedBids, ...aggregatedAsks]
        .reduce((sum, order) => sum + order.total, 0);
      
      // Update aggregated order book
      this.aggregatedOrderBook = {
        bids: aggregatedBids,
        asks: aggregatedAsks,
        lastUpdate: Date.now(),
        totalVolume,
        sources: activeSources,
        metrics: this.calculateLiquidityMetrics(aggregatedBids, aggregatedAsks)
      };
      
      // Emit update event
      this.emit('orderBookUpdated', this.aggregatedOrderBook);
      
      // Check for arbitrage opportunities
      this.detectArbitrageOpportunities();
      
    } catch (error) {
      console.error('❌ Order book aggregation failed:', error);
    }
  }

  applyAggregationStrategy(orders, side) {
    // Sort orders: bids descending (highest first), asks ascending (lowest first)
    const sorted = orders.sort((a, b) => 
      side === 'bids' ? b.price - a.price : a.price - b.price
    );
    
    // Group orders by price level and aggregate sizes
    const priceMap = new Map();
    
    sorted.forEach(order => {
      const priceKey = order.price.toFixed(6);
      if (!priceMap.has(priceKey)) {
        priceMap.set(priceKey, {
          price: order.price,
          size: 0,
          total: 0,
          sources: new Set(),
          orders: []
        });
      }
      
      const level = priceMap.get(priceKey);
      level.size += order.size;
      level.total += order.total;
      level.sources.add(order.source);
      level.orders.push(order);
    });
    
    // Convert back to array and apply volume weighting
    return Array.from(priceMap.values())
      .map(level => ({
        price: level.price,
        size: level.size,
        total: level.total,
        sources: Array.from(level.sources),
        depth: level.orders.length,
        // Weight by source reliability and fees
        weight: this.calculateLevelWeight(level.orders)
      }))
      .slice(0, 50); // Limit to top 50 levels
  }

  calculateLevelWeight(orders) {
    return orders.reduce((weight, order) => {
      const source = LIQUIDITY_SOURCES[order.sourceId];
      return weight + (source?.weight || 0.5);
    }, 0) / orders.length;
  }

  calculateLiquidityMetrics(bids, asks) {
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    
    // Calculate market depth
    const bidDepth = bids.slice(0, 10).reduce((sum, bid) => sum + bid.total, 0);
    const askDepth = asks.slice(0, 10).reduce((sum, ask) => sum + ask.total, 0);
    
    return {
      bestBid,
      bestAsk,
      spread,
      spreadPercent: (spread / midPrice) * 100,
      midPrice,
      bidDepth,
      askDepth,
      totalDepth: bidDepth + askDepth,
      liquidityScore: this.calculateLiquidityScore(bids, asks)
    };
  }

  calculateLiquidityScore(bids, asks) {
    // Calculate liquidity quality score (0-100)
    const spreadScore = Math.max(0, 100 - (this.aggregatedOrderBook.metrics?.spreadPercent || 0) * 20);
    const depthScore = Math.min(100, (this.aggregatedOrderBook.metrics?.totalDepth || 0) / 10000 * 100);
    const sourceScore = (this.aggregatedOrderBook.sources.size / Object.keys(LIQUIDITY_SOURCES).length) * 100;
    
    return (spreadScore + depthScore + sourceScore) / 3;
  }

  detectArbitrageOpportunities() {
    const opportunities = [];
    
    // Compare prices across different chains
    for (const [sourceId1, orderBook1] of this.sourceOrderBooks.entries()) {
      for (const [sourceId2, orderBook2] of this.sourceOrderBooks.entries()) {
        if (sourceId1 !== sourceId2) {
          const source1 = LIQUIDITY_SOURCES[sourceId1];
          const source2 = LIQUIDITY_SOURCES[sourceId2];
          
          if (source1.chain !== source2.chain) {
            const arb = this.calculateArbitrageOpportunity(orderBook1, orderBook2, source1, source2);
            if (arb.profitable) {
              opportunities.push(arb);
            }
          }
        }
      }
    }
    
    if (opportunities.length > 0) {
      this.emit('arbitrageOpportunities', opportunities);
      console.log(`🔍 Found ${opportunities.length} arbitrage opportunities`);
    }
  }

  calculateArbitrageOpportunity(orderBook1, orderBook2, source1, source2) {
    const bestBid1 = orderBook1.bids[0];
    const bestAsk1 = orderBook1.asks[0];
    const bestBid2 = orderBook2.bids[0];
    const bestAsk2 = orderBook2.asks[0];
    
    // Calculate potential profit buying on source2, selling on source1
    const buyPrice = bestAsk2?.price || 0;
    const sellPrice = bestBid1?.price || 0;
    const bridgeFee = 0.1; // Estimated bridge fee percentage
    const totalFees = source1.fees + source2.fees + bridgeFee;
    
    const grossProfit = sellPrice - buyPrice;
    const netProfit = grossProfit - (grossProfit * totalFees / 100);
    const profitPercent = (netProfit / buyPrice) * 100;
    
    return {
      profitable: netProfit > 0 && profitPercent > 0.5, // Minimum 0.5% profit
      buySource: source2.name,
      sellSource: source1.name,
      buyPrice,
      sellPrice,
      grossProfit,
      netProfit,
      profitPercent,
      estimatedVolume: Math.min(bestAsk2?.size || 0, bestBid1?.size || 0),
      chains: [source2.chain, source1.chain]
    };
  }

  // Public API methods

  getAggregatedOrderBook() {
    return this.aggregatedOrderBook;
  }

  async getOptimalExecutionPlan(side, amount, maxSlippage = 2.0) {
    const orders = side === 'buy' ? this.aggregatedOrderBook.asks : this.aggregatedOrderBook.bids;
    const plan = {
      totalCost: 0,
      averagePrice: 0,
      slippage: 0,
      routes: [],
      feasible: false
    };
    
    let remainingAmount = amount;
    let totalCost = 0;
    
    for (const order of orders) {
      if (remainingAmount <= 0) break;
      
      const fillAmount = Math.min(remainingAmount, order.size);
      const cost = fillAmount * order.price;
      
      plan.routes.push({
        source: order.sources[0],
        price: order.price,
        amount: fillAmount,
        cost,
        chain: this.getOrderChain(order)
      });
      
      totalCost += cost;
      remainingAmount -= fillAmount;
    }
    
    if (remainingAmount <= amount * 0.05) { // Allow 5% unfilled
      plan.feasible = true;
      plan.totalCost = totalCost;
      plan.averagePrice = totalCost / (amount - remainingAmount);
      
      const marketPrice = this.aggregatedOrderBook.metrics?.midPrice || 0;
      plan.slippage = Math.abs((plan.averagePrice - marketPrice) / marketPrice) * 100;
    }
    
    return plan;
  }

  getOrderChain(order) {
    // Determine which chain an order comes from
    for (const [sourceId, source] of Object.entries(LIQUIDITY_SOURCES)) {
      if (order.sources.includes(source.name)) {
        return source.chain;
      }
    }
    return 'APTOS'; // Default
  }

  getLiquidityMetrics() {
    return {
      ...this.aggregatedOrderBook.metrics,
      activeSources: this.aggregatedOrderBook.sources.size,
      lastUpdate: this.aggregatedOrderBook.lastUpdate,
      totalVolume: this.aggregatedOrderBook.totalVolume
    };
  }

  getSourceStatus() {
    return Array.from(this.sourceOrderBooks.entries()).map(([sourceId, orderBook]) => ({
      sourceId,
      name: LIQUIDITY_SOURCES[sourceId]?.name,
      chain: LIQUIDITY_SOURCES[sourceId]?.chain,
      lastUpdate: orderBook.lastUpdate,
      isActive: Date.now() - orderBook.lastUpdate < 30000,
      bidCount: orderBook.bids.length,
      askCount: orderBook.asks.length
    }));
  }

  // Cleanup
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.isAggregating = false;
    this.removeAllListeners();
  }
}

// Export singleton instance
const clobLiquidityAggregator = new CLOBLiquidityAggregator();
export default clobLiquidityAggregator;