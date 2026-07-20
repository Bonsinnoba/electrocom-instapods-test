import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Trash2, Info, ShoppingBag, Shield, Star, Clock } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m";
  return Math.floor(seconds) + "s";
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (type) => {
    switch (type) {
      case 'order': return <ShoppingBag size={16} color="var(--primary-blue)" />;
      case 'promo': return <Star size={16} color="var(--warning)" />;
      case 'security': return <Shield size={16} color="var(--danger)" />;
      default: return <Info size={16} color="var(--accent-blue)" />;
    }
  };

  return (
    <div className="notification-center-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        className="sidebar-icon btn" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'relative' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="badge-premium badge-notif animate-pulse-notif">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown glass animate-scale-in" style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '12px',
          width: '360px',
          maxHeight: '480px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}>
          <header style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--border-light)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'var(--bg-surface-secondary)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Notifications</h3>
            {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary-blue)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Check size={14} /> Mark all read
                </button>
            )}
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    marginBottom: '8px',
                    background: n.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid',
                    borderColor: n.read ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  onClick={() => !n.read && markAsRead(n.id)}
                >
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '10px', 
                    background: 'var(--bg-surface)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}>
                    {getIcon(n.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: n.read ? 600 : 800, fontSize: '13px' }}>{n.title || 'Notification'}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Clock size={10} /> {timeAgo(n.time)} ago
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: n.read ? 'var(--text-muted)' : 'var(--text-main)', lineHeight: 1.4 }}>
                      {n.text}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer', opacity: 0.5 }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                  {!n.read && <div style={{ width: '8px', height: '8px', background: 'var(--primary-blue)', borderRadius: '50%', position: 'absolute', right: '40px', top: '14px' }} />}
                </div>
              ))
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={40} style={{ opacity: 0.1, marginBottom: '12px' }} />
                <p style={{ fontSize: '14px' }}>No notifications yet.</p>
              </div>
            )}
          </div>

          <footer style={{ padding: '12px', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
            <button 
                className="btn-text" 
                style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}
                onClick={() => setIsOpen(false)}
            >
                Close Panel
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
