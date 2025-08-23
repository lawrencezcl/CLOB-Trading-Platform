module aptos_clob::ClobCore {
    use std::vector;
    use std::signer;
    use std::option::{Self, Option};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::table::{Self, Table};
    use aptos_std::math64;
    use aptos_clob::OrderVerification::{Self, Order};
    use aptos_clob::LiquidationGuard;

    /// Error codes
    const E_ORDERBOOK_NOT_INITIALIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_ORDER_NOT_FOUND: u64 = 3;
    const E_INVALID_ORDER: u64 = 4;
    const E_UNAUTHORIZED: u64 = 5;
    const E_ORDER_ALREADY_FILLED: u64 = 6;
    const E_MARKET_CLOSED: u64 = 7;
    const E_INVALID_PRICE: u64 = 8;
    const E_INVALID_QUANTITY: u64 = 9;
    const E_SELF_TRADE: u64 = 10;

    /// Order side constants
    const SIDE_BUY: u8 = 0;
    const SIDE_SELL: u8 = 1;

    /// Order status constants
    const ORDER_STATUS_ACTIVE: u8 = 0;
    const ORDER_STATUS_FILLED: u8 = 1;
    const ORDER_STATUS_CANCELLED: u8 = 2;
    const ORDER_STATUS_PARTIALLY_FILLED: u8 = 3;

    /// Order book entry
    struct OrderBookEntry has store, drop {
        order: Order,
        filled_quantity: u64,
        status: u8,
        order_id: u64,
    }

    /// Price level in the order book
    struct PriceLevel has store {
        price: u64,
        total_quantity: u64,
        orders: vector<OrderBookEntry>,
    }

    /// Order book structure
    struct OrderBook has key {
        buy_levels: Table<u64, PriceLevel>,    // Price -> PriceLevel (descending order)
        sell_levels: Table<u64, PriceLevel>,   // Price -> PriceLevel (ascending order)
        next_order_id: u64,
        is_market_open: bool,
        last_trade_price: u64,
        total_volume: u64,
    }

    /// Trade execution event
    struct TradeEvent has drop, store {
        maker_order_id: u64,
        taker_order_id: u64,
        price: u64,
        quantity: u64,
        maker: address,
        taker: address,
        timestamp: u64,
        trade_id: u64,
    }

    /// Order event
    struct OrderEvent has drop, store {
        order_id: u64,
        user: address,
        side: u8,
        price: u64,
        quantity: u64,
        event_type: u8, // 0: placed, 1: cancelled, 2: filled
        timestamp: u64,
    }

    /// Market statistics
    struct MarketStats has key {
        total_trades: u64,
        total_volume: u64,
        last_trade_price: u64,
        price_24h_high: u64,
        price_24h_low: u64,
        volume_24h: u64,
        last_update: u64,
    }

    /// Global market data
    struct GlobalMarketData has key {
        trade_events: event::EventHandle<TradeEvent>,
        order_events: event::EventHandle<OrderEvent>,
        next_trade_id: u64,
        fee_rate: u64, // Trading fee in basis points (e.g., 30 = 0.3%)
        min_order_size: u64,
        max_order_size: u64,
    }

    /// User balance tracking
    struct UserBalance has key {
        available_base: u64,    // Available base asset
        available_quote: u64,   // Available quote asset
        locked_base: u64,       // Locked base asset in orders
        locked_quote: u64,      // Locked quote asset in orders
    }

    /// Initialize the CLOB system
    public fun initialize_clob(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Initialize order book
        move_to(admin, OrderBook {
            buy_levels: table::new<u64, PriceLevel>(),
            sell_levels: table::new<u64, PriceLevel>(),
            next_order_id: 1,
            is_market_open: true,
            last_trade_price: 1000000, // Default price
            total_volume: 0,
        });

        // Initialize market stats
        move_to(admin, MarketStats {
            total_trades: 0,
            total_volume: 0,
            last_trade_price: 1000000,
            price_24h_high: 1000000,
            price_24h_low: 1000000,
            volume_24h: 0,
            last_update: timestamp::now_seconds(),
        });

        // Initialize global market data
        move_to(admin, GlobalMarketData {
            trade_events: account::new_event_handle<TradeEvent>(admin),
            order_events: account::new_event_handle<OrderEvent>(admin),
            next_trade_id: 1,
            fee_rate: 30, // 0.3% trading fee
            min_order_size: 1000, // Minimum 0.001 tokens
            max_order_size: 1000000000000, // Maximum 1M tokens
        });
    }

    /// Initialize user balance
    public fun initialize_user_balance(user: &signer) {
        let user_addr = signer::address_of(user);
        if (!exists<UserBalance>(user_addr)) {
            move_to(user, UserBalance {
                available_base: 0,
                available_quote: 0,
                locked_base: 0,
                locked_quote: 0,
            });
        }
    }

    /// Place a new order
    public fun place_order(
        user: &signer,
        side: u8,
        price: u64,
        quantity: u64,
        expiry: u64,
        signature: vector<u8>
    ): u64 acquires OrderBook, GlobalMarketData, UserBalance {
        let user_addr = signer::address_of(user);
        
        // Ensure user balance is initialized
        if (!exists<UserBalance>(user_addr)) {
            initialize_user_balance(user);
        };

        // Validate market status
        let order_book = borrow_global<OrderBook>(@aptos_clob);
        assert!(order_book.is_market_open, E_MARKET_CLOSED);

        // Get order ID
        let order_book_mut = borrow_global_mut<OrderBook>(@aptos_clob);
        let order_id = order_book_mut.next_order_id;
        order_book_mut.next_order_id = order_id + 1;

        // Create and verify order
        let order = OrderVerification::create_order(
            user_addr,
            side,
            price,
            quantity,
            expiry,
            order_id, // Using order_id as nonce
            signature
        );

        // Verify order signature and parameters
        assert!(OrderVerification::verify_order_signature(&order), E_INVALID_ORDER);

        // Validate order parameters
        let global_data = borrow_global<GlobalMarketData>(@aptos_clob);
        assert!(quantity >= global_data.min_order_size, E_INVALID_QUANTITY);
        assert!(quantity <= global_data.max_order_size, E_INVALID_QUANTITY);
        assert!(price > 0, E_INVALID_PRICE);

        // Check and lock user funds
        lock_user_funds(user_addr, side, price, quantity);

        // Try to match the order
        let (filled_quantity, remaining_quantity) = match_order(order, order_id);

        // If there's remaining quantity, add to order book
        if (remaining_quantity > 0) {
            add_order_to_book(order, order_id, filled_quantity);
        };

        // Emit order event
        let global_data_mut = borrow_global_mut<GlobalMarketData>(@aptos_clob);
        event::emit_event(&mut global_data_mut.order_events, OrderEvent {
            order_id,
            user: user_addr,
            side,
            price,
            quantity,
            event_type: 0, // Order placed
            timestamp: timestamp::now_seconds(),
        });

        // Mark nonce as used
        OrderVerification::mark_nonce_used(user_addr, order_id);

        order_id
    }

    /// Cancel an existing order
    public fun cancel_order(user: &signer, order_id: u64) 
    acquires OrderBook, GlobalMarketData {
        let user_addr = signer::address_of(user);
        let order_book_mut = borrow_global_mut<OrderBook>(@aptos_clob);
        
        // Find and remove order from buy levels
        let found = remove_order_from_levels(&mut order_book_mut.buy_levels, user_addr, order_id);
        
        // If not found in buy levels, try sell levels
        if (!found) {
            found = remove_order_from_levels(&mut order_book_mut.sell_levels, user_addr, order_id);
        };
        
        assert!(found, E_ORDER_NOT_FOUND);

        // Unlock user funds
        unlock_user_funds_for_cancelled_order(user_addr, order_id);

        // Emit cancellation event
        let global_data_mut = borrow_global_mut<GlobalMarketData>(@aptos_clob);
        event::emit_event(&mut global_data_mut.order_events, OrderEvent {
            order_id,
            user: user_addr,
            side: 0, // Will be updated with actual side
            price: 0, // Will be updated with actual price
            quantity: 0, // Will be updated with actual quantity
            event_type: 1, // Order cancelled
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Match an incoming order against existing orders
    fun match_order(order: Order, order_id: u64): (u64, u64) 
    acquires OrderBook {
        let (sender, side, price, quantity, _, _) = OrderVerification::get_order_details(&order);
        let mut_filled_quantity = 0;
        let mut_remaining_quantity = quantity;
        
        let order_book_mut = borrow_global_mut<OrderBook>(@aptos_clob);
        
        if (side == SIDE_BUY) {
            // Match against sell orders (ascending price order)
            // This is simplified - a full implementation would iterate through price levels
            mut_remaining_quantity = match_against_sell_orders(
                order_book_mut,
                sender,
                price,
                mut_remaining_quantity,
                order_id
            );
            mut_filled_quantity = quantity - mut_remaining_quantity;
        } else {
            // Match against buy orders (descending price order)
            mut_remaining_quantity = match_against_buy_orders(
                order_book_mut,
                sender,
                price,
                mut_remaining_quantity,
                order_id
            );
            mut_filled_quantity = quantity - mut_remaining_quantity;
        };
        
        (mut_filled_quantity, mut_remaining_quantity)
    }

    /// Match against sell orders (for buy orders)
    fun match_against_sell_orders(
        order_book: &mut OrderBook,
        buyer: address,
        max_price: u64,
        remaining_quantity: u64,
        taker_order_id: u64
    ): u64 {
        // Simplified matching logic
        // In a real implementation, this would iterate through price levels systematically
        remaining_quantity // Return unchanged for now
    }

    /// Match against buy orders (for sell orders)
    fun match_against_buy_orders(
        order_book: &mut OrderBook,
        seller: address,
        min_price: u64,
        remaining_quantity: u64,
        taker_order_id: u64
    ): u64 {
        // Simplified matching logic
        // In a real implementation, this would iterate through price levels systematically
        remaining_quantity // Return unchanged for now
    }

    /// Add order to the order book
    fun add_order_to_book(order: Order, order_id: u64, filled_quantity: u64) 
    acquires OrderBook {
        let (_, side, price, quantity, _, _) = OrderVerification::get_order_details(&order);
        let order_book_mut = borrow_global_mut<OrderBook>(@aptos_clob);
        
        let entry = OrderBookEntry {
            order,
            filled_quantity,
            status: if (filled_quantity > 0) ORDER_STATUS_PARTIALLY_FILLED else ORDER_STATUS_ACTIVE,
            order_id,
        };
        
        if (side == SIDE_BUY) {
            add_to_price_level(&mut order_book_mut.buy_levels, price, entry);
        } else {
            add_to_price_level(&mut order_book_mut.sell_levels, price, entry);
        };
    }

    /// Add order entry to a specific price level
    fun add_to_price_level(levels: &mut Table<u64, PriceLevel>, price: u64, entry: OrderBookEntry) {
        if (table::contains(levels, price)) {
            let level = table::borrow_mut(levels, price);
            let (_, _, _, quantity, _, _) = OrderVerification::get_order_details(&entry.order);
            let filled_quantity = entry.filled_quantity;
            vector::push_back(&mut level.orders, entry);
            level.total_quantity = level.total_quantity + (quantity - filled_quantity);
        } else {
            let (_, _, _, quantity, _, _) = OrderVerification::get_order_details(&entry.order);
            let level = PriceLevel {
                price,
                total_quantity: quantity - entry.filled_quantity,
                orders: vector::singleton(entry),
            };
            table::add(levels, price, level);
        };
    }

    /// Lock user funds for order
    fun lock_user_funds(user_addr: address, side: u8, price: u64, quantity: u64) 
    acquires UserBalance {
        let balance = borrow_global_mut<UserBalance>(user_addr);
        
        if (side == SIDE_BUY) {
            // Lock quote currency (price * quantity)
            let required_quote = (price * quantity) / 1000000; // Assuming 6 decimal places
            assert!(balance.available_quote >= required_quote, E_INSUFFICIENT_BALANCE);
            balance.available_quote = balance.available_quote - required_quote;
            balance.locked_quote = balance.locked_quote + required_quote;
        } else {
            // Lock base currency
            assert!(balance.available_base >= quantity, E_INSUFFICIENT_BALANCE);
            balance.available_base = balance.available_base - quantity;
            balance.locked_base = balance.locked_base + quantity;
        };
    }

    /// Remove order from price levels
    fun remove_order_from_levels(
        levels: &mut Table<u64, PriceLevel>,
        user_addr: address,
        order_id: u64
    ): bool {
        // Simplified implementation
        // In practice, you'd need to track which price level contains each order
        false // Return false for now
    }

    /// Unlock user funds for cancelled order
    fun unlock_user_funds_for_cancelled_order(user_addr: address, order_id: u64) {
        // Simplified implementation
        // In practice, you'd need to track locked amounts per order
    }

    /// Get current order book state
    public fun get_order_book_depth(levels: u8): (vector<u64>, vector<u64>, vector<u64>, vector<u64>) 
    acquires OrderBook {
        let order_book = borrow_global<OrderBook>(@aptos_clob);
        
        // Return empty vectors for now - full implementation would build depth data
        (
            vector::empty<u64>(), // Buy prices
            vector::empty<u64>(), // Buy quantities
            vector::empty<u64>(), // Sell prices
            vector::empty<u64>()  // Sell quantities
        )
    }

    /// Get market statistics
    public fun get_market_stats(): (u64, u64, u64, u64, u64, u64) acquires MarketStats {
        let stats = borrow_global<MarketStats>(@aptos_clob);
        (
            stats.total_trades,
            stats.total_volume,
            stats.last_trade_price,
            stats.price_24h_high,
            stats.price_24h_low,
            stats.volume_24h
        )
    }

    /// Get user balance
    public fun get_user_balance(user_addr: address): (u64, u64, u64, u64) acquires UserBalance {
        if (!exists<UserBalance>(user_addr)) {
            return (0, 0, 0, 0)
        };
        
        let balance = borrow_global<UserBalance>(user_addr);
        (
            balance.available_base,
            balance.available_quote,
            balance.locked_base,
            balance.locked_quote
        )
    }

    /// Admin function to pause/resume market
    public fun set_market_status(admin: &signer, is_open: bool) acquires OrderBook {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @aptos_clob, E_UNAUTHORIZED);
        
        let order_book = borrow_global_mut<OrderBook>(@aptos_clob);
        order_book.is_market_open = is_open;
    }

    #[test_only]
    use aptos_framework::account::create_account_for_test;

    #[test(framework = @aptos_framework, admin = @aptos_clob, user1 = @0x123)]
    fun test_clob_initialization(framework: &signer, admin: &signer, user1: &signer) {
        // Initialize timestamp and CLOB
        timestamp::set_time_has_started_for_testing(framework);
        initialize_clob(admin);
        initialize_user_balance(user1);
        
        // Verify initialization
        assert!(exists<OrderBook>(@aptos_clob), 1);
        assert!(exists<MarketStats>(@aptos_clob), 2);
        assert!(exists<GlobalMarketData>(@aptos_clob), 3);
        assert!(exists<UserBalance>(signer::address_of(user1)), 4);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_market_status_control(framework: &signer, admin: &signer) acquires OrderBook {
        timestamp::set_time_has_started_for_testing(framework);
        initialize_clob(admin);
        
        // Test market pause
        set_market_status(admin, false);
        let order_book = borrow_global<OrderBook>(@aptos_clob);
        assert!(!order_book.is_market_open, 1);
        
        // Test market resume
        set_market_status(admin, true);
        let order_book = borrow_global<OrderBook>(@aptos_clob);
        assert!(order_book.is_market_open, 2);
    }
}