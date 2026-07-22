import React, { useEffect, useState } from 'react';
import { Package, Truck, CheckCircle, Clock, ExternalLink, Calendar, Hash, MapPin, Loader, FileText, RotateCcw, X, XCircle } from 'lucide-react';
import { formatDateTime } from '../utils/dateFormatter';
import { useUser } from '../context/UserContext';
import { fetchOrders, getInvoiceUrl, requestReturn } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import OrderTrackingModal from '../components/OrderTrackingModal';

const StatusIcon = ({ status }) => {
  switch(status?.toLowerCase()) {
    case 'completed': 
    case 'delivered': return <CheckCircle size={16} color="var(--success)" />;
    case 'shipped': return <Truck size={16} color="var(--primary-blue)" />;
    case 'pending': 
    case 'processing': return <Clock size={16} color="var(--warning)" />;
    default: return <Package size={16} />;
  }
};

const steps = [
  { id: 'pending', label: 'Placed', icon: Clock, desc: 'Your order has been received' },
  { id: 'processing', label: 'Processing', icon: Package, desc: 'We are preparing your items' },
  { id: 'shipped', label: 'Shipped', icon: Truck, desc: 'Your order is on the way' },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle, desc: 'Order has been delivered' }
];

const getStatusIndex = (status) => {
  const s = (status || 'pending').toLowerCase();
  if (s === 'delivered') return 3;
  if (s === 'shipped' || s === 'completed') return 2;
  if (['processing', 'received', 'picking', 'picked'].includes(s)) return 1;
  return 0;
};


const StatusBadge = ({ status, refundedAmount, hasPendingRefund }) => {
  const s = status ? status.toLowerCase() : 'unknown';

  const colors = {
    'completed': { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success)', label: 'Delivered' },
    'delivered': { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success)', label: 'Delivered' },
    'shipped': { bg: 'var(--info-bg)', text: 'var(--primary-blue)', border: 'var(--primary-blue)', label: 'Shipped' },
    'pending': { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning)', label: 'Processing' },
    'processing': { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning)', label: 'Processing' },
    'cancelled': { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger)', label: 'Cancelled' },
  };
  const style = colors[s] || { bg: 'var(--bg-surface-secondary)', text: 'var(--text-muted)', border: 'transparent', label: status };
  
  // Refund badge logic
  const showRefundBadge = (refundedAmount > 0 || hasPendingRefund) && (s === 'completed' || s === 'delivered');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        padding: '6px 14px', 
        borderRadius: '20px', 
        fontSize: '11px', 
        fontWeight: 800, 
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        background: style.bg, 
        color: style.text,
        border: `1px solid ${style.bg === 'var(--bg-surface-secondary)' ? 'transparent' : style.text}`
      }} className="status-badge-container">
        <StatusIcon status={style.label} />
        {style.label}
      </span>
      {showRefundBadge && (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 700,
          background: hasPendingRefund ? 'var(--warning-bg)' : 'var(--success-bg)',
          color: hasPendingRefund ? 'var(--warning)' : 'var(--success)',
          border: `1px solid ${hasPendingRefund ? 'var(--warning)' : 'var(--success)'}`,
          alignSelf: 'flex-start'
        }}>
          {hasPendingRefund ? '⏳ Pending Refund' : `✓ Refunded: GH₵ ${parseFloat(refundedAmount || 0).toFixed(2)}`}
        </span>
      )}
    </div>
  );
};

