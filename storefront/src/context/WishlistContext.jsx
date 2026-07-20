import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserContext';
import { secureStorage } from '../utils/secureStorage';
import { fetchWishlist, addToWishlist, removeFromWishlist } from '../services/api';

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

export const WishlistProvider = ({ children }) => {
  const { user } = useUser();

  const [wishlistItems, setWishlistItems] = useState(() => {
    return secureStorage.getItem('wishlist', 'local') || [];
  });

  // Sync with API on login
  useEffect(() => {
    let mounted = true;
    if (user) {
      const loadWishlist = async () => {
        try {
          const items = await fetchWishlist();
          if (mounted) {
            setWishlistItems(items);
            secureStorage.setItem('wishlist', items, user.id);
          }
        } catch (error) {
          console.error("Failed to load wishlist from server", error);
        }
      };
      loadWishlist();
    } else {
      setWishlistItems([]);
    }
    return () => { mounted = false; };
  }, [user]);

  const toggleWishlist = async (product) => {
    const isAlreadyIn = wishlistItems.some(item => item.id === product.id);
    
    // Optimistic UI update
    setWishlistItems(prev => {
      let nextState;
      if (isAlreadyIn) {
        nextState = prev.filter(item => item.id !== product.id);
      } else {
        nextState = [...prev, product];
      }
      
      // Update local storage
      secureStorage.setItem('wishlist', nextState, user?.id || 'local');
      return nextState;
    });

    // API update if logged in
    if (user) {
      try {
        if (isAlreadyIn) {
          await removeFromWishlist(product.id);
        } else {
          await addToWishlist(product.id);
        }
      } catch (error) {
        console.error("Wishlist sync failed", error);
        // We could revert the optimistic update here on failure
      }
    }
  };

  const isInWishlist = (productId) => {
    return wishlistItems.some(item => item.id === productId);
  };

  const clearWishlist = () => {
    setWishlistItems([]);
    secureStorage.setItem('wishlist', [], user?.id || 'local');
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, toggleWishlist, isInWishlist, clearWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

