import React, { useState, useEffect } from 'react';
import { ShoppingCart, Clock, User, Mail, DollarSign, AlertCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchAbandonedCarts, formatImageUrl } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export default function AbandonedCartManager() {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCart, setExpandedCart] = useState(null);
  const { addToast } = useNotifications();

  useEffect(() => {
    loadCarts();
  }, []);

  const loadCarts = async () => {
    setLoading(true);
    try {
      const result = await fetchAbandonedCarts();
      if (result.success) {
        setCarts(result.data);
      }
    } catch (error) {
      addToast("Failed to load abandoned carts", "error");
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Abandoned Carts</h1>
        <p style={{ color: 'var(--text-muted)' }}>Track and recover potential sales from unfinished checkouts.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>Total Abandoned</span>
            <ShoppingCart size={20} style={{ color: 'var(--warning)' }} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800 }}>{carts.filter(c => c.status === 'abandoned').length}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Active recovery opportunities</p>
        </div>
        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>Potential Revenue</span>
            <DollarSign size={20} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800 }}>GH₵ {carts.filter(c => c.status === 'abandoned').reduce((acc, c) => acc + c.total_value, 0).toFixed(2)}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Estimated value of abandoned items</p>
        </div>
        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>Recovered (7d)</span>
            <AlertCircle size={20} style={{ color: 'var(--primary-blue)' }} />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800 }}>{carts.filter(c => c.status === 'recovered').length}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Cart conversions from recovery efforts</p>
        </div>
      </div>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading carts...</div>
        ) : carts.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '16px 24px' }}>Customer</th>
                  <th style={{ padding: '16px 24px' }}>Value</th>
                  <th style={{ padding: '16px 24px' }}>Status</th>
                  <th style={{ padding: '16px 24px' }}>Email Sent</th>
                  <th style={{ padding: '16px 24px' }}>Last Updated</th>
                  <th style={{ padding: '16px 24px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr style={{ borderBottom: expandedCart === c.id ? 'none' : '1px solid var(--border-light)', fontSize: '14px', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
                            {c.user_name?.charAt(0) || <User size={14} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>{c.user_name || 'Guest User'}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.user_email}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 700 }}>GH₵ {c.total_value.toFixed(2)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '100px', 
                          fontSize: '11px', 
                          fontWeight: 700,
                          background: c.status === 'recovered' ? 'var(--success-bg)' : 
                                      c.status === 'abandoned' ? 'var(--warning-bg)' : 'var(--bg-surface-secondary)',
                          color: c.status === 'recovered' ? 'var(--success)' : 
                                 c.status === 'abandoned' ? 'var(--warning)' : 'var(--text-muted)'
                        }}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: c.email_sent_at ? 'var(--success)' : 'var(--text-muted)' }}>
                          <Mail size={14} />
                          <span style={{ fontSize: '12px' }}>{c.email_sent_at ? new Date(c.email_sent_at).toLocaleDateString() : 'Not Sent'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                        {getTimeAgo(c.last_updated)}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <button 
                          onClick={() => setExpandedCart(expandedCart === c.id ? null : c.id)}
                          className="btn-icon" 
                          style={{ background: 'var(--bg-surface-secondary)' }}
                        >
                          {expandedCart === c.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </td>
                    </tr>
                    {expandedCart === c.id && (
                      <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-light)' }}>
                        <td colSpan="6" style={{ padding: '24px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cart Contents</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                              {c.cart_data.map((item, idx) => (
                                <div key={idx} style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px', 
                                  padding: '12px', 
                                  background: 'var(--bg-surface)', 
                                  borderRadius: '12px',
                                  border: '1px solid var(--border-light)' 
                                }}>
                                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--bg-surface-secondary)', overflow: 'hidden' }}>
                                    <img src={formatImageUrl(item.image_url || item.image)} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.quantity} x GH₵ {Number(item.price || 0).toFixed(2)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShoppingCart size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
            <p>No abandoned carts recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
