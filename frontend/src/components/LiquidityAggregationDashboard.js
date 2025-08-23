import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Table, 
  Progress, 
  Statistic, 
  Badge, 
  Alert, 
  Tabs,
  Button,
  Switch,
  Tooltip,
  Tag
} from 'antd';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  ThunderboltOutlined, 
  LinkOutlined, 
  TrophyOutlined,
  EyeOutlined,
  SettingOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import clobLiquidityAggregator from '../services/CLOBLiquidityAggregator';

const { TabPane } = Tabs;

const LiquidityAggregationDashboard = ({ aptosService }) => {
  const [aggregatedData, setAggregatedData] = useState({
    orderBook: { bids: [], asks: [], metrics: {} },
    sources: [],
    arbitrageOpportunities: []
  });
  const [selectedStrategy, setSelectedStrategy] = useState('best_price');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [liquidityHistory, setLiquidityHistory] = useState([]);

  useEffect(() => {
    // Load initial data
    loadAggregationData();
    
    // Subscribe to real-time updates
    clobLiquidityAggregator.on('orderBookUpdated', handleOrderBookUpdate);
    clobLiquidityAggregator.on('arbitrageOpportunities', handleArbitrageUpdate);
    
    // Setup refresh interval
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadAggregationData, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      clobLiquidityAggregator.removeAllListeners();
    };
  }, [autoRefresh]);

  const loadAggregationData = () => {
    try {
      const orderBook = clobLiquidityAggregator.getAggregatedOrderBook();
      const sources = clobLiquidityAggregator.getSourceStatus();
      const metrics = clobLiquidityAggregator.getLiquidityMetrics();
      
      setAggregatedData(prev => ({
        orderBook,
        sources,
        arbitrageOpportunities: prev.arbitrageOpportunities
      }));
      
      // Update liquidity history for charts
      setLiquidityHistory(prev => {
        const newEntry = {
          timestamp: Date.now(),
          liquidityScore: metrics.liquidityScore || 0,
          spread: metrics.spreadPercent || 0,
          depth: metrics.totalDepth || 0,
          sources: sources.filter(s => s.isActive).length
        };
        
        return [...prev.slice(-20), newEntry]; // Keep last 20 points
      });
      
    } catch (error) {
      console.error('Failed to load aggregation data:', error);
    }
  };

  const handleOrderBookUpdate = (orderBook) => {
    setAggregatedData(prev => ({
      ...prev,
      orderBook
    }));
  };

  const handleArbitrageUpdate = (opportunities) => {
    setAggregatedData(prev => ({
      ...prev,
      arbitrageOpportunities: opportunities
    }));
  };

  // Order book table columns
  const orderBookColumns = [
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price) => `$${price.toFixed(4)}`,
      width: 120
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size) => size.toFixed(2),
      width: 100
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total) => `$${total.toFixed(2)}`,
      width: 120
    },
    {
      title: 'Sources',
      dataIndex: 'sources',
      key: 'sources',
      render: (sources) => (
        <div>
          {sources?.map(source => (
            <Tag key={source} size="small">{source}</Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Weight',
      dataIndex: 'weight',
      key: 'weight',
      render: (weight) => (
        <Progress 
          percent={Math.round(weight * 100)} 
          size="small" 
          showInfo={false}
          strokeColor={weight > 0.7 ? '#52c41a' : weight > 0.4 ? '#faad14' : '#ff4d4f'}
        />
      ),
      width: 80
    }
  ];

  // Source status columns
  const sourceColumns = [
    {
      title: 'Source',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Badge 
            status={record.isActive ? 'success' : 'error'} 
            text={name} 
          />
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.chain}
          </div>
        </div>
      )
    },
    {
      title: 'Orders',
      key: 'orders',
      render: (_, record) => (
        <div>
          <span style={{ color: '#52c41a' }}>{record.bidCount} bids</span>
          <br />
          <span style={{ color: '#ff4d4f' }}>{record.askCount} asks</span>
        </div>
      ),
      width: 100
    },
    {
      title: 'Last Update',
      dataIndex: 'lastUpdate',
      key: 'lastUpdate',
      render: (timestamp) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        return `${seconds}s ago`;
      },
      width: 100
    }
  ];

  // Arbitrage opportunities columns
  const arbitrageColumns = [
    {
      title: 'Route',
      key: 'route',
      render: (_, record) => (
        <div>
          <Tag color="blue">{record.buySource}</Tag>
          →
          <Tag color="green">{record.sellSource}</Tag>
        </div>
      )
    },
    {
      title: 'Profit',
      key: 'profit',
      render: (_, record) => (
        <div>
          <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
            {record.profitPercent.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px' }}>
            ${record.netProfit.toFixed(4)}
          </div>
        </div>
      )
    },
    {
      title: 'Volume',
      dataIndex: 'estimatedVolume',
      key: 'volume',
      render: (volume) => volume.toFixed(2)
    },
    {
      title: 'Chains',
      dataIndex: 'chains',
      key: 'chains',
      render: (chains) => (
        <div>
          {chains.map(chain => (
            <Tag key={chain} size="small">{chain}</Tag>
          ))}
        </div>
      )
    }
  ];

  const metrics = aggregatedData.orderBook.metrics || {};

  return (
    <div style={{ padding: 24 }}>
      {/* Header Controls */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={18}>
          <h2>Cross-Chain Liquidity Aggregation</h2>
        </Col>
        <Col span={6} style={{ textAlign: 'right' }}>
          <Switch 
            checked={autoRefresh}
            onChange={setAutoRefresh}
            checkedChildren="Auto"
            unCheckedChildren="Manual"
          />
        </Col>
      </Row>

      {/* Key Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Liquidity Score"
              value={metrics.liquidityScore || 0}
              precision={1}
              suffix="/100"
              valueStyle={{ 
                color: metrics.liquidityScore > 70 ? '#52c41a' : 
                       metrics.liquidityScore > 40 ? '#faad14' : '#ff4d4f' 
              }}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Spread"
              value={metrics.spreadPercent || 0}
              precision={3}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Depth"
              value={metrics.totalDepth || 0}
              prefix="$"
              formatter={(value) => `${(value / 1000).toFixed(1)}K`}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Sources"
              value={aggregatedData.sources.filter(s => s.isActive).length}
              suffix={`/${aggregatedData.sources.length}`}
              valueStyle={{ color: '#52c41a' }}
              prefix={<LinkOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Tabs defaultActiveKey="orderbook">
        <TabPane tab="Aggregated Order Book" key="orderbook">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Bids" size="small">
                <Table
                  columns={orderBookColumns}
                  dataSource={aggregatedData.orderBook.bids?.slice(0, 10)}
                  pagination={false}
                  size="small"
                  rowKey={(record, index) => `bid-${index}`}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Asks" size="small">
                <Table
                  columns={orderBookColumns}
                  dataSource={aggregatedData.orderBook.asks?.slice(0, 10)}
                  pagination={false}
                  size="small"
                  rowKey={(record, index) => `ask-${index}`}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Liquidity Sources" key="sources">
          <Card title="Source Status">
            <Table
              columns={sourceColumns}
              dataSource={aggregatedData.sources}
              pagination={false}
              size="small"
              rowKey="sourceId"
            />
          </Card>
        </TabPane>

        <TabPane tab="Arbitrage Opportunities" key="arbitrage">
          <Card 
            title="Cross-Chain Arbitrage" 
            extra={
              <Badge 
                count={aggregatedData.arbitrageOpportunities.length} 
                style={{ backgroundColor: '#52c41a' }}
              />
            }
          >
            {aggregatedData.arbitrageOpportunities.length > 0 ? (
              <Table
                columns={arbitrageColumns}
                dataSource={aggregatedData.arbitrageOpportunities}
                pagination={false}
                size="small"
                rowKey={(record, index) => index}
              />
            ) : (
              <Alert
                message="No Arbitrage Opportunities"
                description="Currently no profitable arbitrage opportunities detected across chains."
                type="info"
                showIcon
              />
            )}
          </Card>
        </TabPane>

        <TabPane tab="Analytics" key="analytics">
          <Row gutter={16}>
            <Col span={24}>
              <Card title="Liquidity Metrics Over Time">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={liquidityHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="liquidityScore" 
                      stroke="#8884d8" 
                      name="Liquidity Score"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sources" 
                      stroke="#82ca9d" 
                      name="Active Sources"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
          
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="Spread Analysis">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={liquidityHistory.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="spread" fill="#ffc658" name="Spread %" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Depth Distribution">
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart data={liquidityHistory}>
                    <CartesianGrid />
                    <XAxis dataKey="sources" name="Sources" />
                    <YAxis dataKey="depth" name="Depth" />
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Liquidity" data={liquidityHistory} fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* Status Alerts */}
      {metrics.liquidityScore < 50 && (
        <Alert
          message="Low Liquidity Warning"
          description="Current liquidity score is below optimal levels. Consider adjusting aggregation parameters."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {aggregatedData.sources.filter(s => s.isActive).length < 3 && (
        <Alert
          message="Limited Source Connectivity"
          description="Less than 3 liquidity sources are currently active. This may impact price discovery."
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default LiquidityAggregationDashboard;