module aptos_clob::LiquidationGuard {
    use std::vector;
    use std::signer;
    use std::option::{Self, Option};
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_std::math64;
    use aptos_std::type_info;

    /// Error codes
    const E_INSUFFICIENT_COLLATERAL: u64 = 1;
    const E_POSITION_NOT_LIQUIDATABLE: u64 = 2;
    const E_INVALID_LIQUIDATION_RATIO: u64 = 3;
    const E_LIQUIDATION_TOO_LARGE: u64 = 4;
    const E_INSUFFICIENT_BALANCE: u64 = 5;
    const E_POSITION_NOT_FOUND: u64 = 6;
    const E_UNAUTHORIZED: u64 = 7;
    const E_LIQUIDATION_COOLDOWN: u64 = 8;
    const E_INVALID_PRICE_FEED: u64 = 9;

    /// Liquidation constants
    const LIQUIDATION_THRESHOLD: u64 = 120; // 120% collateralization ratio
    const LIQUIDATION_PENALTY: u64 = 10;    // 10% penalty for liquidation
    const MAX_LIQUIDATION_RATIO: u64 = 50;  // Maximum 50% of position can be liquidated at once
    const LIQUIDATION_COOLDOWN: u64 = 300;  // 5 minutes cooldown between liquidations
    const PRICE_STALENESS_THRESHOLD: u64 = 600; // 10 minutes for price staleness

    /// User position structure
    struct Position has key, store {
        collateral_amount: u64,      // Collateral deposited
        borrowed_amount: u64,        // Amount borrowed
        last_liquidation_time: u64,  // Last liquidation timestamp
        position_id: u64,            // Unique position identifier
    }

    /// Liquidation event
    struct LiquidationEvent has drop, store {
        liquidator: address,
        liquidated_user: address,
        position_id: u64,
        liquidated_amount: u64,
        collateral_seized: u64,
        timestamp: u64,
    }

    /// Position manager resource
    struct PositionManager has key {
        next_position_id: u64,
        liquidation_events: event::EventHandle<LiquidationEvent>,
    }

    /// Price feed structure for external price data
    struct PriceFeed has key {
        price: u64,              // Current price in micro units
        last_update: u64,        // Last update timestamp
        is_valid: bool,          // Price feed validity
    }

    /// Global liquidation settings
    struct LiquidationSettings has key {
        liquidation_threshold: u64,
        liquidation_penalty: u64,
        max_liquidation_ratio: u64,
        liquidation_cooldown: u64,
        is_liquidation_enabled: bool,
    }

    /// Initialize liquidation guard system
    public fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Initialize position manager
        move_to(admin, PositionManager {
            next_position_id: 1,
            liquidation_events: account::new_event_handle<LiquidationEvent>(admin),
        });

        // Initialize liquidation settings
        move_to(admin, LiquidationSettings {
            liquidation_threshold: LIQUIDATION_THRESHOLD,
            liquidation_penalty: LIQUIDATION_PENALTY,
            max_liquidation_ratio: MAX_LIQUIDATION_RATIO,
            liquidation_cooldown: LIQUIDATION_COOLDOWN,
            is_liquidation_enabled: true,
        });

