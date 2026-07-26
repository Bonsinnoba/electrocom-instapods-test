/* @refresh reload */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

import { API_BASE_URL, setGlobalAccessToken } from '../services/api';
import IdleWarningModal from '../components/IdleWarningModal';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// --- Session policy ---
// The 15-minute access token lifetime is purely a technical detail (limits how
// long a stolen token is useful). It should never be user-visible: we refresh
// it silently in the background well before it expires. The real security
// boundary is genuine inactivity — enforced here for UX, and independently
// re-enforced server-side in refresh.php so it can't be bypassed by disabling
// this JS.
const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const IDLE_WARNING_LEAD_MS = 60 * 1000; // show the warning modal 60s before logout
const IDLE_CHECK_INTERVAL_MS = 15 * 1000; // how often we check for inactivity
const ACTIVITY_THROTTLE_MS = 5 * 1000; // don't record activity more than once per 5s
const REFRESH_BUFFER_MS = 90 * 1000; // refresh the access token 90s before it actually expires
const LAST_ACTIVE_STORAGE_KEY = 'ehub_admin_last_active'; // synced across tabs
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

// Decode a JWT's payload without verifying it — verification is the server's job.
// We only need `exp` client-side to know when to proactively refresh.
const decodeJwtExp = (token) => {
  try {
    const payloadB64 = token.split('.')[1];
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [idleWarning, setIdleWarning] = useState({ show: false, secondsLeft: 0 });
  // Use a ref so event listeners always see the current value without stale closures
  const isRefreshingRef = React.useRef(false);
  // Prevent multiple concurrent checkAuth calls
  const isCheckingAuthRef = React.useRef(false);

  const lastActivityRef = useRef(Date.now());
  const lastActivityWriteRef = useRef(0);
  const proactiveRefreshTimerRef = useRef(null);
  const idleCheckIntervalRef = useRef(null);

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

  // --- Proactive silent refresh: renew the access token before it expires,
  // so an active user never actually experiences a 15-minute cutoff. ---
  const scheduleProactiveRefresh = useCallback((token) => {
    if (proactiveRefreshTimerRef.current) {
      clearTimeout(proactiveRefreshTimerRef.current);
      proactiveRefreshTimerRef.current = null;
    }
    if (!token) return;

    const exp = decodeJwtExp(token);
    if (!exp) return;

    const msUntilRefresh = Math.max(0, (exp * 1000) - Date.now() - REFRESH_BUFFER_MS);

    proactiveRefreshTimerRef.current = setTimeout(async () => {
      const newToken = await refreshAccessToken();
      if (newToken) {
        scheduleProactiveRefresh(newToken);
      }
      // If refresh failed here, the next authFetch 401 will trigger the
      // reactive handleUnauthorized path below, which decides whether to
      // hard-logout. We don't force logout directly from this timer alone,
      // since a transient network blip shouldn't end the session.
    }, msUntilRefresh);
  }, []);

  useEffect(() => {
    if (accessToken) {
      scheduleProactiveRefresh(accessToken);
    } else if (proactiveRefreshTimerRef.current) {
      clearTimeout(proactiveRefreshTimerRef.current);
      proactiveRefreshTimerRef.current = null;
    }
  }, [accessToken, scheduleProactiveRefresh]);

  // --- Inactivity tracking ---
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Dismiss the warning immediately if it's showing — the user is clearly here.
    setIdleWarning((prev) => (prev.show ? { show: false, secondsLeft: 0 } : prev));

    // Throttle cross-tab writes so we're not hammering localStorage on every mousemove.
    if (now - lastActivityWriteRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityWriteRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(now));
      } catch (e) {
        // Ignore storage errors — idle tracking still works within this tab.
      }
    }
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

    // Another tab's activity should reset this tab's idle clock too.
    const handleStorageActivity = (e) => {
      if (e.key === LAST_ACTIVE_STORAGE_KEY && e.newValue) {
        const otherTs = Number(e.newValue);
        if (otherTs > lastActivityRef.current) {
          lastActivityRef.current = otherTs;
          setIdleWarning((prev) => (prev.show ? { show: false, secondsLeft: 0 } : prev));
        }
      }
    };
    window.addEventListener('storage', handleStorageActivity);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, recordActivity));
      window.removeEventListener('storage', handleStorageActivity);
    };
  }, [recordActivity]);

  // --- Idle checker: the client-side half of the idle-logout policy. This is
  // a UX courtesy (shows the warning, logs out promptly on a normal browser).
  // It is NOT the real security boundary — refresh.php enforces the same 2h
  // window server-side, so tampering with this code doesn't extend a session
  // past the true limit; it only delays the inevitable next refresh 401. ---
  useEffect(() => {
    if (!accessToken) {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      return;
    }

    idleCheckIntervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= IDLE_LIMIT_MS) {
        setIdleWarning({ show: false, secondsLeft: 0 });
        logout();
        return;
      }

      if (idleMs >= IDLE_LIMIT_MS - IDLE_WARNING_LEAD_MS) {
        const secondsLeft = Math.max(0, Math.ceil((IDLE_LIMIT_MS - idleMs) / 1000));
        setIdleWarning({ show: true, secondsLeft });
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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
          lastActivityRef.current = Date.now();
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
        // Refresh truly failed (expired / revoked cookie, OR the server-side
        // idle window in refresh.php rejected it) — hard logout
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
        lastActivityRef.current = Date.now();
        try {
          localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(Date.now()));
        } catch (e) { /* ignore storage errors */ }
        
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
    if (proactiveRefreshTimerRef.current) {
      clearTimeout(proactiveRefreshTimerRef.current);
      proactiveRefreshTimerRef.current = null;
    }
    if (idleCheckIntervalRef.current) {
      clearInterval(idleCheckIntervalRef.current);
      idleCheckIntervalRef.current = null;
    }
    setIdleWarning({ show: false, secondsLeft: 0 });

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

  const handleStaySignedIn = () => {
    recordActivity();
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: !!accessToken, login, logout, loading, isRefreshing, refreshAccessToken, checkAuth }}>
      {children}
      {idleWarning.show && (
        <IdleWarningModal
          secondsLeft={idleWarning.secondsLeft}
          onContinue={handleStaySignedIn}
          onLogoutNow={logout}
        />
      )}
    </AuthContext.Provider>
  );
};
