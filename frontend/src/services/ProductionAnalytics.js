/**
 * Production Analytics and Performance Monitoring Service
 * Optimized for high-performance trading platform deployment
 */

class ProductionAnalytics {
    constructor() {
        this.isProduction = process.env.REACT_APP_ENVIRONMENT === 'production';
        this.analyticsEnabled = process.env.REACT_APP_ANALYTICS_ENABLED === 'true';
        this.errorReportingEnabled = process.env.REACT_APP_ERROR_REPORTING_ENABLED === 'true';
        
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.pageViews = 0;
        this.interactions = 0;
        this.errors = [];
        
        if (this.isProduction && this.analyticsEnabled) {
            this.initializeAnalytics();
        }
    }

    /**
     * Initialize production analytics
     */
    initializeAnalytics() {
        console.log('📊 Initializing production analytics...');
        
        // Track page performance
        this.trackPagePerformance();
        
        // Setup error tracking
        this.setupErrorTracking();
        
        // Track user interactions
        this.setupInteractionTracking();
        
        // Setup periodic reporting
        this.startPeriodicReporting();
        
        // Track initial page load
        this.trackEvent('page_load', {
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: Date.now()
        });
    }

    /**
     * Track page performance metrics
     */
    trackPagePerformance() {
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const metrics = {
                loadTime: timing.loadEventEnd - timing.navigationStart,
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                firstPaint: this.getFirstPaintTime(),
                resourceLoadTime: timing.loadEventEnd - timing.domContentLoadedEventEnd
            };
            
            this.trackEvent('performance_metrics', metrics);
        }
    }

    /**
     * Get first paint time
     */
    getFirstPaintTime() {
        if (window.performance && window.performance.getEntriesByType) {
            const paintEntries = window.performance.getEntriesByType('paint');
            const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
            return firstPaint ? firstPaint.startTime : null;
        }
        return null;
    }

    /**
     * Setup error tracking
     */
    setupErrorTracking() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.trackError({
                type: 'javascript_error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null,
                timestamp: Date.now()
            });
        });

        // Promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError({
                type: 'unhandled_promise_rejection',
                reason: event.reason,
                timestamp: Date.now()
            });
        });

        // React error boundary integration
        window.trackReactError = (error, errorInfo) => {
            this.trackError({
                type: 'react_error',
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: Date.now()
            });
        };
    }

    /**
     * Setup interaction tracking
     */
    setupInteractionTracking() {
        // Track trading actions
        this.trackTradingInteractions();
        
        // Track wallet interactions
        this.trackWalletInteractions();
        
        // Track UI interactions
        this.trackUIInteractions();
    }

    /**
     * Track trading-specific interactions
     */
    trackTradingInteractions() {
        // Track order placements
        window.trackOrderPlacement = (orderData) => {
            this.trackEvent('order_placement', {
                side: orderData.side,
                price: orderData.price,
                quantity: orderData.quantity,
                pair: orderData.pair,
                timestamp: Date.now()
            });
            this.interactions++;
        };

        // Track order cancellations
        window.trackOrderCancellation = (orderId) => {
            this.trackEvent('order_cancellation', {
                orderId,
                timestamp: Date.now()
            });
            this.interactions++;
        };

        // Track trading pair changes
        window.trackTradingPairChange = (fromPair, toPair) => {
            this.trackEvent('trading_pair_change', {
                fromPair,
                toPair,
                timestamp: Date.now()
            });
            this.interactions++;
        };
    }

    /**
     * Track wallet interactions
     */
    trackWalletInteractions() {
        // Track wallet connections
        window.trackWalletConnection = (walletType) => {
            this.trackEvent('wallet_connection', {
                walletType,
                timestamp: Date.now()
            });
            this.interactions++;
        };

        // Track wallet disconnections
        window.trackWalletDisconnection = () => {
            this.trackEvent('wallet_disconnection', {
                timestamp: Date.now()
            });
            this.interactions++;
        };

        // Track transaction submissions
        window.trackTransactionSubmission = (txHash, type) => {
            this.trackEvent('transaction_submission', {
                txHash,
                type,
                timestamp: Date.now()
            });
            this.interactions++;
        };
    }

    /**
     * Track UI interactions
     */
    trackUIInteractions() {
        // Track page navigation
        window.trackPageNavigation = (fromPage, toPage) => {
            this.trackEvent('page_navigation', {
                fromPage,
                toPage,
                timestamp: Date.now()
            });
            this.pageViews++;
        };

        // Track feature usage
        window.trackFeatureUsage = (feature, action) => {
            this.trackEvent('feature_usage', {
                feature,
                action,
                timestamp: Date.now()
            });
            this.interactions++;
        };
    }

    /**
     * Track custom events
     */
    trackEvent(eventName, eventData = {}) {
        if (!this.analyticsEnabled) return;

        const event = {
            event: eventName,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            url: window.location.href,
            data: eventData
        };

        // Send to analytics endpoint
        this.sendAnalytics(event);
        
        // Log in development
        if (!this.isProduction) {
            console.log('📊 Analytics Event:', event);
        }
    }

    /**
     * Track errors
     */
    trackError(errorData) {
        if (!this.errorReportingEnabled) return;

        const error = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            ...errorData
        };

        this.errors.push(error);
        
        // Send error report
        this.sendErrorReport(error);
        
        // Log in development
        if (!this.isProduction) {
            console.error('🚨 Error tracked:', error);
        }
    }

    /**
     * Send analytics data to backend
     */
    async sendAnalytics(data) {
        try {
            if (this.isProduction) {
                await fetch('/api/analytics/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
            }
        } catch (error) {
            console.warn('Failed to send analytics:', error);
        }
    }

    /**
     * Send error report to backend
     */
    async sendErrorReport(error) {
        try {
            if (this.isProduction) {
                await fetch('/api/analytics/errors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(error)
                });
            }
        } catch (err) {
            console.warn('Failed to send error report:', err);
        }
    }

    /**
     * Start periodic reporting
     */
    startPeriodicReporting() {
        // Send session data every 5 minutes
        setInterval(() => {
            this.sendSessionUpdate();
        }, 5 * 60 * 1000);

        // Send data before page unload
        window.addEventListener('beforeunload', () => {
            this.sendSessionSummary();
        });
    }

    /**
     * Send session update
     */
    sendSessionUpdate() {
        const sessionData = {
            sessionId: this.sessionId,
            duration: Date.now() - this.startTime,
            pageViews: this.pageViews,
            interactions: this.interactions,
            errorCount: this.errors.length,
            timestamp: Date.now()
        };

        this.trackEvent('session_update', sessionData);
    }

    /**
     * Send session summary
     */
    sendSessionSummary() {
        const sessionSummary = {
            sessionId: this.sessionId,
            totalDuration: Date.now() - this.startTime,
            totalPageViews: this.pageViews,
            totalInteractions: this.interactions,
            totalErrors: this.errors.length,
            endTime: Date.now()
        };

        // Use sendBeacon for reliable delivery on page unload
        if (navigator.sendBeacon && this.isProduction) {
            navigator.sendBeacon(
                '/api/analytics/session-summary',
                JSON.stringify(sessionSummary)
            );
        }
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            sessionDuration: Date.now() - this.startTime,
            pageViews: this.pageViews,
            interactions: this.interactions,
            errorCount: this.errors.length,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * Get memory usage (if available)
     */
    getMemoryUsage() {
        if (window.performance && window.performance.memory) {
            return {
                usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                totalJSHeapSize: window.performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /**
     * Track Core Web Vitals
     */
    trackCoreWebVitals() {
        // This would integrate with web-vitals library in production
        if (window.webVitals) {
            window.webVitals.getCLS(console.log);
            window.webVitals.getFID(console.log);
            window.webVitals.getFCP(console.log);
            window.webVitals.getLCP(console.log);
            window.webVitals.getTTFB(console.log);
        }
    }
}

// Initialize analytics service
const productionAnalytics = new ProductionAnalytics();

// Export for use in React components
export default productionAnalytics;

// Global access for tracking functions
window.productionAnalytics = productionAnalytics;