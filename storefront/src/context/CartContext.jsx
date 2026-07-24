import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from './UserContext';
import { syncCart, fetchServerCart, validateCoupon } from '../services/api';
import { useNotifications } from './NotificationContext';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { user } = useUser();
  const { addToast } = useNotifications();

  // Cart lives in the DB — no localStorage
  const [cartItems, setCartItems] = useState([]);

  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const lastUserId = useRef(null);
  const lastCartItemsRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const isFetchingRef = useRef(false);

  // ── Load from DB whenever the user changes (login / switch account) ──
  useEffect(() => {
    if (!user) {
      // Logged out — clear in-memory cart
      setCartItems([]);
      setAppliedCoupon(null);
      lastUserId.current = null;
      lastCartItemsRef.current = null;
      isInitialLoadRef.current = true;
      isFetchingRef.current = false;
      return;
    }

    // Switched accounts — reset the sync refs
    if (lastUserId.current !== user.id) {
      lastUserId.current = user.id;
      lastCartItemsRef.current = null;
      isInitialLoadRef.current = true;
    }

    // Don't fire a concurrent duplicate request
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const loadFromServer = async () => {
      try {
        const serverCart = await fetchServerCart();
        setCartItems(serverCart || []);
        lastCartItemsRef.current = serverCart || [];
      } catch {
        setCartItems([]);
        lastCartItemsRef.current = [];
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadFromServer();
  }, [user]);

  // ── Sync to DB on every cart change (debounced) ──
  useEffect(() => {
    if (!user) return;
    
    // Skip sync during initial load to prevent unnecessary API call
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Only sync if cart items actually changed (compare with previous state)
    const currentCartString = JSON.stringify(cartItems);
    const previousCartString = JSON.stringify(lastCartItemsRef.current);
    
    if (currentCartString === previousCartString) {
      return; // No actual change, skip sync
    }

    const performCartSync = async () => {
      try {
        await syncCart(cartItems);
        lastCartItemsRef.current = cartItems;
      } catch {
        // Silently fail
      }
    };
    
    const timeoutId = setTimeout(performCartSync, 1000);
    return () => clearTimeout(timeoutId);
  }, [cartItems, user]);

  const addToCart = (product, quantity = 1, color = 'Default') => {
    if (!user) {
        addToast('Please login to add items to an active cart', 'error');
        return;
    }
    setCartItems(prev => {
      const existingItemIndex = prev.findIndex(
        item => item.id === product.id && item.selectedColor === color
      );

      if (existingItemIndex > -1) {
        const updatedItems = [...prev];
        updatedItems[existingItemIndex].quantity += quantity;
        return updatedItems;
      }

      return [...prev, { ...product, quantity, selectedColor: color }];
    });
  };

  const removeFromCart = (itemId, color) => {
    setCartItems(prev => prev.filter(item => !(item.id === itemId && item.selectedColor === color)));
  };

  const updateQuantity = (itemId, color, delta) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.id === itemId && item.selectedColor === color) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
  };

  const removeCheckedOutItems = (checkedItems) => {
    // checkedItems = array of cart item objects that were ordered
    setCartItems(prev => prev.filter(
      item => !checkedItems.some(
        c => c.id === item.id && c.selectedColor === item.selectedColor
      )
    ));
  };

  const applyCoupon = async (code) => {
    if (!code.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const result = await validateCoupon(code, subtotal);
      if (result.success) {
        setAppliedCoupon(result.coupon);
        addToast('Coupon applied successfully', 'success');
        return true;
      } else {
        setCouponError(result.error || 'Invalid coupon code');
        return false;
      }
    } catch {
      setCouponError('Error validating coupon. Please try again.');
      return false;
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
    addToast('Coupon removed', 'info');
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);
  const cartCount = cartItems.length;

  return (
    <CartContext.Provider value={{ 
      cartItems, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart,
      removeCheckedOutItems,
      subtotal,
      cartCount,
      appliedCoupon,
      applyCoupon,
      removeCoupon,
      isApplyingCoupon,
      couponError
    }}>
      {children}
    </CartContext.Provider>
  );
};
