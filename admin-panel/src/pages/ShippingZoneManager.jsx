import React, { useState, useEffect } from 'react';
import { MapPin, Plus, X, Trash2, Edit2 } from 'lucide-react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { fetchShippingZones, createShippingZone, updateShippingZone, deleteShippingZone } from '../services/api';

// Fix for default marker icons in React Leaflet (same as CustomerManager.jsx)
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)',
  outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)',
};

const EMPTY_FORM = { id: null, name: '', region: '', center_lat: '', center_lng: '', radius_km: 5, base_fee: 15, per_km_fee: 2, is_active: true };

function MapClickCapture({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function ShippingZoneManager() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  const canAccess = user?.role === 'store_manager' || user?.role === 'super';

  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    const res = await fetchShippingZones();
    if (res.success) setZones(res.data);
    else addToast(res.message || 'Failed to load zones', 'error');
    setLoading(false);
  };

  useEffect(() => { if (canAccess) load(); }, []);

  const openModal = (zone = null) => {
    setFormData(zone ? { ...zone } : EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = formData.id ? await updateShippingZone(formData.id, formData) : await createShippingZone(formData);
    if (res.success) { addToast(`Zone ${formData.id ? 'updated' : 'created'}`, 'success'); setIsModalOpen(false); load(); }
    else addToast(res.message || 'Save failed', 'error');
  };

  const handleDelete = async (id) => {
    if (!(await confirm('Delete this zone? Riders assigned to it will be unassigned.'))) return;
    const res = await deleteShippingZone(id);
    if (res.success) { addToast('Zone deleted', 'success'); load(); }
    else addToast(res.message || 'Delete failed', 'error');
  };

  if (!canAccess) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>You don't have access to this page.</div>;
  }

  const mappable = zones.filter(z => z.center_lat && z.center_lng);
  const mapCenter = mappable.length ? [parseFloat(mappable[0].center_lat), parseFloat(mappable[0].center_lng)] : [5.6037, -0.1870]; // Accra

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapPin size={32} color="var(--primary-blue)" /> Shipping Zones
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Self-fleet coverage areas. Deliveries outside every zone fall back to the flat regional rate.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> New Zone
        </button>
      </div>

      <div style={{ height: '360px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
        <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {mappable.map(z => (
            <Circle key={z.id} center={[parseFloat(z.center_lat), parseFloat(z.center_lng)]} radius={parseFloat(z.radius_km) * 1000}
              pathOptions={{ color: z.is_active ? '#3b82f6' : '#94a3b8', fillOpacity: 0.15 }} />
          ))}
        </MapContainer>
      </div>

      <div style={{ background: 'var(--bg-main)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                {['Zone', 'Radius', 'Base Fee', 'Per KM', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{z.name}<div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{z.region}</div></td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>{z.radius_km ? `${z.radius_km} km` : '-'}</td>
                  <td style={{ padding: '16px 20px' }}>GH₵ {parseFloat(z.base_fee).toFixed(2)}</td>
                  <td style={{ padding: '16px 20px' }}>GH₵ {parseFloat(z.per_km_fee).toFixed(2)}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, background: z.is_active ? 'var(--success-bg)' : 'var(--bg-surface-secondary)', color: z.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                      {z.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                    <button className="btn-outline" onClick={() => openModal(z)} style={{ padding: '6px' }}><Edit2 size={16} /></button>
                    <button className="btn-outline" onClick={() => handleDelete(z.id)} style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {zones.length === 0 && !loading && (
                <tr><td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No zones configured yet - deliveries currently use the flat regional fallback.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setIsModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Zone' : 'New Zone'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>Click the map to set the zone center.</p>
            <div style={{ height: '220px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
              <MapContainer center={formData.center_lat ? [parseFloat(formData.center_lat), parseFloat(formData.center_lng)] : mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap &copy; CARTO' />
                <MapClickCapture onPick={(lat, lng) => setFormData(f => ({ ...f, center_lat: lat.toFixed(6), center_lng: lng.toFixed(6) }))} />
                {formData.center_lat && formData.center_lng && (
                  <Circle center={[parseFloat(formData.center_lat), parseFloat(formData.center_lng)]} radius={(parseFloat(formData.radius_km) || 0) * 1000} pathOptions={{ color: '#3b82f6', fillOpacity: 0.2 }} />
                )}
              </MapContainer>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input required type="text" placeholder="Zone name, e.g. Osu / East Legon" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} />
              <input type="text" placeholder="Region (fallback matching if no coordinates)" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <input type="number" step="0.000001" placeholder="Lat" value={formData.center_lat} onChange={e => setFormData({ ...formData, center_lat: e.target.value })} style={inputStyle} />
                <input type="number" step="0.000001" placeholder="Lng" value={formData.center_lng} onChange={e => setFormData({ ...formData, center_lng: e.target.value })} style={inputStyle} />
                <input type="number" step="0.1" placeholder="Radius (km)" value={formData.radius_km} onChange={e => setFormData({ ...formData, radius_km: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Base Fee (GH₵)</label>
                  <input type="number" step="0.01" value={formData.base_fee} onChange={e => setFormData({ ...formData, base_fee: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Per KM Fee (GH₵)</label>
                  <input type="number" step="0.01" value={formData.per_km_fee} onChange={e => setFormData({ ...formData, per_km_fee: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="zoneActive" checked={!!formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--primary-blue)' }} />
                <label htmlFor="zoneActive" style={{ fontSize: '14px', fontWeight: 600 }}>Zone is active</label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Zone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
