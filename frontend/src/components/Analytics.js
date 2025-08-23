import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Table } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const Analytics = ({ aptosService, marketData }) => {
  const [analytics, setAnalytics] = useState({
    volumeData: [],
    topTraders: [],
    priceHistory: [],
    tradingPairs: []
  });

  useEffect(() => {
    // Generate mock analytics data
    const generateMockData = () => {
      // Volume data for the last 7 days
      const volumeData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        volumeData.push({
          date: date.toISOString().split('T')[0],
          volume: Math.random() * 10000 + 5000,
          trades: Math.floor(Math.random() * 500 + 100)
        });
      }

      // Top traders
      const topTraders = [
        { address: '0x1234...5678', volume: 125420, trades: 342, pnl: 12.5 },
        { address: '0x2345...6789', volume: 98765, trades: 298, pnl: -3.2 },
        { address: '0x3456...7890', volume: 87543, trades: 234, pnl: 8.7 },
        { address: '0x4567...8901', volume: 76543, trades: 187, pnl: 15.3 },
        { address: '0x5678...9012', volume: 65432, trades: 156, pnl: -1.8 }
      ];

      // Trading pairs distribution
      const tradingPairs = [
        { name: 'APT-USDC', value: 65, color: '#8884d8' },
        { name: 'APT-USDT', value: 25, color: '#82ca9d' },
        { name: 'APT-BTC', value: 10, color: '#ffc658' }
      ];

      setAnalytics({
        volumeData,
        topTraders,
        tradingPairs
      });
    };

    generateMockData();
  }, []);

  const columns = [
    {
      title: 'Trader',
      dataIndex: 'address',
      key: 'address',
      render: (address) => (
        <span style={{ fontFamily: 'monospace' }}>{address}</span>
      )
    },
    {
      title: 'Volume',
      dataIndex: 'volume',
      key: 'volume',
      render: (volume) => `$${volume.toLocaleString()}`,
      sorter: (a, b) => a.volume - b.volume,
    },
    {
      title: 'Trades',
      dataIndex: 'trades',
      key: 'trades',
      sorter: (a, b) => a.trades - b.trades,
    },
    {
      title: 'P&L %',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl) => (
        <span style={{ color: pnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {Math.abs(pnl).toFixed(1)}%
        </span>
      ),
      sorter: (a, b) => a.pnl - b.pnl,
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Market Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="24h Volume"
              value={marketData?.volume24h || 0}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix="$"
              suffix="K"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="24h Change"
              value={marketData?.change24h || 0}
              precision={2}
              valueStyle={{ color: (marketData?.change24h || 0) >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={(marketData?.change24h || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Traders"
              value={156}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Avg Trade Size"
              value={1250}
              prefix="$"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <Card title="Trading Volume (7 Days)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.volumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'volume' ? `$${value.toLocaleString()}` : value,
                    name === 'volume' ? 'Volume' : 'Trades'
                  ]}
                />
                <Bar dataKey="volume" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Trading Pairs Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.tradingPairs}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.tradingPairs.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Top Traders Table */}
      <Card title="Top Traders (24h)">
        <Table
          columns={columns}
          dataSource={analytics.topTraders}
          rowKey="address"
          pagination={false}
          size="small"
        />
      </Card>

      {/* Market Health Indicators */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card title="Market Health">
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Liquidity Depth</span>
                <span>85%</span>
              </div>
              <Progress percent={85} strokeColor="#52c41a" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Order Book Spread</span>
                <span>Good</span>
              </div>
              <Progress percent={75} strokeColor="#1890ff" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Market Activity</span>
                <span>High</span>
              </div>
              <Progress percent={92} strokeColor="#722ed1" />
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Platform Stats">
            <Statistic
              title="Total Trading Volume"
              value={1250420}
              prefix="$"
              style={{ marginBottom: 16 }}
            />
            <Statistic
              title="Total Trades"
              value={8547}
              style={{ marginBottom: 16 }}
            />
            <Statistic
              title="Active Users"
              value={342}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Risk Metrics">
            <div style={{ marginBottom: 12 }}>
              <span>Platform Utilization: </span>
              <span style={{ fontWeight: 'bold' }}>72%</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span>Avg Slippage: </span>
              <span style={{ fontWeight: 'bold' }}>0.15%</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span>Failed Txns: </span>
              <span style={{ fontWeight: 'bold', color: '#52c41a' }}>0.02%</span>
            </div>
            <div>
              <span>Network Congestion: </span>
              <span style={{ fontWeight: 'bold', color: '#52c41a' }}>Low</span>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;