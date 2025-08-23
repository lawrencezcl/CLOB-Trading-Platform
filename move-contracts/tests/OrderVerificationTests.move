#[test_only]
module aptos_clob::OrderVerificationTests {
    use std::signer;
    use aptos_clob::OrderVerification;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use std::vector;

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_order_creation_and_validation(framework: &signer, admin: &signer, user: &signer) {
        // Initialize timestamp
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        
        // Initialize user nonce tracker
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Create a valid order
        let order = OrderVerification::create_order(
            user_addr,
            0, // Buy side
            1000000, // $1.00 price
            5000000, // 5 units quantity
            timestamp::now_seconds() + 3600, // 1 hour from now
            1, // nonce
            vector::empty<u8>() // empty signature for test
        );
        
        // Test order details
        let (addr, side, price, quantity, expiry, nonce) = OrderVerification::get_order_details(&order);
        assert!(addr == user_addr, 1);
        assert!(side == 0, 2);
        assert!(price == 1000000, 3);
        assert!(quantity == 5000000, 4);
        assert!(nonce == 1, 5);
        
        // Test order type checks
        assert!(OrderVerification::is_buy_order(&order), 6);
        assert!(!OrderVerification::is_sell_order(&order), 7);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_order_hash_generation(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        let order1 = OrderVerification::create_order(
            user_addr,
            0, // Buy
            1000000,
            5000000,
            timestamp::now_seconds() + 3600,
            1,
            vector::empty<u8>()
        );
        
        let order2 = OrderVerification::create_order(
            user_addr,
            0, // Buy
            1000000,
            5000000,
            timestamp::now_seconds() + 3600,
            1,
            vector::empty<u8>()
        );
        
        // Same order parameters should produce same hash
        let hash1 = OrderVerification::get_order_hash_bytes(&order1);
        let hash2 = OrderVerification::get_order_hash_bytes(&order2);
        assert!(hash1 == hash2, 1);
        
        // Different order should produce different hash
        let order3 = OrderVerification::create_order(
            user_addr,
            1, // Sell - different side
            1000000,
            5000000,
            timestamp::now_seconds() + 3600,
            1,
            vector::empty<u8>()
        );
        
        let hash3 = OrderVerification::get_order_hash_bytes(&order3);
        assert!(hash1 != hash3, 2);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_nonce_management(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Mark nonce as used
        OrderVerification::mark_nonce_used(user_addr, 1);
        OrderVerification::mark_nonce_used(user_addr, 2);
        
        // Test that nonces are tracked correctly
        // This would be validated in the actual signature verification
        // but for testing we just ensure the function executes without error
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_invalid_price_order(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Create order with zero price (creation succeeds, but validation would fail)
        let order = OrderVerification::create_order(
            user_addr,
            0,
            0, // Invalid price
            5000000,
            timestamp::now_seconds() + 3600,
            1,
            vector::empty<u8>()
        );
        
        // Verify order was created but has invalid price
        let (_, _, price, _, _, _) = OrderVerification::get_order_details(&order);
        assert!(price == 0, 1); // Verify the invalid price is stored
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_invalid_quantity_order(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Create order with zero quantity (creation succeeds, but validation would fail)
        let order = OrderVerification::create_order(
            user_addr,
            0,
            1000000,
            0, // Invalid quantity
            timestamp::now_seconds() + 3600,
            1,
            vector::empty<u8>()
        );
        
        // Verify order was created but has invalid quantity
        let (_, _, _, quantity, _, _) = OrderVerification::get_order_details(&order);
        assert!(quantity == 0, 1); // Verify the invalid quantity is stored
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_sell_order_creation(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Create a sell order
        let order = OrderVerification::create_order(
            user_addr,
            1, // Sell side
            1000000,
            5000000,
            timestamp::now_seconds() + 3600,
            1,
            vector::empty<u8>()
        );
        
        // Test order type checks
        assert!(!OrderVerification::is_buy_order(&order), 1);
        assert!(OrderVerification::is_sell_order(&order), 2);
        
        let (_, side, _, _, _, _) = OrderVerification::get_order_details(&order);
        assert!(side == 1, 3);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_order_expiry_validation(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Create order with future expiry
        let future_order = OrderVerification::create_order(
            user_addr,
            0,
            1000000,
            5000000,
            timestamp::now_seconds() + 3600, // Future expiry
            1,
            vector::empty<u8>()
        );
        
        // Advance time to ensure we have a valid timestamp for subtraction
        timestamp::fast_forward_seconds(10);
        
        // Create order with past expiry
        let past_order = OrderVerification::create_order(
            user_addr,
            0,
            1000000,
            5000000,
            timestamp::now_seconds() - 5, // Past expiry (safe subtraction)
            2,
            vector::empty<u8>()
        );
        
        // Verify orders are created successfully
        let (_, _, _, _, expiry1, _) = OrderVerification::get_order_details(&future_order);
        let (_, _, _, _, expiry2, _) = OrderVerification::get_order_details(&past_order);
        
        assert!(expiry1 > timestamp::now_seconds(), 1);
        assert!(expiry2 < timestamp::now_seconds(), 2);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_multiple_nonce_tracking(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        let user_addr = signer::address_of(user);
        OrderVerification::initialize_user_nonce_tracker(user);
        
        // Mark multiple nonces as used
        OrderVerification::mark_nonce_used(user_addr, 1);
        OrderVerification::mark_nonce_used(user_addr, 5);
        OrderVerification::mark_nonce_used(user_addr, 10);
        
        // Test that we can continue to mark nonces without error
        OrderVerification::mark_nonce_used(user_addr, 15);
        OrderVerification::mark_nonce_used(user_addr, 20);
    }
}