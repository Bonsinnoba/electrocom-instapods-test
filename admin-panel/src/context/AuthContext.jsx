/* @refresh reload */
import React, { createContext, useContext, useState, useEffect } from 'react';

import { API_BASE_URL } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = () => {
    const savedToken = localStorage.getItem('ehub_token');
    const savedUser = localStorage.getItem('ehub_user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        
        // Background call to verify active session and role dynamically
        fetch(`${API_BASE_URL}/check_user_status.php`, {
          headers: { 
            'Authorization': `Bearer ${savedToken}`,
            'X-App-ID': 'admin'
          }
        })
        .then(res => {
          if (res.status === 401 || res.status === 403) {
            // Token is invalid, expired, or account suspended/demoted
            logout();
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (data && data.success && data.data?.user) {
            const updatedUser = data.data.user;
            
            // Only update if something actually changed to avoid unnecessary re-renders
            if (JSON.stringify(parsed) !== JSON.stringify(updatedUser)) {
              localStorage.setItem('ehub_user', JSON.stringify(updatedUser));
              setUser(updatedUser);
            }
          }
        })
        .catch(err => {
          console.error("Background session validation failed:", err);
        });
      } catch (e) {
        setUser(null);
      }
    } else {
      setToken(null);
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
    
    const handleStorage = () => checkAuth();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = (newToken, newUser) => {
    try {
        localStorage.setItem('ehub_token', newToken);
        
        // Minimize user data to avoid QuotaExceededError
        const minimizedUser = { ...newUser };
        if (minimizedUser.profileImage && minimizedUser.profileImage.length > 50000) {
            console.warn('Profile image too large for localStorage, omitting.');
            delete minimizedUser.profileImage;
        }
        
        localStorage.setItem('ehub_user', JSON.stringify(minimizedUser));
        setToken(newToken);
        setUser(newUser); // Keep full object in memory
    } catch (e) {
        console.error('Failed to save auth to localStorage:', e);
        // If it still fails, clear everything and try to save AT LEAST the token
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            localStorage.removeItem('ehub_user');
            localStorage.removeItem('ehub_token');
            try {
                localStorage.setItem('ehub_token', newToken);
            } catch (e2) {
                console.error('CRITICAL: Failed to save token even after local cleanup:', e2);
            }
        }
    }
  };

  const logout = () => {
    localStorage.removeItem('ehub_token');
    localStorage.removeItem('ehub_user');
    localStorage.setItem('admin_theme', 'blue');
    window.dispatchEvent(new Event('themeChange'));
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
