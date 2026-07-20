import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, RotateCcw } from 'lucide-react';
import { fetchDeliveryAnalytics, retryFailedNotificationQueue } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

export default function BroadcastDeliveryAnalytics() {
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetchDeliveryAnalytics(days);
    if (res.success) setData(res.data);
    else addToast(res.message || 'Failed to load analytics', 'error');
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [days]);

  const handleRetryAll = async () => {
    if (!(await confirm('Re-queue all failed email/SMS jobs? The worker will pick them up on the next run.'))) return;
    setRetrying(true);
    const res = await retryFailedNotificationQueue();
    if (res.success) addToast(`Re-queued ${res.retried_rows ?? 0} jobs`, 'success');
    else addToast(res.message || 'Retry failed', 'error');
    setRetrying(false);
    load();
  };

  const byChannel = data?.by_channel || {};
  const byRole = data?.by_role_segment || {};

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={26} /> Delivery analytics
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
            Sent / delivered / failed for queued channels. <strong>Delivered</strong> matches queue status <code>sent</code> (provider receipts are not stored).
            In-app promos: {data?.in_app_broadcast_rows ?? '—'} rows in period.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select className="input-premium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={handleRetryAll} disabled={retrying} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={16} /> Retry failed queue
          </button>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
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
  );
}
