/**
 * OrderVerification.move
 * Core order validation and signature verification module
 * This is a copy for deployment without ParallelExecution dependencies
 */

module aptos_clob::OrderVerification {
    use std::vector;
    use std::signer;
    use std::bcs;
    use aptos_framework::account;
    use aptos_framework::ed25519;
    use aptos_framework::timestamp;
    use aptos_std::hash;

    /// Error codes
    const E_INVALID_SIGNATURE: u64 = 1;
    const E_INVALID_ORDER: u64 = 2;
    const E_EXPIRED_ORDER: u64 = 3;
    const E_INVALID_PRICE: u64 = 4;
    const E_INVALID_QUANTITY: u64 = 5;
    const E_INSUFFICIENT_BALANCE: u64 = 6;
    const E_INVALID_NONCE: u64 = 7;

    /// Order side constants
    const SIDE_BUY: u8 = 0;
    const SIDE_SELL: u8 = 1;

    /// Order structure representing a trading order
    struct Order has copy, drop, store {
        sender: address,          // Order creator address
        side: u8,                // Buy (0) or Sell (1)
        price: u64,              // Price in smallest unit (e.g., micro-USDC)
        quantity: u64,           // Quantity in smallest unit
        expiry: u64,             // Expiration timestamp
        nonce: u64,              // Unique nonce for replay protection
        signature: vector<u8>,   // ED25519 signature
    }

    /// Order hash for signature verification
    struct OrderHash has copy, drop {
        hash: vector<u8>,
    }

    /// User nonce tracking for replay protection
    struct UserNonceTracker has key {
        nonces: vector<u64>,
    }

