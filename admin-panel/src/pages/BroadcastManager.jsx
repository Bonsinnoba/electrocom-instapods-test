import React, { useState } from 'react';
import { Send, Users, Mail, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { sendBroadcast, API_BASE_URL } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

export default function BroadcastManager() {
    const { addToast } = useNotifications();
    const { confirm } = useConfirm();
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

    React.useEffect(() => {
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

    const handleSubmit = async (e) => {
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

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <header>
                <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Broadcast Tool</h1>
                <p style={{ color: 'var(--text-muted)' }}>Send mass notifications to your customers via Email or SMS.</p>
            </header>

            <div className="grid-responsive" style={{ gridTemplateColumns: '1fr 350px', gap: '32px', alignItems: 'start' }}>
                <div className="card glass" style={{ padding: '32px' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
        </div>
    );
}
