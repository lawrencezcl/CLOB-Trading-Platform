import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Select, 
  Input, 
  Table, 
  Modal, 
  Form, 
  Steps, 
  Progress, 
  Badge, 
  Alert, 
  Statistic, 
  Row, 
  Col,
  Tooltip,
  message
} from 'antd';
import { 
  SwapOutlined, 
  LinkOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import crossChainBridgeService, { SUPPORTED_CHAINS } from '../services/CrossChainBridgeService';

const { Option } = Select;
const { Step } = Steps;

const CrossChainAssetManager = ({ aptosService, userWallet }) => {
  const [bridgeModalVisible, setBridgeModalVisible] = useState(false);
  const [bridgeForm] = Form.useForm();
  const [activeBridges, setActiveBridges] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [bridgeStats, setBridgeStats] = useState({});
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [bridgeStep, setBridgeStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCrossChainData();
    
    // Poll for bridge updates every 30 seconds
    const interval = setInterval(loadCrossChainData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCrossChainData = async () => {
    try {
      // Load available assets
      const assets = crossChainBridgeService.getAvailableAssets();
      setAvailableAssets(assets);
      
      // Load bridge statistics
      const stats = crossChainBridgeService.getBridgeStats();
      setBridgeStats(stats);
      
      // Load active bridges (mock data for demonstration)
      const mockActiveBridges = [
        {
          bridgeId: 'bridge_001',
          fromChain: 'ETHEREUM',
          toChain: 'APTOS',
          asset: 'USDC',
          amount: 1000,
          status: 'bridging',
          progress: 65,
          estimatedCompletion: Date.now() + 120000
        },
        {
          bridgeId: 'bridge_002',
          fromChain: 'SOLANA',
          toChain: 'APTOS',
          asset: 'SOL',
          amount: 5.5,
          status: 'completed',
          progress: 100,
          completedAt: Date.now() - 300000
        }
      ];
      setActiveBridges(mockActiveBridges);
      
    } catch (error) {
      console.error('Failed to load cross-chain data:', error);
      message.error('Failed to load cross-chain data');
    }
  };

  const handleBridgeAssets = async (values) => {
    try {
      setLoading(true);
      setBridgeStep(1);
      
      const { fromChain, toChain, asset, amount, recipient } = values;
      
      // Get optimal route
      const route = await crossChainBridgeService.getOptimalBridgeRoute(
        fromChain, 
        toChain, 
        asset, 
        parseFloat(amount)
      );
      
      setSelectedRoute(route);
      setBridgeStep(2);
      
      // Simulate transaction confirmation
      setTimeout(() => {
        setBridgeStep(3);
        
        // Initiate bridge
        crossChainBridgeService.bridgeAssets(
          fromChain,
          toChain,
          asset,
          parseFloat(amount),
          recipient || userWallet?.address
        ).then((result) => {
          setBridgeStep(4);
          message.success(`Bridge initiated successfully! Bridge ID: ${result.bridgeId}`);
          
          // Add to active bridges
          setActiveBridges(prev => [...prev, {
            bridgeId: result.bridgeId,
            fromChain,
            toChain,
            asset,
            amount: parseFloat(amount),
            status: 'pending',
            progress: 0,
            estimatedCompletion: result.estimatedCompletion
          }]);
          
          // Reset modal after success
          setTimeout(() => {
            setBridgeModalVisible(false);
            setBridgeStep(0);
            setSelectedRoute(null);
            bridgeForm.resetFields();
          }, 3000);
        });
      }, 2000);
      
    } catch (error) {
      console.error('Bridge failed:', error);
      message.error(`Bridge failed: ${error.message}`);
      setBridgeStep(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'processing',
      'confirmed': 'processing',
      'bridging': 'processing',
      'completed': 'success',
      'failed': 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': <ClockCircleOutlined />,
      'confirmed': <ClockCircleOutlined />,
      'bridging': <SwapOutlined />,
      'completed': <CheckCircleOutlined />,
      'failed': <ExclamationCircleOutlined />
    };
    return icons[status] || <InfoCircleOutlined />;
  };

  const bridgeColumns = [
    {
      title: 'Bridge ID',
      dataIndex: 'bridgeId',
      key: 'bridgeId',
      render: (id) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {id.substring(0, 12)}...
        </span>
      )
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, record) => (
        <div>
          <Badge color="blue" text={record.fromChain} />
          <SwapOutlined style={{ margin: '0 8px' }} />
          <Badge color="green" text={record.toChain} />
        </div>
      )
    },
    {
      title: 'Asset & Amount',
      key: 'assetAmount',
      render: (_, record) => (
        <div>
          <strong>{record.amount}</strong> {record.asset}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          <Badge 
            status={getStatusColor(status)} 
            icon={getStatusIcon(status)}
            text={status.toUpperCase()} 
          />
          {status === 'bridging' && (
            <Progress 
              percent={record.progress} 
              size="small" 
              style={{ marginTop: 4, width: '100px' }}
            />
          )}
        </div>
      )
    },
    {
      title: 'Time',
      key: 'time',
      render: (_, record) => {
        if (record.status === 'completed') {
          return `Completed ${Math.floor((Date.now() - record.completedAt) / 60000)}m ago`;
        } else if (record.estimatedCompletion) {
          const remaining = Math.max(0, Math.floor((record.estimatedCompletion - Date.now()) / 60000));
          return `~${remaining}m remaining`;
        }
        return '-';
      }
    }
  ];

  const renderBridgeModal = () => (
    <Modal
      title="Cross-Chain Asset Bridge"
      visible={bridgeModalVisible}
      onCancel={() => {
        setBridgeModalVisible(false);
        setBridgeStep(0);
        setSelectedRoute(null);
        bridgeForm.resetFields();
      }}
      footer={null}
      width={600}
    >
      <Steps current={bridgeStep} style={{ marginBottom: 24 }}>
        <Step title="Setup" description="Configure bridge parameters" />
        <Step title="Route" description="Calculate optimal route" />
        <Step title="Confirm" description="Review transaction details" />
        <Step title="Execute" description="Complete bridge transaction" />
      </Steps>

      {bridgeStep === 0 && (
        <Form
          form={bridgeForm}
          layout="vertical"
          onFinish={handleBridgeAssets}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fromChain"
                label="From Chain"
                rules={[{ required: true, message: 'Please select source chain' }]}
              >
                <Select placeholder="Select source chain">
                  {Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => (
                    <Option key={key} value={key}>
                      {chain.name} ({chain.symbol})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="toChain"
                label="To Chain"
                rules={[{ required: true, message: 'Please select destination chain' }]}
              >
                <Select placeholder="Select destination chain">
                  {Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => (
                    <Option key={key} value={key}>
                      {chain.name} ({chain.symbol})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="asset"
                label="Asset"
                rules={[{ required: true, message: 'Please select asset' }]}
              >
                <Select placeholder="Select asset to bridge">
                  {availableAssets.map(asset => (
                    <Option key={asset.symbol} value={asset.symbol}>
                      {asset.name} ({asset.symbol}) - ${asset.price}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Amount"
                rules={[
                  { required: true, message: 'Please enter amount' },
                  { pattern: /^\d+(\.\d+)?$/, message: 'Please enter valid amount' }
                ]}
              >
                <Input placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="recipient"
            label="Recipient Address (Optional)"
            help="Leave empty to use your wallet address"
          >
            <Input placeholder="Destination wallet address" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Calculate Bridge Route
            </Button>
          </Form.Item>
        </Form>
      )}

      {bridgeStep === 1 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Progress type="circle" percent={50} />
          <p style={{ marginTop: 16 }}>Calculating optimal bridge route...</p>
        </div>
      )}

      {bridgeStep === 2 && selectedRoute && (
        <div>
          <Alert
            message="Bridge Route Found"
            description="Please review the route details below before proceeding."
            type="info"
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title="Bridge Provider" value={selectedRoute.provider} />
            </Col>
            <Col span={12}>
              <Statistic 
                title="Estimated Time" 
                value={Math.floor(selectedRoute.estimatedTime / 60)} 
                suffix="minutes" 
              />
            </Col>
          </Row>
          
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Statistic 
                title="Bridge Fee" 
                value={selectedRoute.totalFee} 
                precision={4}
                suffix={bridgeForm.getFieldValue('asset')}
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title="You'll Receive" 
                value={selectedRoute.estimatedOutput} 
                precision={4}
                suffix={bridgeForm.getFieldValue('asset')}
              />
            </Col>
          </Row>

          <Button 
            type="primary" 
            onClick={() => setBridgeStep(3)} 
            block 
            style={{ marginTop: 24 }}
          >
            Confirm Bridge Transaction
          </Button>
        </div>
      )}

      {bridgeStep === 3 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Progress type="circle" percent={75} />
          <p style={{ marginTop: 16 }}>Initiating bridge transaction...</p>
        </div>
      )}

      {bridgeStep === 4 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <h3 style={{ marginTop: 16 }}>Bridge Initiated Successfully!</h3>
          <p>Your cross-chain transfer is now in progress.</p>
        </div>
      )}
    </Modal>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Bridge Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Available Routes"
              value={bridgeStats.totalRoutes || 0}
              prefix={<LinkOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Bridges"
              value={bridgeStats.activeBridges || 0}
              prefix={<SwapOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Supported Assets"
              value={bridgeStats.supportedAssets || 0}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Supported Chains"
              value={bridgeStats.supportedChains || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Bridge Controls */}
      <Card 
        title="Cross-Chain Asset Management" 
        extra={
          <Button 
            type="primary" 
            icon={<SwapOutlined />}
            onClick={() => setBridgeModalVisible(true)}
          >
            Bridge Assets
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Alert
          message="Multi-Chain Trading"
          description="Bridge assets between different blockchains to access liquidity across multiple networks. All bridges are secured and monitored."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Available Assets */}
        <Row gutter={16}>
          {availableAssets.slice(0, 6).map(asset => (
            <Col span={4} key={asset.symbol}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <h4>{asset.symbol}</h4>
                <p style={{ margin: 0, color: '#666' }}>${asset.price}</p>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  {asset.supportedChains.length} chains
                </p>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Active Bridges */}
      <Card title="Bridge Transactions">
        {activeBridges.length > 0 ? (
          <Table
            columns={bridgeColumns}
            dataSource={activeBridges}
            rowKey="bridgeId"
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#666' }}>No active bridge transactions</p>
            <Button 
              type="dashed" 
              icon={<SwapOutlined />}
              onClick={() => setBridgeModalVisible(true)}
            >
              Start Your First Bridge
            </Button>
          </div>
        )}
      </Card>

      {renderBridgeModal()}
    </div>
  );
};

export default CrossChainAssetManager;