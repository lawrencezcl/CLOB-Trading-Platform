#[test_only]
module aptos_clob::ClobCoreTests {
    use std::signer;
    use std::vector;
    use aptos_clob::ClobCore;
    use aptos_framework::account;
    use aptos_framework::timestamp;

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_clob_initialization(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        
        // Initialize CLOB system
        ClobCore::initialize_clob(admin);
        
        // Verify initialization completed without error
        assert!(true, 1);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_user_balance_initialization(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Initialize user balance
        ClobCore::initialize_user_balance(user);
        
        let user_addr = signer::address_of(user);
        let (available_base, available_quote, locked_base, locked_quote) = ClobCore::get_user_balance(user_addr);
        
        // Initial balances should be zero
        assert!(available_base == 0, 1);
        assert!(available_quote == 0, 2);
        assert!(locked_base == 0, 3);
        assert!(locked_quote == 0, 4);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_market_status_control(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Test market pause
        ClobCore::set_market_status(admin, false);
        
        // Test market resume
        ClobCore::set_market_status(admin, true);
        
        // Both operations should complete without error
        assert!(true, 1);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_market_stats_access(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        let (total_trades, total_volume, last_price, high_24h, low_24h, volume_24h) = ClobCore::get_market_stats();
        
        // Initial stats should be reasonable defaults
        assert!(total_trades >= 0, 1);
        assert!(total_volume >= 0, 2);
        assert!(last_price > 0, 3); // Should have default price
        assert!(high_24h >= 0, 4);
        assert!(low_24h >= 0, 5);
        assert!(volume_24h >= 0, 6);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_order_book_depth_access(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        let (buy_prices, buy_quantities, sell_prices, sell_quantities) = ClobCore::get_order_book_depth(10);
        
        // Should return empty vectors initially
        assert!(buy_prices == vector::empty<u64>(), 1);
        assert!(buy_quantities == vector::empty<u64>(), 2);
        assert!(sell_prices == vector::empty<u64>(), 3);
        assert!(sell_quantities == vector::empty<u64>(), 4);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_user_balance_access_nonexistent(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        let user_addr = signer::address_of(user);
        
        // Access balance without initialization should return zeros
        let (available_base, available_quote, locked_base, locked_quote) = ClobCore::get_user_balance(user_addr);
        
        assert!(available_base == 0, 1);
        assert!(available_quote == 0, 2);
        assert!(locked_base == 0, 3);
        assert!(locked_quote == 0, 4);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user1 = @0x123, user2 = @0x456)]
    fun test_multiple_user_initialization(framework: &signer, admin: &signer, user1: &signer, user2: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Initialize multiple users
        ClobCore::initialize_user_balance(user1);
        ClobCore::initialize_user_balance(user2);
        
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        
        // Both should have zero balances initially
        let (base1, quote1, locked_base1, locked_quote1) = ClobCore::get_user_balance(user1_addr);
        let (base2, quote2, locked_base2, locked_quote2) = ClobCore::get_user_balance(user2_addr);
        
        assert!(base1 == 0 && quote1 == 0, 1);
        assert!(locked_base1 == 0 && locked_quote1 == 0, 2);
        assert!(base2 == 0 && quote2 == 0, 3);
        assert!(locked_base2 == 0 && locked_quote2 == 0, 4);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    #[expected_failure(abort_code = 5)] // E_UNAUTHORIZED
    fun test_unauthorized_market_control(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Create another signer that is not admin
        let fake_admin = account::create_account_for_test(@0x999);
        
        // Try to control market with unauthorized account
        ClobCore::set_market_status(&fake_admin, false);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob, user = @0x123)]
    fun test_double_user_balance_initialization(framework: &signer, admin: &signer, user: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Initialize user balance twice (should not cause error)
        ClobCore::initialize_user_balance(user);
        ClobCore::initialize_user_balance(user);
        
        let user_addr = signer::address_of(user);
        let (available_base, available_quote, locked_base, locked_quote) = ClobCore::get_user_balance(user_addr);
        
        // Should still have zero balances
        assert!(available_base == 0, 1);
        assert!(available_quote == 0, 2);
        assert!(locked_base == 0, 3);
        assert!(locked_quote == 0, 4);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_market_stats_consistency(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Get stats multiple times to ensure consistency
        let (trades1, volume1, price1, high1, low1, vol24h1) = ClobCore::get_market_stats();
        let (trades2, volume2, price2, high2, low2, vol24h2) = ClobCore::get_market_stats();
        
        // Should be consistent across calls
        assert!(trades1 == trades2, 1);
        assert!(volume1 == volume2, 2);
        assert!(price1 == price2, 3);
        assert!(high1 == high2, 4);
        assert!(low1 == low2, 5);
        assert!(vol24h1 == vol24h2, 6);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_order_book_depth_levels(framework: &signer, admin: &signer) {
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Test different depth levels
        let (buy_prices_5, _, _, _) = ClobCore::get_order_book_depth(5);
        let (buy_prices_10, _, _, _) = ClobCore::get_order_book_depth(10);
        let (buy_prices_20, _, _, _) = ClobCore::get_order_book_depth(20);
        
        // All should return empty initially, but different parameters should work
        assert!(buy_prices_5 == vector::empty<u64>(), 1);
        assert!(buy_prices_10 == vector::empty<u64>(), 2);
        assert!(buy_prices_20 == vector::empty<u64>(), 3);
    }

    #[test(framework = @aptos_framework, admin = @aptos_clob)]
    fun test_system_state_after_initialization(framework: &signer, admin: &signer) 
{
        timestamp::set_time_has_started_for_testing(framework);
        ClobCore::initialize_clob(admin);
        
        // Verify all major components are accessible
        let (total_trades, total_volume, last_price, _, _, _) = ClobCore::get_market_stats();
        let (buy_prices, buy_quantities, sell_prices, sell_quantities) = ClobCore::get_order_book_depth(10);
        
        // System should be in valid initial state
        assert!(total_trades >= 0, 1);
        assert!(total_volume >= 0, 2);
        assert!(last_price > 0, 3);
        assert!(buy_prices == vector::empty<u64>(), 4);
        assert!(buy_quantities == vector::empty<u64>(), 5);
        assert!(sell_prices == vector::empty<u64>(), 6);
        assert!(sell_quantities == vector::empty<u64>(), 7);
    }
}