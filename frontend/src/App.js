import React, { useState, useEffect } from 'react';
import { Layout, Menu, message, Spin } from 'antd';
import { 
  DashboardOutlined, 
  LineChartOutlined, 
  BarChartOutlined,
  WalletOutlined,
  SettingOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { MartianWallet } from '@martianwallet/aptos-wallet-adapter';

// Import components
import TradingDashboard from './components/TradingDashboard';
import OrderBook from './components/OrderBook';
import TradingChart from './components/TradingChart';
import WalletConnection from './components/WalletConnection';
import Analytics from './components/Analytics';
import CrossChainAssetManager from './components/CrossChainAssetManager';

// Import services
import { AptosService } from './services/AptosService';
import { WebSocketService } from './services/WebSocketService';

const { Header, Content, Sider } = Layout;

// Wallet configuration
const wallets = [
  new MartianWallet(),
];

const networkConfig = {
  network: 'testnet',
  nodeUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
  faucetUrl: 'https://faucet.testnet.aptoslabs.com',
};

function App() {
  const [selectedMenuItem, setSelectedMenuItem] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [aptosService, setAptosService] = useState(null);
  const [webSocketService, setWebSocketService] = useState(null);
  const [marketData, setMarketData] = useState({
    lastPrice: 0,
    volume24h: 0,
    change24h: 0,
  });

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize Aptos service
        const aptos = new AptosService(networkConfig);
        await aptos.initialize();
        setAptosService(aptos);

        // Initialize WebSocket service for real-time data
        const ws = new WebSocketService('ws://localhost:3002');
        ws.connect();
        setWebSocketService(ws);

        // Subscribe to market data updates
        ws.on('marketUpdate', (data) => {
          setMarketData(data);
        });

        setLoading(false);
        message.success('Services initialized successfully');
      } catch (error) {
        console.error('Failed to initialize services:', error);
        message.error('Failed to initialize services');
        setLoading(false);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      if (webSocketService) {
        webSocketService.disconnect();
      }
    };
  }, []);

  // Menu items configuration
  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Trading Dashboard',
    },
    {
      key: 'orderbook',
      icon: <LineChartOutlined />,
      label: 'Order Book',
    },
    {
      key: 'chart',
      icon: <BarChartOutlined />,
      label: 'Trading Chart',
    },
    {
      key: 'analytics',
      icon: <BarChartOutlined />,
      label: 'Analytics',
    },
    {
      key: 'crosschain',
      icon: <SwapOutlined />,
      label: 'Cross-Chain',
    },
    {
      key: 'wallet',
      icon: <WalletOutlined />,
      label: 'Wallet',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  // Render main content based on selected menu item
  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px' 
        }}>
          <Spin size="large" />
          <span style={{ marginLeft: 16 }}>Initializing CLOB Trading Platform...</span>
        </div>
      );
    }

    switch (selectedMenuItem) {
      case 'dashboard':
        return (
          <TradingDashboard 
            aptosService={aptosService}
            webSocketService={webSocketService}
            marketData={marketData}
          />
        );
      case 'orderbook':
        return (
          <OrderBook 
            aptosService={aptosService}
            webSocketService={webSocketService}
          />
        );
      case 'chart':
        return (
          <TradingChart 
            aptosService={aptosService}
            webSocketService={webSocketService}
            marketData={marketData}
          />
        );
      case 'analytics':
        return (
          <Analytics 
            aptosService={aptosService}
            marketData={marketData}
          />
        );
      case 'crosschain':
        return (
          <CrossChainAssetManager 
            aptosService={aptosService}
            userWallet={connected ? { address: 'mock_address' } : null}
          />
        );
      case 'wallet':
        return (
          <WalletConnection 
            aptosService={aptosService}
            onConnectionChange={setConnected}
          />
        );
      case 'settings':
        return (
          <div style={{ padding: 24 }}>
            <h2>Settings</h2>
            <p>Platform settings and configuration will be available here.</p>
          </div>
        );
      default:
        return (
          <TradingDashboard 
            aptosService={aptosService}
            webSocketService={webSocketService}
            marketData={marketData}
          />
        );
    }
  };

  return (
    <AptosWalletAdapterProvider 
      wallets={wallets}
      autoConnect={true}
      onError={(error) => {
        console.error('Wallet adapter error:', error);
        message.error('Wallet connection error');
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ 
          background: '#001529', 
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ 
            color: 'white', 
            fontSize: '20px', 
            fontWeight: 'bold' 
          }}>
            🚀 Aptos CLOB Trading Platform
          </div>
          
          <div style={{ 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <span>Last Price: ${marketData.lastPrice.toFixed(4)}</span>
            <span 
              style={{ 
                color: marketData.change24h >= 0 ? '#52c41a' : '#ff4d4f' 
              }}
            >
              {marketData.change24h >= 0 ? '+' : ''}{marketData.change24h.toFixed(2)}%
            </span>
            <span>Vol: {marketData.volume24h.toFixed(2)}</span>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: connected ? '#52c41a' : '#ff4d4f',
              marginLeft: 8
            }} />
          </div>
        </Header>
        
        <Layout>
          <Sider 
            width={256} 
            style={{ background: '#fff' }}
            breakpoint="lg"
            collapsedWidth="0"
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedMenuItem]}
              items={menuItems}
              style={{ height: '100%', borderRight: 0 }}
              onClick={(e) => setSelectedMenuItem(e.key)}
            />
          </Sider>
          
          <Layout style={{ padding: '0 24px 24px' }}>
            <Content
              style={{
                background: '#fff',
                padding: 24,
                margin: 0,
                minHeight: 280,
              }}
            >
              {renderContent()}
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </AptosWalletAdapterProvider>
  );
}

export default App;