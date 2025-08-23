import React, { useState, useEffect, useMemo } from 'react';
import { Spin, Typography, Button } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text } = Typography;

const OrderBook = ({ data, loading, onPriceClick, maxLevels = 20 }) => {
  const [precision, setPrecision] = useState(4);
  const [grouping, setGrouping] = useState(0.01);

  // Process and group orders by price levels
  const processedData = useMemo(() => {
    if (!data || (!data.bids?.length && !data.asks?.length)) {
      return { bids: [], asks: [], spread: 0, midPrice: 0 };
    }

    // Group orders by price with specified precision
    const groupOrders = (orders, isAsk = false) => {
      const grouped = new Map();
      
      orders.forEach(order => {
        const price = parseFloat(order.price);
        const quantity = parseFloat(order.quantity);
        
        // Group by price level based on grouping
        const groupedPrice = Math.floor(price / grouping) * grouping;
        const key = groupedPrice.toFixed(precision);
        
        if (grouped.has(key)) {
          grouped.get(key).quantity += quantity;
        } else {
          grouped.set(key, {
            price: groupedPrice,
            quantity: quantity,
            total: 0 // Will be calculated below
          });
        }
      });

      // Convert to array and sort
      let result = Array.from(grouped.values());
      result.sort((a, b) => isAsk ? a.price - b.price : b.price - a.price);
      
      // Calculate cumulative totals for depth visualization
      let cumulativeTotal = 0;
      result = result.map(level => {
        cumulativeTotal += level.quantity;
        return {
          ...level,
          total: cumulativeTotal
        };
      });

      return result.slice(0, maxLevels);
    };

    const processedBids = groupOrders(data.bids || [], false);
    const processedAsks = groupOrders(data.asks || [], true);

    // Calculate spread and mid price
    const bestBid = processedBids.length > 0 ? processedBids[0].price : 0;
    const bestAsk = processedAsks.length > 0 ? processedAsks[0].price : 0;
    const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
    const midPrice = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;

    return {
      bids: processedBids,
      asks: processedAsks,
      spread,
      midPrice
    };
  }, [data, precision, grouping, maxLevels]);

  // Get maximum quantity for depth visualization
  const maxQuantity = useMemo(() => {
    const allQuantities = [
      ...processedData.bids.map(b => b.quantity),
      ...processedData.asks.map(a => a.quantity)
    ];
    return Math.max(...allQuantities, 1);
  }, [processedData]);

  // Handle price click
  const handlePriceClick = (price) => {
    if (onPriceClick) {
      onPriceClick(price);
    }
  };

  // Render order row
  const renderOrderRow = (order, side, index) => {
    const depthPercentage = (order.quantity / maxQuantity) * 100;
    const isBuy = side === 'buy';
    
    return (
      <div
        key={`${side}-${index}`}
        className={`orderbook-row ${isBuy ? 'orderbook-buy' : 'orderbook-sell'}`}
        style={{
          background: isBuy 
            ? `linear-gradient(90deg, transparent ${100 - depthPercentage}%, rgba(82, 196, 26, 0.15) 100%)`
            : `linear-gradient(90deg, transparent ${100 - depthPercentage}%, rgba(255, 77, 79, 0.15) 100%)`
        }}
        onClick={() => handlePriceClick(order.price)}
      >
        <span className={isBuy ? 'orderbook-price-buy' : 'orderbook-price-sell'}>
          {order.price.toFixed(precision)}
        </span>
        <span className="orderbook-quantity">
          {order.quantity.toFixed(2)}
        </span>
        <span className="orderbook-quantity">
          {order.total.toFixed(2)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 200 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="orderbook-container">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 16,
        padding: '0 8px'
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button 
            size="small" 
            onClick={() => setPrecision(2)}
            type={precision === 2 ? 'primary' : 'default'}
          >
            0.01
          </Button>
          <Button 
            size="small" 
            onClick={() => setPrecision(3)}
            type={precision === 3 ? 'primary' : 'default'}
          >
            0.001
          </Button>
          <Button 
            size="small" 
            onClick={() => setPrecision(4)}
            type={precision === 4 ? 'primary' : 'default'}
          >
            0.0001
          </Button>
        </div>
        
        {data?.lastUpdate && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            {new Date(data.lastUpdate).toLocaleTimeString()}
          </Text>
        )}
      </div>

      {/* Column headers */}
      <div className="orderbook-row" style={{ 
        fontWeight: 'bold', 
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <span>Price</span>
        <span>Quantity</span>
        <span>Total</span>
      </div>

      {/* Asks (Sell orders) - displayed at top */}
      <div style={{ maxHeight: '200px', overflowY: 'hidden' }}>
        {processedData.asks.slice().reverse().map((ask, index) => 
          renderOrderRow(ask, 'sell', index)
        )}
      </div>

      {/* Spread indicator */}
      <div style={{
        padding: '8px',
        background: '#f5f5f5',
        borderTop: '1px solid #d9d9d9',
        borderBottom: '1px solid #d9d9d9',
        textAlign: 'center',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666' }}>
            Spread: {processedData.spread.toFixed(precision)}
          </span>
          <span style={{ fontWeight: 'bold' }}>
            ${processedData.midPrice.toFixed(precision)}
          </span>
          <span style={{ color: '#666' }}>
            {((processedData.spread / processedData.midPrice) * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Bids (Buy orders) - displayed at bottom */}
      <div style={{ maxHeight: '200px', overflowY: 'hidden' }}>
        {processedData.bids.map((bid, index) => 
          renderOrderRow(bid, 'buy', index)
        )}
      </div>

      {/* Footer with statistics */}
      <div style={{
        marginTop: 16,
        padding: '8px',
        background: '#fafafa',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#666'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 4 }} />
            {processedData.bids.length} bids
          </span>
          <span>
            <ArrowDownOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
            {processedData.asks.length} asks
          </span>
        </div>
      </div>

      {/* Empty state */}
      {processedData.bids.length === 0 && processedData.asks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#999'
        }}>
          <div style={{ marginBottom: 8 }}>📊</div>
          <div>No order book data available</div>
          <div style={{ fontSize: '12px', marginTop: 4 }}>
            Waiting for market data...
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderBook;