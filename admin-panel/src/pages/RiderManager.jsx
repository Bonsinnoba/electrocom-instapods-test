import React, { useState, useEffect } from 'react';
import { Bike, Plus, X, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { fetchRiders, createRider, updateRider, setRiderStatus, deleteRider, fetchShippingZones } from '../services/api';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)',
  outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)',
};

const STATUS_COLORS = {
  available: { bg: 'var(--success-bg)', color: 'var(--success)' },
  on_delivery: { bg: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' },
  offline: { bg: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' },
};

const EMPTY_FORM = { id: null, name: '', phone: '', vehicle_type: 'motorcycle', default_zone_id: '' };

export default function RiderManager() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const canAccess = user?.role === 'store_manager' || user?.role === 'super';

  const [riders, setRiders] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    const [ridersRes, zonesRes] = await Promise.all([fetchRiders(), fetchShippingZones()]);
    if (ridersRes.success) setRiders(ridersRes.data);
    else addToast(ridersRes.message || 'Failed to load riders', 'error');
    if (zonesRes.success) setZones(zonesRes.data);
    setLoading(false);
  };

  useEffect(() => { if (canAccess) load(); }, []);

  const openModal = (rider = null) => {
    setFormData(rider ? { ...rider, default_zone_id: rider.default_zone_id || '' } : EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = formData.id ? await updateRider(formData.id, formData) : await createRider(formData);
    if (res.success) { addToast(`Rider ${formData.id ? 'updated' : 'added'}`, 'success'); setIsModalOpen(false); load(); }
    else addToast(res.message || 'Save failed', 'error');
  };

  const handleStatus = async (id, status) => {
    const res = await setRiderStatus(id, status);
    if (res.success) { addToast('Status updated', 'success'); load(); }
    else addToast(res.message || 'Update failed', 'error');
  };

  const handleDelete = async (id) => {
    if (!(await confirm('Remove this rider?'))) return;
    const res = await deleteRider(id);
    if (res.success) { addToast('Rider removed', 'success'); load(); }
    else addToast(res.message || 'Delete failed', 'error');
  };

  if (!canAccess) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>You don't have access to this page.</div>;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bike size={32} color="var(--primary-blue)" /> Delivery Fleet
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Self-owned riders available for door-to-door delivery</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Rider
        </button>
      </div>

      <div style={{ background: 'var(--bg-main)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                {['Rider', 'Vehicle', 'Zone', 'Active Deliveries', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riders.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{r.name}<div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.phone}</div></td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.vehicle_type}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{r.zone_name || '-'}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{r.active_shipments}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <select value={r.status} onChange={e => handleStatus(r.id, e.target.value)}
                      style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, border: 'none', ...STATUS_COLORS[r.status] }}>
                      <option value="available">Available</option>
                      <option value="on_delivery">On Delivery</option>
                      <option value="offline">Offline</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                    <button className="btn-outline" onClick={() => openModal(r)} style={{ padding: '6px' }}><Edit2 size={16} /></button>
                    <button className="btn-outline" onClick={() => handleDelete(r.id)} style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {riders.length === 0 && !loading && (
                <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No riders added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Rider' : 'Add Rider'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input required type="text" placeholder="Full name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} />
              <input required type="text" placeholder="Phone number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={inputStyle} />
              <select value={formData.vehicle_type} onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })} style={inputStyle}>
                <option value="bike">Bike</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
              <select value={formData.default_zone_id} onChange={e => setFormData({ ...formData, default_zone_id: e.target.value })} style={inputStyle}>
                <option value="">No default zone</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
