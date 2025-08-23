/**
 * WebSocket Service for Real-time Market Data
 * Handles real-time subscriptions for order book, trades, and user data
 */
export class WebSocketService {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.messageQueue = [];
    
    // Event handlers
    this.eventHandlers = new Map();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Send any queued messages
        this.flushMessageQueue();
        
        // Emit connected event
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.emit('disconnected');
        
        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
    }
    this.subscriptions.clear();
    this.eventHandlers.clear();
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel, symbol = null, callback = null) {
    const subscriptionKey = symbol ? `${channel}:${symbol}` : channel;
    
    // Store subscription callback
    if (callback) {
      this.subscriptions.set(subscriptionKey, callback);
    }

    // Send subscription message
    this.send({
      type: 'subscribe',
      channel,
      symbol
    });

    return subscriptionKey;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel, symbol = null) {
    const subscriptionKey = symbol ? `${channel}:${symbol}` : channel;
    
    // Remove subscription callback
    this.subscriptions.delete(subscriptionKey);

    // Send unsubscription message
    this.send({
      type: 'unsubscribe',
      channel,
      symbol
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    const { type, channel, symbol, data: messageData } = data;

    switch (type) {
      case 'orderbook':
        this.handleOrderBookUpdate(channel, symbol, messageData);
        break;
      
      case 'trade':
        this.handleTradeUpdate(channel, symbol, messageData);
        break;
      
      case 'userOrder':
        this.handleUserOrderUpdate(messageData);
        break;
      
      case 'marketStats':
        this.handleMarketStatsUpdate(messageData);
        break;
      
      case 'error':
        console.error('WebSocket error:', messageData);
        this.emit('error', messageData);
        break;
      
      default:
        console.log('Unknown message type:', type, data);
    }
  }

  /**
   * Handle order book updates
   */
  handleOrderBookUpdate(channel, symbol, data) {
    const subscriptionKey = `${channel}:${symbol}`;
    const callback = this.subscriptions.get(subscriptionKey);
    
    if (callback) {
      callback(data);
    }

    // Also emit generic orderbook event
    this.emit('orderbook', { symbol, data });
  }

  /**
   * Handle trade updates
   */
  handleTradeUpdate(channel, symbol, data) {
    const subscriptionKey = `${channel}:${symbol}`;
    const callback = this.subscriptions.get(subscriptionKey);
    
    if (callback) {
      callback(data);
    }

    // Also emit generic trade event
    this.emit('trade', { symbol, data });
  }

  /**
   * Handle user order updates
   */
  handleUserOrderUpdate(data) {
    const callback = this.subscriptions.get('userOrders');
    
    if (callback) {
      callback(data);
    }

    this.emit('userOrder', data);
  }

  /**
   * Handle market stats updates
   */
  handleMarketStatsUpdate(data) {
    const callback = this.subscriptions.get('marketStats');
    
    if (callback) {
      callback(data);
    }

    this.emit('marketUpdate', data);
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event, data = null) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.keys())
    };
  }

  /**
   * Ping server to check connection
   */
  ping() {
    if (this.isConnected) {
      this.send({ type: 'ping', timestamp: Date.now() });
    }
  }

  /**
   * Set up keep-alive mechanism
   */
  startKeepAlive(interval = 30000) {
    this.keepAliveInterval = setInterval(() => {
      this.ping();
    }, interval);
  }

  /**
   * Stop keep-alive mechanism
   */
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

// Export singleton instance
export default WebSocketService;