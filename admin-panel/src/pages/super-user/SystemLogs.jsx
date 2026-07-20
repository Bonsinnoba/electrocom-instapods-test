import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, RefreshCw, Trash2, Download, Filter,
  AlertTriangle, Info, CheckCircle, XCircle, Search,
  ChevronDown, Clock, Database, FileText, Plus, User
} from 'lucide-react';
import { fetchLogs, clearLogs, deleteLogDay, fetchBackups, createBackup, deleteBackup, API_BASE_URL, fetchBatch } from '../../services/api';
import { useConfirm } from '../../context/ConfirmContext';



const LEVEL_STYLE = {
  error:   { bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)',   color: '#ef4444',  Icon: XCircle,      label: 'ERROR' },
  warn:    { bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)',  color: '#f59e0b',  Icon: AlertTriangle, label: 'WARN' },
  info:    { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',   color: '#60a5fa',  Icon: Info,          label: 'INFO' },
  success: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',    color: '#22c55e',  Icon: CheckCircle,   label: 'OK' },
};



export default function SystemLogs() {
  const { confirm } = useConfirm();
  const [tab, setTab]               = useState('logs');
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [levelFilter, setLevel]     = useState('all');
  const [autoRefresh, setAuto]      = useState(false);
  const [backups, setBackups]       = useState([]);
  const [backingUp, setBackingUp]   = useState(false);
  const intervalRef                 = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchBatch(['logs']);
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
        const data = await fetchBatch(['backups']);
        if (data.backups) setBackups(data.backups);
    } catch (e) {
        console.error("Failed to load backups", e);
    }
  };

  useEffect(() => {
    load();
    loadBackups();
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 10000);
    }
  }, [autoRefresh]);

  const clearAll = async () => {
    if (!(await confirm("Are you sure you want to wipe ALL log entries?"))) return;
    setLogs([]);
    try {
      await clearLogs();
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteDay = async (dateStr) => {
    if (!(await confirm(`Are you sure you want to delete logs for ${dateStr}?`))) return;
    try {
      const res = await deleteLogDay(dateStr);
      if (res.success) {
        load();
      } else {
        alert(res.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
        const res = await createBackup();
        if (res.success) {
            alert(res.message);
            loadBackups();
            load(); // reload logs to see the "backup created" event
        }
    } catch (e) {
        alert(e.message);
    } finally {
        setBackingUp(false);
    }
  };

  const handleDeleteBackup = async (file) => {
    if (!(await confirm(`Delete backup ${file}?`))) return;
    try {
        const res = await deleteBackup(file);
        if (res.success) loadBackups();
    } catch (e) {
        alert(e.message);
    }
  };

  const downloadLogs = () => {
    const text = logs.map(l => `[${l.ts}] [${l.level.toUpperCase()}] [${l.source}] ${l.msg}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `system-logs-${Date.now()}.txt` });
    a.click(); URL.revokeObjectURL(url);
  };

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    return (levelFilter === 'all' || l.level === levelFilter) &&
      (l.msg?.toLowerCase().includes(q) || l.source?.toLowerCase().includes(q));
  });

  const groupedLogs = (filtered || []).reduce((acc, log) => {
    if (!log || !log.ts) return acc;
    const dateStr = log.ts.split(' ')[0]; // Group by YYYY-MM-DD
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(log);
    return acc;
  }, {});

  const counts = { 
    total: (logs || []).length, 
    error: (logs || []).filter(l => l && l.level === 'error').length, 
    warn: (logs || []).filter(l => l && l.level === 'warn').length 
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Terminal size={32} color="var(--primary-gold)" />
            System Control
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
            Centralised event stream and database management hub.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={downloadLogs} style={{ padding: '10px 16px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Download size={15} /> Export Logs
          </button>
          <button onClick={clearAll} style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Trash2 size={15} /> Clear Logs
          </button>
          <button
            onClick={tab === 'logs' ? load : loadBackups}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </header>

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Events', value: counts.total, col: '#94a3b8' },
          { label: 'Errors',       value: counts.error,  col: '#ef4444' },
          { label: 'Warnings',     value: counts.warn,   col: '#f59e0b' },
          { label: 'DB Backups',   value: backups.length, col: '#8b5cf6' },
          { label: 'Showing',      value: tab === 'logs' ? filtered.length : backups.length, col: 'var(--primary-gold)' },
        ].map((s, i) => (
          <div key={i} className="card glass" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: s.col }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '0' }}>
        <button onClick={() => setTab('logs')} style={{
            display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '10px 10px 0 0', border: 'none',
            background: tab === 'logs' ? 'var(--bg-surface)' : 'transparent', color: tab === 'logs' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer', borderBottom: tab === 'logs' ? '2px solid var(--primary-gold)' : '2px solid transparent',
            transition: 'all 0.2s'
        }}><Terminal size={15}/> Log Stream</button>
        <button onClick={() => setTab('backups')} style={{
            display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '10px 10px 0 0', border: 'none',
            background: tab === 'backups' ? 'var(--bg-surface)' : 'transparent', color: tab === 'backups' ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: '13px', cursor: 'pointer', borderBottom: tab === 'backups' ? '2px solid var(--primary-gold)' : '2px solid transparent',
            transition: 'all 0.2s'
        }}><Database size={15}/> DB Backups</button>
      </div>

      {tab === 'logs' ? (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter logs…"
                style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }}
              />
            </div>
            <select value={levelFilter} onChange={e => setLevel(e.target.value)} style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              <option value="all">All Levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: autoRefresh ? 'var(--primary-gold)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAuto(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--primary-gold)', cursor: 'pointer' }} />
              Auto (10s)
            </label>
          </div>

          <div className="card glass" style={{ padding: '0', overflow: 'hidden', fontFamily: "'Outfit', monospace" }}>
            {/* Terminal top bar */}
            <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: '12px', height: '12px', borderRadius: '50%', background: c }} />)}
              <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>app-core — system.log</span>
            </div>

            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading events…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>No matching log entries.</div>
            ) : (
              <div style={{ maxHeight: '560px', overflowY: 'auto', padding: '8px 0' }}>
                {Object.entries(groupedLogs).map(([dateKey, dateLogs], groupIndex) => {
                  const displayDate = new Date(dateKey).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  return (
                  <div key={dateKey}>
                    <div style={{
                      padding: '8px 20px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      borderTop: groupIndex > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                      position: 'sticky',
                      top: '-8px',
                      zIndex: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{displayDate}</span>
                      <button 
                        onClick={() => deleteDay(dateKey)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title={`Delete logs for ${displayDate}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {dateLogs.map((log, i) => {
                      const s = LEVEL_STYLE[log.level] || LEVEL_STYLE.info;
                      return (
                        <div key={log.id ?? i} style={{
                          display: 'flex', gap: '14px', alignItems: 'flex-start',
                          padding: '10px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          transition: 'background 0.15s'
                        }}>
                          {/* Level badge */}
                          <div style={{ padding: '3px 8px', borderRadius: '6px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '10px', fontWeight: 900, letterSpacing: '0.5px', flexShrink: 0, width: '58px', textAlign: 'center', marginTop: '1px' }}>
                            {s.label}
                          </div>
                          {/* Source */}
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary-gold)', minWidth: '80px', flexShrink: 0, paddingTop: '2px' }}>
                            [{log.source}]
                          </div>
                          {/* Request Context */}
                          {log.context && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }} title={log.context}>
                              {log.context}
                            </div>
                          )}
                          {/* IP */}
                          {log.ip && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 0' }}>
                              {log.ip}
                            </div>
                          )}
                          {/* User ID Badge */}
                          {log.uid && (
                            <div style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              background: 'rgba(139,92,246,0.1)', 
                              border: '1px solid rgba(139,92,246,0.2)', 
                              color: '#a78bfa', 
                              fontSize: '10px', 
                              fontWeight: 700, 
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '1px'
                            }}>
                              <User size={10} />
                              ID:{log.uid}
                            </div>
                          )}
                          {/* Message */}
                          <div style={{ flex: 1, fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', paddingRight: '10px' }}>{log.msg}</div>
                          {/* Timestamp */}
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, paddingTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} />
                            {new Date(log.ts).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* BACKUPS TABLE */
        <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Database size={20} color="var(--primary-gold)" />
                    <span style={{ fontWeight: 800 }}>Database Snapshots</span>
                </div>
                <button 
                  onClick={handleCreateBackup}
                  disabled={backingUp}
                  className="btn-primary" 
                  style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '7px' }}
                >
                    {backingUp ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={14} />}
                    {backingUp ? 'Dumping DB…' : 'Create New Backup'}
                </button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <tr>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Name</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Size</th>
                        <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {backups.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>No backups found. Snapshots are stored in /api/backups.</td></tr>
                    ) : backups.map(b => (
                        <tr key={b.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: '13px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FileText size={16} color="#94a3b8" />
                                    {b.name}
                                </div>
                            </td>
                            <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-muted)' }}>{b.date}</td>
                            <td style={{ padding: '14px 20px', fontSize: '13px' }}>{(b.size / 1024).toFixed(1)} KB</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <a 
                                      href={`${API_BASE_URL}/super_backup.php?action=download&file=${b.name}&token=${localStorage.getItem('ehub_token')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
                                      title="Download SQL"
                                    >
                                        <Download size={14} />
                                    </a>
                                    <button 
                                      onClick={() => handleDeleteBackup(b.name)}
                                      style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                                      title="Delete Snapshot"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
