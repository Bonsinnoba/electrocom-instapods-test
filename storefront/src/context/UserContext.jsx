import React, { createContext, useContext, useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { logoutUser, checkUserStatus, refreshSession } from '../services/api';
import { secureStorage } from '../utils/secureStorage';
import IdleWarningModal from '../components/IdleWarningModal';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// --- Session policy ---
// The access token's 15-minute lifetime is a technical detail only — it should
// never be felt by the customer. We refresh it silently in the background
// well before it expires. The real security boundary is genuine inactivity:
// enforced here for UX (warning + auto logout), and independently re-enforced
// server-side in refresh.php so it can't be bypassed by disabling this JS.
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours of inactivity
const IDLE_WARNING_LEAD_MS = 60 * 1000; // show the warning modal 60s before logout
const IDLE_CHECK_INTERVAL_MS = 15 * 1000; // how often we check for inactivity
const ACTIVITY_THROTTLE_MS = 5 * 1000; // don't record activity more than once per 5s
const REFRESH_BUFFER_MS = 90 * 1000; // refresh the access token 90s before it actually expires
const LAST_ACTIVE_STORAGE_KEY = 'ehub_store_last_active'; // synced across tabs
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

  const [idleWarning, setIdleWarning] = useState({ show: false, secondsLeft: 0 });

  // Ref to prevent duplicate checkUserStatus calls
  const hasCheckedStatus = useRef(false);

  const lastActivityRef = useRef(Date.now());
  const lastActivityWriteRef = useRef(0);
  const proactiveRefreshTimerRef = useRef(null);
  const idleCheckIntervalRef = useRef(null);

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

  // --- Proactive silent refresh: renew the access token before it expires,
  // so an active customer never actually experiences a 15-minute cutoff. ---
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
      const newToken = await refreshSession();
      if (newToken) {
        scheduleProactiveRefresh(newToken);
      }
      // If this fails, the next apiFetch 401 will attempt its own retry via
      // refreshSession; only a genuinely dead refresh-token cookie ends the
      // session, which surfaces through the normal auth_unauthorized flow.
    }, msUntilRefresh);
  }, []);

  // --- Inactivity tracking ---
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    setIdleWarning((prev) => (prev.show ? { show: false, secondsLeft: 0 } : prev));

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
    if (!user) return undefined;

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

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
  }, [user, recordActivity]);

  // --- Idle checker: the client-side half of the idle-logout policy. This is
  // a UX courtesy — the real security boundary is enforced independently in
  // refresh.php's server-side idle window (4h for storefront), so tampering
  // with this code doesn't extend a session past the true limit. ---
  useEffect(() => {
    if (!user) {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
        idleCheckIntervalRef.current = null;
      }
      if (proactiveRefreshTimerRef.current) {
        clearTimeout(proactiveRefreshTimerRef.current);
        proactiveRefreshTimerRef.current = null;
      }
      return undefined;
    }

    // Kick off proactive refresh scheduling for whatever token we currently hold.
    lastActivityRef.current = Date.now();
    scheduleProactiveRefresh(secureStorage.getItem('token', 'shared'));

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
      if (proactiveRefreshTimerRef.current) {
        clearTimeout(proactiveRefreshTimerRef.current);
        proactiveRefreshTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(Date.now()));
    } catch (e) { /* ignore storage errors */ }
    
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
    if (proactiveRefreshTimerRef.current) {
      clearTimeout(proactiveRefreshTimerRef.current);
      proactiveRefreshTimerRef.current = null;
    }
    if (idleCheckIntervalRef.current) {
      clearInterval(idleCheckIntervalRef.current);
      idleCheckIntervalRef.current = null;
    }
    setIdleWarning({ show: false, secondsLeft: 0 });

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
    // Wrapped in startTransition: AuthModal is lazy-loaded, and opening it
    // directly from a synchronous click handler (Cart's "Login to Checkout",
    // Favorites' login prompt, Navbar's cart icon) throws React error #426
    // the first time it mounts in a session. This makes it safe everywhere.
    startTransition(() => {
      setAuthModal({ isOpen: true, mode });
    });
  };

  const closeAuthModal = () => {
    setAuthModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleStaySignedIn = () => {
    recordActivity();
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
      {idleWarning.show && (
        <IdleWarningModal
          secondsLeft={idleWarning.secondsLeft}
          onContinue={handleStaySignedIn}
          onLogoutNow={logout}
        />
      )}
    </UserContext.Provider>
  );
};
