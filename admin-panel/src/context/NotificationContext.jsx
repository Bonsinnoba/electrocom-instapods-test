/* @refresh reload */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const maxSeenIdRef = useRef(0);

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

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      
      osc1.stop(ctx.currentTime + 0.55);
      osc2.stop(ctx.currentTime + 0.55);
    } catch (e) {
      console.warn("Audio Context failed or blocked by browser autoplay policy", e);
    }
  };

  const fetchServerNotifications = async () => {
    const token = localStorage.getItem('ehub_token');
    if (!token) return false; // No token — stop immediately

    try {
        const response = await fetch(`${API_BASE_URL}/get_notifications.php?admin=true&_t=${Date.now()}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-App-ID': 'admin'
            }
        });
        
        if (response.status === 401 || response.status === 403) {
             // Stop polling if unauthorized — do NOT dispatch auth event from here
             return false;
        }

        if (response.status === 429) {
            console.warn('Rate limited on notifications, backing off');
            return true; // Continue polling but let interval handle timing
        }

        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            const formatted = result.data.map(n => ({
                id: n.id,
                text: n.message,
                title: n.title,
                time: n.created_at,
                read: Boolean(parseInt(n.is_read)),
                type: n.type,
                userName: n.user_name
            }));

            // Track max seen ID to identify new incoming alerts
            const ids = formatted.map(n => parseInt(n.id) || 0);
            const currentMax = ids.length > 0 ? Math.max(...ids) : 0;

            if (maxSeenIdRef.current === 0) {
                // Baseline: don't play sound/show desktop alert for history
                maxSeenIdRef.current = currentMax;
            } else if (currentMax > maxSeenIdRef.current) {
                // Filter only new, unread notifications
                const newItems = formatted.filter(n => (parseInt(n.id) || 0) > maxSeenIdRef.current && !n.read);
                if (newItems.length > 0) {
                    playNotificationSound();
                    
                    newItems.forEach(item => {
                        if ("Notification" in window && Notification.permission === "granted") {
                            try {
                                new Notification(item.title || "New Order / System Alert", {
                                    body: item.text,
                                    tag: `notif-${item.id}`
                                });
                            } catch (e) {
                                console.warn("Failed to trigger desktop notification", e);
                            }
                        }
                    });
                }
                maxSeenIdRef.current = currentMax;
            }

            setNotifications(formatted);
        }
    } catch (error) {
        console.error("Failed to fetch admin notifications", error);
    }
    return true;
  };

  useEffect(() => {
    // Request permission on authentication
    if (isAuthenticated && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Only start the poller when the user is authenticated
    if (!isAuthenticated) {
      setNotifications([]); // Clear notifications on logout
      maxSeenIdRef.current = 0;
      return;
    }

    // Initial fetch
    fetchServerNotifications();
    
    // Polling setup — check every 30 seconds to avoid rate limiting
    const interval = setInterval(async () => {
        const shouldContinue = await fetchServerNotifications();
        if (shouldContinue === false) {
            clearInterval(interval);
        }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const addNotification = (text, type = 'info') => {
    const newNotif = {
      id: Date.now(),
      text,
      type,
      time: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    
    if (typeof id === 'number' && id < 1000000000000) {
        try {
            await fetch(`${API_BASE_URL}/get_notifications.php?action=mark_read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('ehub_token')}`
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

  const deleteNotification = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (typeof id === 'number' && id < 1000000000000) {
        try {
            await fetch(`${API_BASE_URL}/get_notifications.php?action=delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('ehub_token')}`
                },
                body: JSON.stringify({ id })
            });
        } catch (error) {
            console.error("Failed to delete notification on server", error);
        }
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
