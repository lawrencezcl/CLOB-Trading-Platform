import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Spin } from 'antd';

const TradingChart = ({ pair, aptosService, webSocketService, marketData }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate mock chart data for demonstration
    const generateMockData = () => {
      const data = [];
      const basePrice = 12.5;
      const now = Date.now();
      
      for (let i = 100; i >= 0; i--) {
        const timestamp = now - (i * 60000); // 1 minute intervals
        const price = basePrice + (Math.random() - 0.5) * 2; // Random walk
        
        data.push({
          timestamp,
          time: new Date(timestamp).toLocaleTimeString(),
          price: price.toFixed(4),
          volume: Math.random() * 1000 + 100
        });
      }
      
      return data;
    };

    setChartData(generateMockData());
    setLoading(false);
  }, [pair]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 300 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            interval="preserveStartEnd"
            fontSize={10}
          />
          <YAxis 
            domain={['dataMin - 0.1', 'dataMax + 0.1']}
            fontSize={10}
          />
          <Tooltip 
            labelFormatter={(value) => `Time: ${value}`}
            formatter={(value) => [`$${value}`, 'Price']}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#1890ff" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TradingChart;