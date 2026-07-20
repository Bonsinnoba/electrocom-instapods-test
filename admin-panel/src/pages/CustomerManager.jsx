import React, { useState, useEffect } from 'react';
import { Search, X, ShieldAlert, ShieldCheck, Edit2, Filter, List, Map as MapIcon, Lock, Eye, Save } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
}

import { fetchCustomers, toggleUserStatus } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { formatPrice } from '../utils/formatPrice';


export default function CustomerManager() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', status: 'Active', orders: 0, totalSpent: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const { addToast } = useNotifications();

  
  const user = JSON.parse(localStorage.getItem('ehub_user') || '{}');
  const isAccountant = user.role === 'accountant';
  const isMarketing = user.role === 'marketing';

  useEffect(() => {
    if (!isMarketing) {
      loadCustomers();
    }
  }, []);

  if (isMarketing) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Access Denied</h1>
        <p style={{ color: 'var(--text-muted)' }}>Marketing roles do not have permission to view the global customer database for privacy reasons.</p>
      </div>
    );
  }

  const loadCustomers = async () => {
    setLoading(true);
    try {
        const data = await fetchCustomers();
        const mapped = data.map(c => ({
            ...c,
            orders: parseInt(c.orders_count || 0),
            totalSpent: parseFloat(c.total_spent || 0),
            status: c.status || 'Active', 
            lat: 5.6037, // Default to Accra, Ghana for marker
            lng: -0.1870,
            location: c.address || 'Accra, Ghana'
        }));
        setCustomers(mapped);
    } catch (error) {
        console.error("Failed to load customers", error);
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', email: '', status: 'Active', orders: 0, totalSpent: 0 });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // For now we don't have a create/update user API in admin_customers.php
    // as users usually register themselves.
    addToast("User editing is disabled for security. Users manage their own profiles.", "info");

    handleCloseModal();
  };

  // ── SUPER-USER ONLY: account deletion is restricted ──────────────────────
  // Admins cannot delete users. Navigate to the Super User Panel to do so.

  const handleToggleSuspension = async (customer) => {
    try {
        await toggleUserStatus(customer.id, customer.status || 'Active');
        loadCustomers();
    } catch (error) {
        addToast("Failed to update user status", "error");

    }
  };



  // Filter customers by search query
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesFilter = filterStatus === 'All';
    if (filterStatus !== 'All') {
        matchesFilter = customer.status === filterStatus;
    }
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>

      {/* ── Super-User restriction notice ──────────────────────────────────── */}
      <div style={{
        padding: '12px 18px',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: '#94a3b8'
      }}>
        <Lock size={15} color="#fbbf24" style={{ flexShrink: 0 }} />
        <span>
          <strong style={{ color: '#fbbf24' }}>Role changes & account deletions</strong> are restricted to the
          <strong style={{ color: 'var(--text-main)' }}> Super User Panel</strong>. Admins may only view and suspend/activate accounts.
        </span>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Customers</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and moderate customer accounts.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'var(--bg-surface-secondary)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
            <button 
              onClick={() => setViewMode('list')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === 'list' ? 'var(--bg-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: viewMode === 'list' ? 600 : 400,
                boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <List size={16} /> List
            </button>
            <button 
              onClick={() => setViewMode('map')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === 'map' ? 'var(--bg-surface)' : 'transparent',
                color: viewMode === 'map' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: viewMode === 'map' ? 600 : 400,
                boxShadow: viewMode === 'map' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <MapIcon size={16} /> Map
            </button>
          </div>
          {/* Add customer is a Super User privilege — removed from admin view */}
        </div>
      </header>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 40px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="btn" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: filterStatus !== 'All' ? 'var(--primary-blue)' : 'var(--bg-surface-secondary)',
                color: filterStatus !== 'All' ? 'white' : 'var(--text-main)'
              }}
            >
              <Filter size={18} /> {filterStatus !== 'All' ? filterStatus : 'Filters'}
            </button>
            {showFilterMenu && (
              <>
                <div 
                  onClick={() => setShowFilterMenu(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  padding: '8px',
                  minWidth: '180px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                  zIndex: 100
                }}>
                  {['All', 'Active', 'Suspended', 'VIP', 'New'].map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setFilterStatus(status);
                        setShowFilterMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        textAlign: 'left',
                        background: filterStatus === status ? 'var(--primary-blue)' : 'transparent',
                        color: filterStatus === status ? 'white' : 'var(--text-main)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: filterStatus === status ? 600 : 400,
                        transition: 'all 0.2s',
                        marginBottom: '4px'
                      }}
                      onMouseEnter={(e) => {
                        if (filterStatus !== status) {
                          e.currentTarget.style.background = 'var(--bg-surface-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (filterStatus !== status) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {viewMode === 'list' ? (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 24px' }}>Customer</th>
                <th style={{ padding: '16px 24px' }}>Orders</th>
                <th style={{ padding: '16px 24px' }}>Total Spent</th>
                <th style={{ padding: '16px 24px' }}>Status</th>
              <th style={{ padding: '16px 24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)', fontSize: '14px' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: c.status === 'Suspended' ? 'var(--danger)' : 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {c.name.charAt(0)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.email}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>{c.orders}</td>
                  <td style={{ padding: '16px 24px', fontWeight: 700 }}>{formatPrice(c.totalSpent)}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '100px', 
                      fontSize: '11px', 
                      fontWeight: 700,
                      background: c.status === 'VIP' ? 'var(--purple-bg)' : 
                                  c.status === 'Active' ? 'var(--success-bg)' : 
                                  c.status === 'Suspended' ? 'var(--danger-bg)' : 'rgba(100, 116, 139, 0.1)',
                      color: c.status === 'VIP' ? '#a78bfa' : 
                             c.status === 'Active' ? 'var(--success)' : 
                             c.status === 'Suspended' ? 'var(--danger)' : 'var(--text-muted)'
                    }}>
                      {c.status}
                    </span>
                  </td>

                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Suspend / Activate — allowed for admins */}
                      <button
                        className="btn"
                        onClick={() => !isAccountant && handleToggleSuspension(c)}
                        disabled={isAccountant}
                        title={isAccountant ? "Accountants cannot moderate users" : (c.status === 'Suspended' ? 'Activate Account' : 'Suspend Account')}
                        style={{ 
                          padding: '8px', 
                          color: c.status === 'Suspended' ? 'var(--success)' : 'var(--warning)', 
                          background: c.status === 'Suspended' ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)', 
                          borderRadius: '8px',
                          opacity: isAccountant ? 0.6 : 1,
                          cursor: isAccountant ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {c.status === 'Suspended' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                      </button>
                      {/* Role change + Delete — Super User only, shown as locked */}
                      <span title="Role changes restricted to Super User Panel" style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#fbbf24', fontWeight: 700, cursor: 'not-allowed', opacity: 0.7 }}>
                        <Lock size={12} /> Super User
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div style={{ height: '500px', width: '100%', borderRadius: '0 0 16px 16px', overflow: 'hidden', zIndex: 0 }}>
            <MapContainer center={[30, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              {filteredCustomers.filter(c => c.lat && c.lng).map(c => (
                <Marker key={c.id} position={[c.lat, c.lng]}>
                  <Popup>
                    <div style={{ padding: '8px', minWidth: '160px' }}>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{c.name}</h3>
                      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>{c.location}</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                        <span style={{ color: '#64748b' }}>Orders:</span>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.orders}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                        <span style={{ color: '#64748b' }}>Spent:</span>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatPrice(c.totalSpent)}</span>
                      </div>

                      <div style={{ 
                        display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: c.status === 'Active' ? '#dcfce7' : c.status === 'VIP' ? '#f3e8ff' : '#f3f4f6', 
                        color: c.status === 'Active' ? '#166534' : c.status === 'VIP' ? '#7e22ce' : '#374151' 
                      }}>
                        {c.status}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="card glass" style={{ width: '100%', maxWidth: '500px', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: 800 }}>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Email Address</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                  >
                    <option value="Active">Active</option>
                    <option value="New">New</option>
                    <option value="VIP">VIP</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Orders Count</label>
                  <input 
                    type="number" 
                    value={formData.orders}
                    onChange={(e) => setFormData({ ...formData, orders: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)', color: 'var(--text-main)', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px' }}>
                  <Save size={20} /> {editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
