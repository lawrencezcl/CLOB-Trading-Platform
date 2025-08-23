/**
 * CLOB Trading Platform Backend Server
 * Redis-optimized API server for high-performance orderbook operations
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const WebSocket = require('ws');
const http = require('http');

// Import services
const redisService = require('./services/RedisService');

const app = express();
const server = http.createServer(app);

// Configuration
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Mock data for demonstration
const mockOrderbook = {
    'APT-USDC': {
        bids: [
            [8.45, 1000],
            [8.44, 1500],
            [8.43, 2000],
            [8.42, 1200],
            [8.41, 800]
        ],
        asks: [
            [8.46, 900],
            [8.47, 1100],
            [8.48, 1300],
            [8.49, 1700],
            [8.50, 2500]
        ],
        lastUpdate: Date.now()
    }
};

const mockMarketStats = {
    'APT-USDC': {
        lastPrice: 8.45,
        volume24h: 125000,
        change24h: 2.3,
        high24h: 8.52,
        low24h: 8.20,
        trades24h: 1543
    }
};

const mockUserBalances = {
    '0x123': {
        availableBase: 1000,
        availableQuote: 5000,
        lockedBase: 100,
        lockedQuote: 500
    }
};

/**
 * API Routes
 */

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const redisHealth = await redisService.healthCheck();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                api: 'healthy',
                redis: redisHealth.status
            },
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Get orderbook with Redis caching
app.get('/api/orderbook/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const levels = parseInt(req.query.levels) || 10;
        
        console.log(`📊 Fetching orderbook for ${symbol}`);
        
        // Try to get from Redis cache first
        let orderbook = await redisService.getOrderbook(symbol);
        
        if (!orderbook) {
            // Fallback to mock data (in production, this would fetch from blockchain)
            orderbook = mockOrderbook[symbol];
            
            if (orderbook) {
                // Cache the orderbook for future requests
                await redisService.cacheOrderbook(symbol, orderbook);
            }
        }
        
        if (!orderbook) {
            return res.status(404).json({
                error: 'Orderbook not found',
                symbol
            });
        }
        
        // Get depth data from Redis sorted sets for better performance
        const depthData = await redisService.getOrderbookDepth(symbol, levels);
        
        res.json({
            symbol,
            bids: depthData.bids.length > 0 ? depthData.bids : orderbook.bids.slice(0, levels),
            asks: depthData.asks.length > 0 ? depthData.asks : orderbook.asks.slice(0, levels),
            lastUpdate: orderbook.lastUpdate || Date.now(),
            cached: !!depthData.bids.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching orderbook:', error);
        res.status(500).json({
            error: 'Failed to fetch orderbook',
            message: error.message
        });
    }
});

// Get market statistics with Redis caching
app.get('/api/market/stats/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        
        console.log(`📈 Fetching market stats for ${symbol}`);
        
        // Try to get from Redis cache first
        let stats = await redisService.getMarketStats(symbol);
        
        if (!stats) {
            // Fallback to mock data (in production, this would fetch from blockchain)
            stats = mockMarketStats[symbol];
            
            if (stats) {
                // Cache the stats for future requests
                await redisService.cacheMarketStats(symbol, stats);
            }
        }
        
        if (!stats) {
            return res.status(404).json({
                error: 'Market stats not found',
                symbol
            });
        }
        
        res.json({
            symbol,
            ...stats,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error fetching market stats:', error);
        res.status(500).json({
            error: 'Failed to fetch market stats',
            message: error.message
        });
    }
});

// Get user balance with Redis caching
app.get('/api/user/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        console.log(`💰 Fetching balance for ${address}`);
        
        // Try to get from Redis cache first
        let balance = await redisService.getUserBalance(address);
        
        if (!balance) {
            // Fallback to mock data (in production, this would fetch from blockchain)
            balance = mockUserBalances[address];
            
            if (balance) {
                // Cache the balance for future requests
                await redisService.cacheUserBalance(address, balance);
            }
        }
        
        if (!balance) {
            return res.status(404).json({
                error: 'User balance not found',
                address
            });
        }
        
        res.json({
            address,
            ...balance,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error fetching user balance:', error);
        res.status(500).json({
            error: 'Failed to fetch user balance',
            message: error.message
        });
    }
});

