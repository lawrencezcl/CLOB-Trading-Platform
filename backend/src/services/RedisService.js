/**
 * Redis Service for CLOB Trading Platform
 * Provides high-performance caching for orderbook data, market statistics,
 * and real-time trading information
 */

const redis = require('redis');
const { promisify } = require('util');

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1 second

        // Cache keys configuration
        this.CACHE_KEYS = {
            ORDERBOOK: 'clob:orderbook',
            MARKET_STATS: 'clob:market:stats',
            USER_BALANCE: 'clob:user:balance',
            TRADE_HISTORY: 'clob:trades:history',
            PRICE_FEED: 'clob:price:feed',
            LIQUIDATIONS: 'clob:liquidations',
            CROSS_CHAIN: 'clob:crosschain',
            ANALYTICS: 'clob:analytics'
        };

        // Cache expiration times (in seconds)
        this.CACHE_TTL = {
            ORDERBOOK: 5,           // 5 seconds for orderbook
            MARKET_STATS: 10,       // 10 seconds for market stats
            USER_BALANCE: 30,       // 30 seconds for user balance
            TRADE_HISTORY: 60,      // 1 minute for trade history
            PRICE_FEED: 15,         // 15 seconds for price feed
            LIQUIDATIONS: 120,      // 2 minutes for liquidations
            CROSS_CHAIN: 300,       // 5 minutes for cross-chain data
            ANALYTICS: 600          // 10 minutes for analytics
        };
    }

    /**
     * Initialize Redis connection
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Redis service...');

            // Create Redis client
            this.client = redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: process.env.REDIS_DB || 0,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.error('❌ Redis server connection refused');
                        return new Error('Redis server connection refused');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.error('❌ Redis retry time exhausted');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        console.error('❌ Too many Redis retry attempts');
                        return undefined;
                    }
                    // Exponential backoff
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            // Setup event handlers
            this.setupEventHandlers();

            // Test connection
            await this.testConnection();

            console.log('✅ Redis service initialized successfully');
            this.isConnected = true;

        } catch (error) {
            console.error('❌ Failed to initialize Redis service:', error);
            throw error;
        }
    }

    /**
     * Setup Redis event handlers
     */
    setupEventHandlers() {
        this.client.on('connect', () => {
            console.log('🔗 Redis client connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.client.on('ready', () => {
            console.log('✅ Redis client ready');
        });

        this.client.on('error', (error) => {
            console.error('❌ Redis client error:', error);
            this.isConnected = false;
        });

        this.client.on('end', () => {
            console.log('🔌 Redis client connection ended');
            this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
            this.reconnectAttempts++;
            console.log(`🔄 Redis client reconnecting (attempt ${this.reconnectAttempts})`);
        });
    }

    /**
     * Test Redis connection
     */
    async testConnection() {
        return new Promise((resolve, reject) => {
            this.client.ping((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('🏓 Redis ping successful:', result);
                    resolve(result);
                }
            });
        });
    }

    /**
     * Cache orderbook data
     */
    async cacheOrderbook(symbol, orderbookData) {
        try {
            const key = `${this.CACHE_KEYS.ORDERBOOK}:${symbol}`;
            const data = JSON.stringify({
                symbol,
                bids: orderbookData.bids,
                asks: orderbookData.asks,
                timestamp: Date.now(),
                lastUpdate: orderbookData.lastUpdate
            });

            await this.setWithTTL(key, data, this.CACHE_TTL.ORDERBOOK);
            
            // Also maintain a sorted set for price levels
            await this.cacheOrderbookLevels(symbol, orderbookData);

            console.log(`📊 Cached orderbook for ${symbol}`);
        } catch (error) {
            console.error('❌ Failed to cache orderbook:', error);
        }
    }

    /**
     * Cache orderbook price levels in sorted sets
     */
    async cacheOrderbookLevels(symbol, orderbookData) {
        const bidKey = `${this.CACHE_KEYS.ORDERBOOK}:${symbol}:bids`;
        const askKey = `${this.CACHE_KEYS.ORDERBOOK}:${symbol}:asks`;

        // Clear existing data
        await this.client.del(bidKey);
        await this.client.del(askKey);

        // Cache bids (sorted by price descending)
        for (const [price, quantity] of orderbookData.bids) {
            await this.client.zadd(bidKey, price, `${price}:${quantity}`);
        }

        // Cache asks (sorted by price ascending)
        for (const [price, quantity] of orderbookData.asks) {
            await this.client.zadd(askKey, price, `${price}:${quantity}`);
        }

        // Set expiration
        await this.client.expire(bidKey, this.CACHE_TTL.ORDERBOOK);
        await this.client.expire(askKey, this.CACHE_TTL.ORDERBOOK);
    }

    /**
     * Get cached orderbook
     */
    async getOrderbook(symbol) {
        try {
            const key = `${this.CACHE_KEYS.ORDERBOOK}:${symbol}`;
            const data = await this.get(key);
            
            if (data) {
                const orderbook = JSON.parse(data);
                console.log(`📖 Retrieved cached orderbook for ${symbol}`);
                return orderbook;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to get cached orderbook:', error);
            return null;
        }
    }

    /**
     * Get orderbook depth from sorted sets
     */
    async getOrderbookDepth(symbol, levels = 10) {
        try {
            const bidKey = `${this.CACHE_KEYS.ORDERBOOK}:${symbol}:bids`;
            const askKey = `${this.CACHE_KEYS.ORDERBOOK}:${symbol}:asks`;

            // Get top bids (highest prices first)
            const bids = await this.client.zrevrange(bidKey, 0, levels - 1);
            
            // Get top asks (lowest prices first)  
            const asks = await this.client.zrange(askKey, 0, levels - 1);

            return {
                bids: bids.map(item => {
                    const [price, quantity] = item.split(':');
                    return [parseFloat(price), parseFloat(quantity)];
                }),
                asks: asks.map(item => {
                    const [price, quantity] = item.split(':');
                    return [parseFloat(price), parseFloat(quantity)];
                })
            };
        } catch (error) {
            console.error('❌ Failed to get orderbook depth:', error);
            return { bids: [], asks: [] };
        }
    }

    /**
     * Cache market statistics
     */
    async cacheMarketStats(symbol, stats) {
        try {
            const key = `${this.CACHE_KEYS.MARKET_STATS}:${symbol}`;
            const data = JSON.stringify({
                symbol,
                lastPrice: stats.lastPrice,
                volume24h: stats.volume24h,
                change24h: stats.change24h,
                high24h: stats.high24h,
                low24h: stats.low24h,
                trades24h: stats.trades24h,
                timestamp: Date.now()
            });

            await this.setWithTTL(key, data, this.CACHE_TTL.MARKET_STATS);
            console.log(`📈 Cached market stats for ${symbol}`);
        } catch (error) {
            console.error('❌ Failed to cache market stats:', error);
        }
    }

    /**
     * Get cached market statistics
     */
    async getMarketStats(symbol) {
        try {
            const key = `${this.CACHE_KEYS.MARKET_STATS}:${symbol}`;
            const data = await this.get(key);
            
            if (data) {
                const stats = JSON.parse(data);
                console.log(`📊 Retrieved cached market stats for ${symbol}`);
                return stats;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to get cached market stats:', error);
            return null;
        }
    }

    /**
     * Cache user balance
     */
    async cacheUserBalance(userAddress, balance) {
        try {
            const key = `${this.CACHE_KEYS.USER_BALANCE}:${userAddress}`;
            const data = JSON.stringify({
                userAddress,
                availableBase: balance.availableBase,
                availableQuote: balance.availableQuote,
                lockedBase: balance.lockedBase,
                lockedQuote: balance.lockedQuote,
                timestamp: Date.now()
            });

            await this.setWithTTL(key, data, this.CACHE_TTL.USER_BALANCE);
            console.log(`💰 Cached user balance for ${userAddress}`);
        } catch (error) {
            console.error('❌ Failed to cache user balance:', error);
        }
    }

    /**
     * Get cached user balance
     */
    async getUserBalance(userAddress) {
        try {
            const key = `${this.CACHE_KEYS.USER_BALANCE}:${userAddress}`;
            const data = await this.get(key);
            
            if (data) {
                const balance = JSON.parse(data);
                console.log(`💰 Retrieved cached user balance for ${userAddress}`);
                return balance;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to get cached user balance:', error);
            return null;
        }
    }

    /**
     * Cache trade history
     */
    async cacheTradeHistory(symbol, trades) {
        try {
            const key = `${this.CACHE_KEYS.TRADE_HISTORY}:${symbol}`;
            
            // Use a list to store recent trades
            for (const trade of trades) {
                const tradeData = JSON.stringify({
                    id: trade.id,
                    price: trade.price,
                    quantity: trade.quantity,
                    side: trade.side,
                    timestamp: trade.timestamp
                });
                
                await this.client.lpush(key, tradeData);
            }
            
            // Keep only last 100 trades
            await this.client.ltrim(key, 0, 99);
            await this.client.expire(key, this.CACHE_TTL.TRADE_HISTORY);
            
            console.log(`📋 Cached trade history for ${symbol}`);
        } catch (error) {
            console.error('❌ Failed to cache trade history:', error);
        }
    }

    /**
     * Get cached trade history
     */
    async getTradeHistory(symbol, limit = 50) {
        try {
            const key = `${this.CACHE_KEYS.TRADE_HISTORY}:${symbol}`;
            const trades = await this.client.lrange(key, 0, limit - 1);
            
            return trades.map(trade => JSON.parse(trade));
        } catch (error) {
            console.error('❌ Failed to get cached trade history:', error);
            return [];
        }
    }

    /**
     * Cache cross-chain bridge data
     */
    async cacheCrossChainData(bridgeId, data) {
        try {
            const key = `${this.CACHE_KEYS.CROSS_CHAIN}:${bridgeId}`;
            const bridgeData = JSON.stringify({
                bridgeId,
                status: data.status,
                fromChain: data.fromChain,
                toChain: data.toChain,
                asset: data.asset,
                amount: data.amount,
                estimatedCompletion: data.estimatedCompletion,
                timestamp: Date.now()
            });

            await this.setWithTTL(key, bridgeData, this.CACHE_TTL.CROSS_CHAIN);
            console.log(`🌉 Cached cross-chain data for bridge ${bridgeId}`);
        } catch (error) {
            console.error('❌ Failed to cache cross-chain data:', error);
        }
    }

    /**
     * Cache analytics data
     */
    async cacheAnalytics(key, data, customTTL = null) {
        try {
            const cacheKey = `${this.CACHE_KEYS.ANALYTICS}:${key}`;
            const analyticsData = JSON.stringify({
                key,
                data,
                timestamp: Date.now()
            });

            const ttl = customTTL || this.CACHE_TTL.ANALYTICS;
            await this.setWithTTL(cacheKey, analyticsData, ttl);
            console.log(`📊 Cached analytics data for ${key}`);
        } catch (error) {
            console.error('❌ Failed to cache analytics data:', error);
        }
    }

    /**
     * Generic set operation with TTL
     */
    async setWithTTL(key, value, ttl) {
        if (!this.isConnected) {
            throw new Error('Redis client not connected');
        }

        return new Promise((resolve, reject) => {
            this.client.setex(key, ttl, value, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Generic get operation
     */
    async get(key) {
        if (!this.isConnected) {
            throw new Error('Redis client not connected');
        }

        return new Promise((resolve, reject) => {
            this.client.get(key, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Clear cache for a specific pattern
     */
    async clearCache(pattern) {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
                console.log(`🗑️  Cleared ${keys.length} cache entries for pattern: ${pattern}`);
            }
        } catch (error) {
            console.error('❌ Failed to clear cache:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const info = await this.client.info('memory');
            const keyspace = await this.client.info('keyspace');
            
            return {
                memoryUsed: this.parseRedisInfo(info, 'used_memory_human'),
                totalKeys: this.parseRedisInfo(keyspace, 'db0'),
                isConnected: this.isConnected,
                lastUpdate: Date.now()
            };
        } catch (error) {
            console.error('❌ Failed to get cache stats:', error);
            return {
                memoryUsed: 'Unknown',
                totalKeys: 0,
                isConnected: false,
                lastUpdate: Date.now()
            };
        }
    }

    /**
     * Parse Redis INFO command output
     */
    parseRedisInfo(info, key) {
        const lines = info.split('\r\n');
        for (const line of lines) {
            if (line.startsWith(key + ':')) {
                return line.split(':')[1];
            }
        }
        return null;
    }

    /**
     * Close Redis connection
     */
    async close() {
        if (this.client) {
            this.client.quit();
            this.isConnected = false;
            console.log('👋 Redis connection closed');
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'unhealthy', message: 'Redis not connected' };
            }

            await this.testConnection();
            const stats = await this.getCacheStats();
            
            return {
                status: 'healthy',
                message: 'Redis is operational',
                stats
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message
            };
        }
    }
}

// Export singleton instance
const redisService = new RedisService();

module.exports = redisService;