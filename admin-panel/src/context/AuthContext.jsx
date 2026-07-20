/* @refresh reload */
import React, { createContext, useContext, useState, useEffect } from 'react';

import { API_BASE_URL, setGlobalAccessToken } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Use a ref so event listeners always see the current value without stale closures
  const isRefreshingRef = React.useRef(false);
  // Prevent multiple concurrent checkAuth calls
  const isCheckingAuthRef = React.useRef(false);

  // Refresh access token using refresh token from HttpOnly cookie
  const refreshAccessToken = async () => {
    if (isRefreshingRef.current) return null;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/refresh.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-App-ID': 'admin'
        }
      });

      // Only treat definitive auth failures as logout triggers (return null, caller will logout)
      if (response.status === 401 || response.status === 403) {
        return null;
      }

      const result = await response.json();

      if (result.success && result.data?.access_token) {
        setAccessToken(result.data.access_token);
        setGlobalAccessToken(result.data.access_token);
        return result.data.access_token;
      } else {
        // Server responded but refresh failed — return null, caller will logout
        return null;
      }
    } catch (error) {
      // Network error — do NOT logout; user may just be briefly offline
      console.error('Token refresh failed (network error):', error);
      return null;
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  const checkAuth = async () => {
    // Prevent multiple concurrent checkAuth calls (race condition fix)
    if (isCheckingAuthRef.current) {
      return;
    }
    
    isCheckingAuthRef.current = true;
    const savedUser = localStorage.getItem('ehub_user');
    
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        
        // Try to refresh the access token on app boot
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Background call to verify active session and role dynamically.
          // IMPORTANT: Must include Authorization header so authenticate() finds the token.
          fetch(`${API_BASE_URL}/check_user_status.php`, {
            headers: { 
              'X-App-ID': 'admin',
              'Authorization': `Bearer ${newToken}`
            }
          })
          .then(res => {
            if (res.status === 401 || res.status === 403) {
              // Clear state without calling logout API
              setAccessToken(null);
              setGlobalAccessToken(null);
              setUser(null);
              localStorage.removeItem('ehub_user');
              return null;
            }
            return res.json();
          })
          .then(data => {
            if (data && data.success && data.data?.user) {
              const updatedUser = data.data.user;
              if (JSON.stringify(parsed) !== JSON.stringify(updatedUser)) {
                localStorage.setItem('ehub_user', JSON.stringify(updatedUser));
                setUser(updatedUser);
              }
            }
          })
          .catch(err => {
            console.error("Background session validation failed:", err);
            // Don't logout on network errors - user may be temporarily offline
          });
        } else {
          // Refresh failed — clear state without calling logout API
          setAccessToken(null);
          setGlobalAccessToken(null);
          setUser(null);
          localStorage.removeItem('ehub_user');
        }
      } catch (e) {
        setUser(null);
        setAccessToken(null);
        setGlobalAccessToken(null);
      }
    } else {
      setAccessToken(null);
      setGlobalAccessToken(null);
      setUser(null);
    }
    
    isCheckingAuthRef.current = false;
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
    
    const handleStorage = () => checkAuth();
    window.addEventListener('storage', handleStorage);
    
    // Handle 401/403 errors from authFetch with automatic silent token refresh.
    // Do NOT reload the page — that causes a new boot cycle which may lose
    // the freshly acquired access token before React state is settled.
    const handleUnauthorized = async () => {
      if (isRefreshingRef.current) return;
      const newToken = await refreshAccessToken();
      if (!newToken) {
        // Refresh truly failed (expired / revoked cookie) — hard logout
        logout();
      }
      // If newToken succeeded, the global token store is updated and the
      // next authFetch call will automatically pick up the new token.
    };
    window.addEventListener('auth_unauthorized', handleUnauthorized);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
    };
  }, []);

  const login = (accessToken, newUser) => {
    try {
        // Store access token in memory only (short-lived, 15 minutes)
        setAccessToken(accessToken);
        setGlobalAccessToken(accessToken);
        
        // Minimize user data to avoid QuotaExceededError
        const minimizedUser = { ...newUser };
        if (minimizedUser.profileImage && minimizedUser.profileImage.length > 50000) {
            console.warn('Profile image too large for localStorage, omitting.');
            delete minimizedUser.profileImage;
        }
        
        localStorage.setItem('ehub_user', JSON.stringify(minimizedUser));
        setUser(newUser); // Keep full object in memory
    } catch (e) {
        console.error('Failed to save auth to localStorage:', e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            localStorage.removeItem('ehub_user');
            try {
                localStorage.setItem('ehub_user', JSON.stringify({ id: newUser.id, name: newUser.name, role: newUser.role }));
            } catch (e2) {
                console.error('CRITICAL: Failed to save user data even after local cleanup:', e2);
            }
        }
    }
  };

  const logout = async () => {
    // Call logout endpoint to clear refresh token cookie
    try {
      const response = await fetch(`${API_BASE_URL}/logout.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-App-ID': 'admin'
        }
      });
      if (!response.ok) {
        console.error('Logout API returned error status:', response.status);
      }
    } catch (error) {
      console.error('Logout API call failed:', error.message || error);
    }
    
    // Clear state regardless of API call success
    setAccessToken(null);
    setGlobalAccessToken(null);
    setUser(null);
    localStorage.removeItem('ehub_user');
    localStorage.setItem('admin_theme', 'blue');
    window.dispatchEvent(new Event('themeChange'));
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: !!accessToken, login, logout, loading, isRefreshing, refreshAccessToken, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
