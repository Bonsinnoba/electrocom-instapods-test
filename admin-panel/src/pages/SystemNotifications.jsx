import React from 'react';
import { Bell, Shield, Info, ShoppingBag, Check, Trash2, Clock, Filter, Search } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function SystemNotifications() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, unreadCount } = useNotifications();
  const [filterType, setFilterType] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');

  const filtered = notifications.filter(n => {
    const matchesFilter = filterType === 'All' || n.type === filterType.toLowerCase();
    const matchesSearch = n.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.userName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getIcon = (type) => {
    switch (type) {
      case 'system': return <Bell size={20} color="var(--accent-blue)" />;
      case 'security': return <Shield size={20} color="var(--danger)" />;
      case 'order': return <ShoppingBag size={20} color="var(--primary-blue)" />;
      default: return <Info size={20} color="var(--accent-blue)" />;
    }
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800 }}>System Notifications</h1>
          <p style={{ color: 'var(--text-muted)' }}>Monitor security alerts, low stock warnings, and system events.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {unreadCount > 0 && (
            <button className="btn" onClick={markAllAsRead} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} /> Mark All as Read
            </button>
          )}
        </div>
      </header>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
             <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
             <input 
                type="text" 
                placeholder="Search alerts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 40px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)' }}
             />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['All', 'System', 'Security', 'Order', 'Info'].map(t => (
              <button 
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: filterType === t ? 'var(--primary-blue)' : 'var(--border-light)',
                  background: filterType === t ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: filterType === t ? 'var(--primary-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '10px' }}>
          {filtered.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.map(n => (
                <div 
                  key={n.id} 
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    marginBottom: '10px',
                    background: n.read ? 'transparent' : 'rgba(59, 130, 246, 0.03)',
                    border: '1px solid',
                    borderColor: n.read ? 'var(--border-light)' : 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    gap: '20px',
                    position: 'relative',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '14px', 
                    background: 'var(--bg-surface)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}>
                    {getIcon(n.type)}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: n.read ? 600 : 800 }}>{n.title || 'System Alert'}</h4>
                        {!n.read && <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--primary-blue)', color: 'white', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>New</span>}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> {timeAgo(n.time)} ago
                      </span>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: n.read ? 'var(--text-muted)' : 'var(--text-main)', lineHeight: 1.5 }}>
                      {n.text}
                    </p>
                    {n.userName && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                                {n.userName.charAt(0)}
                            </div>
                            Related User: <strong>{n.userName}</strong>
                        </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {!n.read && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="btn-icon" 
                        title="Mark as Read"
                        style={{ color: 'var(--success)', background: 'rgba(34,197,94,0.1)' }}
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="btn-icon" 
                      title="Delete"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={64} style={{ opacity: 0.1, marginBottom: '20px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>All clear!</h3>
              <p>No system notifications found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