        // Initialize price feed
        move_to(admin, PriceFeed {
            price: 1000000, // Default price: 1 USD in micro units
            last_update: timestamp::now_seconds(),
            is_valid: true,
        });
    }

    /// Create a new position
    public fun create_position(
        user: &signer,
        collateral_amount: u64,
        borrowed_amount: u64
    ) acquires PositionManager, PriceFeed, LiquidationSettings {
        let user_addr = signer::address_of(user);
        
        // Validate position parameters
        assert!(collateral_amount > 0, E_INSUFFICIENT_COLLATERAL);
        assert!(is_position_safe(collateral_amount, borrowed_amount), E_INSUFFICIENT_COLLATERAL);
        
        let position_manager = borrow_global_mut<PositionManager>(@aptos_clob);
        let position_id = position_manager.next_position_id;
        position_manager.next_position_id = position_id + 1;
        
        // Create and store position
        let position = Position {
            collateral_amount,
            borrowed_amount,
            last_liquidation_time: 0,
            position_id,
        };
        
        move_to(user, position);
    }

    /// Check if a position is liquidatable
    public fun is_position_liquidatable(user_addr: address): bool acquires Position, PriceFeed, LiquidationSettings {
        if (!exists<Position>(user_addr)) {
            return false
        };
        
        let position = borrow_global<Position>(user_addr);
        let settings = borrow_global<LiquidationSettings>(@aptos_clob);
        
        if (!settings.is_liquidation_enabled) {
            return false
        };
        
        // Check cooldown period
        if (position.last_liquidation_time + settings.liquidation_cooldown > timestamp::now_seconds()) {
            return false
        };
        
        // Calculate current collateralization ratio
        let collateralization_ratio = calculate_collateralization_ratio(
            position.collateral_amount,
            position.borrowed_amount
        );
        
        collateralization_ratio < settings.liquidation_threshold
    }

    /// Perform liquidation with safety checks
    public fun liquidate_position(
        liquidator: &signer,
        user_addr: address,
        liquidation_amount: u64
    ) acquires Position, PositionManager, PriceFeed, LiquidationSettings {
        let liquidator_addr = signer::address_of(liquidator);
        
        // Verify position exists and is liquidatable
        assert!(exists<Position>(user_addr), E_POSITION_NOT_FOUND);
        assert!(is_position_liquidatable(user_addr), E_POSITION_NOT_LIQUIDATABLE);
        
        let position = borrow_global_mut<Position>(user_addr);
        let settings = borrow_global<LiquidationSettings>(@aptos_clob);
        
        // Validate liquidation amount
        let max_liquidatable = (position.borrowed_amount * settings.max_liquidation_ratio) / 100;
        assert!(liquidation_amount <= max_liquidatable, E_LIQUIDATION_TOO_LARGE);
        assert!(liquidation_amount > 0, E_LIQUIDATION_TOO_LARGE);
        
        // Calculate collateral to seize (with penalty)
        let collateral_to_seize = calculate_liquidation_collateral(
            liquidation_amount,
            settings.liquidation_penalty
        );
        
        assert!(collateral_to_seize <= position.collateral_amount, E_INSUFFICIENT_COLLATERAL);
        
        // Update position
        position.borrowed_amount = position.borrowed_amount - liquidation_amount;
        position.collateral_amount = position.collateral_amount - collateral_to_seize;
        position.last_liquidation_time = timestamp::now_seconds();
        
        // Emit liquidation event
        let position_manager = borrow_global_mut<PositionManager>(@aptos_clob);
        event::emit_event(&mut position_manager.liquidation_events, LiquidationEvent {
            liquidator: liquidator_addr,
            liquidated_user: user_addr,
            position_id: position.position_id,
            liquidated_amount: liquidation_amount,
            collateral_seized: collateral_to_seize,
            timestamp: timestamp::now_seconds(),
        });
        
        // Transfer collateral to liquidator (implementation depends on coin type)
        // This would involve actual coin transfers in a real implementation
    }

    /// Calculate collateralization ratio
    fun calculate_collateralization_ratio(collateral_amount: u64, borrowed_amount: u64): u64 acquires PriceFeed {
        if (borrowed_amount == 0) {
            return 10000 // Infinite collateralization
        };
        
        let price_feed = borrow_global<PriceFeed>(@aptos_clob);
        assert!(price_feed.is_valid, E_INVALID_PRICE_FEED);
        assert!(
            price_feed.last_update + PRICE_STALENESS_THRESHOLD > timestamp::now_seconds(),
            E_INVALID_PRICE_FEED
        );
        
        // Calculate ratio: (collateral_value / borrowed_value) * 100
        let collateral_value = (collateral_amount * price_feed.price) / 1000000; // Normalize price
        let borrowed_value = borrowed_amount;
        
        if (borrowed_value == 0) {
            return 10000
        };
        
        (collateral_value * 100) / borrowed_value
    }

    /// Check if position is safe (above liquidation threshold)
    fun is_position_safe(collateral_amount: u64, borrowed_amount: u64): bool acquires PriceFeed, LiquidationSettings {
        let settings = borrow_global<LiquidationSettings>(@aptos_clob);
        let ratio = calculate_collateralization_ratio(collateral_amount, borrowed_amount);
        ratio >= settings.liquidation_threshold
    }

    /// Calculate collateral to seize during liquidation
    fun calculate_liquidation_collateral(liquidation_amount: u64, penalty_rate: u64): u64 acquires PriceFeed {
        let price_feed = borrow_global<PriceFeed>(@aptos_clob);
        
        // Base collateral needed to cover liquidation
        let base_collateral = (liquidation_amount * 1000000) / price_feed.price;
        
        // Add penalty
        let penalty = (base_collateral * penalty_rate) / 100;
        
        base_collateral + penalty
    }

    /// Update price feed (admin only)
    public fun update_price_feed(admin: &signer, new_price: u64) acquires PriceFeed {
        // In production, this should have proper access control
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @aptos_clob, E_UNAUTHORIZED);
        
        let price_feed = borrow_global_mut<PriceFeed>(@aptos_clob);
        price_feed.price = new_price;
        price_feed.last_update = timestamp::now_seconds();
        price_feed.is_valid = true;
    }

    /// Get position details
    public fun get_position_details(user_addr: address): (u64, u64, u64, u64) acquires Position {
        assert!(exists<Position>(user_addr), E_POSITION_NOT_FOUND);
        let position = borrow_global<Position>(user_addr);
        (
            position.collateral_amount,
            position.borrowed_amount,
            position.last_liquidation_time,
            position.position_id
        )
    }

    /// Get current collateralization ratio for a position
    public fun get_collateralization_ratio(user_addr: address): u64 acquires Position, PriceFeed {
        assert!(exists<Position>(user_addr), E_POSITION_NOT_FOUND);
        let position = borrow_global<Position>(user_addr);
        calculate_collateralization_ratio(position.collateral_amount, position.borrowed_amount)
    }

    /// Check liquidation cooldown status
    public fun get_liquidation_cooldown_remaining(user_addr: address): u64 acquires Position, LiquidationSettings {
        if (!exists<Position>(user_addr)) {
            return 0
        };
        
        let position = borrow_global<Position>(user_addr);
        let settings = borrow_global<LiquidationSettings>(@aptos_clob);
        let current_time = timestamp::now_seconds();
        
        if (position.last_liquidation_time + settings.liquidation_cooldown <= current_time) {
            return 0
        };
        
        (position.last_liquidation_time + settings.liquidation_cooldown) - current_time
    }

    /// Emergency disable liquidations (admin only)
    public fun emergency_disable_liquidations(admin: &signer) acquires LiquidationSettings {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @aptos_clob, E_UNAUTHORIZED);
        
        let settings = borrow_global_mut<LiquidationSettings>(@aptos_clob);
        settings.is_liquidation_enabled = false;
    }

    /// Re-enable liquidations (admin only)
    public fun enable_liquidations(admin: &signer) acquires LiquidationSettings {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @aptos_clob, E_UNAUTHORIZED);
        
        let settings = borrow_global_mut<LiquidationSettings>(@aptos_clob);
        settings.is_liquidation_enabled = true;
    }

    #[test_only]
    use aptos_framework::account::create_account_for_test;

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_position_creation(framework: &signer, admin: &signer, user: &signer) acquires PositionManager, LiquidationSettings, PriceFeed {
        // Initialize timestamp and system
        timestamp::set_time_has_started_for_testing(framework);
        initialize(admin);
        
        // Create position
        create_position(user, 1000000, 500000); // 2:1 collateral ratio
        
        // Verify position exists
        assert!(exists<Position>(signer::address_of(user)), 1);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_liquidation_safety_checks(framework: &signer, admin: &signer, user: &signer) 
    acquires PositionManager, Position, PriceFeed, LiquidationSettings {
        // Initialize timestamp and system
        timestamp::set_time_has_started_for_testing(framework);
        initialize(admin);
        
        // Create safe position
        create_position(user, 2000000, 500000); // 4:1 collateral ratio
        
        let user_addr = signer::address_of(user);
        
        // Should not be liquidatable
        assert!(!is_position_liquidatable(user_addr), 1);
        
        // Test collateralization ratio calculation
        let ratio = get_collateralization_ratio(user_addr);
        assert!(ratio >= LIQUIDATION_THRESHOLD, 2);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_price_feed_update(framework: &signer, admin: &signer) acquires PriceFeed {
        timestamp::set_time_has_started_for_testing(framework);
        initialize(admin);
        
        // Update price
        update_price_feed(admin, 2000000); // 2 USD
        
        let price_feed = borrow_global<PriceFeed>(@aptos_clob);
        assert!(price_feed.price == 2000000, 1);
        assert!(price_feed.is_valid, 2);
    }
}