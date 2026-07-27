import React, { useState, useEffect } from 'react';
import { Truck, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  fetchShipments, createSelfFleetShipment, createCarrierShipment,
  assignRiderToShipment, updateShipmentStatus, fetchRiders,
} from '../services/api';

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)',
  outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)',
};

const STATUS_OPTIONS = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled'];

const STATUS_COLORS = {
  pending: { bg: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' },
  assigned: { bg: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' },
  picked_up: { bg: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' },
  in_transit: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  out_for_delivery: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  delivered: { bg: 'var(--success-bg)', color: 'var(--success)' },
  failed: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
  cancelled: { bg: 'var(--danger-bg)', color: 'var(--danger)' },
};

export default function ShipmentsDashboard() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const canAccess = user?.role === 'store_manager' || user?.role === 'super';

  const [shipments, setShipments] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [providerType, setProviderType] = useState('self_fleet');

  const [selfForm, setSelfForm] = useState({ order_id: '', dest_region: '', dest_address: '' });
  const [carrierForm, setCarrierForm] = useState({ order_id: '', carrier_name: '', tracking_number: '', cost: '', dest_address: '' });

  const load = async () => {
    setLoading(true);
    const [shipRes, riderRes] = await Promise.all([fetchShipments(statusFilter || undefined), fetchRiders()]);
    if (shipRes.success) setShipments(shipRes.data);
    else addToast(shipRes.message || 'Failed to load shipments', 'error');
    if (riderRes.success) setRiders(riderRes.data.filter(r => r.status === 'available'));
    setLoading(false);
  };

  useEffect(() => { if (canAccess) load(); }, [statusFilter]);

  const handleAssign = async (shipmentId, riderId) => {
    if (!riderId) return;
    const res = await assignRiderToShipment(shipmentId, riderId);
    if (res.success) { addToast('Rider assigned', 'success'); load(); }
    else addToast(res.message || 'Assignment failed', 'error');
  };

  const handleStatusChange = async (shipmentId, status) => {
    const res = await updateShipmentStatus(shipmentId, status);
    if (res.success) { addToast('Status updated', 'success'); load(); }
    else addToast(res.message || 'Update failed', 'error');
  };

  const handleCreateSelf = async (e) => {
    e.preventDefault();
    const res = await createSelfFleetShipment(selfForm);
    if (res.success) { addToast('Self-fleet shipment created', 'success'); setIsModalOpen(false); setSelfForm({ order_id: '', dest_region: '', dest_address: '' }); load(); }
    else addToast(res.message || 'Failed to create shipment', 'error');
  };

  const handleCreateCarrier = async (e) => {
    e.preventDefault();
    const res = await createCarrierShipment(carrierForm);
    if (res.success) { addToast('Carrier shipment recorded', 'success'); setIsModalOpen(false); setCarrierForm({ order_id: '', carrier_name: '', tracking_number: '', cost: '', dest_address: '' }); load(); }
    else addToast(res.message || 'Failed to record shipment', 'error');
  };

  if (!canAccess) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>You don't have access to this page.</div>;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Truck size={32} color="var(--primary-blue)" /> Shipments
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Track and assign deliveries across self-fleet and carrier orders</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> New Shipment
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['', ...STATUS_OPTIONS].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'btn-primary' : 'btn-outline'} style={{ padding: '8px 16px', fontSize: '12px' }}>
            {s === '' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-main)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                {['Order', 'Provider', 'Tracking', 'Rider / Carrier', 'Cost', 'Status', 'Assign'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>#{s.order_id}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.provider_type.replace('_', ' ')}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>{s.tracking_number || '-'}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{s.rider_name || s.carrier_name || (s.zone_name ? `Zone: ${s.zone_name}` : '-')}</td>
                  <td style={{ padding: '16px 20px' }}>GH₵ {parseFloat(s.cost || 0).toFixed(2)}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <select value={s.status} onChange={e => handleStatusChange(s.id, e.target.value)}
                      style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, border: 'none', ...STATUS_COLORS[s.status] }}>
                      {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {s.provider_type === 'self_fleet' && !['delivered', 'cancelled', 'failed'].includes(s.status) ? (
                      <select defaultValue="" onChange={e => handleAssign(s.id, e.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: '13px' }}>
                        <option value="">Assign rider...</option>
                        {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && !loading && (
                <tr><td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No shipments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>New Shipment</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button className={providerType === 'self_fleet' ? 'btn-primary' : 'btn-outline'} onClick={() => setProviderType('self_fleet')} style={{ flex: 1, padding: '10px' }}>Self-Fleet</button>
              <button className={providerType === 'carrier' ? 'btn-primary' : 'btn-outline'} onClick={() => setProviderType('carrier')} style={{ flex: 1, padding: '10px' }}>Carrier</button>
            </div>

            {providerType === 'self_fleet' ? (
              <form onSubmit={handleCreateSelf} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input required type="number" placeholder="Order ID" value={selfForm.order_id} onChange={e => setSelfForm({ ...selfForm, order_id: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="Destination region (fallback matching)" value={selfForm.dest_region} onChange={e => setSelfForm({ ...selfForm, dest_region: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="Destination address" value={selfForm.dest_address} onChange={e => setSelfForm({ ...selfForm, dest_address: e.target.value })} style={inputStyle} />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Zone and cost are matched automatically based on the destination.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Create</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateCarrier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input required type="number" placeholder="Order ID" value={carrierForm.order_id} onChange={e => setCarrierForm({ ...carrierForm, order_id: e.target.value })} style={inputStyle} />
                <input required type="text" placeholder="Carrier name (e.g. fedex, dhl)" value={carrierForm.carrier_name} onChange={e => setCarrierForm({ ...carrierForm, carrier_name: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="Tracking number (from carrier's own portal)" value={carrierForm.tracking_number} onChange={e => setCarrierForm({ ...carrierForm, tracking_number: e.target.value })} style={inputStyle} />
                <input type="number" step="0.01" placeholder="Cost" value={carrierForm.cost} onChange={e => setCarrierForm({ ...carrierForm, cost: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="Destination address" value={carrierForm.dest_address} onChange={e => setCarrierForm({ ...carrierForm, dest_address: e.target.value })} style={inputStyle} />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  No live carrier API is wired in yet - book the shipment on the carrier's own site/portal first, then log it here for tracking.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Record Shipment</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
