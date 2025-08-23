import React, { useState, useEffect } from 'react';
import { Card, Button, message, Descriptions, Alert } from 'antd';
import { WalletOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const WalletConnection = ({ aptosService, onConnectionChange }) => {
  const { 
    connect, 
    disconnect, 
    account, 
    connected, 
    connecting, 
    wallet 
  } = useWallet();
  
  const [balance, setBalance] = useState({
    apt: 0,
    usdc: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(connected);
    }
  }, [connected, onConnectionChange]);

  useEffect(() => {
    if (connected && account?.address) {
      fetchBalance();
    }
  }, [connected, account?.address]);

  const fetchBalance = async () => {
    if (!aptosService || !account?.address) return;
    
    try {
      setLoading(true);
      const userBalance = await aptosService.getUserBalance();
      setBalance(userBalance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      await connect('Petra' in window ? 'Petra' : 'Martian');
      message.success('Wallet connected successfully');
    } catch (error) {
      console.error('Connection error:', error);
      message.error('Failed to connect wallet');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setBalance({ apt: 0, usdc: 0 });
      message.success('Wallet disconnected');
    } catch (error) {
      console.error('Disconnection error:', error);
      message.error('Failed to disconnect wallet');
    }
  };

  const handleFaucetRequest = async () => {
    try {
      setLoading(true);
      await aptosService.fundFromFaucet();
      message.success('Faucet request successful! Check your balance in a few moments.');
      setTimeout(fetchBalance, 3000); // Refresh balance after 3 seconds
    } catch (error) {
      console.error('Faucet error:', error);
      message.error('Faucet request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="Wallet Connection" style={{ marginBottom: 24 }}>
        {!connected ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <WalletOutlined style={{ fontSize: 48, color: '#ccc' }} />
            </div>
            <p>Connect your Aptos wallet to start trading</p>
            <Button 
              type="primary" 
              size="large"
              loading={connecting}
              onClick={handleConnect}
              icon={<WalletOutlined />}
            >
              Connect Wallet
            </Button>
          </div>
        ) : (
          <div>
            <div className="wallet-connection">
              <div className="wallet-status">
                <div className="wallet-status-dot connected"></div>
                <span>Connected to {wallet?.name || 'Unknown'}</span>
              </div>
              <Button 
                danger
                onClick={handleDisconnect}
                icon={<DisconnectOutlined />}
              >
                Disconnect
              </Button>
            </div>

            <Descriptions column={1} style={{ marginTop: 16 }}>
              <Descriptions.Item label="Address">
                {account?.address ? 
                  `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 
                  'Unknown'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Network">
                Testnet
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Card>

      {connected && (
        <Card title="Account Balance" loading={loading}>
          <div className="balance-display">
            <div className="balance-item">
              <div className="balance-label">APT Balance</div>
              <div className="balance-value">{balance.apt?.toFixed(4) || '0.0000'}</div>
            </div>
            <div className="balance-item">
              <div className="balance-label">USDC Balance</div>
              <div className="balance-value">{balance.usdc?.toFixed(2) || '0.00'}</div>
            </div>
          </div>

          <Button 
            block 
            style={{ marginTop: 16 }}
            onClick={handleFaucetRequest}
            loading={loading}
          >
            Request Testnet Funds
          </Button>

          <Alert
            message="Testnet Only"
            description="This is running on Aptos testnet. Use faucet to get test tokens."
            type="info"
            style={{ marginTop: 16 }}
            showIcon
          />
        </Card>
      )}

      {connected && (
        <Card title="Wallet Actions" style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Button onClick={fetchBalance}>
              Refresh Balance
            </Button>
            <Button 
              href={`https://explorer.aptoslabs.com/account/${account?.address}?network=testnet`}
              target="_blank"
            >
              View on Explorer
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default WalletConnection;