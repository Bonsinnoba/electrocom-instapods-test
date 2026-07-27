import React, { useState, useEffect } from 'react';
import { FileText, X, Plus, Trash2, Send, Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  fetchQuoteRequests, fetchQuoteRequest, setQuoteRequestStatus,
  createQuote, voidQuote,
} from '../services/api';

const STATUS_COLORS = {
  draft: { bg: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' },
  submitted: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  under_review: { bg: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' },
  quoted: { bg: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' },
  accepted: { bg: 'var(--success-bg)', color: 'var(--success)' },
  rejected: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  expired: { bg: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' },
};

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)',
  outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)',
};

export default function QuoteManager() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const canAccess = user?.role === 'sales' || user?.role === 'super';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [buildMode, setBuildMode] = useState(false);

  const [quoteForm, setQuoteForm] = useState({
    items: [], discount: 0, tax: 0, payment_terms: 'due_on_receipt', valid_until: '', terms_notes: '',
  });

  const load = async () => {
    setLoading(true);
    const res = await fetchQuoteRequests(statusFilter || undefined);
    if (res.success) setRequests(res.data);
    else addToast(res.message || 'Failed to load quote requests', 'error');
    setLoading(false);
  };

  useEffect(() => { if (canAccess) load(); }, [statusFilter]);

  const openDetail = async (id) => {
    const res = await fetchQuoteRequest(id);
    if (res.success) {
      setDetail(res.data);
      setQuoteForm({
        items: res.data.items.map(i => ({ product_id: i.product_id, description: i.product_name || i.notes || '', quantity: i.quantity, unit_price: i.product_price || 0 })),
        discount: 0, tax: 0, payment_terms: 'due_on_receipt', valid_until: '', terms_notes: '',
      });
      setBuildMode(false);
    } else {
      addToast(res.message || 'Failed to load request', 'error');
    }
  };

  const handleSetStatus = async (id, status) => {
    const res = await setQuoteRequestStatus(id, status);
    if (res.success) { addToast('Status updated', 'success'); load(); openDetail(id); }
    else addToast(res.message || 'Update failed', 'error');
  };

  const updateItem = (idx, field, value) => {
    const items = [...quoteForm.items];
    items[idx] = { ...items[idx], [field]: value };
    setQuoteForm({ ...quoteForm, items });
  };

  const addItem = () => setQuoteForm({ ...quoteForm, items: [...quoteForm.items, { product_id: null, description: '', quantity: 1, unit_price: 0 }] });
  const removeItem = (idx) => setQuoteForm({ ...quoteForm, items: quoteForm.items.filter((_, i) => i !== idx) });

  const subtotal = quoteForm.items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - (parseFloat(quoteForm.discount) || 0) + (parseFloat(quoteForm.tax) || 0));

  const handleSendQuote = async (e) => {
    e.preventDefault();
    if (quoteForm.items.length === 0) { addToast('Add at least one item', 'error'); return; }
    const res = await createQuote({ quote_request_id: detail.id, ...quoteForm });
    if (res.success) {
      addToast('Quote sent to institution', 'success');
      openDetail(detail.id);
    } else {
      addToast(res.message || 'Failed to send quote', 'error');
    }
  };

  const handleVoid = async (quoteId) => {
    if (!(await confirm('Void this quote? The institution will no longer be able to accept it.'))) return;
    const res = await voidQuote(quoteId);
    if (res.success) { addToast('Quote voided', 'success'); openDetail(detail.id); }
    else addToast(res.message || 'Failed to void quote', 'error');
  };

  if (!canAccess) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>You don't have access to this page.</div>;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 32px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={32} color="var(--primary-blue)" /> Institutional Quotes
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Review RFQs and build priced quotes for institutions</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', 'submitted', 'under_review', 'quoted', 'accepted', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'btn-primary' : 'btn-outline'} style={{ padding: '8px 16px', fontSize: '13px' }}>
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-main)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                {['Institution', 'Submitted By', 'Items', 'Status', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }} onClick={() => openDetail(r.id)}>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{r.institution_name}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{r.submitted_by_name}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{r.item_count}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, ...STATUS_COLORS[r.status] }}>{r.status.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td></td>
                </tr>
              ))}
              {requests.length === 0 && !loading && (
                <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No quote requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '680px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>{detail.institution_name}</h2>
              <button onClick={() => setDetail(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, ...STATUS_COLORS[detail.status] }}>{detail.status.replace('_', ' ')}</span>

            {detail.status === 'submitted' && (
              <button className="btn-outline" style={{ marginLeft: '10px', fontSize: '12px', padding: '4px 10px' }} onClick={() => handleSetStatus(detail.id, 'under_review')}>
                Mark Under Review
              </button>
            )}

            {detail.notes && <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>"{detail.notes}"</p>}

            <h3 style={{ fontSize: '15px', fontWeight: 700, marginTop: '20px', marginBottom: '10px' }}>Requested Items</h3>
            {detail.items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: '14px' }}>
                <span>{i.product_name || 'Custom item'} {i.notes ? `(${i.notes})` : ''}</span>
                <span style={{ color: 'var(--text-muted)' }}>Qty: {i.quantity}</span>
              </div>
            ))}

            {detail.quotes && detail.quotes.length > 0 && (
              <>
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginTop: '20px', marginBottom: '10px' }}>Quotes Sent</h3>
                {detail.quotes.map(q => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>GH₵ {parseFloat(q.total).toFixed(2)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({q.status})</span></div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sent {new Date(q.created_at).toLocaleDateString()}{q.valid_until ? ` · valid until ${q.valid_until}` : ''}</div>
                    </div>
                    {q.status === 'sent' && (
                      <button className="btn-outline" onClick={() => handleVoid(q.id)} style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Void">
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            {!['accepted', 'rejected', 'expired'].includes(detail.status) && (
              <>
                {!buildMode ? (
                  <button className="btn-primary" style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setBuildMode(true)}>
                    <Plus size={16} /> Build a Quote
                  </button>
                ) : (
                  <form onSubmit={handleSendQuote} style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Line Items</h3>
                    {quoteForm.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 100px 30px', gap: '8px', marginBottom: '8px' }}>
                        <input placeholder="Description" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} style={inputStyle} required />
                        <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={inputStyle} required />
                        <input type="number" step="0.01" placeholder="Unit price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} style={inputStyle} required />
                        <button type="button" onClick={() => removeItem(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={addItem} className="btn-outline" style={{ fontSize: '12px', padding: '6px 12px', marginBottom: '16px' }}>+ Add line</button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Discount (GH₵)</label>
                        <input type="number" step="0.01" value={quoteForm.discount} onChange={e => setQuoteForm({ ...quoteForm, discount: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Tax (GH₵)</label>
                        <input type="number" step="0.01" value={quoteForm.tax} onChange={e => setQuoteForm({ ...quoteForm, tax: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Payment Terms</label>
                        <select value={quoteForm.payment_terms} onChange={e => setQuoteForm({ ...quoteForm, payment_terms: e.target.value })} style={inputStyle}>
                          <option value="due_on_receipt">Due on Receipt</option>
                          <option value="net_15">Net 15</option>
                          <option value="net_30">Net 30</option>
                          <option value="net_60">Net 60</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Valid Until</label>
                        <input type="date" value={quoteForm.valid_until} onChange={e => setQuoteForm({ ...quoteForm, valid_until: e.target.value })} style={inputStyle} />
                      </div>
                    </div>
                    <textarea placeholder="Terms notes (optional)" value={quoteForm.terms_notes} onChange={e => setQuoteForm({ ...quoteForm, terms_notes: e.target.value })} style={{ ...inputStyle, minHeight: '60px', marginBottom: '16px' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800 }}>Total: GH₵ {total.toFixed(2)}</div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="btn-secondary" onClick={() => setBuildMode(false)}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={16} /> Send Quote</button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
