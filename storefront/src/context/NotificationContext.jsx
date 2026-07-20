import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from './UserContext';
import { secureStorage } from '../utils/secureStorage';

const NotificationContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useUser();

  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollingIntervalRef = useRef(null);
  const isPollingActiveRef = useRef(false);

  const addToast = (text, type = 'info') => {
    const id = Date.now();
    const newToast = { id, text, type };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingActiveRef.current = false;
  }, []);

  const fetchServerNotifications = useCallback(async () => {
    if (!user) {
      stopPolling();
      return;
    }
    if (!isPollingActiveRef.current) return;

    try {
      const token = secureStorage.getItem('token', 'shared');
      const response = await fetch(`${API_BASE_URL}/get_notifications.php`, {
        credentials: 'include',
        headers: {
          'X-App-ID': 'storefront',
          ...(token ? { 'X-Session-Token': token } : {})
        }
      });

      // Stop polling on 401 Unauthorized
      if (response.status === 401) {
        stopPolling();
        setNotifications([]);
        return;
      }

      const result = await response.json();
      if (result.success) {
        // Map server notifications to local format
        const mapped = result.data.map(n => ({
          id: n.id,
          text: n.message,
          title: n.title,
          time: n.created_at,
          read: Boolean(parseInt(n.is_read)),
          type: n.type
        }));
        setNotifications(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
      // Stop polling on network errors to prevent spam
      stopPolling();
    }
  }, [user, stopPolling]);

  useEffect(() => {
    if (user) {
      isPollingActiveRef.current = true;
      fetchServerNotifications();
      pollingIntervalRef.current = setInterval(fetchServerNotifications, 30000); // 30s poll
    } else {
      stopPolling();
      setNotifications([]);
    }
    return () => {
      stopPolling();
    };
  }, [user, fetchServerNotifications, stopPolling]);

  // Immediately stop polling on global auth_unauthorized event
  useEffect(() => {
    const handleUnauthorized = () => {
      stopPolling();
      setNotifications([]);
    };
    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
    };
  }, [stopPolling]);

  const addNotification = (text, type = 'info') => {
    // This adds a temporary local notification, usually for UI actions
    // Real persistent notifications from the server will be fetched next poll
    const newNotif = {
      id: Date.now(),
      text,
      time: new Date().toISOString(),
      read: false,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markAsRead = async (id) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    
    // Server update if it's a persistent ID
    if (typeof id === 'number' && id < 1000000000000) { // Simple check for non-timestamp ID
        try {
            const token = secureStorage.getItem('token', 'shared');
            await fetch(`${API_BASE_URL}/get_notifications.php?action=mark_read`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'X-App-ID': 'storefront',
                  ...(token ? { 'X-Session-Token': token } : {})
                },
                body: JSON.stringify({ id })
            });
        } catch (error) {
            console.error("Failed to mark notification as read on server", error);
        }
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => {
        if (!n.read) markAsRead(n.id);
        return { ...n, read: true };
    }));
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (typeof id === 'number' && id < 1000000000000) {
      const token = secureStorage.getItem('token', 'shared');
      fetch(`${API_BASE_URL}/get_notifications.php?action=delete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-App-ID': 'storefront',
          ...(token ? { 'X-Session-Token': token } : {})
        },
        body: JSON.stringify({ id })
      }).catch((error) => {
        console.error("Failed to delete notification on server", error);
      });
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAsRead, 
      markAllAsRead, 
      deleteNotification, 
      clearAllNotifications,
      toasts,
      addToast,
      removeToast
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
