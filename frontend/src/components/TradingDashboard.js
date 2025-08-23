import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Form, Input, Select, message, Tabs, Modal, Badge, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, LineChartOutlined, ThunderboltOutlined } from '@ant-design/icons';
import OrderBook from './OrderBook';
import TradingChart from './TradingChart';
import RecentTrades from './RecentTrades';
import OrderForm from './OrderForm';
import LiquidityAggregationDashboard from './LiquidityAggregationDashboard';
import clobLiquidityAggregator from '../services/CLOBLiquidityAggregator';

const { Option } = Select;
const { TabPane } = Tabs;

const TradingDashboard = ({ aptosService, webSocketService, marketData }) => {
  const [selectedPair, setSelectedPair] = useState('APT-USDC');
  const [orderBookData, setOrderBookData] = useState({
    bids: [],
    asks: [],
    lastUpdate: null
  });
  const [recentTrades, setRecentTrades] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liquidityModalVisible, setLiquidityModalVisible] = useState(false);
  const [liquidityMetrics, setLiquidityMetrics] = useState({});
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalVolume: 0,
    activeOrders: 0,
    userBalance: {
      apt: 0,
      usdc: 0
    }
  });

  // Trading pairs configuration
  const tradingPairs = [
    { value: 'APT-USDC', label: 'APT/USDC', baseAsset: 'APT', quoteAsset: 'USDC' },
    { value: 'APT-USDT', label: 'APT/USDT', baseAsset: 'APT', quoteAsset: 'USDT' },
    // Add more pairs as needed
  ];

  // Initialize dashboard data
  useEffect(() => {
    const initializeDashboard = async () => {
      if (!aptosService) return;

      setLoading(true);
      try {
        // Fetch initial market data
        await fetchMarketData();
        await fetchUserData();
        
        // Set up real-time subscriptions
        if (webSocketService) {
          setupWebSocketSubscriptions();
        }
        
        // Set up liquidity aggregation monitoring
        setupLiquidityMonitoring();
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        message.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [aptosService, webSocketService, selectedPair]);

  // Fetch market data from Aptos
  const fetchMarketData = async () => {
    try {
      // Get order book data
      const orderBook = await aptosService.getOrderBook(selectedPair, 20);
      setOrderBookData({
        bids: orderBook.bids || [],
        asks: orderBook.asks || [],
        lastUpdate: new Date()
      });

      // Get recent trades
      const trades = await aptosService.getRecentTrades(selectedPair, 50);
      setRecentTrades(trades || []);

      // Get market statistics
      const marketStats = await aptosService.getMarketStats(selectedPair);
      setStats(prev => ({
        ...prev,
        totalTrades: marketStats.totalTrades || 0,
        totalVolume: marketStats.totalVolume || 0
      }));
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  // Fetch user-specific data
  const fetchUserData = async () => {
    try {
      const connected = await aptosService.isWalletConnected();
      if (!connected) return;

      // Get user orders
      const orders = await aptosService.getUserOrders();
      setUserOrders(orders || []);

      // Get user balance
      const balance = await aptosService.getUserBalance();
      setStats(prev => ({
        ...prev,
        activeOrders: orders?.length || 0,
        userBalance: {
          apt: balance?.apt || 0,
          usdc: balance?.usdc || 0
        }
      }));
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Set up WebSocket subscriptions for real-time updates
  const setupWebSocketSubscriptions = () => {
    // Subscribe to order book updates
    webSocketService.subscribe('orderbook', selectedPair, (data) => {
      setOrderBookData({
        bids: data.bids || [],
        asks: data.asks || [],
        lastUpdate: new Date()
      });
    });

    // Subscribe to trade updates
    webSocketService.subscribe('trades', selectedPair, (data) => {
      setRecentTrades(prev => [data, ...prev.slice(0, 49)]);
    });

    // Subscribe to user order updates
    webSocketService.subscribe('userOrders', null, (data) => {
      setUserOrders(prev => {
        const updated = prev.map(order => 
          order.id === data.orderId ? { ...order, ...data } : order
        );
        return updated;
      });
    });
  };

  // Set up liquidity aggregation monitoring
  const setupLiquidityMonitoring = () => {
    // Subscribe to liquidity updates
    clobLiquidityAggregator.on('orderBookUpdated', (aggregatedOrderBook) => {
      const metrics = clobLiquidityAggregator.getLiquidityMetrics();
      setLiquidityMetrics(metrics);
      
      // Update order book with aggregated data if it's better
      if (aggregatedOrderBook.totalVolume > orderBookData.totalVolume) {
        setOrderBookData({
          bids: aggregatedOrderBook.bids.slice(0, 20),
          asks: aggregatedOrderBook.asks.slice(0, 20),
          lastUpdate: new Date(aggregatedOrderBook.lastUpdate)
        });
      }
    });

    // Load initial liquidity metrics
    const initialMetrics = clobLiquidityAggregator.getLiquidityMetrics();
    setLiquidityMetrics(initialMetrics);
  };

  // Handle order placement with liquidity optimization
  const handlePlaceOrder = async (orderData) => {
    try {
      setLoading(true);
      
      // Get optimal execution plan from liquidity aggregator
      const executionPlan = await clobLiquidityAggregator.getOptimalExecutionPlan(
        orderData.side === 'buy' ? 'buy' : 'sell',
        parseFloat(orderData.quantity),
        2.0 // Max 2% slippage
      );
      
      if (executionPlan.feasible) {
        message.info(`Optimal execution plan found with ${executionPlan.slippage.toFixed(2)}% slippage`);
      }
      
      const result = await aptosService.placeOrder({
        ...orderData,
        pair: selectedPair,
        executionPlan: executionPlan.feasible ? executionPlan : null
      });
      
      message.success(`Order placed successfully! Order ID: ${result.orderId}`);
      await fetchUserData(); // Refresh user data
    } catch (error) {
      console.error('Error placing order:', error);
      message.error('Failed to place order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async (orderId) => {
    try {
      setLoading(true);
      await aptosService.cancelOrder(orderId);
      message.success('Order cancelled successfully');
      await fetchUserData(); // Refresh user data
    } catch (error) {
      console.error('Error cancelling order:', error);
      message.error('Failed to cancel order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trading-dashboard fade-in">
      {/* Market Statistics Header */}
      <div className="market-stats">
        <div className="market-stat-item">
          <div className="market-stat-label">Last Price</div>
          <div className="market-stat-value">
            ${marketData?.lastPrice?.toFixed(4) || '0.0000'}
          </div>
          <div className={`market-stat-change ${marketData?.change24h >= 0 ? 'positive' : 'negative'}`}>
            {marketData?.change24h >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(marketData?.change24h || 0).toFixed(2)}%
          </div>
        </div>

        <div className="market-stat-item">
          <div className="market-stat-label">24h Volume</div>
          <div className="market-stat-value">
            {(marketData?.volume24h || 0).toLocaleString()}
          </div>
          <div className="market-stat-change">APT</div>
        </div>

        <div className="market-stat-item">
          <div className="market-stat-label">Total Trades</div>
          <div className="market-stat-value">
            {stats.totalTrades.toLocaleString()}
          </div>
        </div>

        <div className="market-stat-item">
          <div className="market-stat-label">Your Orders</div>
          <div className="market-stat-value">
            {stats.activeOrders}
          </div>
          <div className="market-stat-change">Active</div>
        </div>

        <div className="market-stat-item">
          <div className="market-stat-label">Liquidity Score</div>
          <div className="market-stat-value">
            {liquidityMetrics.liquidityScore?.toFixed(0) || 'N/A'}
          </div>
          <div className="market-stat-change">Cross-Chain</div>
        </div>
      </div>

      {/* Trading Pair Selector */}
      <div className="trading-pair-selector">
        <div>
          <span className="trading-pair-name">{selectedPair}</span>
          <Select
            value={selectedPair}
            onChange={setSelectedPair}
            style={{ marginLeft: 16, width: 120 }}
          >
            {tradingPairs.map(pair => (
              <Option key={pair.value} value={pair.value}>
                {pair.label}
              </Option>
            ))}
          </Select>
          
          <Tooltip title="View Cross-Chain Liquidity Aggregation">
            <Button 
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setLiquidityModalVisible(true)}
              style={{ marginLeft: 16 }}
            >
              <Badge count={liquidityMetrics.activeSources || 0} size="small">
                Aggregated Liquidity
              </Badge>
            </Button>
          </Tooltip>
        </div>
        <div className="trading-pair-price">
          ${marketData?.lastPrice?.toFixed(4) || '0.0000'}
        </div>
      </div>

      {/* Main Trading Interface */}
      <div className="trading-grid">
        <div className="trading-main">
          {/* Trading Chart */}
          <Card 
            title={
              <span>
                <LineChartOutlined style={{ marginRight: 8 }} />
                Price Chart
              </span>
            }
            style={{ height: 'calc(60vh - 100px)' }}
          >
            <TradingChart 
              pair={selectedPair}
              aptosService={aptosService}
              webSocketService={webSocketService}
              marketData={marketData}
            />
          </Card>

          {/* Recent Trades and Market Data */}
          <Tabs defaultActiveKey="trades" style={{ height: 'calc(40vh - 50px)' }}>
            <TabPane tab="Recent Trades" key="trades">
              <RecentTrades 
                trades={recentTrades}
                loading={loading}
              />
            </TabPane>
            <TabPane tab="Your Orders" key="orders">
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {userOrders.map(order => (
                  <div key={order.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <span>
                      {order.side} {order.quantity} at ${order.price}
                    </span>
                    <Button 
                      size="small" 
                      danger
                      onClick={() => handleCancelOrder(order.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
                {userOrders.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                    No active orders
                  </div>
                )}
              </div>
            </TabPane>
          </Tabs>
        </div>

        {/* Order Book and Trading Form */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 16 }}>
          {/* Order Book */}
          <Card title="Order Book" style={{ height: 'calc(60vh - 50px)' }}>
            <OrderBook 
              data={orderBookData}
              loading={loading}
              onPriceClick={(price) => {
                // Auto-fill price in order form
                console.log('Price clicked:', price);
              }}
            />
          </Card>

          {/* Order Form */}
          <Card title="Place Order">
            <OrderForm 
              pair={selectedPair}
              balance={stats.userBalance}
              onSubmit={handlePlaceOrder}
              loading={loading}
            />
          </Card>
        </div>
      </div>
      
      {/* Liquidity Aggregation Modal */}
      <Modal
        title="Cross-Chain Liquidity Aggregation"
        visible={liquidityModalVisible}
        onCancel={() => setLiquidityModalVisible(false)}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        <LiquidityAggregationDashboard aptosService={aptosService} />
      </Modal>
    </div>
  );
};

export default TradingDashboard;