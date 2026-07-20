import React from 'react';
import { X, ShieldAlert, Loader, Trash2, FileSearch, Database } from 'lucide-react';

export default function MaintenanceModal({ 
  show, 
  onClose, 
  loading, 
  stats, 
  onAction 
}) {
  if (!show) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '32px', borderRadius: '24px', background: 'var(--bg-surface)', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={24} color="#ef4444" /> System Maintenance
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {loading && !stats ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Loader className="spin" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-main)', padding: '16px', borderRadius: '16px' }}>
                <div style={{ fontSize: '13px' }}><div style={{ color: 'var(--text-muted)' }}>Messages</div><strong>{stats.total_messages}</strong></div>
                <div style={{ fontSize: '13px' }}><div style={{ color: 'var(--text-muted)' }}>Attachments</div><strong>{stats.with_attachments}</strong></div>
                <div style={{ fontSize: '13px' }}><div style={{ color: 'var(--text-muted)' }}>Traffic Logs</div><strong>{stats.traffic_logs}</strong></div>
                <div style={{ fontSize: '13px' }}><div style={{ color: 'var(--text-muted)' }}>Oldest Msg</div><strong>{stats.oldest_message ? new Date(stats.oldest_message).toLocaleDateString() : 'N/A'}</strong></div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => onAction('prune', { days: 180 })}
                className="btn-warn"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}
              >
                <Trash2 size={18} /> Prune Messages (&gt; 180 days)
              </button>
              <button 
                onClick={() => onAction('clean_orphans')}
                className="btn-secondary"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}
              >
                <FileSearch size={18} /> Cleanup Orphan Files
              </button>
              <button 
                onClick={() => onAction('clear_traffic')}
                className="btn-danger"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}
              >
                <Database size={18} /> Clear Traffic Logs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
