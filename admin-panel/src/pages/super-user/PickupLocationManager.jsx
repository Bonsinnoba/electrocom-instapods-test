import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Save } from 'lucide-react';
import {
  fetchPickupLocationsAdmin,
  createPickupLocation,
  updatePickupLocation,
  deletePickupLocation
} from '../../services/api';

const emptyForm = { name: '', address: '', city: '', fee: 0, is_active: true };

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
              {['Name', 'Address', 'City', 'Fee', 'Active', 'Actions'].map((h) => (
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
                <td style={{ padding: '10px 16px' }}><input className="input-field" type="number" step="0.01" min="0" value={loc.fee} onChange={(e) => setLocations((prev) => prev.map((x) => x.id === loc.id ? { ...x, fee: e.target.value } : x))} /></td>
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
              <tr><td colSpan={6} style={{ padding: '20px' }}><div className="empty-state"><MapPin size={16} style={{ marginRight: '8px' }} /> No pickup locations yet.</div></td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
