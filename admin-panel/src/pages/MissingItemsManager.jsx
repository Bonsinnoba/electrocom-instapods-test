import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  fetchMissingItemsReports,
  resolveMissingItemsReport,
  reopenMissingItemsReport,
  requestCustomerMissingItemConfirmation,
} from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export default function MissingItemsManager() {
  const { addToast } = useNotifications();
  const [status, setStatus] = useState('open');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ open: 0, resolved: 0 });

  const user = JSON.parse(localStorage.getItem('ehub_user') || '{}');
  const canResolve = ['super', 'store_manager'].includes(user.role);

  const load = async () => {
    setLoading(true);
    const res = await fetchMissingItemsReports(status, limit);
    if (res.success) {
      setRows(res.data || []);
      setSummary(res.summary || { open: 0, resolved: 0 });
    } else {
      addToast(res.message || 'Failed to load missing-item reports', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [status, limit]);

  const resolveOne = async (id) => {
    if (!canResolve) return;
    const note = window.prompt('Resolution note (optional):', 'Substitution approved and picker informed');
    if (note === null) return;
    setActionLoading(true);
    const res = await resolveMissingItemsReport(id, String(note || '').trim());
    if (res.success) {
      addToast('Missing-item report resolved', 'success');
      await load();
    } else {
      addToast(res.message || 'Failed to resolve report', 'error');
    }
    setActionLoading(false);
  };

  const requestCustomerConfirm = async (id) => {
    if (!canResolve) return;
    setActionLoading(true);
    const res = await requestCustomerMissingItemConfirmation(id);
    if (res.success) {
      addToast('Customer notified by in-app, SMS and email', 'success');
      await load();
    } else {
      addToast(res.message || 'Failed to request customer confirmation', 'error');
    }
    setActionLoading(false);
  };

  const reopenOne = async (id) => {
    if (!canResolve) return;
    setActionLoading(true);
    const res = await reopenMissingItemsReport(id);
    if (res.success) {
      addToast('Missing-item report reopened', 'success');
      await load();
    } else {
      addToast(res.message || 'Failed to reopen report', 'error');
    }
    setActionLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header>
        <h1 style={{ fontSize: '32px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={28} color="var(--warning)" /> Missing Items Queue
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Track products pickers could not find and close the loop quickly.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card glass" style={{ padding: '18px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Open reports</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--warning)' }}>{summary.open || 0}</div>
        </div>
        <div className="card glass" style={{ padding: '18px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Resolved reports</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--success)' }}>{summary.resolved || 0}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input-premium" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select className="input-premium" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
          <option value={250}>250 rows</option>
        </select>
        <button className="btn btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading reports...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 16px' }}>Order</th>
                  <th style={{ padding: '14px 16px' }}>Item</th>
                  <th style={{ padding: '14px 16px' }}>Qty</th>
                  <th style={{ padding: '14px 16px' }}>Reason</th>
                  <th style={{ padding: '14px 16px' }}>Reported By</th>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                  <th style={{ padding: '14px 16px' }}>Customer Action</th>
                  <th style={{ padding: '14px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '16px', color: 'var(--text-muted)' }}>No reports for this filter.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary-blue)' }}>{`ORD-${r.order_id}`}</td>
                    <td style={{ padding: '14px 16px' }}>{r.product_name}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>{r.qty_missing}</td>
                    <td style={{ padding: '14px 16px', maxWidth: '260px' }}>{r.reason || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>{r.reported_by_name || 'Staff'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: r.status === 'resolved' ? 'var(--success-bg)' : 'var(--warning-bg)',
                        color: r.status === 'resolved' ? 'var(--success)' : 'var(--warning)',
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {r.customer_action ? r.customer_action.replace('_', ' ') : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {canResolve ? (
                        r.status === 'open' ? (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={() => requestCustomerConfirm(r.id)} disabled={actionLoading} style={{ padding: '6px 10px', fontSize: '11px' }}>
                              Ask Customer In App
                            </button>
                            <button className="btn btn-secondary" onClick={() => resolveOne(r.id)} disabled={actionLoading} style={{ padding: '6px 10px', fontSize: '11px' }}>
                              <CheckCircle2 size={12} /> Resolve Only
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-secondary" onClick={() => reopenOne(r.id)} disabled={actionLoading} style={{ padding: '6px 10px', fontSize: '11px' }}>
                            <RotateCcw size={12} /> Reopen
                          </button>
                        )
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
