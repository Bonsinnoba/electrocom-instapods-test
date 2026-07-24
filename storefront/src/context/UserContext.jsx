import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { logoutUser, checkUserStatus } from '../services/api';
import { secureStorage } from '../utils/secureStorage';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Try to recover the last active user session from local storage safely
    let lastUserId;
    try {
      lastUserId = localStorage.getItem('ehub_last_user_id');
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when loading last user ID');
      }
    }
    return lastUserId ? secureStorage.getItem('user', lastUserId) : null;
  });

  // Ref to prevent duplicate checkUserStatus calls
  const hasCheckedStatus = useRef(false);

  // Hydrate full user profile on initial load.
  // If a session cookie or shared token exists, we should validate it even when the local user object
  // is absent due to browser refresh or missing secure storage state.
  useEffect(() => {
      if (hasCheckedStatus.current) return;

      const hasStoredToken = Boolean(secureStorage.getItem('token', 'shared'));
      let lastUserId = null;
      try {
        lastUserId = localStorage.getItem('ehub_last_user_id');
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          console.warn('Storage quota exceeded when reading last user ID');
        }
      }

      if (!user && !hasStoredToken && !lastUserId) return;

      hasCheckedStatus.current = true;
      checkUserStatus().then(res => {
          if (res && res.success && res.data && res.data.user) {
              // Use the login helper to ensure storage is synced to the confirmed ID
              login(res.data.user);
          } else if (res && res.unauthorized) {
              logout();
          }
      }).catch(err => {
          console.error('Session validation failed:', err);
      });
  }, []);

  useEffect(() => {
    if (user && user.id) {
        secureStorage.setItem('user', user, user.id);
        try {
          localStorage.setItem('ehub_last_user_id', user.id);
        } catch (e) {
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.warn('Storage quota exceeded when saving last user ID');
          }
        }
    }
  }, [user]);

  const updateUser = (newData) => {
    setUser(prev => {
        if (!prev) return newData;
        return { ...prev, ...newData };
    });
  };

  /**
   * Dedicated login function that fully replaces the user session.
   * This prevents accidental "merging" of data between different accounts.
   */
  const login = (userData, token = null) => {
    // 1. Wipe any stale shared data first
    secureStorage.removeItem('user', 'shared');
    
    // 2. Persist token if provided (Critical for api.js headers)
    if (token) {
        secureStorage.setItem('token', token, 'shared');
    }
    
    // 3. Set the new user state cleanly (REPLACE, don't MERGE)
    setUser(userData);
    
    // 4. Store the ID so we can recover this specific session on refresh
    if (userData && userData.id) {
        try {
          localStorage.setItem('ehub_last_user_id', userData.id);
        } catch (e) {
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.warn('Storage quota exceeded when saving last user ID');
          }
        }
        // Explicitly set the isolated storage immediately to avoid race conditions
        secureStorage.setItem('user', userData, userData.id);
    }
  };

  const logout = async () => {
    const currentId = user?.id;

    // 1. Clear State
    setUser(null);
    try {
      localStorage.removeItem('ehub_last_user_id');
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when removing last user ID');
      }
    }

    // 2. Deep Cleanup of storage
    if (currentId) {
        secureStorage.removeItem('user', currentId);
    }
    secureStorage.removeItem('user', 'shared');
    secureStorage.removeItem('token', 'shared');

    // 3. System Cleanup
    try {
      localStorage.setItem('site_theme', 'blue');
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('Storage quota exceeded when saving theme');
      }
    }
    window.dispatchEvent(new Event('themeChange'));

    try {
        await logoutUser();
    } catch (e) {
        console.warn('Failed to logout user:', e);
    }
  };

  const resetUser = () => {
    setUser(prev => {
        if (!prev) return null; // If not logged in, remain logged out
        return {
            ...prev,
            name: 'Guest User', 
            address: '', 
            profileImage: null,
            avatar: 'GU'
        };
    });
  };

  const [authModal, setAuthModal] = useState({ isOpen: false, mode: 'signin' });

  const openAuthModal = (mode = 'signin') => {
    setAuthModal({ isOpen: true, mode });
  };

  const closeAuthModal = () => {
    setAuthModal(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      updateUser,
      login, 
      resetUser, 
      logout,
      authModal,
      openAuthModal,
      closeAuthModal
    }}>
      {children}
    </UserContext.Provider>
  );
};
