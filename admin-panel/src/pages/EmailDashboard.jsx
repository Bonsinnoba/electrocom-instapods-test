import React, { useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, RotateCcw, Ban, Download, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  fetchEmailDashboard,
  retryAllFailedEmails,
  retryEmailQueueIds,
  cancelEmailQueueIds,
} from '../services/api';

const badgeStyle = (status) => {
  const map = {
    pending: { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    retrying: { bg: 'rgba(234,179,8,0.14)', color: '#facc15' },
    sent: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
    failed: { bg: 'rgba(239,68,68,0.14)', color: '#f87171' },
    cancelled: { bg: 'rgba(148,163,184,0.16)', color: '#cbd5e1' },
  };
  const t = map[status] || map.pending;
  return {
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    background: t.bg,
    color: t.color,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
};

export default function EmailDashboard() {
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState('pending');
  const [limit, setLimit] = useState(100);
  const [data, setData] = useState({
    overview: {},
    by_provider: {},
    queue: [],
    recent_failures: [],
  });
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => {
    setLoading(true);
    const res = await fetchEmailDashboard({ status, days, limit });
    if (res.success) {
      setData(res.data || {});
    } else {
      addToast(res.message || 'Failed to load email dashboard', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [status, days, limit]);

  const queueRows = data?.queue || [];
  const allSelected = queueRows.length > 0 && selectedIds.length === queueRows.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(queueRows.map((r) => Number(r.id)));
  };

  const toggleSelectOne = (id) => {
    const n = Number(id);
    setSelectedIds((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      return [...prev, n];
    });
  };

  const runBulkRetry = async () => {
    if (selectedIds.length === 0) return;
    if (!(await confirm(`Retry ${selectedIds.length} selected email job(s)?`))) return;
    setActionLoading(true);
    const res = await retryEmailQueueIds(selectedIds);
    if (res.success) {
      addToast(`Re-queued ${res.affected_rows ?? 0} selected jobs`, 'success');
      setSelectedIds([]);
      await load();
    } else {
      addToast(res.message || 'Retry failed', 'error');
    }
    setActionLoading(false);
  };

  const runBulkCancel = async () => {
    if (selectedIds.length === 0) return;
    if (!(await confirm(`Cancel ${selectedIds.length} selected queued job(s)?`))) return;
    setActionLoading(true);
    const res = await cancelEmailQueueIds(selectedIds);
    if (res.success) {
      addToast(`Cancelled ${res.affected_rows ?? 0} selected jobs`, 'success');
      setSelectedIds([]);
      await load();
    } else {
      addToast(res.message || 'Cancel failed', 'error');
    }
    setActionLoading(false);
  };

  const runRetryFailed = async () => {
    if (!(await confirm('Re-queue all failed email jobs?'))) return;
    setActionLoading(true);
    const res = await retryAllFailedEmails();
    if (res.success) {
      addToast(`Re-queued ${res.retried_rows ?? 0} failed jobs`, 'success');
      await load();
    } else {
      addToast(res.message || 'Retry failed', 'error');
    }
    setActionLoading(false);
  };

  const exportQueueCsv = () => {
    if (!queueRows.length) {
      addToast('No queue rows to export', 'warning');
      return;
    }

    const headers = [
      'id',
      'recipient_email',
      'template_key',
      'subject',
      'status',
      'attempts',
      'max_attempts',
      'scheduled_at',
      'sent_at',
      'processed_at',
      'created_at',
      'last_error',
    ];
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const bodyRows = queueRows.map((row) => headers.map((h) => csvEscape(row[h])).join(','));
    const csv = [headers.join(','), ...bodyRows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-queue-${status}-${days}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Queue exported to CSV', 'success');
  };

  const overview = data?.overview || {};
  const providers = data?.by_provider || {};
  const trend = data?.trend || [];
  const trendMax = Math.max(1, ...trend.map((r) => Math.max(Number(r.sent || 0), Number(r.failed || 0))));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={26} /> Email Engine Dashboard
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '14px' }}>
            Monitor queue health, provider outcomes, and recover failed email jobs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input-premium" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select className="input-premium" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="retrying">Retrying</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="input-premium" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={250}>250 rows</option>
          </select>
          <button className="btn btn-secondary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={runRetryFailed} disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={15} /> Retry all failed
          </button>
          <button className="btn btn-secondary" onClick={exportQueueCsv} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/super/settings')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={15} /> Provider Settings
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px' }}>
        {['pending', 'retrying', 'sent', 'failed', 'cancelled'].map((k) => (
          <div key={k} className="card glass" style={{ padding: '14px 16px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '6px' }}>{overview[k] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="card glass" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '10px' }}>Provider performance</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px' }}>Provider</th>
              <th style={{ padding: '8px' }}>Sent</th>
              <th style={{ padding: '8px' }}>Failed</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(providers).length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '10px', color: 'var(--text-muted)' }}>No provider log data in selected window.</td></tr>
            ) : Object.entries(providers).map(([provider, row]) => (
              <tr key={provider} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '10px', fontWeight: 700 }}>{provider}</td>
                <td style={{ padding: '10px' }}>{row.sent ?? 0}</td>
                <td style={{ padding: '10px' }}>{row.failed ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card glass" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '10px' }}>Delivery trend (daily)</h3>
        {trend.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No trend data in selected window.</p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: '6px' }}>
            {trend.map((row) => {
              const sent = Number(row.sent || 0);
              const failed = Number(row.failed || 0);
              const sentHeight = Math.max(2, Math.round((sent / trendMax) * 120));
              const failedHeight = Math.max(2, Math.round((failed / trendMax) * 120));
              return (
                <div key={row.day} style={{ minWidth: '40px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', height: '130px' }}>
                    <div title={`Sent: ${sent}`} style={{ width: '12px', height: `${sentHeight}px`, background: '#22c55e', borderRadius: '4px 4px 0 0' }} />
                    <div title={`Failed: ${failed}`} style={{ width: '12px', height: `${failedHeight}px`, background: '#ef4444', borderRadius: '4px 4px 0 0' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {String(row.day).slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} /> Sent
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} /> Failed
          </span>
        </div>
      </div>

      <div className="card glass" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '10px' }}>Recent failures</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>ID</th>
                <th style={{ padding: '8px' }}>Recipient</th>
                <th style={{ padding: '8px' }}>Provider</th>
                <th style={{ padding: '8px' }}>Error</th>
                <th style={{ padding: '8px' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_failures || []).length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '10px', color: 'var(--text-muted)' }}>No recent failures in this window.</td></tr>
              ) : (data?.recent_failures || []).map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px', fontWeight: 700 }}>{row.id}</td>
                  <td style={{ padding: '8px' }}>{row.recipient_email}</td>
                  <td style={{ padding: '8px' }}>{row.provider || '—'}</td>
                  <td style={{ padding: '8px', maxWidth: '420px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.error_message || ''}>
                    {row.error_message || '—'}
                  </td>
                  <td style={{ padding: '8px' }}>{row.created_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card glass" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Queue entries</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={runBulkRetry} disabled={actionLoading || selectedIds.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RotateCcw size={14} /> Retry selected
            </button>
            <button className="btn btn-danger" onClick={runBulkCancel} disabled={actionLoading || selectedIds.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Ban size={14} /> Cancel selected
            </button>
          </div>
        </div>

        {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading queue…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </th>
                  <th style={{ padding: '8px' }}>ID</th>
                  <th style={{ padding: '8px' }}>Recipient</th>
                  <th style={{ padding: '8px' }}>Template</th>
                  <th style={{ padding: '8px' }}>Status</th>
                  <th style={{ padding: '8px' }}>Attempts</th>
                  <th style={{ padding: '8px' }}>Scheduled</th>
                  <th style={{ padding: '8px' }}>Last Error</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '12px', color: 'var(--text-muted)' }}>No queue rows for this filter.</td></tr>
                ) : queueRows.map((row) => (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(Number(row.id))}
                        onChange={() => toggleSelectOne(row.id)}
                      />
                    </td>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{row.id}</td>
                    <td style={{ padding: '8px' }}>{row.recipient_email}</td>
                    <td style={{ padding: '8px' }}>{row.template_key}</td>
                    <td style={{ padding: '8px' }}><span style={badgeStyle(row.status)}>{row.status}</span></td>
                    <td style={{ padding: '8px' }}>{row.attempts}/{row.max_attempts}</td>
                    <td style={{ padding: '8px' }}>{row.scheduled_at || '—'}</td>
                    <td style={{ padding: '8px', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.last_error || ''}>
                      {row.last_error || '—'}
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
