import React from 'react';
import { Card, List, Typography, Tag } from 'antd';

const { Text } = Typography;

const RecentTrades = ({ trades, loading }) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        Loading trades...
      </div>
    );
  }

  return (
    <div style={{ height: 300, overflowY: 'auto' }}>
      <List
        size="small"
        dataSource={trades}
        renderItem={(trade) => (
          <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Text style={{ color: trade.side === 'buy' ? '#52c41a' : '#ff4d4f' }}>
                ${trade.price}
              </Text>
              <Text>{trade.quantity}</Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {new Date(trade.timestamp).toLocaleTimeString()}
              </Text>
            </div>
          </List.Item>
        )}
      />
      {trades.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          No recent trades
        </div>
      )}
    </div>
  );
};

export default RecentTrades;