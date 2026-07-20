import React, { useState, useEffect } from 'react';
import { Send, BarChart3, RefreshCw, RotateCcw, Users, Mail, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { sendBroadcast, fetchDeliveryAnalytics, retryFailedNotificationQueue, API_BASE_URL } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

export default function BroadcastHub() {
    const { addToast } = useNotifications();
    const { confirm } = useConfirm();
    const [activeTab, setActiveTab] = useState('tool');
    
    // Broadcast Tool State
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [roleOptions, setRoleOptions] = useState(['customer']);
    const [formData, setFormData] = useState({
        type: 'email',
        target: 'all',
        role_targets: ['customer'],
        title: '',
        message: ''
    });

    // Analytics State
    const [days, setDays] = useState(30);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        const loadRoles = async () => {
            try {
                const token = localStorage.getItem('ehub_token');
                const res = await fetch(`${API_BASE_URL}/admin_broadcast.php`, {
                    headers: {
                        'X-App-ID': 'admin',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    setRoleOptions(data.data);
                }
            } catch {}
        };
        loadRoles();
    }, []);

    useEffect(() => {
        if (activeTab === 'analytics') {
            loadAnalytics();
        }
    }, [activeTab, days]);

    const loadAnalytics = async () => {
        setAnalyticsLoading(true);
        const res = await fetchDeliveryAnalytics(days);
        if (res.success) setAnalyticsData(res.data);
        else addToast(res.message || 'Failed to load analytics', 'error');
        setAnalyticsLoading(false);
    };

    const handleBroadcastSubmit = async (e) => {
        e.preventDefault();
        if (!formData.message) return alert('Message is required');
        
        if (!formData.role_targets?.length) return alert('Select at least one role');
        if (!(await confirm(`Are you sure you want to send this broadcast to selected roles (${formData.role_targets.join(', ')})? This action cannot be undone.`))) return;

        setLoading(true);
        setStats(null);
        try {
            const res = await sendBroadcast(formData);
            if (res.success) {
                addToast('Broadcast sent successfully!', 'success');
                setStats(res.stats);
                setFormData({ ...formData, title: '', message: '' });
            } else {
                addToast(res.error || 'Failed to send broadcast', 'error');
            }
        } catch (err) {
            addToast('Network error occurred', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRetryAll = async () => {
        if (!(await confirm('Re-queue all failed email/SMS jobs? The worker will pick them up on the next run.'))) return;
        setRetrying(true);
        const res = await retryFailedNotificationQueue();
        if (res.success) addToast(`Re-queued ${res.retried_rows ?? 0} jobs`, 'success');
        else addToast(res.message || 'Retry failed', 'error');
        setRetrying(false);
        loadAnalytics();
    };

    const byChannel = analyticsData?.by_channel || {};
    const byRole = analyticsData?.by_role_segment || {};

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Broadcast Hub</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Send mass notifications and view delivery analytics.</p>
                </div>
                
                {/* Tab Switcher */}
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                    <button 
                        onClick={() => setActiveTab('tool')} 
                        style={{ 
                            padding: '10px 24px', 
                            borderRadius: '12px', 
                            background: activeTab === 'tool' ? 'var(--primary-blue)' : 'transparent', 
                            color: activeTab === 'tool' ? 'white' : 'var(--text-muted)', 
                            border: 'none', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'tool' ? '0 4px 15px rgba(59, 130, 246, 0.2)' : 'none'
                        }}
                    >
                        <Send size={18} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} />
                        Broadcast Tool
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')} 
                        style={{ 
                            padding: '10px 24px', 
                            borderRadius: '12px', 
                            background: activeTab === 'analytics' ? 'var(--primary-blue)' : 'transparent', 
                            color: activeTab === 'analytics' ? 'white' : 'var(--text-muted)', 
                            border: 'none', 
                            fontWeight: 700, 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'analytics' ? '0 4px 15px rgba(59, 130, 246, 0.2)' : 'none'
                        }}
                    >
                        <BarChart3 size={18} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} />
                        Delivery Analytics
                    </button>
                </div>
            </div>

            {activeTab === 'tool' ? (
                <div className="grid-responsive" style={{ gridTemplateColumns: '1fr 350px', gap: '32px', alignItems: 'start' }}>
                    <div className="card glass" style={{ padding: '32px' }}>
                        <form onSubmit={handleBroadcastSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Broadcast Type</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'email'})}
                                        className={`btn ${formData.type === 'email' ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <Mail size={18} /> Email
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'sms'})}
                                        className={`btn ${formData.type === 'sms' ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        <MessageSquare size={18} /> SMS
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'both'})}
                                        className={`btn ${formData.type === 'both' ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    >
                                        Both
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Target Audience</label>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 10px', fontSize: '12px' }}
                                            onClick={() => setFormData({ ...formData, role_targets: [...roleOptions] })}
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 10px', fontSize: '12px' }}
                                            onClick={() => setFormData({ ...formData, role_targets: ['customer'] })}
                                        >
                                            Customers only
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {roleOptions.map((role) => {
                                            const active = formData.role_targets.includes(role);
                                            return (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = active
                                                            ? formData.role_targets.filter(r => r !== role)
                                                            : [...formData.role_targets, role];
                                                        setFormData({ ...formData, role_targets: next });
                                                    }}
                                                    className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                                                    style={{ padding: '8px 12px', textTransform: 'capitalize' }}
                                                >
                                                    {role.replace('_', ' ')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <select 
                                        value={formData.target} 
                                        onChange={(e) => setFormData({...formData, target: e.target.value})}
                                        className="input-field"
                                        style={{ width: '100%', padding: '12px' }}
                                    >
                                        <option value="all">All Selected Roles</option>
                                        <option value="verified">Verified Customers (only applies to customer role)</option>
                                        <option value="standard">Standard Customers (only applies to customer role)</option>
                                    </select>
                                </div>
                            </div>

                            {(formData.type === 'email' || formData.type === 'both') && (
                                <div className="form-group animate-fade-in">
                                    <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Email Subject</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Flash Sale: 50% Off Everything!" 
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        className="input-field"
                                        style={{ width: '100%', padding: '12px' }}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Message Body</label>
                                <textarea 
                                    placeholder="Type your message here..." 
                                    value={formData.message}
                                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                                    className="input-field"
                                    style={{ width: '100%', padding: '12px', minHeight: '200px', resize: 'vertical' }}
                                />
                                {formData.type === 'sms' && (
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                        Message Length: {formData.message.length} characters (approx. {Math.ceil(formData.message.length / 160)} SMS units)
                                    </p>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="btn-primary" 
                                style={{ padding: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            >
                                {loading ? (
                                    <>Sending...</>
                                ) : (
                                    <>
                                        <Send size={20} /> Send Broadcast
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="card glass" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} color="var(--warning)" /> Best Practices
                            </h3>
                            <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <li>Be concise with SMS messages to save on costs.</li>
                                <li>Include a clear Call to Action (CTA) link.</li>
                                <li>Personalize the subject line for higher open rates.</li>
                                <li>Avoid sending more than 1-2 broadcasts per week.</li>
                            </ul>
                        </div>

                        {stats && (
                            <div className="card glass animate-fade-in" style={{ padding: '24px', border: '1px solid var(--success-bg)' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                                    <CheckCircle size={20} /> Last Broadcast Stats
                                </h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                        <span>Total Reached:</span>
                                        <span style={{ fontWeight: 700 }}>{stats.total_reached}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                        <span>Emails Sent:</span>
                                        <span style={{ fontWeight: 700 }}>{stats.emails}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                        <span>SMS Sent:</span>
                                        <span style={{ fontWeight: 700 }}>{stats.sms}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BarChart3 size={26} /> Delivery analytics
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
                                Sent / delivered / failed for queued channels. <strong>Delivered</strong> matches queue status <code>sent</code> (provider receipts are not stored).
                                In-app promos: {analyticsData?.in_app_broadcast_rows ?? '—'} rows in period.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <select className="input-premium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                                <option value={7}>Last 7 days</option>
                                <option value={30}>Last 30 days</option>
                                <option value={90}>Last 90 days</option>
                            </select>
                            <button type="button" className="btn btn-secondary" onClick={loadAnalytics} disabled={analyticsLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <RefreshCw size={16} className={analyticsLoading ? 'animate-spin' : ''} /> Refresh
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleRetryAll} disabled={retrying} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <RotateCcw size={16} /> Retry failed queue
                            </button>
                        </div>
                    </div>

                    {analyticsLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
                        <>
                            <div className="card glass" style={{ padding: '20px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px' }}>By channel</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '8px' }}>Channel</th>
                                            <th style={{ padding: '8px' }}>Sent</th>
                                            <th style={{ padding: '8px' }}>Delivered (same as sent)</th>
                                            <th style={{ padding: '8px' }}>Failed</th>
                                            <th style={{ padding: '8px' }}>Pending</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(byChannel).length === 0 ? (
                                            <tr><td colSpan={5} style={{ padding: '12px', color: 'var(--text-muted)' }}>No queue data in this window.</td></tr>
                                        ) : Object.entries(byChannel).map(([ch, row]) => (
                                            <tr key={ch} style={{ borderTop: '1px solid var(--border-light)' }}>
                                                <td style={{ padding: '10px', fontWeight: 700 }}>{ch}</td>
                                                <td style={{ padding: '10px' }}>{row.sent ?? 0}</td>
                                                <td style={{ padding: '10px' }}>{row.delivered ?? row.sent ?? 0}</td>
                                                <td style={{ padding: '10px' }}>{row.failed ?? 0}</td>
                                                <td style={{ padding: '10px' }}>{row.pending ?? 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="card glass" style={{ padding: '20px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px' }}>By audience role segment (queue payload)</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '8px' }}>Role</th>
                                            <th style={{ padding: '8px' }}>Channel</th>
                                            <th style={{ padding: '8px' }}>Sent</th>
                                            <th style={{ padding: '8px' }}>Failed</th>
                                            <th style={{ padding: '8px' }}>Pending</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(byRole).length === 0 ? (
                                            <tr><td colSpan={5} style={{ padding: '12px', color: 'var(--text-muted)' }}>No segmented data (new broadcasts include role tags).</td></tr>
                                        ) : Object.entries(byRole).map(([role, channels]) =>
                                            Object.entries(channels).map(([ch, row]) => (
                                                <tr key={`${role}-${ch}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '10px', fontWeight: 700 }}>{role}</td>
                                                    <td style={{ padding: '10px' }}>{ch}</td>
                                                    <td style={{ padding: '10px' }}>{row.sent ?? 0}</td>
                                                    <td style={{ padding: '10px' }}>{row.failed ?? 0}</td>
                                                    <td style={{ padding: '10px' }}>{row.pending ?? 0}</td>
                                                </tr>
                                            )),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