// Get trade history with Redis caching
app.get('/api/trades/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        console.log(`📋 Fetching trade history for ${symbol}`);
        
        // Get from Redis cache
        const trades = await redisService.getTradeHistory(symbol, limit);
        
        res.json({
            symbol,
            trades,
            count: trades.length,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error fetching trade history:', error);
        res.status(500).json({
            error: 'Failed to fetch trade history',
            message: error.message
        });
    }
});

// Cache management endpoints
app.post('/api/cache/clear/:pattern', async (req, res) => {
    try {
        const { pattern } = req.params;
        
        await redisService.clearCache(pattern);
        
        res.json({
            message: `Cache cleared for pattern: ${pattern}`,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error clearing cache:', error);
        res.status(500).json({
            error: 'Failed to clear cache',
            message: error.message
        });
    }
});

app.get('/api/cache/stats', async (req, res) => {
    try {
        const stats = await redisService.getCacheStats();
        
        res.json({
            cache: stats,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('❌ Error getting cache stats:', error);
        res.status(500).json({
            error: 'Failed to get cache stats',
            message: error.message
        });
    }
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`🔗 WebSocket server listening on port ${WS_PORT}`);

wss.on('connection', (ws) => {
    console.log('👋 New WebSocket connection');
    
    // Send initial data
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to CLOB Trading Platform WebSocket',
        timestamp: Date.now()
    }));
    
    // Handle incoming messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'subscribe_orderbook':
                    // Subscribe to orderbook updates
                    ws.orderbookSymbol = data.symbol;
                    console.log(`📊 Client subscribed to orderbook: ${data.symbol}`);
                    
                    // Send initial orderbook
                    const orderbook = await redisService.getOrderbook(data.symbol);
                    if (orderbook) {
                        ws.send(JSON.stringify({
                            type: 'orderbook_update',
                            symbol: data.symbol,
                            data: orderbook
                        }));
                    }
                    break;
                    
                case 'subscribe_trades':
                    // Subscribe to trade updates
                    ws.tradesSymbol = data.symbol;
                    console.log(`📋 Client subscribed to trades: ${data.symbol}`);
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: Date.now()
                    }));
                    break;
            }
        } catch (error) {
            console.error('❌ WebSocket message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('👋 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Simulate real-time updates
setInterval(async () => {
    try {
        // Update mock orderbook
        const symbol = 'APT-USDC';
        const orderbook = mockOrderbook[symbol];
        
        // Simulate price changes
        const priceVariation = (Math.random() - 0.5) * 0.02; // ±1%
        orderbook.bids = orderbook.bids.map(([price, quantity]) => [
            price * (1 + priceVariation),
            quantity * (0.8 + Math.random() * 0.4) // ±20% quantity variation
        ]);
        orderbook.asks = orderbook.asks.map(([price, quantity]) => [
            price * (1 + priceVariation),
            quantity * (0.8 + Math.random() * 0.4)
        ]);
        orderbook.lastUpdate = Date.now();
        
        // Cache updated orderbook
        await redisService.cacheOrderbook(symbol, orderbook);
        
        // Broadcast to WebSocket clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client.orderbookSymbol === symbol) {
                client.send(JSON.stringify({
                    type: 'orderbook_update',
                    symbol,
                    data: orderbook
                }));
            }
        });
        
    } catch (error) {
        console.error('❌ Error in real-time update:', error);
    }
}, 2000); // Update every 2 seconds

/**
 * Server startup
 */
async function startServer() {
    try {
        // Initialize Redis
        await redisService.initialize();
        
        // Start HTTP server
        server.listen(PORT, () => {
            console.log(`🚀 CLOB Trading Platform API server listening on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 WebSocket server on port ${WS_PORT}`);
            console.log(`✅ Redis caching enabled for optimized performance`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    await redisService.close();
    server.close(() => {
        console.log('👋 Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    await redisService.close();
    server.close(() => {
        console.log('👋 Server closed');
        process.exit(0);
    });
});

// Start the server
startServer();

module.exports = app;