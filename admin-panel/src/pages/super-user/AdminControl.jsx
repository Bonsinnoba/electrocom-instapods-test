import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Shield, ShieldOff, Search, Trash2,
  CheckCircle, XCircle, RefreshCw, UserCog, ChevronDown,
  Crown, AlertTriangle, Eye, ShieldCheck, ShieldAlert,
  Download
} from 'lucide-react';
import { 
  fetchCustomers as getUsers, 
  setUserRole as updateRole, 
  toggleUserStatus as toggleStatus, 
  deleteCustomer as deleteUser,
  generateReportToken,
  API_BASE_URL
} from '../../services/api';

const ROLE_STYLE = {
  super:        { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  color: '#fca5a5', label: 'SUPER' },
  store_manager:{ bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', color: '#fbbf24', label: 'MGR' },
  picker:       { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)', color: '#38bdf8', label: 'PICKER' },
  accountant:   { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#4ade80', label: 'ACCT' },
  marketing:    { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)', color: '#c084fc', label: 'MKTG' },
  customer:     { bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)', color: '#94a3b8', label: 'CUST' },
};

const STATUS_STYLE = {
  Active:    { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#22c55e' },
  Suspended: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: '#ef4444' },
};

function Badge({ label, style }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800,
      background: style.bg, border: `1px solid ${style.border}`, color: style.color,
      textTransform: 'uppercase', letterSpacing: '0.5px'
    }}>{label}</span>
  );
}

