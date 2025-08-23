import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, InputNumber, Radio, message, Divider } from 'antd';
import { WalletOutlined } from '@ant-design/icons';

const { Option } = Select;

const OrderForm = ({ pair, balance, onSubmit, loading }) => {
  const [form] = Form.useForm();
  const [orderType, setOrderType] = useState('limit');
  const [side, setSide] = useState('buy');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');

  // Calculate total when price or quantity changes
  useEffect(() => {
    if (price && quantity) {
      const calculatedTotal = parseFloat(price) * parseFloat(quantity);
      setTotal(calculatedTotal.toFixed(4));
      form.setFieldsValue({ total: calculatedTotal.toFixed(4) });
    }
  }, [price, quantity, form]);

  // Handle form submission
  const handleSubmit = async (values) => {
    try {
      // Validate balance
      if (side === 'buy') {
        const requiredQuote = parseFloat(values.price) * parseFloat(values.quantity);
        if (requiredQuote > balance.usdc) {
          message.error('Insufficient USDC balance');
          return;
        }
      } else {
        if (parseFloat(values.quantity) > balance.apt) {
          message.error('Insufficient APT balance');
          return;
        }
      }

      // Create order data
      const orderData = {
        side,
        type: orderType,
        price: values.price,
        quantity: values.quantity,
        pair
      };

      await onSubmit(orderData);
      
      // Reset form on success
      form.resetFields();
      setPrice('');
      setQuantity('');
      setTotal('');
    } catch (error) {
      console.error('Order submission error:', error);
    }
  };

  // Handle percentage buttons for quick quantity selection
  const handlePercentageClick = (percentage) => {
    let availableBalance;
    let calculatedQuantity;

    if (side === 'buy') {
      // For buy orders, calculate based on USDC balance and current price
      availableBalance = balance.usdc;
      if (price) {
        calculatedQuantity = (availableBalance * percentage / 100) / parseFloat(price);
      }
    } else {
      // For sell orders, calculate based on APT balance
      availableBalance = balance.apt;
      calculatedQuantity = availableBalance * percentage / 100;
    }

    if (calculatedQuantity) {
      const roundedQuantity = calculatedQuantity.toFixed(6);
      setQuantity(roundedQuantity);
      form.setFieldsValue({ quantity: roundedQuantity });
    }
  };

  // Get base and quote assets from pair
  const [baseAsset, quoteAsset] = pair.split('-');

  return (
    <div className="trading-form">
      {/* Order Side Selector */}
      <Radio.Group
        value={side}
        onChange={(e) => setSide(e.target.value)}
        style={{ width: '100%', marginBottom: 16 }}
        buttonStyle="solid"
      >
        <Radio.Button value="buy" style={{ width: '50%', textAlign: 'center' }}>
          Buy {baseAsset}
        </Radio.Button>
        <Radio.Button value="sell" style={{ width: '50%', textAlign: 'center' }}>
          Sell {baseAsset}
        </Radio.Button>
      </Radio.Group>

      {/* Order Type Selector */}
      <Form.Item label="Order Type" style={{ marginBottom: 16 }}>
        <Select
          value={orderType}
          onChange={setOrderType}
          style={{ width: '100%' }}
        >
          <Option value="limit">Limit Order</Option>
          <Option value="market">Market Order</Option>
        </Select>
      </Form.Item>

      {/* Balance Display */}
      <div className="balance-display" style={{ marginBottom: 16 }}>
        <div className="balance-item">
          <div className="balance-label">{baseAsset} Balance</div>
          <div className="balance-value">{balance.apt?.toFixed(4) || '0.0000'}</div>
        </div>
        <div className="balance-item">
          <div className="balance-label">{quoteAsset} Balance</div>
          <div className="balance-value">{balance.usdc?.toFixed(2) || '0.00'}</div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        {/* Price Input (only for limit orders) */}
        {orderType === 'limit' && (
          <Form.Item
            label={`Price (${quoteAsset})`}
            name="price"
            rules={[
              { required: true, message: 'Please enter price' },
              { 
                validator: (_, value) => {
                  if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                    return Promise.reject('Price must be a positive number');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              suffix={quoteAsset}
            />
          </Form.Item>
        )}

        {/* Quantity Input */}
        <Form.Item
          label={`Quantity (${baseAsset})`}
          name="quantity"
          rules={[
            { required: true, message: 'Please enter quantity' },
            { 
              validator: (_, value) => {
                if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                  return Promise.reject('Quantity must be a positive number');
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <Input
            placeholder="0.000000"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            suffix={baseAsset}
          />
        </Form.Item>

        {/* Percentage Buttons */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr 1fr', 
          gap: 8, 
          marginBottom: 16 
        }}>
          {[25, 50, 75, 100].map(percentage => (
            <Button
              key={percentage}
              size="small"
              onClick={() => handlePercentageClick(percentage)}
            >
              {percentage}%
            </Button>
          ))}
        </div>

        {/* Total (for limit orders) */}
        {orderType === 'limit' && (
          <Form.Item
            label={`Total (${quoteAsset})`}
            name="total"
          >
            <Input
              placeholder="0.00"
              value={total}
              readOnly
              suffix={quoteAsset}
              style={{ background: '#f5f5f5' }}
            />
          </Form.Item>
        )}

        <Divider style={{ margin: '16px 0' }} />

        {/* Submit Button */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            className={side === 'buy' ? 'buy-button' : 'sell-button'}
            style={{
              width: '100%',
              height: 48,
              fontSize: 16,
              fontWeight: 'bold',
              background: side === 'buy' ? '#52c41a' : '#ff4d4f',
              borderColor: side === 'buy' ? '#52c41a' : '#ff4d4f'
            }}
          >
            <WalletOutlined style={{ marginRight: 8 }} />
            {side === 'buy' ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
          </Button>
        </Form.Item>

        {/* Order Summary */}
        {orderType === 'limit' && price && quantity && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#f9f9f9',
            borderRadius: 6,
            fontSize: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Order Value:</span>
              <span>{total} {quoteAsset}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Est. Fee (0.3%):</span>
              <span>{(parseFloat(total) * 0.003).toFixed(4)} {quoteAsset}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Total Cost:</span>
              <span>{(parseFloat(total) * 1.003).toFixed(4)} {quoteAsset}</span>
            </div>
          </div>
        )}

        {/* Market Order Warning */}
        {orderType === 'market' && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#fff7e6',
            border: '1px solid #ffd666',
            borderRadius: 6,
            fontSize: 12,
            color: '#ad8b00'
          }}>
            ⚠️ Market orders execute immediately at the best available price
          </div>
        )}
      </Form>
    </div>
  );
};

export default OrderForm;