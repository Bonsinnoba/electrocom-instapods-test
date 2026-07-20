import React, { useState, useEffect, useMemo } from 'react';
import { Package, Save, CheckSquare, Square } from 'lucide-react';
import { fetchProducts, bulkUpdateShelving, formatImageUrl } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export default function BulkShelvingTool() {
  const { addToast } = useNotifications();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({});
  const [filterCat, setFilterCat] = useState('All');
  const [aisle, setAisle] = useState('');
  const [rack, setRack] = useState('');
  const [bin, setBin] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    load();
  }, []);

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.category || 'Uncategorized'));
    return ['All', ...Array.from(s).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    if (filterCat === 'All') return products;
    return products.filter((p) => (p.category || 'Uncategorized') === filterCat);
  }, [products, filterCat]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]).map(Number), [selected]);

  const toggleAllVisible = () => {
    const allOn = filtered.length > 0 && filtered.every((p) => selected[p.id]);
    const next = { ...selected };
    filtered.forEach((p) => {
      next[p.id] = !allOn;
    });
    setSelected(next);
  };

  const toggleOne = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      addToast('Select at least one product', 'error');
      return;
    }
    const hasStruct = [aisle, rack, bin].some((v) => String(v || '').trim());
    if (hasStruct && (!String(aisle).trim() || !String(rack).trim() || !String(bin).trim())) {
      addToast('Aisle, Rack, and Bin must all be set together (or leave all empty and use Location only).', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await bulkUpdateShelving({
        product_ids: selectedIds,
        aisle,
        rack,
        bin,
        location,
      });
      if (res.success) {
        addToast(`Updated shelving for ${res.updated ?? selectedIds.length} products`, 'success');
        setSelected({});
        const data = await fetchProducts();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        addToast(res.error || res.message || 'Update failed', 'error');
      }
    } catch (e) {
      addToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Package className="animate-pulse" size={40} />
        <p>Loading catalog…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card glass" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Package size={22} /> Bulk shelf reassignment
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
          Set Aisle / Rack / Bin together (format: alphanumeric, e.g. A1, R2, B03). Optional legacy Location applies to all selected rows.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <input className="input-premium" placeholder="Aisle" value={aisle} onChange={(e) => setAisle(e.target.value)} />
          <input className="input-premium" placeholder="Rack" value={rack} onChange={(e) => setRack(e.target.value)} />
          <input className="input-premium" placeholder="Bin" value={bin} onChange={(e) => setBin(e.target.value)} />
          <input className="input-premium" placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Save size={18} /> Apply to {selectedIds.length} selected
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontWeight: 700, fontSize: '13px' }}>Category</label>
        <select className="input-premium" value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ maxWidth: 220 }}>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={toggleAllVisible} style={{ fontSize: '12px' }}>
          {filtered.length > 0 && filtered.every((p) => selected[p.id]) ? 'Clear visible' : 'Select visible'}
        </button>
      </div>

      <div className="table-container card glass" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '12px', width: 40 }} />
              <th style={{ padding: '12px' }}>Product</th>
              <th style={{ padding: '12px' }}>Code</th>
              <th style={{ padding: '12px' }}>Aisle</th>
              <th style={{ padding: '12px' }}>Rack</th>
              <th style={{ padding: '12px' }}>Bin</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '10px' }}>
                  <button type="button" aria-label="toggle" onClick={() => toggleOne(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-blue)' }}>
                    {selected[p.id] ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                </td>
                <td style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {p.image_url && (
                    <img src={formatImageUrl(p.image_url)} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8 }} />
                  )}
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                </td>
                <td style={{ padding: '10px' }}>{p.product_code || '—'}</td>
                <td style={{ padding: '10px' }}>{p.aisle || '—'}</td>
                <td style={{ padding: '10px' }}>{p.rack || '—'}</td>
                <td style={{ padding: '10px' }}>{p.bin || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
