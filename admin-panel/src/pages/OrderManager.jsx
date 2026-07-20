import React, { useState, useEffect } from 'react';
import { Eye, Truck, CheckCircle, Clock, X, MapPin, User, Package, Calendar, Mail, ShieldCheck, RotateCcw, AlertTriangle, Download, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchOrders, updateOrderStatus, updatePickerOrderStage, resendReceipt, verifyDelivery, reportPickerMissingItems, API_BASE_URL, fetchBatch } from '../services/api';
import { useConfirm } from '../context/ConfirmContext';
import { formatPrice } from '../utils/formatPrice';

export default function OrderManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [liveStats, setLiveStats] = useState({ review: 0, shipped: 0, deliveredToday: 0 });
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [reportingMissing, setReportingMissing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('ehub_user') || '{}');
  const isAccountant = user.role === 'accountant';
  const isMarketing = user.role === 'marketing';
  const isPicker = user.role === 'picker';
  const canUsePickerWorkflow = ['picker', 'super', 'store_manager'].includes(user.role);

  const getPickLocation = (item) => {
    const aisle = String(item?.aisle || '').trim();
    const rack = String(item?.rack || '').trim();
    const bin = String(item?.bin || '').trim();
    const location = String(item?.location || '').trim();

    if (aisle || rack || bin) {
      const parts = [];
      if (aisle) parts.push(`Aisle ${aisle}`);
      if (rack) parts.push(`Rack ${rack}`);
      if (bin) parts.push(`Bin ${bin}`);
      return parts.join(' • ');
    }
    if (location) {
      return `Shelf ${location}`;
    }
    return '';
  };

  const normalizeSortToken = (value) => {
    const v = String(value || '').trim();
    if (!v) return 'ZZZZZZ';
    const m = v.match(/^([A-Za-z]+)?(\d+)?(.*)$/);
    if (!m) return v.toUpperCase();
    const alpha = (m[1] || '').toUpperCase();
    const num = m[2] ? String(m[2]).padStart(6, '0') : '999999';
    const rest = (m[3] || '').toUpperCase();
    return `${alpha}|${num}|${rest}`;
  };

  const getSortedItems = (items = []) => {
    return [...items].sort((a, b) => {
      const aHasStruct = !!(String(a?.aisle || '').trim() || String(a?.rack || '').trim() || String(a?.bin || '').trim());
      const bHasStruct = !!(String(b?.aisle || '').trim() || String(b?.rack || '').trim() || String(b?.bin || '').trim());
      if (aHasStruct !== bHasStruct) return aHasStruct ? -1 : 1;

      const aHasAnyLoc = !!(getPickLocation(a));
      const bHasAnyLoc = !!(getPickLocation(b));
      if (aHasAnyLoc !== bHasAnyLoc) return aHasAnyLoc ? -1 : 1;

      const aKey = [
        normalizeSortToken(a?.aisle),
        normalizeSortToken(a?.rack),
        normalizeSortToken(a?.bin),
        normalizeSortToken(a?.location),
        String(a?.name || '').toUpperCase(),
      ].join('||');
      const bKey = [
        normalizeSortToken(b?.aisle),
        normalizeSortToken(b?.rack),
        normalizeSortToken(b?.bin),
        normalizeSortToken(b?.location),
        String(b?.name || '').toUpperCase(),
      ].join('||');
      return aKey.localeCompare(bKey);
    });
  };

  useEffect(() => {
    if (isMarketing) return;

    let isMounted = true;

    const fetchAndProcess = async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        const data = await fetchBatch(['orders']);
        if (!isMounted) return;
        setOrders(data.orders || []);

        // Compute live stat card values
        const today = new Date().toDateString();
        const orders = data.orders || [];
        setLiveStats({
          review: orders.filter(o => o.status === 'Pending' || o.status === 'pending').length,
          shipped: orders.filter(o => o.status === 'Shipped' || o.status === 'shipped').length,
          deliveredToday: orders.filter(o =>
            (o.status === 'Delivered' || o.status === 'delivered') &&
            new Date(o.date).toDateString() === today
          ).length
        });
      } catch (error) {
        console.error("Failed to load orders", error);
      } finally {
        if (isInitial) setLoading(false);
      }
    };

    fetchAndProcess(true);
    const intervalId = setInterval(() => fetchAndProcess(false), 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isMarketing]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
        await updateOrderStatus(id, newStatus);
        // Optimistically update the selected order panel; interval will sync the table
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
    } catch (error) {
        alert("Failed to update status");
    }
  };

  const handleVerifyDelivery = async () => {
    if (!otp) return alert('Please enter the delivery code');
    setVerifying(true);
    try {
      const res = await verifyDelivery(selectedOrder.id, otp);
      if (res.success) {
        alert(res.message);
        setOtp('');
        // Reload orders or update local state
        if (selectedOrder) {
          setSelectedOrder({ ...selectedOrder, status: 'Delivered' });
        }
      } else {
        alert(res.error);
      }
    } catch (err) {
      alert('Connection error');
    } finally {
      setVerifying(false);
    }
  };

  const handlePickerStage = async (id, stage) => {
    try {
      const res = await updatePickerOrderStage(id, stage);
      if (!res.success) {
        alert(res.error || 'Failed to update picker stage');
        return;
      }
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder({ ...selectedOrder, status: res.status || selectedOrder.status });
      }
    } catch (error) {
      alert('Failed to update picker stage');
    }
  };

  const handleReportMissingItem = async (item) => {
    if (!selectedOrder?.id) return;
    const maxQty = Math.max(1, Number(item.qty || 1));
    const qtyInput = window.prompt(`How many units are missing for "${item.name}"? (1-${maxQty})`, '1');
    if (qtyInput === null) return;
    const qtyMissing = Math.max(1, Math.min(maxQty, parseInt(String(qtyInput), 10) || 1));
    const reason = window.prompt(`Why is "${item.name}" missing?`, 'Not found on shelf');
    if (reason === null) return;
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) {
      alert('Please provide a reason before reporting.');
      return;
    }

    setReportingMissing(true);
    try {
      const res = await reportPickerMissingItems(selectedOrder.id, [{
        product_id: item.product_id,
        name: item.name,
        qty: qtyMissing,
        reason: cleanReason,
      }]);
      if (!res.success) {
        alert(res.error || 'Failed to report missing item');
        return;
      }
      alert('Missing item reported. Admin team has been notified.');
    } catch (error) {
      alert('Failed to report missing item');
    } finally {
      setReportingMissing(false);
    }
  };


  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      String(o.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(o.customer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(o.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || 
      String(o.status || '').toLowerCase() === statusFilter.toLowerCase();
      
    const matchesType = typeFilter === 'all' || 
      String(o.type || '').toLowerCase() === typeFilter.toLowerCase();
      
    let matchesDate = true;
    if (startDate || endDate) {
      const orderDate = new Date(o.date);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) matchesDate = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  const exportOrdersCSV = () => {
    let csvRows = [];
    
    // Header
    csvRows.push("ELECTRCOM DETAILED SALES AUDIT TRAIL");
    csvRows.push(`Exported On,${new Date().toLocaleString()}`);
    csvRows.push("");
    
    // Table Headers
    csvRows.push("Order ID,Date,Customer Name,Customer Email,Fulfillment Type,Status,Total Amount (GHS),Product Name,SKU,Quantity,Purchase Price (GHS),Item Subtotal (GHS)");
    
    filteredOrders.forEach(o => {
      const formattedDate = o.date;
      const customer = (o.customer || 'Walk-in').replace(/"/g, '""');
      const email = (o.email || '').replace(/"/g, '""');
      const type = o.type;
      const status = o.status;
      const totalAmount = o.amount;
      
      if (Array.isArray(o.items) && o.items.length > 0) {
        o.items.forEach(item => {
          const prodName = (item.name || '').replace(/"/g, '""');
          const sku = item.product_code || '—';
          const qty = item.qty || 0;
          const price = item.price || 0;
          const subtotal = qty * price;
          
          csvRows.push(`${o.id},${formattedDate},"${customer}","${email}",${type},${status},${totalAmount},"${prodName}",${sku},${qty},${price},${subtotal}`);
        });
      } else {
        csvRows.push(`${o.id},${formattedDate},"${customer}","${email}",${type},${status},${totalAmount},—,—,0,0,0`);
      }
    });
    
    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `electrcom_sales_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isMarketing) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Access Denied</h1>
        <p style={{ color: 'var(--text-muted)' }}>Marketing roles do not have permission to view or manage customer orders.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Orders</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track and fulfill customer orders.</p>
        </div>
        {!isPicker && (
          <button 
            onClick={exportOrdersCSV} 
            className="btn glass" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}
          >
            <Download size={16} /> EXPORT AUDIT TRAIL
          </button>
        )}
      </header>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '8px' }}>
        <div className="card glass" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
          <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderRadius: '10px' }}><Clock size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>In Review</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{liveStats.review}</div>
          </div>
        </div>
        <div className="card glass" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
          <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '10px' }}><Truck size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Shipments</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{liveStats.shipped}</div>
          </div>
        </div>
        <div className="card glass" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px' }}>
          <div style={{ padding: '10px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '10px' }}><CheckCircle size={20} /></div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Completed today</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{liveStats.deliveredToday}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="card glass" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', background: 'var(--bg-surface-secondary)' }}>
        {/* Search */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by ID, customer name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ width: '100%', paddingLeft: '36px', height: '40px', fontSize: '14px' }}
          />
        </div>
        
        {/* Status Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
            style={{ height: '40px', padding: '0 12px', minWidth: '130px', fontSize: '14px' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</label>
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field"
            style={{ height: '40px', padding: '0 12px', minWidth: '120px', fontSize: '14px' }}
          >
            <option value="all">All Types</option>
            <option value="delivery">Delivery</option>
            <option value="pick up">Pick Up</option>
          </select>
        </div>

        {/* Start Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>From Date</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field"
            style={{ height: '40px', padding: '0 12px', fontSize: '14px' }}
          />
        </div>

        {/* End Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>To Date</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field"
            style={{ height: '40px', padding: '0 12px', fontSize: '14px' }}
          />
        </div>

        {/* Clear Filters Button */}
        {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || startDate || endDate) && (
          <button 
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
              setStartDate('');
              setEndDate('');
            }}
            className="btn"
            style={{ height: '40px', padding: '0 16px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', marginTop: '20px' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '16px 24px' }}>Order ID</th>
              <th style={{ padding: '16px 24px' }}>Customer</th>
              <th style={{ padding: '16px 24px' }}>Date</th>
              <th style={{ padding: '16px 24px' }}>Amount</th>
              <th style={{ padding: '16px 24px' }}>Type</th>
              <th style={{ padding: '16px 24px' }}>Status</th>
              <th style={{ padding: '16px 24px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o, idx) => (
              <tr 
                key={o.id} 
                className="animate-fade-in"
                style={{ 
                  borderBottom: '1px solid var(--border-light)', 
                  fontSize: '14px',
                  animationDelay: `${idx * 0.05}s`,
                  animationFillMode: 'both'
                }}
              >
                <td style={{ padding: '16px 24px', fontWeight: 700, color: 'var(--accent-blue)' }}>{o.id}</td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{o.customer}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.email}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>{o.date}</td>
                <td style={{ padding: '16px 24px', fontWeight: 700 }}>{formatPrice(o.amount)}</td>
                <td style={{ padding: '16px 24px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {o.type === 'Delivery' ? <Truck size={14} /> : <MapPin size={14} />} {o.type}
                  </span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '100px', 
                      fontSize: '11px', 
                      fontWeight: 700,
                      background: o.status.toLowerCase() === 'delivered' ? 'var(--success-bg)' : 
                                 o.status.toLowerCase() === 'shipped' ? 'var(--info-bg)' : 
                                 o.status.toLowerCase() === 'cancelled' ? 'var(--bg-surface-secondary)' : 'var(--warning-bg)',
                      color: o.status.toLowerCase() === 'delivered' ? 'var(--success)' : 
                             o.status.toLowerCase() === 'shipped' ? 'var(--accent-blue)' : 
                             o.status.toLowerCase() === 'cancelled' ? 'var(--text-muted)' : 'var(--warning)'
                    }}>
                      {o.status}
                    </span>
                    {o.review_requested_at && (
                      <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={10} /> Review Sent
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <button onClick={() => setSelectedOrder(o)} className="btn" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--bg-surface-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={14} /> Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: '450px',
          height: '100%',
          zIndex: 2000,
          background: 'var(--bg-surface)',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-light)'
        }} className="glass animate-slide-in">
          <header style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Order Details</h2>
                <span style={{ fontSize: '12px', color: 'var(--primary-blue)', fontWeight: 700 }}>{selectedOrder.id}</span>
              </div>
              {!isPicker && (
                <>
                  <button 
                    onClick={() => {
                      const token = localStorage.getItem('ehub_token');
                      window.open(`${API_BASE_URL}/invoice.php?order_id=${selectedOrder.id.replace('ORD-', '')}${token ? `&token=${encodeURIComponent(token)}` : ''}`, '_blank');
                    }}
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🖨️ Print Invoice
                  </button>
                  <button 
                    onClick={async () => {
                      if(await confirm('Resend receipt to customer?')) {
                        const res = await resendReceipt(selectedOrder.id);
                        if(res.success) alert('Receipt re-sent!');
                        else alert('Failed: ' + res.error);
                      }
                    }}
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--bg-surface-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Mail size={14} /> Resend E-Receipt
                  </button>
                </>
              )}
            </div>
            <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} /> Customer Info
              </h3>
              <div className="card" style={{ background: 'var(--bg-surface-secondary)', border: 'none' }}>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{selectedOrder.customer}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{selectedOrder.email}</div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <MapPin size={16} style={{ flexShrink: 0 }} /> {selectedOrder.address}
                </div>
                {selectedOrder.user_region && (
                   <div style={{ marginTop: '12px', display: 'flex', gap: '8px', color: 'var(--accent-blue)', fontSize: '13px', fontWeight: 600 }}>
                     <ShieldCheck size={16} style={{ flexShrink: 0 }} /> Region: {selectedOrder.user_region}
                   </div>
                )}
                {selectedOrder.review_requested_at && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--success-bg)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>
                       <CheckCircle size={14} /> Review request sent on {new Date(selectedOrder.review_requested_at).toLocaleDateString()}
                    </div>
                )}
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={16} /> Order Items
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {getSortedItems(selectedOrder.items || []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '10px', background: 'var(--bg-surface-secondary)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</div>
                      {item.product_code && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, marginTop: '3px' }}>
                          SKU: {item.product_code}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Qty: {item.qty}</span>
                        {getPickLocation(item) ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary-blue)', background: 'rgba(59, 130, 246, 0.12)', padding: '2px 7px', borderRadius: '4px' }}>
                            {getPickLocation(item)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 7px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={10} /> Location not assigned
                          </span>
                        )}
                        {canUsePickerWorkflow && (
                          <button
                            type="button"
                            onClick={() => handleReportMissingItem(item)}
                            disabled={reportingMissing}
                            style={{
                              border: '1px solid rgba(245, 158, 11, 0.45)',
                              background: 'rgba(245, 158, 11, 0.14)',
                              color: 'var(--warning)',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              cursor: reportingMissing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Report missing
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800 }}>{formatPrice(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', padding: '16px', borderTop: '2px dashed var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Total Amount</span>
                <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary-blue)' }}>{formatPrice(selectedOrder.amount)}</span>
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} /> Fulfillment Status
              </h3>
              

              {canUsePickerWorkflow ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <button
                    onClick={() => handlePickerStage(selectedOrder.id, 'received')}
                    className="btn"
                    style={{ background: 'var(--warning-bg)', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    <Clock size={14} /> Mark Order Received
                  </button>
                  <button
                    onClick={() => handlePickerStage(selectedOrder.id, 'picked')}
                    className="btn"
                    style={{ background: 'var(--info-bg)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    <Package size={14} /> Mark Items Picked
                  </button>
                  <button
                    onClick={() => handlePickerStage(selectedOrder.id, 'dispatched')}
                    className="btn"
                    style={{ background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    <Truck size={14} /> Mark Dispatched
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Shipped')}
                    disabled={selectedOrder.status.toLowerCase() === 'shipped' || isAccountant}
                    className="btn" 
                    style={{ 
                      background: 'var(--info-bg)', 
                      color: 'var(--accent-blue)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      justifyContent: 'center',
                      opacity: isAccountant ? 0.6 : 1,
                      cursor: isAccountant ? 'not-allowed' : 'pointer'
                    }}
                    title={isAccountant ? "Accounting role cannot update order status" : ""}
                  >
                    <Truck size={14} /> Mark Shipped
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'Delivered')}
                    disabled={selectedOrder.status.toLowerCase() === 'delivered' || isAccountant}
                    className="btn" 
                    style={{ 
                      background: 'var(--success-bg)', 
                      color: 'var(--success)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      justifyContent: 'center',
                      opacity: isAccountant ? 0.6 : 1,
                      cursor: isAccountant ? 'not-allowed' : 'pointer'
                    }}
                    title={isAccountant ? "Accounting role cannot update order status" : ""}
                  >
                    <CheckCircle size={14} /> Mark Delivered
                  </button>
                </div>
              )}
              
              {selectedOrder.status.toLowerCase() === 'delivered' && !isMarketing && !isAccountant && !isPicker && (
                <button 
                  onClick={() => navigate(`/returns?orderId=${selectedOrder.id}`)}
                  className="btn" 
                  style={{ 
                    marginTop: '12px',
                    width: '100%',
                    background: 'rgba(var(--primary-blue-rgb), 0.1)', 
                    color: 'var(--primary-blue)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    justifyContent: 'center',
                    padding: '12px',
                    fontWeight: 700
                  }}
                >
                  <RotateCcw size={16} /> Process Return Items
                </button>
              )}
            </section>

            {selectedOrder.status.toLowerCase() === 'shipped' && !isPicker && (
              <section className="animate-fade-in">
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Delivery Verification
                </h3>
                <div className="card" style={{ 
                  padding: '20px', 
                  background: 'rgba(234, 179, 8, 0.05)', 
                  border: '1px solid var(--warning)',
                  borderRadius: '12px'
                }}>
                   <div style={{ display: 'flex', gap: '10px' }}>
                     <input 
                       type="text" 
                       placeholder="Enter 6-digit Code" 
                       value={otp}
                       onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                       className="input-field"
                       style={{ flex: 1, padding: '12px', fontSize: '16px', fontWeight: 800, textAlign: 'center', letterSpacing: '4px', background: 'var(--bg-surface)' }}
                     />
                     <button 
                       onClick={handleVerifyDelivery}
                       disabled={verifying}
                       className="btn"
                       style={{ padding: '0 24px', fontSize: '14px', fontWeight: 700, background: 'var(--primary-blue)', color: 'white' }}
                     >
                       {verifying ? 'Verifying...' : 'Verify & Complete'}
                     </button>
                   </div>
                   <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: '1.4' }}>
                     The customer received this unique code via email and SMS. Verification is required to finalize delivery.
                   </p>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
