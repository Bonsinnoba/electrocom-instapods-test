import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Save, Info } from 'lucide-react';
import {
  fetchPickupLocationsAdmin,
  createPickupLocation,
  updatePickupLocation,
  deletePickupLocation
} from '../../services/api';

const emptyForm = { name: '', address: '', city: '', fee: 0, latitude: '', longitude: '', contact_person: '', contact_phone: '', pickup_instructions: '', what_to_bring: '', id_requirements: '', pickup_deadline_days: 7, is_active: true };

// Helper function to convert DMS format to decimal degrees
// Example: "10°02'06.6\"N" -> 10.03513
const dmsToDecimal = (dmsString) => {
  if (!dmsString) return '';
  
  // Try to parse DMS format like "10°02'06.6"N" or "2°30'35.2"W"
  const regex = /(\d+)°(\d+)'([\d.]+)"([NSEW])/i;
  const match = dmsString.match(regex);
  
  if (match) {
    const degrees = parseFloat(match[1]);
    const minutes = parseFloat(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4].toUpperCase();
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    
    // South and West are negative
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal.toFixed(8);
  }
  
  // If not DMS format, return as-is (might already be decimal)
  return dmsString;
};

export default function PickupLocationManager() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setInitialLoading(true);
    const res = await fetchPickupLocationsAdmin();
    if (res.success) setLocations(res.data || []);
    setInitialLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.address) return;
    setLoading(true);
    const res = await createPickupLocation(form);
    setLoading(false);
    if (res.success) {
      setForm(emptyForm);
      load();
    }
  };

  const handleUpdate = async (loc) => {
    setSavingId(loc.id);
    await updatePickupLocation({ ...loc, fee: Number(loc.fee || 0) });
    setSavingId(null);
    load();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    await deletePickupLocation(id);
    setDeletingId(null);
    load();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '6px' }}>Pickup Locations</h1>
          <p className="page-subtitle">Manage pickup points and fees used at checkout.</p>
        </div>
      </header>

      <div className="card glass" style={{ display: 'grid', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Add Pickup Location</h3>
        <input className="input-field" placeholder="Location name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input-field" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input className="input-field" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input-field" type="number" step="0.01" min="0" placeholder="Pickup fee (GHS)" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input 
            className="input-field" 
            type="text" 
            step="0.00000001" 
            placeholder="Latitude (optional)" 
            value={form.latitude} 
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            onBlur={(e) => {
              const converted = dmsToDecimal(e.target.value);
              if (converted && converted !== e.target.value) {
                setForm({ ...form, latitude: converted });
              }
            }}
          />
          <input 
            className="input-field" 
            type="text" 
            step="0.00000001" 
            placeholder="Longitude (optional)" 
            value={form.longitude} 
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            onBlur={(e) => {
              const converted = dmsToDecimal(e.target.value);
              if (converted && converted !== e.target.value) {
                setForm({ ...form, longitude: converted });
              }
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input className="input-field" placeholder="Contact Person (optional)" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <input className="input-field" placeholder="Contact Phone (optional)" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </div>
        <textarea 
          className="input-field" 
          placeholder="Pickup Instructions (e.g., process, hours, etc.)" 
          value={form.pickup_instructions} 
          onChange={(e) => setForm({ ...form, pickup_instructions: e.target.value })}
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
        <textarea 
          className="input-field" 
          placeholder="What to Bring (e.g., ID, order number, payment proof)" 
          value={form.what_to_bring} 
          onChange={(e) => setForm({ ...form, what_to_bring: e.target.value })}
          style={{ minHeight: '60px', resize: 'vertical' }}
        />
        <textarea 
          className="input-field" 
          placeholder="ID Requirements (e.g., valid national ID required)" 
          value={form.id_requirements} 
          onChange={(e) => setForm({ ...form, id_requirements: e.target.value })}
          style={{ minHeight: '60px', resize: 'vertical' }}
        />
        <input 
          className="input-field" 
          type="number" 
          min="1" 
          placeholder="Pickup Deadline (days)" 
          value={form.pickup_deadline_days} 
          onChange={(e) => setForm({ ...form, pickup_deadline_days: e.target.value })}
        />
        <div style={{ 
          background: 'rgba(59, 130, 246, 0.1)', 
          border: '1px solid rgba(59, 130, 246, 0.3)', 
          borderRadius: '8px', 
          padding: '12px', 
          fontSize: '13px', 
          color: 'var(--text-main)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <Info size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Coordinate Format:</strong> Enter decimal degrees (e.g., 5.6833, -0.1667).<br />
            <strong>Google Maps Format:</strong> You can paste DMS format like "10°02'06.6"N 2°30'35.2"W" and it will auto-convert.<br />
            <strong>Tip:</strong> Right-click any location in Google Maps and copy coordinates for precise positioning.
          </div>
        </div>
        <button className="btn-primary" disabled={loading} onClick={handleCreate} style={{ width: 'fit-content' }}>
          <Plus size={16} /> Add Location
        </button>
      </div>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        {initialLoading ? (
          <div className="loading-state" style={{ height: '140px' }}>Loading pickup locations...</div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              {['Name', 'Address', 'City', 'Contact', 'Phone', 'Lat', 'Lng', 'Fee', 'Deadline', 'Active', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '10px 16px' }}><input className="input-field" value={loc.name} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, name: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}><input className="input-field" value={loc.address} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, address: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}><input className="input-field" value={loc.city || ''} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, city: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}><input className="input-field" placeholder="Contact" value={loc.contact_person || ''} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, contact_person: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}><input className="input-field" placeholder="Phone" value={loc.contact_phone || ''} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, contact_phone: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}><input 
                  className="input-field" 
                  type="text" 
                  step="0.00000001" 
                  placeholder="Latitude" 
                  value={loc.latitude || ''} 
                  onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, latitude: e.target.value } : x))}
                  onBlur={(e) => {
                    const converted = dmsToDecimal(e.target.value);
                    if (converted && converted !== e.target.value) {
                      setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, latitude: converted } : x));
                    }
                  }}
                /></td>
                <td style={{ padding: '10px 16px' }}><input 
                  className="input-field" 
                  type="text" 
                  step="0.00000001" 
                  placeholder="Longitude" 
                  value={loc.longitude || ''} 
                  onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, longitude: e.target.value } : x))}
                  onBlur={(e) => {
                    const converted = dmsToDecimal(e.target.value);
                    if (converted && converted !== e.target.value) {
                      setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, longitude: converted } : x));
                    }
                  }}
                /></td>
                <td style={{ padding: '10px 16px' }}><input className="input-field" type="number" step="0.01" min="0" value={loc.fee} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, fee: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}><input className="input-field" type="number" min="1" placeholder="Days" value={loc.pickup_deadline_days || 7} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, pickup_deadline_days: e.target.value } : x))} /></td>
                <td style={{ padding: '10px 16px' }}>
                  <input type="checkbox" checked={Boolean(Number(loc.is_active))} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, is_active: e.target.checked ? 1 : 0 } : x))} />
                </td>
                <td style={{ padding: '10px 16px', display: 'flex', gap: '8px' }}>
                  <button className="btn" onClick={() => handleUpdate(loc)} disabled={savingId === loc.id}>
                    {savingId === loc.id ? 'Saving...' : <Save size={14} />}
                  </button>
                  <button className="btn" onClick={() => handleDelete(loc.id)} disabled={deletingId === loc.id}>
                    {deletingId === loc.id ? 'Deleting...' : <Trash2 size={14} />}
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr><td colSpan={11} style={{ padding: '20px' }}><div className="empty-state"><MapPin size={16} style={{ marginRight: '8px' }} /> No pickup locations yet.</div></td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