export default function AdminControl() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busy, setBusy]       = useState({}); // tracks per-row loading
  const [confirm, setConfirm] = useState(null); // { type, user }

  const [activeTab, setActiveTab] = useState('users');
  const [archives, setArchives] = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);

  const loadArchives = async () => {
    setArchivesLoading(true);
    try {
      const token = localStorage.getItem('ehub_token');
      const res = await fetch(`${API_BASE_URL}/admin_reports_list.php`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setArchives(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setArchivesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'archives') loadArchives();
  }, [activeTab]);

  const currentUser = JSON.parse(localStorage.getItem('ehub_user') || '{}');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const uRes = await getUsers();
      setUsers(uRes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  }), [users, search, roleFilter]);

  const withBusy = async (id, fn) => {
    setBusy(p => ({ ...p, [id]: true }));
    try { await fn(); await load(); }
    catch (e) { alert(e.message); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  const handleDelete  = (u) => setConfirm({ type: 'delete', user: u });
  const handleConfirm = async () => {
    if (!confirm) return;
    const { type, user } = confirm;
    setConfirm(null);
    if (type === 'delete') {
      await withBusy(user.id, () => deleteUser(user.id));
    }
  };

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => ['super', 'store_manager', 'picker', 'accountant', 'marketing'].includes(u.role)).length,
    customers: users.filter(u => u.role === 'customer').length,
    suspended: users.filter(u => u.status === 'Suspended').length,
  }), [users]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '6px' }}>Admin Control</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Manage all users, roles, and account statuses system-wide.</p>
      </header>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)' }}>
        <button 
          onClick={() => setActiveTab('users')}
          style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '3px solid var(--primary-color, #3b82f6)' : '3px solid transparent', color: activeTab === 'users' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          User Management
        </button>
        <button 
          onClick={() => setActiveTab('archives')}
          style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'archives' ? '3px solid var(--primary-color, #3b82f6)' : '3px solid transparent', color: activeTab === 'archives' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Archived Reports
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Users',  value: counts.total,     icon: <Users size={18} />,   col: '#3b82f6' },
          { label: 'Admins',       value: counts.admins,    icon: <Crown size={18} />,   col: 'var(--primary-gold)' },
          { label: 'Customers',    value: counts.customers, icon: <Users size={18} />,   col: '#22c55e' },
          { label: 'Suspended',    value: counts.suspended, icon: <XCircle size={18} />, col: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="card glass" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '9px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: s.col }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 900 }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            style={{
              width: '100%', padding: '11px 14px 11px 40px', borderRadius: '10px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '14px', outline: 'none'
            }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '11px 16px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          <option value="all">All Roles</option>
          <option value="super">Super Admins</option>
          <option value="store_manager">Store Managers</option>
          <option value="picker">Pickers</option>
          <option value="accountant">Accountants</option>
          <option value="marketing">Marketing</option>
          <option value="customer">Customers</option>
        </select>
        <button 
          onClick={async () => {
            try {
              const res = await generateReportToken();
              if (res && res.success && res.dl_token) {
                window.open(`${API_BASE_URL}/admin_staff_report.php?dl_token=${encodeURIComponent(res.dl_token)}`, '_blank');
              } else {
                alert(res?.message || "Failed to generate temporary download token.");
              }
            } catch (e) {
              console.error(e);
              alert("An error occurred while generating download token.");
            }
          }}
          style={{ padding: '11px 18px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <Download size={15} /> Weekly Staff Report
        </button>
        <button onClick={load} className="btn-primary" style={{ padding: '11px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading users…</div>
      ) : error ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: '#ef4444' }}>
          <AlertTriangle size={28} style={{ marginBottom: '10px' }} />
          <div style={{ fontWeight: 700 }}>{error}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Check API connectivity and super_token.</div>
        </div>
      ) : (
        <div className="card glass" style={{ overflow: 'hidden', padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No users match your search.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {['User', 'Role', 'Status', 'Orders', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => {
                  const roleStyle   = ROLE_STYLE[user.role] || ROLE_STYLE.customer;
                  const statusStyle = STATUS_STYLE[user.status] || STATUS_STYLE.Active;
                  const isBusy      = !!busy[user.id];
                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: isBusy ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#000', fontSize: '14px', flexShrink: 0 }}>
                            {user.avatar_text || user.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {user.name}
                              {user.id_verified == 1 ? (
                                <ShieldCheck size={14} color="#22c55e" title="Identity Verified" />
                              ) : user.id_number ? (
                                <ShieldAlert size={14} color="#f59e0b" title="Verification Pending" />
                              ) : null}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <select 
                          value={user.role} 
                          onChange={(e) => withBusy(user.id, () => updateRole(user.id, e.target.value))}
                          disabled={isBusy || (user.role === 'super' && user.id === currentUser?.id)}
                          style={{ 
                            background: roleStyle.bg, border: `1px solid ${roleStyle.border}`, color: roleStyle.color,
                            padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', outline: 'none'
                          }}
                        >
                          {Object.keys(ROLE_STYLE).map(r => (
                            <option key={r} value={r} style={{ background: 'var(--bg-surface)', color: 'var(--text-main)' }}>{ROLE_STYLE[r].label}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: '16px 20px' }}><Badge label={user.status || 'Active'} style={statusStyle} /></td>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>{user.orders_count || 0}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Toggle Status */}
                          <button
                            disabled={isBusy}
                            onClick={() => withBusy(user.id, () => toggleStatus(user.id, user.status || 'Active'))}
                            title={user.status === 'Suspended' ? 'Activate account' : 'Suspend account'}
                            style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: user.status === 'Suspended' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.3)', background: user.status === 'Suspended' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: user.status === 'Suspended' ? '#22c55e' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            {user.status === 'Suspended' ? <><CheckCircle size={13} /> Activate</> : <><XCircle size={13} /> Suspend</>}
                          </button>
                          {/* Delete */}
                          <button
                            disabled={isBusy || user.role === 'super'}
                            onClick={() => handleDelete(user)}
                            style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
        </>
      )}

      {activeTab === 'archives' && (
        <div className="card glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900 }}>Archived Weekly Reports</h2>
            <button onClick={loadArchives} disabled={archivesLoading} className="btn-primary" style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} className={archivesLoading ? 'spin' : ''} /> Refresh Archive
            </button>
          </div>
          {archivesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading archives…</div>
          ) : archives.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No archived reports found. Reports are generated automatically at the start of each week.</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {archives.map(arch => (
                <div key={arch.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px', textTransform: 'capitalize' }}>{arch.filename.replace('.csv', '').replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generated: {new Date(arch.created_at).toLocaleString()} • Size: {(arch.size / 1024).toFixed(2)} KB</div>
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        const res = await generateReportToken();
                        if (res && res.success && res.dl_token) {
                          window.open(`${API_BASE_URL}/admin_staff_report.php?file=${encodeURIComponent(arch.filename)}&dl_token=${encodeURIComponent(res.dl_token)}`, '_blank');
                        } else {
                          alert(res?.message || "Failed to generate temporary download token.");
                        }
                      } catch (e) {
                        console.error(e);
                        alert("An error occurred while generating download token.");
                      }
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} /> Download CSV
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(6px)' }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontWeight: 900, marginBottom: '10px' }}>Confirm Delete</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Are you sure you want to permanently delete <strong>{confirm.user.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirm} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Delete User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