export default function Orders() {
  const { user } = useUser();
  const { formatPrice } = useSettings();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  
  // Return request modal state
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Cancel order modal state
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const openTracking = (id) => {
    setTrackingOrderId(id);
    setIsTrackingOpen(true);
  };

  const openReturnModal = (order) => {
    setReturnModalOrder(order);
    setSelectedReturnItems({});
    setReturnReason('');
  };

  const closeReturnModal = () => {
    setReturnModalOrder(null);
    setSelectedReturnItems({});
    setReturnReason('');
  };

  const openCancelModal = (order) => {
    setCancelModalOrder(order);
  };

  const closeCancelModal = () => {
    setCancelModalOrder(null);
  };

  const handleCancelOrder = async () => {
    if (!cancelModalOrder) return;

    setIsCancelling(true);
    try {
      let token;
      try {
        token = localStorage.getItem('token');
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          console.warn('Storage quota exceeded when getting token');
        }
      }
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/orders.php?order_id=${cancelModalOrder.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        alert('Order cancelled successfully');
        closeCancelModal();
        // Reload orders
        const ordersData = await fetchOrders(user.id);
        setOrders(ordersData);
      } else {
        alert(data.message || 'Failed to cancel order');
      }
    } catch {
      alert('An error occurred while cancelling the order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (!returnModalOrder) return;
    
    const itemsPayload = Object.keys(selectedReturnItems).map(pid => ({
      product_id: parseInt(pid, 10),
      quantity: selectedReturnItems[pid]
    })).filter(i => i.quantity > 0);

    if (itemsPayload.length === 0) {
      alert('Please select at least one item to return.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await requestReturn(returnModalOrder.id, itemsPayload, returnReason);
      if (res.success) {
        alert('Return request submitted successfully! Awaiting admin approval.');
        closeReturnModal();
      } else {
        alert(res.error || res.message || 'Failed to submit return request.');
      }
    } catch {
      alert('An error occurred while submitting your return request.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  useEffect(() => {
    const loadOrders = async () => {
      if (!user) {
          setLoading(false);
          return;
      }
      try {
        const data = await fetchOrders(user.id);
        setOrders(data);
      } catch {
        console.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [user]);

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'delivered');
  const pastOrders = orders.filter(o => o.status === 'completed' || o.status === 'delivered');

  const OrderCard = ({ order }) => {
    // Using shared utility for consistent date formatting
    const displayDate = (dateString) => formatDateTime(dateString, { dateStyle: 'medium', timeStyle: 'short' });

    return (
    <div className="order-item-card glass" style={{ 
      padding: '28px 16px', 
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'default',
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ flex: 1, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div style={{ background: 'var(--info-bg)', padding: '10px', borderRadius: '12px', color: 'var(--primary-blue)' }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '20px', letterSpacing: '-0.5px' }}>#{order.id}</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
              <Calendar size={14} /> {displayDate(order.created_at)}
            </div>
          </div>
        </div>
        
        <div style={{ paddingLeft: '46px' }}>
          <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
            {order.items ? order.items : `Order #${order.id}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '14px' }}>Total Amount:</span> {formatPrice(parseFloat(order.total_amount || 0))}
            </div>
            {order.status !== 'completed' && order.status !== 'delivered' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '6px 12px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
                color: 'var(--primary-blue)', 
                fontSize: '12px', 
                fontWeight: 700,
                borderRadius: '20px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <Truck size={14} className="animate-pulse" /> Live Tracking
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Stepper Timeline */}
      {order.status !== 'completed' && order.status !== 'delivered' && (
         <div className="card-timeline" style={{
           padding: '20px 12px 12px 12px',
           borderTop: '1px solid var(--border-light)',
           width: '100%',
           boxSizing: 'border-box',
           marginTop: '8px',
           background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.02) 0%, transparent 100%)'
         }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', marginBottom: '12px' }}>
              {/* Connector track */}
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '24px',
                right: '24px',
                height: '4px',
                background: 'var(--bg-surface-secondary)',
                zIndex: 1,
                borderRadius: '3px'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary-blue), #60a5fa)',
                  width: `${(getStatusIndex(order.status) / (steps.length - 1)) * 100}%`,
                  borderRadius: '3px',
                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 0 12px rgba(59, 130, 246, 0.6), inset 0 1px 2px rgba(255,255,255,0.3)'
                }}></div>
              </div>

              {steps.map((step, idx) => {
                 const stepIdx = getStatusIndex(order.status);
                 const isCompleted = idx <= stepIdx;
                 const isActive = idx === stepIdx;
                 const Icon = step.icon;

                 return (
                   <div key={step.id} style={{
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     position: 'relative',
                     zIndex: 2,
                     width: '70px'
                   }}>
                     <div 
                       className={`timeline-icon-container ${isActive ? 'active-pulse' : ''}`}
                       style={{
                         width: '40px',
                         height: '40px',
                         borderRadius: '12px',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         background: isCompleted 
                           ? 'linear-gradient(135deg, var(--primary-blue), #3b82f6)' 
                           : 'var(--bg-surface-secondary)',
                         color: isCompleted ? '#ffffff' : 'var(--text-muted)',
                         transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                         boxShadow: isCompleted 
                           ? '0 6px 16px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0,0,0,0.1)' 
                           : '0 2px 4px rgba(0,0,0,0.05)',
                         border: isActive ? '3px solid rgba(59, 130, 246, 0.3)' : 'none',
                         transform: isActive ? 'scale(1.1)' : 'scale(1)'
                       }}
                     >
                       <Icon size={18} />
                     </div>
                     <span 
                       className="timeline-label"
                       style={{
                         fontSize: '11px',
                         fontWeight: isActive ? '800' : '600',
                         color: isActive ? 'var(--primary-blue)' : (isCompleted ? 'var(--text-main)' : 'var(--text-muted)'),
                         marginTop: '8px',
                         textAlign: 'center',
                         whiteSpace: 'nowrap',
                         transition: 'all 0.3s ease',
                         letterSpacing: '0.3px'
                       }}
                     >
                       {step.label}
                     </span>
                     {isActive && (
                       <span style={{
                         fontSize: '9px',
                         fontWeight: 700,
                         color: 'var(--primary-blue)',
                         marginTop: '2px',
                         textTransform: 'uppercase',
                         letterSpacing: '0.5px',
                         animation: 'pulse-text 2s infinite'
                       }}>
                         Current
                       </span>
                     )}
                   </div>
                 );
              })}
           </div>
         </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px', width: '100%' }}>
        <StatusBadge
          status={order.status}
          refundedAmount={order.refunded_amount}
          hasPendingRefund={order.has_pending_refund}
        />
        {(order.status === 'completed' || order.status === 'delivered') && (
          <button
            onClick={() => openReturnModal(order)}
            className="btn-secondary"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              padding: '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'center',
              background: 'var(--warning-bg)',
              color: 'var(--warning)',
              border: '1px solid var(--warning)'
            }}
          >
            <RotateCcw size={14} /> Request Return
          </button>
        )}
        {(order.status === 'pending' || order.status === 'processing') && (
          <button
            onClick={() => openCancelModal(order)}
            className="btn-secondary"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              padding: '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'center',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)'
            }}
          >
            <XCircle size={14} /> Cancel Order
          </button>
        )}
        <button
          onClick={() => openTracking(order.id)}
          className="btn-secondary"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            padding: '10px 20px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            justifyContent: 'center'
          }}
        >
          Track Order <ExternalLink size={14} />
        </button>
        <a
          href={getInvoiceUrl(order.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            padding: '10px 20px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            justifyContent: 'center',
            textDecoration: 'none',
            color: 'var(--text-main)'
          }}
        >
          <FileText size={14} /> Receipt
        </a>
      </div>

      <div className="card-hover-bg" style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '4px', 
        height: '100%', 
        background: 'var(--primary-blue)', 
        opacity: 0, 
        transition: 'opacity 0.3s' 
      }}></div>
    </div>
    );
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader className="animate-spin" /> Loading orders...</div>;
  if (!user) return <div style={{ padding: '40px', textAlign: 'center' }}>Please log in to view orders.</div>;

  return (
    <div className="orders-page" style={{ width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ padding: '24px 0 8px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>Orders</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '4px' }}>Track shipment progress and view your past purchase history.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Active Orders Section */}
        {activeOrders.length > 0 && (
          <div className="orders-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary-blue)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}></div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Active Shipments</h2>
              <span style={{ padding: '2px 10px', background: 'var(--info-bg)', color: 'var(--primary-blue)', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>{activeOrders.length}</span>
            </div>
            <div className="orders-list-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr', 
              gap: '24px' 
            }}>
              {activeOrders.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          </div>
        )}

        {/* Order History Section */}
        <div className="orders-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.5 }}></div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Purchase History</h2>
          </div>
          {pastOrders.length === 0 && activeOrders.length === 0 ? (
             <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center', background: 'var(--bg-main)', borderRadius: '16px' }}>No orders found</div>
          ) : (
            <div className="orders-list-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr', 
                gap: '24px' 
            }}>
                {pastOrders.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </div>
      </div>

      <OrderTrackingModal 
        isOpen={isTrackingOpen}
        orderId={trackingOrderId}
        onClose={() => setIsTrackingOpen(false)}
      />

      {/* Return Request Modal */}
      {returnModalOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Request Return</h2>
              <button
                onClick={closeReturnModal}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-main)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>Order #{returnModalOrder.id}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {formatPrice(parseFloat(returnModalOrder.total_amount || 0))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                Select Items to Return
              </label>
              {returnModalOrder.items && Array.isArray(returnModalOrder.items) ? (
                returnModalOrder.items.map((item, idx) => {
                  const pid = item.product_id || item.id;
                  const maxQty = item.quantity || item.qty || 1;
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-main)', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.name || item.product_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max: {maxQty}</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={maxQty}
                        value={selectedReturnItems[pid] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setSelectedReturnItems(prev => ({
                            ...prev,
                            [pid]: isNaN(val) ? 0 : Math.min(maxQty, Math.max(0, val))
                          }));
                        }}
                        style={{ width: '70px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)', textAlign: 'center' }}
                      />
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No items found for this order.
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>
                Reason for Return
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Please explain why you want to return these items..."
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', minHeight: '80px', resize: 'vertical', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={closeReturnModal}
                disabled={isSubmittingReturn}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={isSubmittingReturn}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary-blue)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: isSubmittingReturn ? 0.7 : 1 }}
              >
                {isSubmittingReturn ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '100%',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Cancel Order</h2>
              <button
                onClick={closeCancelModal}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--danger-bg)', borderRadius: '8px', border: '1px solid var(--danger)' }}>
              <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>Order #{cancelModalOrder.id}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {formatPrice(parseFloat(cancelModalOrder.total_amount || 0))}
              </div>
            </div>

            <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to cancel this order? This action cannot be undone. If you have already paid, a refund will be processed.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={closeCancelModal}
                disabled={isCancelling}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-main)', fontWeight: 600, cursor: 'pointer' }}
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--danger)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: isCancelling ? 0.7 : 1 }}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1024px) {
          .orders-list-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        .order-item-card:hover {
          transform: translateY(-4px);
          border-color: var(--primary-blue) !important;
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
        }
        .order-item-card:hover .card-hover-bg {
          opacity: 1 !important;
        }
        .status-badge-container {
           border-color: transparent !important;
        }
        
        .active-pulse {
          position: relative;
        }
        .active-pulse::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 12px;
          border: 2px solid var(--primary-blue);
          animation: timeline-pulse 1.8s infinite cubic-bezier(0.4, 0, 0.6, 1);
          pointer-events: none;
        }
        @keyframes timeline-pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          70% {
            transform: scale(1.15);
            opacity: 0;
            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
          }
          100% {
            transform: scale(0.95);
            opacity: 0;
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        @keyframes pulse-text {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @media (max-width: 480px) {
          .card-timeline {
            padding: 12px 0px 4px 0px !important;
          }
          .timeline-label {
            font-size: 9px !important;
            letter-spacing: -0.3px;
          }
          .timeline-icon-container {
            width: 28px !important;
            height: 28px !important;
            border-radius: 8px !important;
          }
          .timeline-icon-container svg {
            width: 12px !important;
            height: 12px !important;
          }
          .timeline-label {
            font-size: 8px !important;
          }
        }
      `}} />
    </div>
  );
}
