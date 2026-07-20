import React, { useState, useEffect } from 'react';
import { Tag, Plus, Search, Edit2, Trash2, X, CheckCircle, Copy } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';

import { API_BASE_URL } from '../services/api';

export default function CouponManager() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useNotifications();
  const { confirm } = useConfirm();
  
  const [formData, setFormData] = useState({
    id: null,
    code: '',
    discount_type: 'percent',
    discount_value: '',
    min_spend: '0.00',
    max_uses: '',
    valid_until: '',
    is_active: 1
  });

  const fetchCoupons = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/coupons.php`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ehub_token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setCoupons(data.data);
      } else {
         addToast(data.error || 'Failed to fetch coupons', 'error');
      }
    } catch (error) {
      console.error(error);
      addToast('Error fetching coupons', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleOpenModal = (coupon = null) => {
    if (coupon) {
      setFormData({
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        min_spend: coupon.min_spend,
        max_uses: coupon.max_uses === null ? '' : coupon.max_uses,
        valid_until: coupon.valid_until ? coupon.valid_until.replace(' ', 'T').slice(0, 16) : '',
        is_active: parseInt(coupon.is_active)
      });
    } else {
      setFormData({
        id: null, code: '', discount_type: 'percent', discount_value: '',
        min_spend: '0.00', max_uses: '', valid_until: '', is_active: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dbFormatValidUntil = formData.valid_until ? formData.valid_until.replace('T', ' ') + ':00' : null;
      
      const response = await fetch(`${API_BASE_URL}/coupons.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ehub_token')}`
        },
        body: JSON.stringify({ ...formData, valid_until: dbFormatValidUntil })
      });
      
      const data = await response.json();
      if (data.success) {
        addToast(`Coupon ${formData.id ? 'updated' : 'created'} successfully`, 'success');
        setIsModalOpen(false);
        fetchCoupons();
      } else {
        addToast(data.error || 'Failed to save coupon', 'error');
      }
    } catch (error) {
       addToast('Error connecting to server', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Are you sure you want to delete this coupon?"))) return;
    try {
      const response = await fetch(`${API_BASE_URL}/coupons.php`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ehub_token')}`
        },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        addToast('Coupon deleted', 'success');
        fetchCoupons();
      } else {
        addToast(data.error || 'Failed to delete coupon', 'error');
      }
    } catch (error) {
      addToast('Error deleting coupon', 'error');
    }
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ padding: '0 0 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
           <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Tag size={32} color="var(--primary-blue)" /> Discount Coupons
           </h1>
           <p style={{ margin: 0, color: 'var(--text-muted)' }}>Manage promo codes and discounts</p>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Create Coupon
        </button>
      </div>

      <div style={{ padding: '24px', background: 'var(--bg-main)', borderRadius: '16px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
         <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search coupons..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', outline: 'none', color: 'var(--text-main)', fontSize: '14px' }}
            />
         </div>
      </div>

      <div style={{ background: 'var(--bg-main)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
         <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
               <thead>
                  <tr style={{ background: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                     <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Promo Code</th>
                     <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discount</th>
                     <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                     <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Uses</th>
                     <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Valid Until</th>
                     <th style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredCoupons.map((coupon) => (
                      <tr key={coupon.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                         <td style={{ padding: '16px 20px' }}>
                             <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-blue)', borderRadius: '8px', fontWeight: 700, fontSize: '14px', letterSpacing: '1px' }}>
                                 {coupon.code}
                                 <Copy size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => {
                                     navigator.clipboard.writeText(coupon.code);
                                     addToast('Copied to clipboard', 'info');
                                 }} />
                             </div>
                         </td>
                         <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                            {coupon.discount_type === 'percent' ? `${parseFloat(coupon.discount_value)}% OFF` : `GH₵ ${parseFloat(coupon.discount_value).toFixed(2)} OFF`}
                         </td>
                         <td style={{ padding: '16px 20px' }}>
                             {parseInt(coupon.is_active) === 1 && (!coupon.valid_until || new Date(coupon.valid_until) > new Date()) ? (
                                <span style={{ padding: '4px 10px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>Active</span>
                             ) : (
                                <span style={{ padding: '4px 10px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '100px', fontSize: '12px', fontWeight: 700 }}>Inactive/Expired</span>
                             )}
                         </td>
                         <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            {coupon.current_uses} / {coupon.max_uses === null ? '∞' : coupon.max_uses}
                         </td>
                         <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            {coupon.valid_until ? new Date(coupon.valid_until).toLocaleString() : 'Permanent'}
                         </td>
                         <td style={{ padding: '16px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                             <button className="btn-outline" onClick={() => handleOpenModal(coupon)} style={{ padding: '6px' }} title="Edit"><Edit2 size={16} /></button>
                             <button className="btn-outline" onClick={() => handleDelete(coupon.id)} style={{ padding: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Delete"><Trash2 size={16} /></button>
                         </td>
                      </tr>
                  ))}
                  {filteredCoupons.length === 0 && !loading && (
                      <tr>
                         <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No discount codes found.
                         </td>
                      </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content glass animate-scale-in" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-main)', borderRadius: '24px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                 <div>
                   <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Code *</label>
                   <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)', textTransform: 'uppercase' }} placeholder="SUMMER2024" />
                 </div>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                   <div>
                     <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Discount Type</label>
                     <select value={formData.discount_type} onChange={e => setFormData({...formData, discount_type: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)', appearance: 'auto' }}>
                       <option value="percent">Percentage (%)</option>
                       <option value="fixed">Fixed Amount</option>
                     </select>
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Discount Value *</label>
                     <input required type="number" step="0.01" value={formData.discount_value} onChange={e => setFormData({...formData, discount_value: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)' }} placeholder="e.g. 15" />
                   </div>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                   <div>
                     <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Min Spend (Optional)</label>
                     <input type="number" step="0.01" value={formData.min_spend} onChange={e => setFormData({...formData, min_spend: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)' }} placeholder="0.00" />
                   </div>
                   <div>
                     <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Max Uses (Optional)</label>
                     <input type="number" value={formData.max_uses} onChange={e => setFormData({...formData, max_uses: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)' }} placeholder="Unlimited" />
                   </div>
                 </div>

                 <div>
                   <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Valid Until (Optional)</label>
                   <input type="datetime-local" value={formData.valid_until} onChange={e => setFormData({...formData, valid_until: e.target.value})} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', outline: 'none', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-main)', colorScheme: 'dark' }} />
                 </div>
                 
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                   <input type="checkbox" id="couponActive" checked={formData.is_active === 1} onChange={e => setFormData({...formData, is_active: e.target.checked ? 1 : 0})} style={{ width: '18px', height: '18px', accentColor: 'var(--primary-blue)' }} />
                   <label htmlFor="couponActive" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Coupon is Active</label>
                 </div>
               </div>
               
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
                 <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                 <button type="submit" className="btn-primary">Save Coupon</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