    /// Initialize nonce tracker for a user
    public fun initialize_user_nonce_tracker(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<UserNonceTracker>(account_addr)) {
            move_to(account, UserNonceTracker {
                nonces: vector::empty<u64>(),
            });
        }
    }

    /// Create a new order
    public fun create_order(
        sender: address,
        side: u8,
        price: u64,
        quantity: u64,
        expiry: u64,
        nonce: u64,
        signature: vector<u8>
    ): Order {
        Order {
            sender,
            side,
            price,
            quantity,
            expiry,
            nonce,
            signature,
        }
    }

    /// Generate order hash for signature verification
    public fun generate_order_hash(order: &Order): OrderHash {
        let hash_input = vector::empty<u8>();
        
        // Serialize order data for hashing
        vector::append(&mut hash_input, bcs::to_bytes(&order.sender));
        vector::append(&mut hash_input, bcs::to_bytes(&order.side));
        vector::append(&mut hash_input, bcs::to_bytes(&order.price));
        vector::append(&mut hash_input, bcs::to_bytes(&order.quantity));
        vector::append(&mut hash_input, bcs::to_bytes(&order.expiry));
        vector::append(&mut hash_input, bcs::to_bytes(&order.nonce));
        
        let hash = hash::sha3_256(hash_input);
        OrderHash { hash }
    }

    /// Verify order signature using ED25519
    public fun verify_order_signature(order: &Order): bool acquires UserNonceTracker {
        // Basic validation
        if (!is_valid_order_params(order)) {
            return false
        };

        // Check expiry
        if (!is_order_not_expired(order)) {
            return false
        };

        // Check nonce (replay protection)
        if (!is_valid_nonce(order)) {
            return false
        };

        // Generate order hash
        let order_hash = generate_order_hash(order);
        
        // Get user's public key
        let public_key_option = account::get_authentication_key(order.sender);
        if (vector::length(&public_key_option) != 32) {
            return false
        };

        // Convert authentication key to public key (first 32 bytes)
        let public_key = vector::empty<u8>();
        let i = 0;
        while (i < 32) {
            vector::push_back(&mut public_key, *vector::borrow(&public_key_option, i));
            i = i + 1;
        };

        // Verify signature
        let public_key_struct = ed25519::new_unvalidated_public_key_from_bytes(public_key);
        let signature_struct = ed25519::new_signature_from_bytes(order.signature);
        
        ed25519::signature_verify_strict(&signature_struct, &public_key_struct, order_hash.hash)
    }

    /// Validate order parameters
    fun is_valid_order_params(order: &Order): bool {
        // Check side
        if (order.side != SIDE_BUY && order.side != SIDE_SELL) {
            return false
        };
        
        // Check price (must be positive)
        if (order.price == 0) {
            return false
        };
        
        // Check quantity (must be positive)
        if (order.quantity == 0) {
            return false
        };
        
        // Check signature length
        if (vector::length(&order.signature) != 64) {
            return false
        };
        
        true
    }

    /// Check if order is not expired
    fun is_order_not_expired(order: &Order): bool {
        let current_time = timestamp::now_seconds();
        order.expiry > current_time
    }

    /// Validate nonce to prevent replay attacks
    fun is_valid_nonce(order: &Order): bool acquires UserNonceTracker {
        if (!exists<UserNonceTracker>(order.sender)) {
            return false
        };
        
        let nonce_tracker = borrow_global<UserNonceTracker>(order.sender);
        
        // Check if nonce has been used
        let i = 0;
        let len = vector::length(&nonce_tracker.nonces);
        while (i < len) {
            if (*vector::borrow(&nonce_tracker.nonces, i) == order.nonce) {
                return false // Nonce already used
            };
            i = i + 1;
        };
        
        true
    }

    /// Mark nonce as used
    public fun mark_nonce_used(sender: address, nonce: u64) acquires UserNonceTracker {
        let nonce_tracker = borrow_global_mut<UserNonceTracker>(sender);
        vector::push_back(&mut nonce_tracker.nonces, nonce);
    }

    /// Get order details for external access
    public fun get_order_details(order: &Order): (address, u8, u64, u64, u64, u64) {
        (order.sender, order.side, order.price, order.quantity, order.expiry, order.nonce)
    }

    /// Check if order is buy order
    public fun is_buy_order(order: &Order): bool {
        order.side == SIDE_BUY
    }

    /// Check if order is sell order
    public fun is_sell_order(order: &Order): bool {
        order.side == SIDE_SELL
    }

    /// Get order hash bytes for external use
    public fun get_order_hash_bytes(order: &Order): vector<u8> {
        let order_hash = generate_order_hash(order);
        order_hash.hash
    }

    /// Get order price
    public fun get_order_price(order: &Order): u64 {
        order.price
    }

    /// Get order quantity
    public fun get_order_quantity(order: &Order): u64 {
        order.quantity
    }

    /// Get order sender
    public fun get_order_sender(order: &Order): address {
        order.sender
    }

    /// Get order expiry
    public fun get_order_expiry(order: &Order): u64 {
        order.expiry
    }

    /// Get order nonce
    public fun get_order_nonce(order: &Order): u64 {
        order.nonce
    }

    /// Get next available nonce for user
    public fun get_next_nonce(user_addr: address): u64 acquires UserNonceTracker {
        if (!exists<UserNonceTracker>(user_addr)) {
            return 1
        };
        
        let nonce_tracker = borrow_global<UserNonceTracker>(user_addr);
        vector::length(&nonce_tracker.nonces) + 1
    }

    /// Admin function to clear old nonces (for cleanup)
    public fun clear_old_nonces(admin: &signer, user_addr: address, keep_count: u64) 
    acquires UserNonceTracker {
        // In production, add proper admin checks
        let _admin_addr = signer::address_of(admin);
        
        if (!exists<UserNonceTracker>(user_addr)) {
            return
        };
        
        let nonce_tracker = borrow_global_mut<UserNonceTracker>(user_addr);
        let total_nonces = vector::length(&nonce_tracker.nonces);
        
        if (total_nonces <= keep_count) {
            return
        };
        
        let remove_count = total_nonces - keep_count;
        let i = 0;
        while (i < remove_count) {
            vector::remove(&mut nonce_tracker.nonces, 0);
            i = i + 1;
        };
    }
}