import React, { useState, useEffect } from 'react';
import { Building2, Plus, X, CheckCircle, Ban, UserPlus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  fetchInstitutions, fetchInstitution, createInstitution, updateInstitution,
  setInstitutionStatus, addInstitutionContact, removeInstitutionContact,
} from '../services/api';

const STATUS_COLORS = {
  pending: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  verified: { bg: 'var(--success-bg)', color: 'var(--success)' },
  suspended: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
};

const TYPE_LABELS = { school: 'School', hospital: 'Hospital', corporate: 'Corporate', government: 'Government', ngo: 'NGO', other: 'Other' };

export default function InstitutionManager() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const canAccess = user?.role === 'sales' || user?.role === 'super';

  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactTitle, setContactTitle] = useState('');

  const [formData, setFormData] = useState({
    id: null, name: '', type: 'other', tax_id: '', billing_address: '', phone: '', email: '', notes: '',
  });

  const load = async () => {
    setLoading(true);
    const res = await fetchInstitutions(statusFilter || undefined);
    if (res.success) setInstitutions(res.data);
    else addToast(res.message || 'Failed to load institutions', 'error');
    setLoading(false);
  };

  useEffect(() => { if (canAccess) load(); }, [statusFilter]);

  const openDetail = async (id) => {
    const res = await fetchInstitution(id);
    if (res.success) setDetail(res.data);
    else addToast(res.message || 'Failed to load institution', 'error');
  };

  const openModal = (inst = null) => {
    setFormData(inst ? { ...inst } : { id: null, name: '', type: 'other', tax_id: '', billing_address: '', phone: '', email: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = formData.id ? await updateInstitution(formData.id, formData) : await createInstitution(formData);
    if (res.success) {
      addToast(`Institution ${formData.id ? 'updated' : 'created'}`, 'success');
      setIsModalOpen(false);
      load();
    } else {
      addToast(res.message || 'Save failed', 'error');
    }
  };

  const handleSetStatus = async (id, status) => {
    if (status === 'suspended' && !(await confirm('Suspend this institution? They will not be able to submit new quote requests.'))) return;
    const res = await setInstitutionStatus(id, status);
    if (res.success) {
      addToast('Status updated', 'success');
      load();
      if (detail?.id === id) openDetail(id);
    } else {
      addToast(res.message || 'Update failed', 'error');
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!contactEmail) return;
    const res = await addInstitutionContact(detail.id, contactEmail, contactTitle, false);
    if (res.success) {
      addToast('Contact linked', 'success');
      setContactEmail(''); setContactTitle('');
      openDetail(detail.id);
    } else {
      addToast(res.message || 'Could not add contact', 'error');
    }
  };

  const handleRemoveContact = async (contactId) => {
    if (!(await confirm('Remove this contact from the institution?'))) return;
    const res = await removeInstitutionContact(contactId);
    if (res.success) { addToast('Contact removed', 'success'); openDetail(detail.id); }
    else addToast(res.message || 'Failed to remove contact', 'error');
  };

  if (!canAccess) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>You don't have access to this page.</div>;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Building2 size={32} color="var(--primary-blue)" /> Institutions
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Manage institutional (B2B) accounts and their quote requests</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Institution
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['', 'pending', 'verified', 'suspended'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={statusFilter === s ? 'btn-primary' : 'btn-outline'}
            style={{ padding: '8px 16px', fontSize: '13px' }}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-main)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                {['Name', 'Type', 'Status', 'Requests', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {institutions.map(inst => (
                <tr key={inst.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 600 }} onClick={() => openDetail(inst.id)}>{inst.name}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{TYPE_LABELS[inst.type] || inst.type}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, ...STATUS_COLORS[inst.status] }}>
                      {inst.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{inst.quote_request_count}</td>
                  <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                    {inst.status !== 'verified' && (
                      <button className="btn-outline" title="Verify" onClick={() => handleSetStatus(inst.id, 'verified')} style={{ padding: '6px', color: 'var(--success)', borderColor: 'var(--success)' }}>
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {inst.status !== 'suspended' && (
                      <button className="btn-outline" title="Suspend" onClick={() => handleSetStatus(inst.id, 'suspended')} style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                        <Ban size={16} />
                      </button>
                    )}
                    <button className="btn-outline" title="View" onClick={() => openDetail(inst.id)} style={{ padding: '6px' }}>
                      <Users size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {institutions.length === 0 && !loading && (
                <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No institutions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Institution' : 'Add Institution'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle} placeholder="e.g. Accra General Hospital" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Type</label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={inputStyle}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Tax ID</label>
                <input type="text" value={formData.tax_id} onChange={e => setFormData({ ...formData, tax_id: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Billing Address</label>
                <textarea value={formData.billing_address} onChange={e => setFormData({ ...formData, billing_address: e.target.value })} style={{ ...inputStyle, minHeight: '70px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Internal Notes</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ ...inputStyle, minHeight: '60px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / contacts drawer */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>{detail.name}</h2>
              <button onClick={() => setDetail(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, ...STATUS_COLORS[detail.status] }}>{detail.status}</span>

            <h3 style={{ fontSize: '15px', fontWeight: 700, marginTop: '24px', marginBottom: '12px' }}>Contacts</h3>
            {(detail.contacts || []).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name} {c.is_primary ? <span style={{ fontSize: '11px', color: 'var(--primary-blue)' }}>(primary)</span> : null}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{c.email} {c.title ? `· ${c.title}` : ''}</div>
                </div>
                <button className="btn-outline" onClick={() => handleRemoveContact(c.id)} style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {(!detail.contacts || detail.contacts.length === 0) && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No contacts linked yet.</p>
            )}

            <form onSubmit={handleAddContact} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <input type="email" required placeholder="Existing user's email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
              <input type="text" placeholder="Title (optional)" value={contactTitle} onChange={e => setContactTitle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button type="submit" className="btn-primary" style={{ padding: '10px 14px' }}><UserPlus size={16} /></button>
            </form>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              The person must already have a customer account with this email - this links them, it doesn't create one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)',
  outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)',
};
