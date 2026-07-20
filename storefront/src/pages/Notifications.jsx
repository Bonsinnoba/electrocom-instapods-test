
import React, { useEffect, useState } from 'react';
import { Bell, Clock, Trash2, Check, CheckCircle, Mail, ShieldCheck, Filter } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatRelativeTime } from '../utils/dateFormatter';
import { fetchMissingItemConfirmations, submitMissingItemConfirmation } from '../services/api';

const NotificationIcon = ({ type }) => {
  switch (type) {
    case 'info': return <div style={{ color: 'var(--primary-blue)' }}><Bell size={20} /></div>;
    case 'error': return <div style={{ color: 'var(--danger)' }}><ShieldCheck size={20} /></div>;
    case 'success': return <div style={{ color: 'var(--success)', filter: 'brightness(1.5)' }}><CheckCircle size={20} /></div>;
    default: return <div style={{ color: 'var(--primary-blue)' }}><Bell size={20} /></div>;
  }
};

export default function Notifications({ searchQuery }) {
  const { siteSettings } = useSettings();
  const siteName = siteSettings.siteName || 'your store';
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, unreadCount } = useNotifications();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('all');
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    const loadPendingConfirmations = async () => {
      const res = await fetchMissingItemConfirmations();
      if (res.success) {
        setPendingConfirmations(Array.isArray(res.data) ? res.data : []);
      }
    };
    loadPendingConfirmations();
  }, []);

  const handleDecision = async (item, choice) => {
    const labels = {
      replace_item: 'replace this item',
      refund_item: 'refund this missing item',
      cancel_order: 'cancel the whole order',
      accept_available: 'continue with available quantity',
    };
    if (!(await confirm(`Confirm that you want to ${labels[choice]} for ORD-${item.order_id}?`))) return;
    setConfirmingId(item.id);
    const res = await submitMissingItemConfirmation(item.id, choice);
    if (res.success) {
      setPendingConfirmations((prev) => prev.filter((x) => x.id !== item.id));
    }
    setConfirmingId(null);
  };

  const filters = [
    { id: 'all', label: 'All', icon: <Bell size={14} /> },
    { id: 'info', label: 'Updates', icon: <Bell size={14} /> },
    { id: 'success', label: 'Success', icon: <CheckCircle size={14} /> },
    { id: 'error', label: 'Alerts', icon: <ShieldCheck size={14} /> },
  ];

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = !searchQuery || n.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || n.type === filter;
    return matchesSearch && matchesFilter;
  });

  const unreadNotifs = filteredNotifications.filter(n => !n.read);
  const readNotifs = filteredNotifications.filter(n => n.read);

  const NotificationCard = ({ notif }) => (
    <div className="notif-card glass" style={{ 
      display: 'flex', 
      gap: '20px', 
      padding: '24px', 
      borderLeft: notif.read ? '1px solid var(--glass-border)' : `4px solid ${notif.type === 'error' ? 'var(--danger)' : notif.type === 'success' ? 'var(--success)' : 'var(--primary-blue)'}`,
      alignItems: 'start',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'default',
      position: 'relative'
    }}>
      <div style={{ 
        background: notif.read ? 'var(--bg-surface-secondary)' : (notif.type === 'error' ? 'var(--danger-bg)' : notif.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'var(--info-bg)'), 
        padding: '12px', 
        borderRadius: '14px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
        <NotificationIcon type={notif.type} />
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontWeight: notif.read ? 600 : 800, 
          color: 'var(--text-main)',
          fontSize: '16px',
          lineHeight: '1.4',
          marginBottom: '8px'
        }}>
          {notif.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <Clock size={14} /> {formatRelativeTime(notif.time)}
          {!notif.read && (
            <>
              <span style={{ color: 'var(--border-light)' }}>•</span>
              <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>New Activity</span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {!notif.read && (
          <button 
            className="btn-icon" 
            title="Mark as read" 
            onClick={() => markAsRead(notif.id)}
            style={{ 
              padding: '8px', 
              borderRadius: '10px', 
              color: 'var(--primary-blue)',
              background: 'var(--info-bg)',
              transition: 'all 0.2s',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Check size={16} />
          </button>
        )}
        <button 
          className="btn-icon" 
          title="Delete" 
          onClick={() => deleteNotification(notif.id)}
          style={{ 
            padding: '8px', 
            borderRadius: '10px', 
            color: 'var(--text-muted)',
            transition: 'all 0.2s',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="notifications-page" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px'
    }}>
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '24px 0 8px' 
      }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>Notifications</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '4px' }}>{`See what's happening at ${siteName}.`}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '500px', marginLeft: '24px' }}>
          <button 
            className="btn-secondary" 
            onClick={markAllAsRead}
            disabled={notifications.length === 0}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 24px', 
              borderRadius: '14px',
              fontWeight: 700,
              background: 'var(--info-bg)',
              color: 'var(--primary-blue)',
              border: '1px solid var(--border-light)',
              cursor: notifications.length === 0 ? 'not-allowed' : 'pointer',
              opacity: notifications.length === 0 ? 0.5 : 1,
              flex: 1,
              whiteSpace: 'nowrap'
            }}
          >
            <CheckCircle size={18} /> Mark all read
          </button>
          <button 
            className="btn-secondary" 
            onClick={async () => {
              if (await confirm('Are you sure you want to delete all notifications?')) {
                clearAllNotifications();
              }
            }}
            disabled={notifications.length === 0}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 24px', 
              borderRadius: '14px',
              fontWeight: 700,
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid var(--glass-border)',
              cursor: notifications.length === 0 ? 'not-allowed' : 'pointer',
              opacity: notifications.length === 0 ? 0.5 : 1,
              flex: 1,
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={18} /> Clear all
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '30px',
              border: '1px solid',
              borderColor: filter === f.id ? 'var(--primary-blue)' : 'var(--border-light)',
              background: filter === f.id ? 'var(--info-bg)' : 'var(--bg-surface)',
              color: filter === f.id ? 'var(--primary-blue)' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {pendingConfirmations.length > 0 && (
          <div className="notif-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)', boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)' }}></div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Action Required</h2>
              <span style={{ padding: '2px 8px', background: 'var(--warning)', color: '#111', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>
                {pendingConfirmations.length} PENDING
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              {pendingConfirmations.map((item) => (
                <div key={item.id} className="notif-card glass" style={{ padding: '20px', borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ fontWeight: 800, marginBottom: '8px' }}>Order ORD-{item.order_id}: Item availability issue</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '10px' }}>
                    {item.product_name} (Qty: {item.qty_missing}) is unavailable. Choose how you want us to proceed.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDecision(item, 'replace_item')}
                      disabled={confirmingId === item.id}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                    >
                      Replace Item
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDecision(item, 'refund_item')}
                      disabled={confirmingId === item.id}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                    >
                      Refund Item
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDecision(item, 'accept_available')}
                      disabled={confirmingId === item.id}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }}
                    >
                      Continue With Available Qty
                    </button>
                    <button
                      onClick={() => handleDecision(item, 'cancel_order')}
                      disabled={confirmingId === item.id}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--danger)', background: 'var(--danger-bg)', cursor: 'pointer' }}
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Notifications */}
        {unreadNotifs.length > 0 && (
          <div className="notif-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-blue)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}></div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Recent Alerts</h2>
              <span style={{ padding: '2px 8px', background: 'var(--primary-blue)', color: 'white', borderRadius: '8px', fontSize: '11px', fontWeight: 800 }}>{unreadNotifs.length} NEW</span>
            </div>
            <div className="notif-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr', 
              gap: '16px' 
            }}>
              {unreadNotifs.map(notif => <NotificationCard key={notif.id} notif={notif} />)}
            </div>
          </div>
        )}

        {/* Earlier Notifications */}
        <div className="notif-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5 }}></div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Earlier History</h2>
          </div>
          <div className="notif-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr', 
            gap: '16px' 
          }}>
            {readNotifs.map(notif => <NotificationCard key={notif.id} notif={notif} />)}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1024px) {
          .notif-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        .notif-card:hover {
          transform: translateY(-2px);
          border-color: var(--primary-blue) !important;
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
        }
        .btn-icon:hover {
          background: var(--border-light) !important;
          color: var(--primary-blue) !important;
          transform: scale(1.1);
        }
      `}} />
    </div>
  );
}
