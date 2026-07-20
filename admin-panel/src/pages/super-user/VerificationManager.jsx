import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, CheckCircle, XCircle, 
  Eye, Search, RefreshCw, AlertTriangle, Clock,
  FileText, User, Mail, Phone
} from 'lucide-react';
import { fetchVerificationRequests, approveVerification, rejectVerification } from '../../services/api';

const STATUS_STYLE = {
  pending: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b', label: 'PENDING' },
  verified: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: '#22c55e', label: 'VERIFIED' },
};

export default function VerificationManager() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVerificationRequests();
      setRequests(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = requests.filter(r => 
    r.name?.toLowerCase().includes(search.toLowerCase()) || 
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.id_number?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = async (id) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const res = await approveVerification(id, 'Verified by Admin');
      if (res.success) {
        setRequests(prev => prev.filter(r => r.id !== id));
        setSelectedRequest(null);
      } else {
        alert(res.message || 'Approval failed');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReject = async () => {
    if (isBusy || !selectedRequest || !rejectReason.trim()) return;
    setIsBusy(true);
    try {
      const res = await rejectVerification(selectedRequest.id, rejectReason);
      if (res.success) {
        setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
        setSelectedRequest(null);
        setShowRejectForm(false);
        setRejectReason('');
      } else {
        alert(res.message || 'Rejection failed');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '6px' }}>Identity Verification</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Review and approve user Ghana Card uploads to verify their identities.</p>
      </header>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or ID number..."
            style={{
              width: '100%', padding: '12px 14px 12px 40px', borderRadius: '12px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)', color: 'var(--text-main)', outline: 'none'
            }}
          />
        </div>
        <button onClick={load} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px' }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRequest ? '1fr 400px' : '1fr', gap: '24px', transition: 'all 0.3s' }}>
        {/* Main List */}
        <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" style={{ marginBottom: '12px' }} />
              <div>Scanning for requests...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
              <AlertTriangle size={32} style={{ marginBottom: '12px' }} />
              <div>{error}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <h3>All caught up!</h3>
              <p>No pending verification requests found.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Details</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => (
                  <tr 
                    key={req.id} 
                    onClick={() => setSelectedRequest(req)}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.03)', 
                      cursor: 'pointer', 
                      background: selectedRequest?.id === req.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                          {req.name?.[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{req.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{req.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-gold)' }}>{req.id_number}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> Pending Review
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                        <Eye size={14} style={{ marginRight: '6px' }} /> View Document
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sidebar Detail */}
        {selectedRequest && (
          <div className="animate-slide-in-right">
            <div className="card glass sticky" style={{ top: '24px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Request Details</h3>
                <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <XCircle size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                   <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}><User size={18} /></div>
                   <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Full Name</div>
                      <div style={{ fontWeight: 600 }}>{selectedRequest.name}</div>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                   <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}><Mail size={18} /></div>
                   <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Email</div>
                      <div style={{ fontSize: '13px' }}>{selectedRequest.email}</div>
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)', color: 'var(--primary-gold)' }}><FileText size={18} /></div>
                   <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Ghana Card #</div>
                      <div style={{ fontWeight: 700, color: 'var(--primary-gold)' }}>{selectedRequest.id_number}</div>
                   </div>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>DOCUMENT PREVIEW</div>
                <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border-light)', background: '#000' }}>
                  {selectedRequest.id_photo ? (
                    <img 
                      src={selectedRequest.id_photo} 
                      alt="ID Document" 
                      style={{ width: '100%', display: 'block' }} 
                      onClick={() => window.open(selectedRequest.id_photo, '_blank')}
                    />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <ShieldAlert size={32} style={{ marginBottom: '8px' }} />
                      <div>No Image Data</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>Click image to view full size</div>
              </div>

              {!showRejectForm ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button 
                    className="btn-primary" 
                    disabled={isBusy}
                    onClick={() => handleApprove(selectedRequest.id)}
                    style={{ flex: 1, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button 
                    className="btn-secondary" 
                    disabled={isBusy}
                    onClick={() => setShowRejectForm(true)}
                    style={{ flex: 1, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                  >
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in" style={{ padding: '16px', background: 'rgba(239,68,68,0.05)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#ef4444' }}>Rejection Reason</div>
                  <textarea 
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Tell the user why their document was rejected (e.g. Blurry photo, expired card)..."
                    style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'white', fontSize: '13px', outline: 'none', marginBottom: '12px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleReject} disabled={isBusy || !rejectReason.trim()} className="btn-primary" style={{ flex: 1, height: '36px', background: '#ef4444', borderColor: '#ef4444' }}>Submit Rejection</button>
                    <button onClick={() => setShowRejectForm(false)} disabled={isBusy} className="btn-secondary" style={{ flex: 1, height: '36px' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
